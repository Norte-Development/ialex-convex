export type ProcessingCallbackBody = {
  status: "completed" | "failed";
  documentId: string;
  totalChunks?: number;
  method?: string;
  durationMs?: number;
  error?: string;
};


