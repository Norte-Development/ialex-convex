/**
 * Tool Types
 *
 * This file contains type definitions for tool-related functionality used in the Agent components.
 */

/**
 * Tool execution states
 */
export type ToolState = "call" | "result" | "error" | string;

/**
 * Tool execution part interface
 */
export type ToolPart = {
  input?: unknown;
  output?: {
    type: string;
    value: unknown;
  };
  error?: string;
  toolCallId?: string;
  startedAt?: string | number | Date;
  completedAt?: string | number | Date;
  // Legacy support
  args?: unknown;
  result?: unknown;
};

/**
 * Props for the ToolCallDisplay component
 */
export interface ToolCallDisplayProps {
  state: ToolState;
  part: ToolPart;
}
