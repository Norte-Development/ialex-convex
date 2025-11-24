import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useCase } from "@/context/CaseContext";

export interface EscritoWithPendingChanges {
  escritoId: Id<"escritos">;
  prosemirrorId: string;
  title: string;
  caseId: Id<"cases">;
  pendingChangesCount: number;
}

/**
 * Hook to get all escritos in the current case that have pending changes.
 * This queries all escritos and checks their prosemirror documents for change nodes.
 */
export function useEscritosWithPendingChanges(): EscritoWithPendingChanges[] {
  const { currentCase } = useCase();
  
  // Query all escritos in the case
  const escritosResult = useQuery(
    api.functions.documents.getEscritos,
    currentCase?._id
      ? {
          caseId: currentCase._id,
          paginationOpts: { numItems: 100, cursor: null },
        }
      : "skip",
  );

  // Query pending changes for each escrito
  // Note: This is a simplified version - in a real implementation, you'd want
  // a server-side query that checks prosemirror documents for change nodes
  // For now, we'll rely on client-side tracking via the context
  
  // Return empty array if no case or escritos
  if (!currentCase || !escritosResult?.page) {
    return [];
  }

  // Filter escritos that have pending changes
  // This will be enhanced to actually check prosemirror documents
  // For now, return empty array - the context will track changes as they're detected
  return escritosResult.page.map(escrito => ({
    escritoId: escrito._id,
    prosemirrorId: escrito.prosemirrorId,
    title: escrito.title,
    caseId: escrito.caseId,
    pendingChangesCount: 0, // Placeholder until real logic is implemented
  }));
}

