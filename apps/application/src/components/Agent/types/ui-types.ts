/**
 * UI Component Props Types
 *
 * This file contains type definitions for UI component props used in the Agent components.
 */

export interface SidebarChatbotProps {
  isOpen: boolean;
  onToggle: () => void;
  width: number;
  onWidthChange: (width: number) => void;
  onResizeStart: () => void;
  onResizeEnd: () => void;
}

export interface ResizeHandleProps {
  onMouseDown: (e: React.MouseEvent) => void;
}

export interface ToggleButtonProps {
  onToggle: () => void;
}

/**
 * Props for the Pill component used in ContextSummaryBar
 */
export type PillProps = {
  label: string;
  value?: string | null;
  icon?: React.ReactNode;
  variant?: "default" | "accent";
};
