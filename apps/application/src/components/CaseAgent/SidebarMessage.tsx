import { useSmoothText } from "@convex-dev/agent/react";
import { cn } from "@/lib/utils";
import { Message, MessageContent, MessageAvatar } from "../ai-elements/message";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "../ai-elements/reasoning";
import { Sources, SourcesTrigger, SourcesContent } from "../ai-elements/source";
import { Actions, Action } from "../ai-elements/actions";
import { Copy, ThumbsUp, ThumbsDown } from "lucide-react";
import {
  Tool,
} from "../ai-elements/tool";
import { MessageText } from "../ai-elements/message-text";
import type { SidebarMessageProps } from "./types/message-types";
import { LegislationModal } from "./legislation-modal";
import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { ToolUIPart } from "ai";

interface TextPartRendererProps {
  part: any;
  index: number;
  isUser: boolean;
  shouldStream: boolean;
  visibleText: string;
  lastTextPartIndex: number;
  cumulativeTextLengths: number[];
  onCitationClick?: (id: string, type: string) => void;
}

const TextPartRenderer = memo(function TextPartRenderer({
  part,
  isUser,
  shouldStream,
  visibleText,
  lastTextPartIndex,
  cumulativeTextLengths,
  index,
  onCitationClick,
}: TextPartRendererProps) {
  const partText = (part as any).text;
  
  if (isUser) {
    return (
      <div className={cn("prose prose-sm max-w-none whitespace-pre-wrap")}>
        <MessageText text={partText} renderMarkdown={true} />
      </div>
    );
  }

  const isLastTextPart = index === lastTextPartIndex;
  let displayText = partText;

  if (shouldStream && isLastTextPart) {
    const startPos = cumulativeTextLengths[index] || 0;
    const endPos = startPos + partText.length;
    displayText = visibleText.slice(startPos, endPos);
  }

  if (shouldStream && (!displayText || displayText.trim() === "")) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
        <span className="text-xs text-gray-500 italic">Pensando...</span>
      </div>
    );
  }

  return (
    <div className={cn("prose prose-sm max-w-none whitespace-pre-wrap")}>
      <MessageText
        text={displayText}
        renderMarkdown={true}
        onCitationClick={onCitationClick}
      />
    </div>
  );
});

interface ReasoningPartRendererProps {
  part: any;
  index: number;
  messageStatus: string;
  messagePartsLength: number;
  onToggle: () => void;
}

const ReasoningPartRenderer = memo(function ReasoningPartRenderer({
  part,
  index,
  messageStatus,
  messagePartsLength,
  onToggle,
}: ReasoningPartRendererProps) {
  const isLastPart = index === (messagePartsLength - 1);
  const reasoningIsStreaming = messageStatus === "streaming" && isLastPart;
  
  return (
    <Reasoning 
      key={`reasoning-${index}`}
      defaultOpen={false} 
      isStreaming={reasoningIsStreaming}
      onToggle={onToggle}
    >
      <ReasoningTrigger className="!text-[10px]" />
      <ReasoningContent className="group relative !px-3 !py-2 !text-[10px] space-y-2 max-w-[85%]">
        {part.text}
      </ReasoningContent>
    </Reasoning>
  );
});

interface SourcePartRendererProps {
  part: any;
  index: number;
  onToggle: () => void;
}

