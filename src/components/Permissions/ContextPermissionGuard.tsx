import { type Permission } from "@/permissions/types";
import { usePermissions } from "@/context/CasePermissionsContext";

interface ContextPermissionGuardProps {
  children: React.ReactNode;
  permission: Permission;
  fallback?: React.ReactNode;
  loadingFallback?: React.ReactNode;
}

export function ContextPermissionGuard({ 
  children, 
  permission, 
  fallback = null,
  loadingFallback = <div className="animate-pulse bg-gray-200 h-4 w-20 rounded" />
}: ContextPermissionGuardProps) {
  const { hasPermission, isLoading } = usePermissions();
  
  if (isLoading) {
    return <>{loadingFallback}</>;
  }
  
  if (!hasPermission(permission)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
} 