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
    // Return default values with no permissions instead of throwing
    return {
      hasAccess: false,
      accessLevel: null,
      source: null,
      isLoading: false,
      hasAccessLevel: () => false,
      hasPermission: () => false,
      can: {
        viewCase: false,
        editCase: false,
        deleteCase: false,
        manageCase: false,
        docs: {
          read: false,
          write: false,
          delete: false,
        },
        escritos: {
          read: false,
          write: false,
          delete: false,
        },
        clients: {
          read: false,
          write: false,
          delete: false,
        },
        teams: {
          read: false,
          write: false,
        },
        chat: false,
        permissions: {
          grant: false,
          revoke: false,
        },
      },
    };
  }
  return ctx;
}

// Alias para compatibilidad con código existente
export const useCasePermissionsContext = usePermissions;
