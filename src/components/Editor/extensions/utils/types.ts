export const CHANGE_TYPES = {
  ADDED: 'added',
  DELETED: 'deleted',
  MODIFIED: 'modified',
  LINE_BREAK: 'line_break',
  PARAGRAPH_MERGE: 'paragraph_merge',
  FORMATTING_CHANGE: 'formatting_change'
} as const;
  
export const INLINE_NODE_TYPES = ['text', 'em', 'strong', 'code', 'link', 'italic', 'bold'];
export const BLOCK_NODE_TYPES = ['paragraph', 'heading', 'blockquote', 'orderedList', 'bulletList', 'codeBlock', 'listItem'];
  
export type ChangeType = typeof CHANGE_TYPES[keyof typeof CHANGE_TYPES];