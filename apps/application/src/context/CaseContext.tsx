import React, { createContext, useContext, ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Case } from "types/cases";

interface CaseContextType {
  currentCase: Case | null | undefined;
  isLoading: boolean;
  error: string | null;
  caseId: Id<"cases"> | null;
  caseTitle: string | null;
}

const CaseContext = createContext<CaseContextType | undefined>(undefined);

interface CaseProviderProps {
  children: ReactNode;
}

export const CaseProvider: React.FC<CaseProviderProps> = ({ children }) => {
  const { id } = useParams<{ id: string }>();

  const currentCase = useQuery(
    api.functions.cases.getCaseById,
    id ? { caseId: id as Id<"cases"> } : "skip"
  );

  const contextValue: CaseContextType = {
    currentCase,
    isLoading: currentCase === undefined,
    error: currentCase === null && id ? `Caso no encontrado con ID: ${id}` : null,
    caseId: currentCase?._id || null,
    caseTitle: currentCase?.title || null,
  };

  return (
    <CaseContext.Provider value={contextValue}>{children}</CaseContext.Provider>
  );
};

export const useCase = (): CaseContextType => {
  const context = useContext(CaseContext);
  if (context === undefined) {
    // Return default values instead of throwing
    return {
      currentCase: null,
      isLoading: false,
      error: null,
      caseId: null,
      caseTitle: null,
    };
  }
  return context;
};

export default CaseContext;
