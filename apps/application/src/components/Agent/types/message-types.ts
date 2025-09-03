/**
 * Message Types
 *
 * This file contains type definitions for message-related functionality used in the Agent components.
 */

import type { UIMessage } from "@convex-dev/agent/react";
import type { Reference, ReferenceWithOriginal } from "./reference-types";

/**
 * Props for the ChatInput component
 */
export interface ChatInputProps {
  /**
   * Callback function called when user submits a message
   * @param message - The trimmed message text from the user
   */
  onSendMessage: (message: string) => void;

  /**
   * Indicates whether the AI is currently streaming a response
   * When true, shows abort button and disables send functionality
   */
  isStreaming: boolean;

  /**
   * Callback function called when user wants to abort the current stream
   * Only relevant when isStreaming is true
   */
  onAbortStream: () => void;

  /**
   * Optional placeholder text for the input field
   * @default "¿En qué trabajamos hoy?"
   */
  placeholder?: string;

  /**
   * Optional minimum height for the textarea in pixels
   * @default 48
   */
  minHeight?: number;

  /**
   * Optional maximum height for the textarea in pixels before scrolling
   * @default 120
   */
  maxHeight?: number;

  /**
   * Optional disabled state for the entire input
   * @default false
   */
  disabled?: boolean;

  /**
   * Callback function called when active references change
   * @param references - Array of active references selected from autocomplete
   */
  onReferencesChange?: (references: Reference[]) => void;
}

/**
 * Props for the SidebarMessage component
 */
export interface SidebarMessageProps {
  /**
   * The message object from the AI conversation
   * Contains message content, role, status, and parts
   */
  message: UIMessage;

  /**
   * Optional avatar URL for the user
   * If not provided, will use fallback with user initials
   */
  userAvatar?: string;

  /**
   * Optional avatar URL for the assistant
   * If not provided, will use fallback with assistant initials
   */
  assistantAvatar?: string;

  /**
   * Optional user name for avatar fallback
   * @default "Usuario"
   */
  userName?: string;

  /**
   * Optional assistant name for avatar fallback
   * @default "iAlex"
   */
  assistantName?: string;
}

/**
 * Props for the ContextSummaryBar component
 */
export interface ContextSummaryBarProps {
  references?: ReferenceWithOriginal[];
  onRemoveReference?: (index: number) => void;
}
