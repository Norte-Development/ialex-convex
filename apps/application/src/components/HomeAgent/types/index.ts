/**
 * HomeAgent Types Index
 * 
 * Central export point for all HomeAgent type definitions.
 */

// Thread Types
export type {
  HomeThread,
  HomeThreadListItem,
  CreateThreadParams,
  UpdateThreadParams,
} from "./thread-types";

// Message Types
export type {
  MessageRole,
  TextPart,
  ToolCallPart,
  ToolResultPart,
  MessagePart,
  HomeMessage,
  SendMessageParams,
} from "./message-types";

// UI Types
export type {
  HomeAgentPageProps,
  ThreadListProps,
  ThreadListItemProps,
  ChatInterfaceProps,
  MessageDisplayProps,
  ChatInputProps,
  EmptyStateProps,
} from "./ui-types";

export type {
  HomeAgentMediaRef,
  HomeAgentMediaKind,
} from "./media-types";
export { HOME_AGENT_MAX_MEDIA_BYTES } from "./media-types";
