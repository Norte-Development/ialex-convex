import { Id } from "../../../../convex/_generated/dataModel";

// ============================================
// TYPE: Structured Case Summary (matches Zod schema in backend)
// ============================================
export interface CaseSummaryContent {
  keyFacts: Array<{ fact: string; importance: "high" | "medium" | "low" }>;
  relevantActions: Array<{
    action: string;
    date: string;
    status: "completed" | "in_progress" | "pending";
  }>;
  currentStatus: {
    summary: string;
    phase:
      | "initial"
      | "investigation"
      | "negotiation"
      | "litigation"
      | "appeal"
      | "closed";
    urgency: "urgent" | "normal" | "low";
  };
  nextSteps: Array<{
    step: string;
    priority: "high" | "medium" | "low";
    actionType:
      | "document"
      | "meeting"
      | "filing"
      | "research"
      | "communication"
      | "other";
    deadline: string;
  }>;
}

export interface CaseSummaryPanelProps {
  caseId: Id<"cases">;
  existingSummary?: string;
  summaryUpdatedAt?: number;
  manuallyEdited?: boolean;
}
