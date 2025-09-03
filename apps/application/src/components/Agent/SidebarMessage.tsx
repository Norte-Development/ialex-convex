import { useSmoothText } from "@convex-dev/agent/react";
import { cn } from "@/lib/utils";
import { ToolCallDisplay } from "./ToolCallDisplay";
import { Message, MessageContent, MessageAvatar } from "../ai-elements/message";
import { Reasoning, ReasoningContent } from "../ai-elements/reasoning";
import { Sources, SourcesTrigger, SourcesContent } from "../ai-elements/source";
import { Actions, Action } from "../ai-elements/actions";
import { Loader } from "../ai-elements/loader";
import { Copy, ThumbsUp, ThumbsDown } from "lucide-react";
import {
  Task,
  TaskTrigger,
  TaskContent as TaskContentComponent,
} from "../ai-elements/task";
import { Response } from "../ai-elements/response";
import type { SidebarMessageProps } from "./types/message-types";

export function SidebarMessage({
  message,
  userAvatar,
  assistantAvatar,
  userName = "Usuario",
  assistantName = "iAlex",
}: SidebarMessageProps) {
  const isUser = message.role === "user";

  const messageText =
    message.parts
      ?.filter((part) => part.type === "text")
      .map((part: any) => part.text)
      .join("") || "";

  const messageAge = Date.now() - (message._creationTime || 0);
  const shouldStream =
    message.role === "assistant" &&
    (message.status === "streaming" ||
      (message.status === "success" && messageAge < 5000));

  const [visibleText, { isStreaming }] = useSmoothText(messageText, {
    charsPerSec: 80,
    startStreaming: shouldStream,
  });

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
        {/* Tool calls container */}
        {(() => {
          const toolCalls =
            message.parts?.filter((part) => part.type.startsWith("tool-")) ||
            [];
          if (toolCalls.length === 0) return null;

          return (
            <Task key="tools-container" defaultOpen={true} className="mb-2">
              <TaskTrigger
                title={`Herramientas usadas (${toolCalls.length})`}
                className="mb-0"
              />
              <TaskContentComponent className="mt-0">
                {toolCalls.map((part, index) => {
                  const aiSDKState =
                    (part as any).state === "output-available"
                      ? "output-available"
                      : "input-available";

                  return (
                    <ToolCallDisplay
                      key={index}
                      state={
                        aiSDKState === "output-available" ? "result" : "call"
                      }
                      part={part as any}
                    />
                  );
                })}
              </TaskContentComponent>
            </Task>
          );
        })()}

        {/* Message parts */}
        {message.parts?.map((part, index) => {
          if (part.type === "text") {
            const displayText = isUser
              ? part.text
              : shouldStream
                ? visibleText
                : messageText;

            if (
              !isUser &&
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
                <Response>{displayText}</Response>
                {!isUser && isStreaming && (
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
            return (
              <Reasoning key={index} defaultOpen={false}>
                <ReasoningContent>{(part as any).text}</ReasoningContent>
              </Reasoning>
            );
          }

          if (part.type === "source-url") {
            return (
              <Sources key={index}>
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
            return null;
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
    </Message>
  );
}
