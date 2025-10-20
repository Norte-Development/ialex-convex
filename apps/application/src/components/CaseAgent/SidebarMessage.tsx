import { useSmoothText } from "@convex-dev/agent/react";
import { cn } from "@/lib/utils";
import { Message, MessageContent, MessageAvatar } from "../ai-elements/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "../ai-elements/reasoning";
import { Sources, SourcesTrigger, SourcesContent } from "../ai-elements/source";
import { Actions, Action } from "../ai-elements/actions";
import { Copy, ThumbsUp, ThumbsDown } from "lucide-react";
import { Tool } from "../ai-elements/tool";
import { MessageText } from "../ai-elements/message-text";
import type { SidebarMessageProps } from "./types/message-types";
import { CitationModal } from "./citation-modal";
import { useState, useEffect, memo } from "react";
import { ToolUIPart } from "ai";

function SidebarMessageInner({
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

  const messageAge = Date.now() - (message._creationTime || 0);
  // Detect tool calls and whether they've all completed output
  const toolCalls =
    message.parts?.filter((part) => (part as any).type?.startsWith("tool-")) ||
    [];
  const allToolsCompleted =
    toolCalls.length > 0 &&
    toolCalls.every((part) => (part as any).state === "output-available");
  
  // Check if there are active tools (not completed yet)
  const hasActiveTools = toolCalls.length > 0 && !allToolsCompleted;

  // Only stream while assistant is actively streaming and tools (if any) are not all completed
  const shouldStream =
    message.role === "assistant" &&
    (message.status === "streaming" ||
      (message.status === "success" && messageAge < 5000)) &&
    !allToolsCompleted;

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
        {/* Show thinking indicator if message has no parts yet, is empty, or only has tools without text */}
        {!isUser &&
          (message.status === "streaming" || hasActiveTools) &&
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
                          console.log("Citation clicked:", { id, type });
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
            // More intelligent reasoning streaming detection
            // Reasoning is considered streaming only if:
            // 1. The message is still streaming AND
            // 2. This is the last part (reasoning is still being generated) OR
            // 3. The reasoning text is empty or very short (just started)
            const isLastPart = index === (message.parts?.length || 0) - 1;

            const reasoningIsStreaming =
              message.status === "streaming" && isLastPart;

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
            return (
              <Sources
                key={index}
                onToggle={() => {
                  // Trigger content change when sources are expanded/collapsed
                  if (onContentChange) {
                    setTimeout(onContentChange, 100); // Small delay to allow DOM update
                  }
                }}
              >
                <SourcesTrigger count={1}>
                  Source:{" "}
                  {(part as any).title || (part as any).url || "Unknown source"}
                </SourcesTrigger>
                <SourcesContent>
                  <div className="text-xs bg-blue-50 border border-blue-200 rounded p-2">
                    <strong>URL:</strong> {(part as any).url}
                    {(part as any).title && (
                      <>
                        <br />
                        <strong>Title:</strong> {(part as any).title}
                      </>
                    )}
                  </div>
                </SourcesContent>
              </Sources>
            );
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

export const SidebarMessage = memo(SidebarMessageInner, (prevProps, nextProps) => {
  // Custom comparison: only re-render if the message content or structure changes
  // Don't re-render just because parent re-rendered
  const prevMsg = prevProps.message as any;
  const nextMsg = nextProps.message as any;
  
  return (
    (prevMsg.id || prevMsg._id) === (nextMsg.id || nextMsg._id) &&
    prevMsg.status === nextMsg.status &&
    prevMsg.parts?.length === nextMsg.parts?.length &&
    prevMsg.parts?.every((p: any, i: number) => 
      p.type === nextMsg.parts?.[i]?.type &&
      (p.type === "text" ? (p as any).text === (nextMsg.parts?.[i] as any)?.text : true)
    )
  );
});

SidebarMessage.displayName = 'SidebarMessage';
