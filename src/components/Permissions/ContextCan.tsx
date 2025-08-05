import { PERMISSIONS, type Permission } from "@/permissions/types";
import { useCasePerms } from "@/contexts/CasePermissionsContext";

interface ContextCanProps {
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ContextCan({ permission, children, fallback = null }: ContextCanProps) {
  const { hasPermission, isLoading } = useCasePerms();
  
  if (isLoading || !hasPermission(permission)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
} 