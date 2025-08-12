import { type Permission } from "@/permissions/types";
import { usePermissions } from "@/context/CasePermissionsContext";

interface ContextCanProps {
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ContextCan({ permission, children, fallback = null }: ContextCanProps) {
  const { hasPermission, isLoading } = usePermissions();
  
  if (isLoading || !hasPermission(permission)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
} 