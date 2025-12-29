import React from "react";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { Response } from "@/components/ai-elements/response";
import { Actions, Action } from "@/components/ai-elements/actions";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import {
  Sources,
  SourcesTrigger,
  SourcesContent,
  Source,
} from "@/components/ai-elements/source";
import { Copy, RotateCw, Check, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Tool } from "@/components/ai-elements/tool";
import type { ToolUIPart } from "ai";
import { extractCitationsFromToolOutputs } from "@/components/ai-elements/citations";
import { HomeAgentMessageMedia } from "./HomeAgentMessageMedia";

/**
 * Tipos para las partes del mensaje
 */
export type AgentPart = {
  type?: string;
  state?: string;
  text?: string;
  output?: unknown;
  input?: unknown;
  url?: string;
  title?: string;
  mediaType?: string;
  filename?: string;
  // Campos para medios enviados por el backend
  image?: string;
  data?: string;
  [key: string]: unknown;
};

/**
 * Estructura del mensaje del agente
 */
export type AgentMessage = {
  _id?: string;
  id?: string;
  role: "user" | "assistant" | "system";
  status?: "pending" | "streaming" | "done" | "failed" | "success";
  order?: number;
  _creationTime?: number;
  text?: string;
  parts?: AgentPart[];
};

interface HomeAgentMessageProps {
  msg: AgentMessage;
  copiedMessageId: string | null;
  onCopyMessage: (messageId: string, text: string) => void;
  onCitationClick: (id: string, type: string) => void;
  onRetry?: (userMessage: string) => void;
}

/**
 * Componente individual de mensaje para el HomeAgent
 */
