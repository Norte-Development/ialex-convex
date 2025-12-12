import { useSmoothText } from "@convex-dev/agent/react";
import { cn } from "@/lib/utils";
import { Message, MessageContent, MessageAvatar } from "../ai-elements/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "../ai-elements/reasoning";
import { Sources, SourcesTrigger, SourcesContent, Source } from "../ai-elements/source";
import { Actions, Action } from "../ai-elements/actions";
import { Copy, ThumbsUp, ThumbsDown } from "lucide-react";
import { Tool } from "../ai-elements/tool";
import { MessageText } from "../ai-elements/message-text";
import type { SidebarMessageProps } from "./types/message-types";
import { CitationModal } from "./citation-modal";
import { useState, useEffect } from "react";
import { ToolUIPart } from "ai";

/** Citation extracted from tool outputs */
interface ToolCitation {
  id: string;
  type: string;
  title: string;
  url?: string;
}

/**
 * Extracts citations from tool outputs in message parts.
 * Looks for tool parts with output.type === 'json' and output.value.citations
 */
function extractCitationsFromToolOutputs(parts: unknown[]): ToolCitation[] {
  const citations: ToolCitation[] = [];
  
  console.group("🔍 [Citations] Extracting citations from tool outputs (SidebarMessage)");
  console.log("Total parts to check:", parts.length);
  
  for (const part of parts) {
    const p = part as { type?: string; state?: string; output?: { type?: string; value?: { citations?: unknown[] } } };
    if (!p.type?.startsWith("tool-")) continue;
    if (p.state !== "output-available") continue;
      
    const output = p.output;
    if (!output) {
      console.log(`  ⏭️  Skipping ${p.type}: no output`);
      continue;
    }
    
    console.log(`  🔧 Checking ${p.type}:`, {
      outputType: output.type,
      hasValue: !!output.value,
      hasCitations: !!output.value?.citations,
    });
    
    // Check for JSON output with citations array
    if (output.type === "json" && output.value?.citations) {
      const citationsArray = output.value.citations;
      if (Array.isArray(citationsArray)) {
        console.log(`  ✅ Found ${citationsArray.length} citations in ${p.type}`);
        for (const cit of citationsArray) {
          const c = cit as { id?: unknown; type?: unknown; title?: unknown; url?: unknown };
          if (c.id && c.type) {
            const citation = {
              id: String(c.id),
              type: String(c.type),
              title: String(c.title || "Fuente"),
              url: c.url ? String(c.url) : undefined,
            };
            citations.push(citation);
            console.log(`    📚 Citation:`, citation);
          } else {
            console.warn(`    ⚠️  Invalid citation (missing id or type):`, cit);
          }
        }
      } else {
        console.warn(`  ⚠️  Citations is not an array:`, typeof citationsArray);
      }
    }
  }
  
  console.log(`📊 Total citations extracted: ${citations.length}`);
  console.groupEnd();
  
  return citations;
}

