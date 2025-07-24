export interface Thread {
  _id: string;
  threadId: string;
  caseId?: string;
  title?: string;
  agentType?: string;
  isActive: boolean;
}