import { PERMISSIONS, type Permission } from "@/permissions/types";
import { useCasePermissions } from "@/hooks/useCasePermissions";
import { Id } from "../../../convex/_generated/dataModel";

interface CanProps {
  permission: Permission;
  caseId: Id<"cases"> | null;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function Can({ permission, caseId, children, fallback = null }: CanProps) {
  const { hasPermission, isLoading } = useCasePermissions(caseId);
  
  if (isLoading || !hasPermission(permission)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
} 