import { PERMISSIONS, type Permission } from "@/permissions/types";
import { useCasePermissions } from "@/hooks/useCasePermissions";
import { Id } from "../../../convex/_generated/dataModel";

interface PermissionGuardProps {
  children: React.ReactNode;
  permission: Permission;
  caseId: Id<"cases"> | null;
  fallback?: React.ReactNode;
  loadingFallback?: React.ReactNode;
}

export function PermissionGuard({ 
  children, 
  permission, 
  caseId,
  fallback = null,
  loadingFallback = <div className="animate-pulse bg-gray-200 h-4 w-20 rounded" />
}: PermissionGuardProps) {
  const { hasPermission, isLoading } = useCasePermissions(caseId);
  
  if (isLoading) {
    return <>{loadingFallback}</>;
  }
  
  if (!hasPermission(permission)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
} 