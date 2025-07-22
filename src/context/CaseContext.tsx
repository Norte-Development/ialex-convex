import React, { createContext, useContext, ReactNode, useMemo } from "react";
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

  const cases = useQuery(api.functions.cases.getCases, {});

  const currentCase = useMemo(() => {
    if (!cases || !id) {
      return null;
    }
    const found = cases.find((caseItem) => caseItem._id === id);

    return found;
  }, [cases, id]);

  const contextValue: CaseContextType = {
    currentCase,
    isLoading: cases === undefined,
    error:
      id && cases && !currentCase ? `Caso no encontrado con ID: ${id}` : null,
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
    throw new Error("useCase must be used within a CaseProvider");
  }
  return context;
};

export default CaseContext;