export const HomeAgentMessage = ({
  msg,
  copiedMessageId,
  onCopyMessage,
  onCitationClick,
  onRetry,
}: HomeAgentMessageProps) => {
  const messageText =
    msg.text ||
    msg.parts
      ?.filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("") ||
    "";

  const isUser = msg.role === "user";
  const messageId = msg._id ?? msg.id ?? "";
  const isCopied = copiedMessageId === messageId;

  // Check for active tools
  const toolCalls =
    msg.parts?.filter(
      (p) => typeof p.type === "string" && p.type.startsWith("tool-"),
    ) || [];
  const allToolsCompleted =
    toolCalls.length > 0 &&
    toolCalls.every((p) => p.state === "output-available");
  const hasActiveTools = toolCalls.length > 0 && !allToolsCompleted;

  // Extract source parts (from web search etc.)
  const sourceParts =
    msg.parts?.filter((part) => part.type === "source-url") || [];

  // Extract citations from tool outputs (legislation search, fallos, etc.)
  const toolCitations = msg.parts
    ? extractCitationsFromToolOutputs(msg.parts)
    : [];

  return (
    <Message key={messageId} from={msg.role}>
      <MessageContent>
        {/* Show thinking indicator if message is streaming but has no text yet */}
        {!isUser &&
          msg.status === "streaming" &&
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

        {/* Renderizar parts en orden cronológico con agrupación de medios */}
        {msg.parts && msg.parts.length > 0 ? (
          (() => {
            const elements: React.ReactNode[] = [];
            let currentMediaGroup: React.ReactNode[] = [];

            const flushMediaGroup = (index: number) => {
              if (currentMediaGroup.length > 0) {
                elements.push(
                  <div key={`media-group-${index}`} className="flex flex-wrap gap-2 mb-2">
                    {currentMediaGroup}
                  </div>
                );
                currentMediaGroup = [];
              }
            };

            msg.parts.forEach((part, partIndex) => {
              if (part.type === "image" || part.type === "file") {
                currentMediaGroup.push(
                  <HomeAgentMessageMedia
                    key={`media-${partIndex}`}
                    type={part.type as "image" | "file"}
                    url={(part.type === "image" ? part.image : part.data) || part.url || ""}
                    filename={part.filename}
                    className="mb-0" // Quitar margen inferior cuando está en grupo
                  />
                );
              } else {
                flushMediaGroup(partIndex);

                // Renderizar texto
                if (part.type === "text") {
                  const displayText = part.text;

                  if (isUser) {
                    elements.push(
                      <div key={partIndex} className="whitespace-pre-wrap text-sm">
                        {displayText || "..."}
                      </div>
                    );
                  } else {
                    elements.push(
                      <Response
                        key={partIndex}
                        className="text-sm"
                        onCitationClick={(id, type) => {
                          console.log("🔗 [Citations] Citation clicked in message text:", {
                            id,
                            type,
                          });
                          onCitationClick(id, type);
                        }}
                      >
                        {displayText || "..."}
                      </Response>
                    );
                  }
                }

                // Renderizar reasoning
                else if (part.type === "reasoning") {
                  const reasoningIsStreaming = msg.status === "streaming";

                  elements.push(
                    <Reasoning
                      key={`${messageId}-${partIndex}`}
                      defaultOpen={false}
                      isStreaming={reasoningIsStreaming}
                    >
                      <ReasoningTrigger className="text-[10px]!" />
                      <ReasoningContent className="group relative px-3! py-2! text-[10px]! space-y-2 max-w-[85%]">
                        {typeof part.text === "string" ? part.text : ""}
                      </ReasoningContent>
                    </Reasoning>
                  );
                }

                // Renderizar tool calls
                else if (part.type?.startsWith("tool-")) {
                  const aiSDKState = part.state;
                  const outputType = (
                    part.output as { type?: unknown } | undefined
                  )?.type as string | undefined;
                  const isError =
                    aiSDKState === "output-available" &&
                    (outputType?.startsWith("error-") ?? false);

                  const toolState = isError
                    ? "output-error"
                    : aiSDKState === "output-available"
                      ? "output-available"
                      : aiSDKState === "input-available"
                        ? "input-available"
                        : "input-streaming";

                  elements.push(
                    <Tool
                      key={partIndex}
                      className="mb-2"
                      type={part.type.replace("tool-", "")}
                      state={toolState}
                      output={part.output as ToolUIPart["output"]}
                      input={part.input}
                    />
                  );
                }
              }
            });

            flushMediaGroup(msg.parts.length);
            return elements;
          })()
        ) : isUser ? (
          <div className="whitespace-pre-wrap text-sm">
            {messageText || "..."}
          </div>
        ) : (
          <Response
            className="text-sm"
            onCitationClick={(id, type) => {
              console.log(
                "🔗 [Citations] Citation clicked in message text (fallback):",
                { id, type },
              );
              onCitationClick(id, type);
            }}
          >
            {messageText || "..."}
          </Response>
        )}
        {/* Sources - from source-url parts and tool output citations */}
        {(sourceParts.length > 0 || toolCitations.length > 0) && (
          <Sources className="mt-2">
            <SourcesTrigger count={sourceParts.length + toolCitations.length} />
            <SourcesContent>
              {/* Render source-url parts (web search) */}
              {sourceParts.map((part, i: number) => (
                <Source
                  key={`source-${i}`}
                  href={typeof part.url === "string" ? part.url : undefined}
                  title={typeof part.title === "string" ? part.title : undefined}
                  index={i + 1}
                />
              ))}
              {/* Render tool citations (legislation, fallos, etc.) */}
              {toolCitations.map((cit, i: number) => (
                <button
                  key={`cit-${cit.id}-${i}`}
                  onClick={() => {
                    console.log(
                      "🔗 [Citations] Citation clicked from sources list:",
                      cit,
                    );
                    onCitationClick(cit.id, cit.type);
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
                          : cit.type === "document" ||
                              cit.type === "case-doc" ||
                              cit.type === "doc"
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

        <div className="flex items-center justify-between mt-2">
          <div className="text-[10px] opacity-70">
            {msg._creationTime
              ? formatDistanceToNow(msg._creationTime, {
                  addSuffix: true,
                  locale: es,
                })
              : "ahora"}
          </div>

          {/* Actions - Solo para mensajes de la IA */}
          {!isUser && (
            <Actions>
              <Action
                tooltip={isCopied ? "¡Copiado!" : "Copiar"}
                onClick={() => onCopyMessage(messageId, messageText)}
              >
                {isCopied ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Action>

              {onRetry && (
                <Action
                  tooltip="Reintentar"
                  onClick={() => onRetry(messageText)}
                >
                  <RotateCw className="size-4" />
                </Action>
              )}
            </Actions>
          )}
        </div>

        {msg.status === "failed" && (
          <div className="flex items-center gap-2 mt-2 text-red-600 text-sm">
            <AlertCircle className="size-4" />
            <span>Error al procesar el mensaje</span>
          </div>
        )}
      </MessageContent>
    </Message>
  );
};

