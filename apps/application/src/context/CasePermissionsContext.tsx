import { createContext, useContext } from "react";
import { useCasePermissions } from "@/hooks/useCasePermissions";
import { Id } from "../../convex/_generated/dataModel";

// Context que proporciona acceso a los permisos del caso usando el nuevo sistema jerárquico
const CasePermissionsContext = createContext<ReturnType<
  typeof useCasePermissions
> | null>(null);

export function CasePermissionsProvider({
  caseId,
  children,
}: {
  caseId: Id<"cases"> | null;
  children: React.ReactNode;
}) {
  const value = useCasePermissions(caseId);

  return (
    <CasePermissionsContext.Provider value={value}>
      {children}
    </CasePermissionsContext.Provider>
  );
}

export function usePermissions() {
  const ctx = useContext(CasePermissionsContext);
  if (!ctx) {
    throw new Error(
      "usePermissions must be used within CasePermissionsProvider.",
    );
  }
  return ctx;
}

// Alias para compatibilidad con código existente
export const useCasePermissionsContext = usePermissions;
