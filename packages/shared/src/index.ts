export * as diff from "./diff";
export * as tiptap from "./tiptap";

export type ProcessingCallbackBody = {
  status: "completed" | "failed";
  documentId: string;
  totalChunks?: number;
  method?: string;
  durationMs?: number;
  error?: string;
};


