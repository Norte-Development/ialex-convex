import { useSmoothText, type UIMessage } from "@convex-dev/agent/react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
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

/**
 * SidebarMessage Component
 *
 * A modern message component built using ai-sdk elements.
 * Displays user and assistant messages with support for:
 * - Markdown rendering
 * - Tool call display
 * - Streaming text animation
 * - Multiple message parts (text, tool calls)
 * - Status indicators (streaming, failed, etc.)
 *
 * @component
 */

interface SidebarMessageProps {
  /** The message object from the AI conversation */
  message: UIMessage;
  /** Optional avatar URL for the user */
  userAvatar?: string;
  /** Optional avatar URL for the assistant */
  assistantAvatar?: string;
  /** Optional user name for avatar fallback */
  userName?: string;
  /** Optional assistant name for avatar fallback */
  assistantName?: string;
}

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

  // Determine if we should show typewriter effect (solo para mensajes muy recientes)
  const messageAge = Date.now() - (message._creationTime || 0);
  const isRecentMessage = messageAge < 5000; // 5 segundos, igual que antes

  const shouldStream =
    message.role === "assistant" &&
    (message.status === "streaming" ||
      (message.status === "success" && isRecentMessage));

  // Use ai-sdk's useSmoothText hook
  const [visibleText, { isStreaming }] = useSmoothText(messageText, {
    charsPerSec: 80,
    startStreaming: shouldStream,
  });

  // Para mensajes antiguos, mostrar texto completo inmediatamente
  const finalText = shouldStream ? visibleText : messageText;

  console.log("Rendering message:", message);

  console.log("Final text:", finalText);
  return (
    <Message
      from={message.role}
      className={cn(
        "!justify-start",
        isUser ? "!flex-row-reverse" : "!flex-row",
      )}
    >
      {/* Avatar */}
      <MessageAvatar
        src={isUser ? userAvatar || "" : assistantAvatar || ""}
        name={isUser ? userName : assistantName}
        className={cn("shrink-0", isUser ? "ml-2" : "mr-2")}
      />

      {/* Message Content */}
      <MessageContent
        className={cn(
          "group relative !rounded-lg !px-3 !py-2 !text-[12px] shadow-sm space-y-2 max-w-[85%]",
          // User messages
          isUser && "!bg-blue-600 !text-white",
          // Assistant messages
          !isUser && "!bg-gray-100 !text-gray-800",

          message.status === "failed" &&
            "!bg-red-100 !text-red-800 border-l-2 border-red-400",
        )}
      >
        {/* Group all tool calls under expandible container */}
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

        {/* Render message parts */}
        {message.parts?.map((part, index) => {
          if (part.type === "text") {
            const displayText = isUser ? part.text : finalText;

            if (
              !isUser &&
              (!displayText || !finalText || displayText.trim() === "")
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
                <ReactMarkdown
                  components={{
                    p: ({ children }) => (
                      <p className="mb-2 last:mb-0">{children}</p>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc list-inside mb-2">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal list-inside mb-2">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => <li className="mb-1">{children}</li>,
                    code: ({ children, className }) => {
                      const isInline = !className;
                      return isInline ? (
                        <code
                          className={cn(
                            "px-1 py-0.5 rounded text-xs font-mono",
                            isUser
                              ? "bg-blue-500 text-white"
                              : "bg-gray-200 text-gray-800",
                          )}
                        >
                          {children}
                        </code>
                      ) : (
                        <pre
                          className={cn(
                            "p-2 rounded text-xs font-mono overflow-x-auto",
                            isUser
                              ? "bg-blue-500 text-white"
                              : "bg-gray-200 text-gray-800",
                          )}
                        >
                          <code>{children}</code>
                        </pre>
                      );
                    },
                    blockquote: ({ children }) => (
                      <blockquote
                        className={cn(
                          "border-l-2 pl-2 italic",
                          isUser ? "border-blue-300" : "border-gray-400",
                        )}
                      >
                        {children}
                      </blockquote>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-semibold">{children}</strong>
                    ),
                    em: ({ children }) => (
                      <em className="italic">{children}</em>
                    ),
                    h1: ({ children }) => (
                      <h1 className="text-lg font-bold mb-2">{children}</h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-md font-bold mb-2">{children}</h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-sm font-bold mb-1">{children}</h3>
                    ),
                  }}
                >
                  {displayText}
                </ReactMarkdown>

                {/* Loader for typing indicator */}
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

          // Handle reasoning parts
          if (part.type === "reasoning") {
            return (
              <Reasoning key={index} defaultOpen={false}>
                <ReasoningContent>{(part as any).text}</ReasoningContent>
              </Reasoning>
            );
          }

          // Handle source parts
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

          // Handle file parts (images, etc.)
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

          // Handle tool calls
          if (part.type.startsWith("tool-")) {
            return null;
          }

          return null;
        })}

        {/* Fallback for old content-based messages */}
        {!message.parts?.length && (
          <div>
            <div
              className={cn(
                "prose prose-sm max-w-none whitespace-pre-wrap",
                isUser ? "text-white" : "text-gray-800",
              )}
            >
              <ReactMarkdown>{finalText}</ReactMarkdown>
            </div>

            {/* Loader for typing indicator in fallback */}
            {!isUser && isStreaming && (
              <div className="flex items-center gap-1 mt-2">
                <Loader size={12} />
                <span className="text-xs text-gray-500">Escribiendo...</span>
              </div>
            )}
          </div>
        )}

        {/* Status indicator */}
        {!isUser && message.status === "failed" && (
          <div className="flex items-center gap-1 mt-2 text-red-600">
            <span className="text-xs">❌ Error al procesar el mensaje</span>
          </div>
        )}

        {/* Actions for assistant messages */}
        {!isUser && !isStreaming && (
          <Actions className="mt-2  transition-opacity">
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