const SourcePartRenderer = memo(function SourcePartRenderer({
  part,
  index,
  onToggle,
}: SourcePartRendererProps) {
  return (
    <Sources key={`source-${index}`} onToggle={onToggle}>
      <SourcesTrigger count={1}>
        Source: {(part as any).title || (part as any).url || "Unknown source"}
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
});

interface FilePartRendererProps {
  part: any;
  index: number;
  onImageLoad: () => void;
}

const FilePartRenderer = memo(function FilePartRenderer({
  part,
  index,
  onImageLoad,
}: FilePartRendererProps) {
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
});

interface ToolPartRendererProps {
  part: any;
  index: number;
}

const ToolPartRenderer = memo(function ToolPartRenderer({
  part,
  index,
}: ToolPartRendererProps) {
  const aiSDKState = (part as any).state;
  const outputType = (part as any)?.output?.type as string | undefined;
  const isError = aiSDKState === "output-available" && (outputType?.startsWith("error-") ?? false);
  
  const toolState = isError 
    ? "output-error" 
    : aiSDKState === "output-available" 
      ? "output-available" 
      : aiSDKState === "input-available"
        ? "input-available"
        : "input-streaming";
  
  return (
    <Tool 
      key={`tool-${index}`} 
      className="mb-4" 
      type={part.type.replace("tool-", "")} 
      state={toolState} 
      output={(part as any)?.output as ToolUIPart["output"]}
    />
  );
});

function SidebarMessageContent({
  message,
  isUser,
  shouldStream,
  visibleText,
  lastTextPartIndex,
  cumulativeTextLengths,
  isStreaming,
  messageText,
  onCitationClick,
  onContentChange,
}: {
  message: any;
  isUser: boolean;
  shouldStream: boolean;
  visibleText: string;
  lastTextPartIndex: number;
  cumulativeTextLengths: number[];
  isStreaming: boolean;
  messageText: string;
  onCitationClick?: (id: string, type: string) => void;
  onContentChange: () => void;
}) {
  return (
    <MessageContent
      className={cn(
        "group relative !rounded-lg !px-3 !py-2 !text-[12px] shadow-sm space-y-2 max-w-[85%]",
        isUser && "!bg-blue-600 !text-white",
        !isUser && "!bg-gray-100 !text-gray-800",
        message.status === "failed" && "!bg-red-100 !text-red-800 border-l-2 border-red-400",
      )}
    >
      {/* Thinking indicator */}
      {!isUser && shouldStream && (!message.parts || message.parts.length === 0 || !messageText || messageText.trim() === "") && (
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <span className="text-xs text-gray-500 italic">Pensando...</span>
        </div>
      )}
      
      {/* Message parts */}
      {message.parts?.map((part: any, index: number) => {
        const partType = part.type;

        if (partType === "text") {
          return (
            <TextPartRenderer
              key={`text-${index}`}
              part={part}
              index={index}
              isUser={isUser}
              shouldStream={shouldStream}
              visibleText={visibleText}
              lastTextPartIndex={lastTextPartIndex}
              cumulativeTextLengths={cumulativeTextLengths}
              onCitationClick={onCitationClick}
            />
          );
        }

        if (partType === "reasoning") {
          return (
            <ReasoningPartRenderer
              key={`reasoning-${index}`}
              part={part}
              index={index}
              messageStatus={message.status}
              messagePartsLength={message.parts?.length || 0}
              onToggle={() => {
                setTimeout(onContentChange, 100);
              }}
            />
          );
        }

        if (partType === "source-url") {
          return (
            <SourcePartRenderer
              key={`source-${index}`}
              part={part}
              index={index}
              onToggle={() => {
                setTimeout(onContentChange, 100);
              }}
            />
          );
        }

        if (partType === "file") {
          return (
            <FilePartRenderer
              key={`file-${index}`}
              part={part}
              index={index}
              onImageLoad={() => {
                setTimeout(onContentChange, 100);
              }}
            />
          );
        }

        if (partType.startsWith("tool-")) {
          return (
            <ToolPartRenderer
              key={`tool-${index}`}
              part={part}
              index={index}
            />
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
  );
}

function SidebarMessageInner({
  message,
  userAvatar,
  assistantAvatar,
  userName = "Usuario",
  assistantName = "iAlex",
  onContentChange,
}: SidebarMessageProps) {
  const [open, setOpen] = useState(false);
  const [normativeId, setNormativeId] = useState("");
  const contentChangeTimeoutRef = useRef<NodeJS.Timeout>(null);

  const isUser = message.role === "user";

  const messageText =
    message.parts
      ?.filter((part) => part.type === "text")
      .map((part: any) => part.text)
      .join("") || "";

  const messageAge = Date.now() - (message._creationTime || 0);
  const toolCalls =
    message.parts?.filter((part) => (part as any).type?.startsWith("tool-")) || [];
  const allToolsCompleted =
    toolCalls.length > 0 &&
    toolCalls.every((part) => (part as any).state === "output-available");

  const shouldStream =
    message.role === "assistant" &&
    (message.status === "streaming" ||
      (message.status === "success" && messageAge < 5000)) &&
    !allToolsCompleted;

  const [visibleText, { isStreaming }] = useSmoothText(messageText, {
    charsPerSec: 80,
    startStreaming: shouldStream,
  });

  // Debounce content change callback to prevent excessive resize observer calls
  const debouncedContentChange = useCallback(() => {
    if (contentChangeTimeoutRef.current) {
      clearTimeout(contentChangeTimeoutRef.current);
    }
    contentChangeTimeoutRef.current = setTimeout(() => {
      if (onContentChange) {
        onContentChange();
      }
    }, 50); // Only call once per 50ms
  }, [onContentChange]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (contentChangeTimeoutRef.current) {
        clearTimeout(contentChangeTimeoutRef.current);
      }
    };
  }, []);

  // Call debounced content change when streaming text updates
  useEffect(() => {
    if (isStreaming) {
      debouncedContentChange();
    }
  }, [visibleText, isStreaming, debouncedContentChange]);

  // Call debounced content change when message parts change
  useEffect(() => {
    debouncedContentChange();
  }, [message.parts, debouncedContentChange]);

  // Memoize cumulative text lengths to avoid recalculating on every render
  const cumulativeTextLengths = useMemo(() => {
    const lengths: number[] = [];
    let cumulative = 0;
    message.parts?.forEach((part: any) => {
      if (part.type === "text") {
        lengths.push(cumulative);
        cumulative += (part as any).text.length;
      } else {
        lengths.push(cumulative);
      }
    });
    return lengths;
  }, [message.parts]);

  const lastTextPartIndex = useMemo(() => {
    const parts = message.parts || [];
    for (let i = parts.length - 1; i >= 0; i--) {
      if ((parts[i] as any).type === "text") return i;
    }
    return -1;
  }, [message.parts]);

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

      <SidebarMessageContent
        message={message}
        isUser={isUser}
        shouldStream={shouldStream}
        visibleText={visibleText}
        lastTextPartIndex={lastTextPartIndex}
        cumulativeTextLengths={cumulativeTextLengths}
        isStreaming={isStreaming}
        messageText={messageText}
        onCitationClick={!isUser ? (id) => {
          setOpen(true);
          setNormativeId(id);
        } : undefined}
        onContentChange={debouncedContentChange}
      />

      <LegislationModal open={open} setOpen={setOpen} normativeId={normativeId} />
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