export function SidebarMessage({
  message,
  userAvatar,
  assistantAvatar,
  userName = "Usuario",
  assistantName = "iAlex",
  onContentChange,
}: SidebarMessageProps) {
  const [open, setOpen] = useState(false);
  const [citationId, setCitationId] = useState("");
  const [citationType, setCitationType] = useState("");
  const isUser = message.role === "user";

  const messageText =
    message.parts
      ?.filter((part) => part.type === "text")
      .map((part: any) => part.text)
      .join("") || "";

  // Detect tool calls
  const toolCalls =
    message.parts?.filter((part) => (part as any).type?.startsWith("tool-")) ||
    [];
  const allToolsCompleted =
    toolCalls.length > 0 &&
    toolCalls.every((part) => (part as any).state === "output-available");
  
  // Check if there are active tools (not completed yet)
  const hasActiveTools = toolCalls.length > 0 && !allToolsCompleted;

  // Extract source parts (from web search etc.)
  const sourceParts = message.parts?.filter((part) => part.type === "source-url") || [];
  
  // Extract citations from tool outputs (legislation search, fallos, etc.)
  const toolCitations = message.parts ? extractCitationsFromToolOutputs(message.parts) : [];

  // Simple streaming logic - just trust the backend status like HomeAgentPage
  const shouldStream =
    message.role === "assistant" && message.status === "streaming";

  const [visibleText, { isStreaming }] = useSmoothText(messageText, {
    charsPerSec: 80,
    startStreaming: shouldStream,
  });

  // Trigger content change callback when streaming text updates
  useEffect(() => {
    if (isStreaming && onContentChange) {
      onContentChange();
    }
  }, [visibleText, isStreaming, onContentChange]);

  // Trigger content change callback when message parts change (tools, reasoning, etc.)
  useEffect(() => {
    if (onContentChange) {
      onContentChange();
    }
  }, [message.parts, onContentChange]);

  // Callback for when images load to trigger layout updates
  const onImageLoad = () => {
    if (onContentChange) {
      setTimeout(onContentChange, 100); // Small delay to allow DOM update
    }
  };

  // Helper to calculate cumulative text length up to a given text part
  const getCumulativeTextLength = (upToIndex: number) => {
    let length = 0;
    message.parts?.forEach((part, idx) => {
      if (part.type === "text" && idx < upToIndex) {
        length += (part as any).text.length;
      }
    });
    return length;
  };

  // Find the index of the last text part for streaming logic
  // Use a manual search since Array.prototype.findLastIndex may not be available in this environment.
  const lastTextPartIndex = (() => {
    const parts = message.parts || [];
    for (let i = parts.length - 1; i >= 0; i--) {
      if ((parts[i] as any).type === "text") return i;
    }
    return -1;
  })();

  return (
    <Message
      from={message.role}
      className={cn(
        "!justify-start ",
        isUser ? "!flex-row-reverse" : "!flex-row",
      )}
    >
      <MessageAvatar
        src={isUser ? userAvatar || "" : assistantAvatar || ""}
        name={isUser ? userName : assistantName}
        className={cn("shrink-0", isUser ? "ml-2" : "mr-2")}
      />

      <MessageContent
        className={cn(
          "group relative !rounded-lg !px-3 !py-2 !text-[12px] shadow-sm space-y-2 max-w-[85%]",
          isUser && "!bg-[#F3F4F6] !text-black",
          !isUser && "!bg-[#F3F4F6] !text-black",
          message.status === "failed" &&
            "!bg-red-100 !text-red-800 border-l-2 border-red-400",
        )}
      >
        {/* Show thinking indicator if message is streaming but has no text yet */}
        {!isUser &&
          message.status === "streaming" &&
          (!messageText || messageText.trim() === "") && (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
              <span className="text-xs text-gray-500 italic">
                {hasActiveTools ? "Procesando herramientas..." : "Pensando..."}
              </span>
            </div>
          )}

        {/* Message parts in chronological order */}
        {message.parts?.map((part, index) => {
          if (part.type === "text") {
            const partText = (part as any).text;

            // For user messages, just show the text as-is
            if (isUser) {
              return (
                <div
                  key={index}
                  className={cn(
                    "prose prose-sm max-w-none whitespace-pre-wrap",
                  )}
                >
                  <MessageText text={partText} renderMarkdown={true} />
                </div>
              );
            }

  const isLastTextPart = index === lastTextPartIndex;
  let displayText = partText;

            if (shouldStream && isLastTextPart) {
              // Calculate where this part's text starts in the combined text
              const startPos = getCumulativeTextLength(index);
              const endPos = startPos + partText.length;

              // Extract only this part's text from the visible (streamed) text
              displayText = visibleText.slice(startPos, endPos);
            }

            // Skip rendering empty text parts - the main thinking indicator handles this
            if (!displayText || displayText.trim() === "") {
              return null;
            }

            return (
              <div
                key={index}
                className={cn("prose prose-sm max-w-none whitespace-pre-wrap")}
              >
                <MessageText
                  text={displayText}
                  renderMarkdown={true}
                  onCitationClick={
                    !isUser
                      ? (id, type) => {
                          console.log("🔗 [Citations] Citation clicked in message text:", { id, type });
                          setOpen(true);
                          setCitationId(id);
                          setCitationType(type);
                        }
                      : undefined
                  }
                />
              </div>
            );
          }

          if (part.type === "reasoning") {
            // Simple streaming detection - trust the backend status
            const reasoningIsStreaming = message.status === "streaming";

            return (
              <Reasoning
                key={`${message.id}-${index}`}
                defaultOpen={false}
                isStreaming={reasoningIsStreaming}
                onToggle={() => {
                  // Trigger content change when reasoning is expanded/collapsed
                  if (onContentChange) {
                    setTimeout(onContentChange, 100); // Small delay to allow DOM update
                  }
                }}
              >
                <ReasoningTrigger className="!text-[10px]" />
                <ReasoningContent className="group relative !px-3 !py-2 !text-[10px] space-y-2 max-w-[85%]">
                  {part.text}
                </ReasoningContent>
              </Reasoning>
            );
          }

          if (part.type === "source-url") {
            return null;
          }

          if (part.type === "file") {
            const fileUrl = (part as any).url;
            const mediaType = (part as any).mediaType;
            const filename = (part as any).filename;

            if (mediaType?.startsWith("image/")) {
              return (
                <div key={`file-${index}`} className="mt-2">
                  <img
                    src={fileUrl}
                    alt={filename || "Attached image"}
                    className="max-w-full h-auto rounded"
                    onLoad={onImageLoad}
                  />
                </div>
              );
            }

            return (
              <div key={`file-${index}`} className="text-xs bg-gray-50 border border-gray-200 rounded p-2">
                <strong>File:</strong> {filename || "Unknown file"}
              </div>
            );
          }

          if (part.type.startsWith("tool-")) {
            const aiSDKState = (part as any).state;
            const outputType = (part as any)?.output?.type as
              | string
              | undefined;
            const isError =
              aiSDKState === "output-available" &&
              (outputType?.startsWith("error-") ?? false);

            // Map our states to Tool component states
            const toolState = isError
              ? "output-error"
              : aiSDKState === "output-available"
                ? "output-available"
                : aiSDKState === "input-available"
                  ? "input-available"
                  : "input-streaming";

            return (
              <Tool
                key={index}
                className="mb-4"
                type={part.type.replace("tool-", "")}
                state={toolState}
                output={(part as any)?.output as ToolUIPart["output"]}
                input={(part as any)?.input}
              ></Tool>
            );
          }

        return null;
      })}

      {/* Sources - from source-url parts and tool output citations */}
      {(sourceParts.length > 0 || toolCitations.length > 0) && (
        <Sources
          className="mt-2"
          onOpenChange={(open: boolean) => {
            if (open && onContentChange) {
              setTimeout(onContentChange, 100);
            }
          }}
        >
          <SourcesTrigger count={sourceParts.length + toolCitations.length} />
          <SourcesContent>
            {/* Render source-url parts (web search) */}
            {sourceParts.map((part: { url?: string; title?: string }, i) => (
              <Source
                key={`source-${i}`}
                href={part.url}
                title={part.title}
                index={i + 1}
              />
            ))}
            {/* Render tool citations (legislation, fallos, etc.) */}
            {toolCitations.map((cit, i) => (
              <button
                key={`cit-${cit.id}-${i}`}
                onClick={() => {
                  console.log("🔗 [Citations] Citation clicked from sources list:", cit);
                  setOpen(true);
                  setCitationId(cit.id);
                  setCitationType(cit.type);
                }}
                className="flex items-center gap-2.5 p-2 rounded-md hover:bg-muted/80 transition-all duration-200 no-underline group/source w-full text-left"
              >
                <div className="flex items-center justify-center h-5 w-5 shrink-0 rounded-full bg-background border text-[10px] font-medium text-muted-foreground group-hover/source:text-foreground group-hover/source:border-primary/20">
                  {sourceParts.length + i + 1}
                </div>
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span className="text-xs font-medium truncate text-foreground/90 group-hover/source:text-primary">
                    {cit.title}
                  </span>
                    <span className="text-[10px] text-muted-foreground truncate opacity-70">
                      {cit.type === "leg"
                        ? "Legislación"
                        : cit.type === "fallo"
                        ? "Jurisprudencia"
                        : cit.type === "document" || cit.type === "case-doc" || cit.type === "doc"
                        ? "Documento"
                        : cit.type === "escrito"
                        ? "Escrito"
                        : cit.type}
                    </span>
                </div>
              </button>
            ))}
          </SourcesContent>
        </Sources>
      )}

      {/* Status and Actions */}
      {!isUser && message.status === "failed" && (
        <div className="flex items-center gap-1 mt-2 text-red-600">
          <span className="text-xs">❌ Error al procesar el mensaje</span>
        </div>
      )}

        {!isUser && !isStreaming && (
          <Actions className="mt-2 transition-opacity">
            <Action
              tooltip="Copiar respuesta"
              onClick={() => navigator.clipboard.writeText(messageText)}
              className="cursor-pointer"
            >
              <Copy size={14} className="text-gray-500" />
            </Action>
            <Action tooltip="Me gusta" className="cursor-pointer">
              <ThumbsUp size={14} className="text-gray-500" />
            </Action>
            <Action tooltip="No me gusta" className="cursor-pointer">
              <ThumbsDown size={14} className="text-gray-500" />
            </Action>
          </Actions>
        )}
      </MessageContent>
      <CitationModal
        open={open}
        setOpen={setOpen}
        citationId={citationId}
        citationType={citationType}
      />
    </Message>
  );
}
