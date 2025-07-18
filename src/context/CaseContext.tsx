import React, { createContext, useContext, ReactNode, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface Case {
  _id: Id<"cases">;
  title: string;
  description?: string;
  status: string;
  priority: string;
  category?: string;
  assignedLawyer: Id<"users">;
  createdBy: Id<"users">;
  startDate: number;
  estimatedHours?: number;
  isArchived: boolean;
}

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
  const { title } = useParams<{ title: string }>();

  // Obtener todos los casos para encontrar el que coincida con el title
  const cases = useQuery(api.functions.cases.getCases, {});

  // Encontrar el caso actual basado en el title del URL
  const currentCase = useMemo(() => {
    if (!cases || !title) return null;

    const slug = title.toLowerCase().replace(/-/g, " ");
    return cases.find((caseItem) => caseItem.title.toLowerCase() === slug);
  }, [cases, title]);

  const contextValue: CaseContextType = {
    currentCase,
    isLoading: cases === undefined,
    error:
      title && cases && !currentCase ? `Caso no encontrado: ${title}` : null,
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
