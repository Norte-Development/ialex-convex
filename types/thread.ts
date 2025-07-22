export interface Thread {
  _id: string;
  threadId: string;
  caseId?: string;
  userId: string;
  title?: string;
  agentType?: string;
  isActive: boolean;
}