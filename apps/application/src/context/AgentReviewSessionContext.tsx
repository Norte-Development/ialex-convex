import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { Id } from "../../convex/_generated/dataModel";

export type DocumentType = "escrito" | "document" | "modelo";

export interface AgentEditedDocument {
  id: string; // prosemirrorId (used as unique key)
  documentId: Id<"escritos"> | Id<"documents"> | Id<"modelos"> | null; // Convex ID for navigation
  prosemirrorId: string;
  title: string;
  type: DocumentType;
  caseId?: Id<"cases">; // Case ID for navigation (needed for escritos/documents)
  pendingChangesCount: number;
  lastEditedAt: number;
  hasUnseenSuggestions: boolean;
}

interface AgentReviewSessionContextType {
  documents: AgentEditedDocument[];
  activeDocumentId: string | null;
  registerDocument: (
    id: string,
    documentId: Id<"escritos"> | Id<"documents"> | Id<"modelos"> | null,
    prosemirrorId: string,
    title: string,
    type: DocumentType,
    caseId?: Id<"cases">,
  ) => void;
  unregisterDocument: (id: string) => void;
  updateDocumentChanges: (id: string, pendingChangesCount: number) => void;
  setActiveDocument: (id: string | null) => void;
  clearSession: () => void;
}

const AgentReviewSessionContext = createContext<AgentReviewSessionContextType | undefined>(
  undefined,
);

interface AgentReviewSessionProviderProps {
  children: React.ReactNode;
}

export function AgentReviewSessionProvider({
  children,
}: AgentReviewSessionProviderProps) {
  const [documents, setDocuments] = useState<AgentEditedDocument[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);

  const registerDocument = useCallback(
    (
      id: string,
      documentId: Id<"escritos"> | Id<"documents"> | Id<"modelos"> | null,
      prosemirrorId: string,
      title: string,
      type: DocumentType,
      caseId?: Id<"cases">,
    ) => {
      setDocuments((prev) => {
        // Check if document already exists
        const existingIndex = prev.findIndex((doc) => doc.id === id);
        if (existingIndex >= 0) {
          // Update existing document
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            documentId,
            prosemirrorId,
            title,
            type,
            caseId,
            lastEditedAt: Date.now(),
          };
          return updated;
        }
        // Add new document
        return [
          ...prev,
          {
            id,
            documentId,
            prosemirrorId,
            title,
            type,
            caseId,
            pendingChangesCount: 0,
            lastEditedAt: Date.now(),
            hasUnseenSuggestions: false,
          },
        ];
      });
    },
    [],
  );

  const unregisterDocument = useCallback((id: string) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
    setActiveDocumentId((current) => (current === id ? null : current));
  }, []);

  const updateDocumentChanges = useCallback((id: string, pendingChangesCount: number) => {
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === id
          ? {
              ...doc,
              pendingChangesCount,
              lastEditedAt: Date.now(),
              hasUnseenSuggestions:
                pendingChangesCount > 0 && doc.id !== activeDocumentId,
            }
          : doc,
      ),
    );
  }, [activeDocumentId]);

  const setActiveDocument = useCallback((id: string | null) => {
    setActiveDocumentId(id);
    // Mark suggestions as seen when document becomes active
    if (id) {
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === id ? { ...doc, hasUnseenSuggestions: false } : doc,
        ),
      );
    }
  }, []);

  const clearSession = useCallback(() => {
    setDocuments([]);
    setActiveDocumentId(null);
  }, []);

  // Clear session when component unmounts or when explicitly cleared
  useEffect(() => {
    return () => {
      // Optional: clear on unmount if needed
    };
  }, []);

  const value: AgentReviewSessionContextType = {
    documents,
    activeDocumentId,
    registerDocument,
    unregisterDocument,
    updateDocumentChanges,
    setActiveDocument,
    clearSession,
  };

  return (
    <AgentReviewSessionContext.Provider value={value}>
      {children}
    </AgentReviewSessionContext.Provider>
  );
}

export function useAgentReviewSession(): AgentReviewSessionContextType {
  const context = useContext(AgentReviewSessionContext);
  if (context === undefined) {
    throw new Error(
      "useAgentReviewSession must be used within an AgentReviewSessionProvider",
    );
  }
  return context;
}

