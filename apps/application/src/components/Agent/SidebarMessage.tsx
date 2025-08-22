import { useSmoothText, type UIMessage } from "@convex-dev/agent/react"
import { cn } from "@/lib/utils"
import ReactMarkdown from "react-markdown"
import { ToolCallDisplay } from "./ToolCallDisplay"

interface SidebarMessageProps {
  message: UIMessage
}

export function SidebarMessage({ message }: SidebarMessageProps) {
  const isUser = message.role === "user"
  const [visibleText] = useSmoothText(message.text, {
    startStreaming: message.status === "streaming",
  })

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "rounded-lg px-3 py-2 max-w-[85%] text-sm shadow-sm space-y-2",
          isUser ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800",
          {
            "bg-green-100 text-green-800": !isUser && message.status === "streaming",
            "bg-red-100 text-red-800": message.status === "failed",
          },
        )}
      >
        {message.parts?.map((part, index) => {
          // Handle text parts with ReactMarkdown
          if (part.type === "text") {
            return (
              <div key={index} className={cn(
                "prose prose-sm max-w-none whitespace-pre-wrap",
                isUser ? "text-white" : "text-gray-800"
              )}>
                <ReactMarkdown
                  components={{
                    // Customize markdown components to match chat styling
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
                    li: ({ children }) => <li className="mb-1">{children}</li>,
                    code: ({ children, className }) => {
                      const isInline = !className
                      return isInline ? (
                        <code className={cn(
                          "px-1 py-0.5 rounded text-xs font-mono",
                          isUser ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-800"
                        )}>
                          {children}
                        </code>
                      ) : (
                        <pre className={cn(
                          "p-2 rounded text-xs font-mono overflow-x-auto",
                          isUser ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-800"
                        )}>
                          <code>{children}</code>
                        </pre>
                      )
                    },
                    blockquote: ({ children }) => (
                      <blockquote className={cn(
                        "border-l-2 pl-2 italic",
                        isUser ? "border-blue-300" : "border-gray-400"
                      )}>
                        {children}
                      </blockquote>
                    ),
                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                    em: ({ children }) => <em className="italic">{children}</em>,
                    h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-md font-bold mb-2">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
                  }}
                >
                  {part.text}
                </ReactMarkdown>
              </div>
            )
          }

          // Handle reasoning parts
          if (part.type === "reasoning") {
            return (
              <div key={index} className="text-xs text-gray-600 italic border-l-2 border-gray-300 pl-2 mt-2">
                <strong>Reasoning:</strong> {(part as any).text}
              </div>
            )
          }

          // Handle source parts
          if (part.type === "source-url") {
            return (
              <div key={index} className="text-xs bg-blue-50 border border-blue-200 rounded p-2 mt-2">
                <strong>Source:</strong> {(part as any).title || (part as any).url || "Unknown source"}
              </div>
            )
          }

          // Handle file parts (images, etc.)
          if (part.type === "file") {
            const fileUrl = (part as any).url
            const mediaType = (part as any).mediaType
            const filename = (part as any).filename

            if (mediaType?.startsWith('image/')) {
              return (
                <div key={index} className="mt-2">
                  <img 
                    src={fileUrl} 
                    alt={filename || "Attached image"} 
                    className="max-w-full h-auto rounded"
                  />
                </div>
              )
            }

            return (
              <div key={index} className="text-xs bg-gray-50 border border-gray-200 rounded p-2 mt-2">
                <strong>File:</strong> {filename || "Unknown file"}
              </div>
            )
          }

          // Handle tool calls (new v5 AI SDK format)
          if (part.type.startsWith("tool-")) {
            const toolName = part.type.replace("tool-", "")
            const state = (part as any).state === "output-available" ? "result" : "call"
            
            return (
              <ToolCallDisplay
                key={index}
                toolName={toolName}
                state={state}
                part={part as any}
              />
            )
          }

          return null
        })}

        {/* Fallback for old content-based messages */}
        {!message.parts?.length && (
          <div className={cn(
            "prose prose-sm max-w-none whitespace-pre-wrap",
            isUser ? "text-white" : "text-gray-800"
          )}>
            <ReactMarkdown>
              {visibleText}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
} 