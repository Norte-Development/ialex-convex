import { useSmoothText } from "@convex-dev/agent/react";
import { cn } from "@/lib/utils";
import { Message, MessageContent, MessageAvatar } from "../ai-elements/message";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "../ai-elements/reasoning";
import { Sources, SourcesTrigger, SourcesContent } from "../ai-elements/source";
import { Actions, Action } from "../ai-elements/actions";
import { Loader } from "../ai-elements/loader";
import { Copy, ThumbsUp, ThumbsDown } from "lucide-react";
import {
  Tool,
} from "../ai-elements/tool";
import { MessageText } from "../ai-elements/message-text";
import type { SidebarMessageProps } from "./types/message-types";
import { LegislationModal } from "./legislation-modal";
import { useState, useEffect } from "react";
import { ToolUIPart } from "ai";

export function SidebarMessage({
  message,
  userAvatar,
  assistantAvatar,
  userName = "Usuario",
  assistantName = "iAlex",
  onContentChange,
}: SidebarMessageProps) {

  const [open, setOpen] = useState(false);
  const [normativeId, setNormativeId] = useState("");
  const isUser = message.role === "user";

  const messageText =
    message.parts
      ?.filter((part) => part.type === "text")
      .map((part: any) => part.text)
      .join("") || "";

  const messageAge = Date.now() - (message._creationTime || 0);
  // Detect tool calls and whether they've all completed output
  const toolCalls =
    message.parts?.filter((part) => (part as any).type?.startsWith("tool-")) || [];
  const allToolsCompleted =
    toolCalls.length > 0 &&
    toolCalls.every((part) => (part as any).state === "output-available");

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

  return (
    <Message
      from={message.role}
      className={cn(
        "!justify-start",
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
          isUser && "!bg-blue-600 !text-white",
          !isUser && "!bg-gray-100 !text-gray-800",
          message.status === "failed" &&
            "!bg-red-100 !text-red-800 border-l-2 border-red-400",
        )}
      >
        {/* Message parts in chronological order */}
        {message.parts?.map((part, index) => {
          if (part.type === "text") {
            const displayText = isUser
              ? part.text
              : shouldStream
                ? visibleText
                : messageText;

            if (
              !isUser &&
              shouldStream &&
              visibleText === "" &&
              (!displayText || displayText.trim() === "")
            ) {
              return (
                <div key={index} className="flex items-center gap-2">
                  <Loader size={12} />
                  <span className="text-xs text-gray-500 italic">
                    Pensando...
                  </span>
                </div>
              );
            }

            return (
              <div
                key={index}
                className={cn("prose prose-sm max-w-none whitespace-pre-wrap")}
              >
                <MessageText
                  text={displayText}
                  renderMarkdown={true}
                  onCitationClick={!isUser ? (id, type) => {
                    console.log('Citation clicked:', { id, type });
                    setOpen(true);
                    setNormativeId(id);
                  } : undefined}
                />
                {!isUser && isStreaming && !allToolsCompleted && (
                  <div className="flex items-center gap-1 mt-2">
                    <Loader size={12} />
                    <span className="text-xs text-gray-500">
                      Escribiendo...
                    </span>
                  </div>
                )}
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
            
            const reasoningIsStreaming = message.status === "streaming" && 
              (isLastPart);
            
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
                <ReasoningContent className="group relative !px-3 !py-2 !text-[10px] space-y-2 max-w-[85%]">{part.text}</ReasoningContent>
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
                <div key={index} className="mt-2">
                  <img
                    src={fileUrl}
                    alt={filename || "Attached image"}
                    className="max-w-full h-auto rounded"
                    onLoad={() => {
                      // Trigger content change when image loads (height changes)
                      if (onContentChange) {
                        setTimeout(onContentChange, 100);
                      }
                    }}
                  />
                </div>
              );
            }

            return (
              <div
                key={index}
                className="text-xs bg-gray-50 border border-gray-200 rounded p-2"
              >
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
              <Tool key={index} className="mb-4" type={part.type.replace("tool-", "")} state={toolState} output={(part as any)?.output as ToolUIPart["output"]}>
              </Tool>
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
      <LegislationModal open={open} setOpen={setOpen} normativeId={normativeId} />
    </Message>
  );
}
