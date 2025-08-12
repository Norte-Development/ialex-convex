import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { PERMISSIONS, type Permission, type UserCasePermissions, type PermissionCapabilities } from "@/permissions/types";

export function useCasePermissions(caseId: Id<"cases"> | null) {
  const data = useQuery(
    api.functions.permissions.getUserCasePermissions,
    caseId ? { caseId } : "skip"
  );

  const isLoading = data === undefined;

  // Normalize return shape to prevent undefined access
  const normalized: UserCasePermissions = {
    hasAccess: Boolean(data?.hasAccess),
    permissions: (data?.permissions as Permission[]) ?? [],
    accessLevel: (data?.accessLevel as UserCasePermissions["accessLevel"]) ?? "none",
    source: (data?.source as UserCasePermissions["source"]) ?? "none",
    isLoading,
  };

  const hasPermission = (permission: Permission): boolean => {
    if (!normalized.hasAccess || normalized.isLoading) return false;
    return (
      normalized.permissions.includes(PERMISSIONS.FULL) ||
      normalized.permissions.includes(permission)
    );
  };

  const hasFullAccess = normalized.accessLevel === "full" || hasPermission(PERMISSIONS.FULL);

  // Granular capability object for better semantics
  const can: PermissionCapabilities = {
    // Case capabilities
    viewCase: hasPermission(PERMISSIONS.CASE_VIEW) || hasFullAccess,
    editCase: hasPermission(PERMISSIONS.CASE_EDIT) || hasFullAccess,
    deleteCase: hasPermission(PERMISSIONS.CASE_DELETE) || hasFullAccess,
    
    // Document capabilities
    docs: {
      read: hasPermission(PERMISSIONS.DOC_READ) || hasFullAccess,
      write: hasPermission(PERMISSIONS.DOC_WRITE) || hasFullAccess,
      delete: hasPermission(PERMISSIONS.DOC_DELETE) || hasFullAccess,
    },
    
    // Escrito capabilities
    escritos: {
      read: hasPermission(PERMISSIONS.ESCRITO_READ) || hasFullAccess,
      write: hasPermission(PERMISSIONS.ESCRITO_WRITE) || hasFullAccess,
      delete: hasPermission(PERMISSIONS.ESCRITO_DELETE) || hasFullAccess,
    },
    
    // Client capabilities
    clients: {
      read: hasPermission(PERMISSIONS.CLIENT_READ) || hasFullAccess,
      write: hasPermission(PERMISSIONS.CLIENT_WRITE) || hasFullAccess,
      delete: hasPermission(PERMISSIONS.CLIENT_DELETE) || hasFullAccess,
    },
    
    // Team capabilities
    teams: {
      read: hasPermission(PERMISSIONS.TEAM_READ) || hasFullAccess,
      write: hasPermission(PERMISSIONS.TEAM_WRITE) || hasFullAccess,
    },
    
    // Chat capability
    chat: hasPermission(PERMISSIONS.CHAT_ACCESS) || hasFullAccess,
  };

  return {
    ...normalized,
    hasPermission,
    can,
  };
} 