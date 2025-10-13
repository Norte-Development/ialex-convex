/**
 * HomeAgent UI Component Types
 * 
 * Type definitions for UI components in the home agent system.
 */

import { HomeThread } from "./thread-types";
import { HomeMessage } from "./message-types";

/**
 * Props for the main HomeAgent page component
 */
export interface HomeAgentPageProps {
  threadId?: string;
}

/**
 * Props for the thread list sidebar
 */
export interface ThreadListProps {
  threads: HomeThread[];
  currentThreadId?: string;
  onThreadSelect: (threadId: string) => void;
  onNewThread: () => void;
  isLoading?: boolean;
}

/**
 * Props for individual thread list item
 */
export interface ThreadListItemProps {
  thread: HomeThread;
  isActive: boolean;
  onClick: () => void;
}

/**
 * Props for the chat interface
 */
export interface ChatInterfaceProps {
  threadId: string;
  messages: HomeMessage[];
  onSendMessage: (content: string) => void;
  isLoading?: boolean;
  isStreaming?: boolean;
}

/**
 * Props for message display component
 */
export interface MessageDisplayProps {
  message: HomeMessage;
  isStreaming?: boolean;
}

/**
 * Props for chat input component
 */
export interface ChatInputProps {
  onSend: (content: string) => void;
  isDisabled?: boolean;
  placeholder?: string;
}

/**
 * Props for empty state component
 */
export interface EmptyStateProps {
  onNewThread: () => void;
}
