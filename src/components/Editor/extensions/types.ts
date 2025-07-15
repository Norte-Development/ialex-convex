export type Snapshot = {
    versionId: string
    createdAt: number
    createdBy: 'user' | 'agent'
    content: any // Editor JSON
    delta?: any // JSON delta for changes (replaces text-based diff)
  }

export interface ProseMirrorNode {
  type: string;
  content?: ProseMirrorNode[];
  text?: string;
  marks?: any[];
  attrs?: Record<string, any>;
  [key: string]: any; // Allow additional metadata (e.g., __textChange)
}
