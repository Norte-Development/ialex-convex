import { createContext, useContext } from "react";
import { useCasePermissions } from "@/hooks/useCasePermissions";
import { Id } from "../../convex/_generated/dataModel";

const CasePermissionsContext = createContext<ReturnType<typeof useCasePermissions> | null>(null);

export function CasePermissionsProvider({ 
  caseId, 
  children 
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

export function useCasePerms() {
  const ctx = useContext(CasePermissionsContext);
  if (!ctx) {
    throw new Error("useCasePerms must be used within CasePermissionsProvider. Use useCasePermissions directly if outside case routes.");
  }
  return ctx;
} 