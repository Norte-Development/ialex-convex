import { useSmoothText, type UIMessage } from "@convex-dev/agent/react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { ToolCallDisplay } from "./ToolCallDisplay";
import { Message, MessageContent, MessageAvatar } from "../ai-elements/message";
import { Reasoning, ReasoningContent } from "../ai-elements/reasoning";
import { Sources, SourcesTrigger, SourcesContent } from "../ai-elements/source";
import { Tool, ToolHeader, ToolContent } from "../ai-elements/tool";

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
      .map((part) => part.text)
      .join("") || "";

  const [visibleText] = useSmoothText(messageText, {
    startStreaming: message.status === "streaming",
  });

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
          "!rounded-lg !px-3 !py-2 !text-sm shadow-sm space-y-2 max-w-[85%]",
          // User messages
          isUser && "!bg-blue-600 !text-white",
          // Assistant messages
          !isUser && "!bg-gray-100 !text-gray-800",
          // Status-based styling
          !isUser &&
            message.status === "streaming" &&
            "!bg-green-100 !text-green-800",
          message.status === "failed" && "!bg-red-100 !text-red-800",
        )}
      >
        {message.parts?.map((part, index) => {
          // Handle text parts with ReactMarkdown
          if (part.type === "text") {
            return (
              <div
                key={index}
                className={cn(
                  "prose prose-sm max-w-none whitespace-pre-wrap",
                  isUser ? "text-white" : "text-gray-800",
                )}
              >
                <ReactMarkdown
                  components={{
                    // Customize markdown components to match chat styling
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
                  {part.text}
                </ReactMarkdown>
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
                className="text-xs bg-gray-50 border border-gray-200 rounded p-2 mt-2"
              >
                <strong>File:</strong> {filename || "Unknown file"}
              </div>
            );
          }

          // Handle tool calls
          if (part.type.startsWith("tool-")) {
            const toolName = part.type.replace("tool-", "");
            const state =
              (part as any).state === "output-available"
                ? "output-available"
                : "input-available";

            return (
              <Tool key={index}>
                <ToolHeader type={part.type as any} state={state as any} />
                <ToolContent>
                  <ToolCallDisplay
                    toolName={toolName}
                    state={state === "output-available" ? "result" : "call"}
                    part={part as any}
                  />
                </ToolContent>
              </Tool>
            );
          }

          return null;
        })}

        {/* Fallback for old content-based messages */}
        {!message.parts?.length && (
          <div
            className={cn(
              "prose prose-sm max-w-none whitespace-pre-wrap",
              isUser ? "text-white" : "text-gray-800",
            )}
          >
            <ReactMarkdown>{visibleText}</ReactMarkdown>
          </div>
        )}
      </MessageContent>
    </Message>
  );
}
