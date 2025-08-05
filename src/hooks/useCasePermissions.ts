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

  // Granular capability object for better semantics
  const can: PermissionCapabilities = {
    // Case capabilities
    viewCase: hasPermission(PERMISSIONS.CASE_VIEW),
    editCase: hasPermission(PERMISSIONS.CASE_EDIT) || hasPermission(PERMISSIONS.FULL),
    deleteCase: hasPermission(PERMISSIONS.CASE_DELETE) || hasPermission(PERMISSIONS.FULL),
    
    // Document capabilities
    docs: {
      read: hasPermission(PERMISSIONS.DOC_READ),
      write: hasPermission(PERMISSIONS.DOC_WRITE),
      delete: hasPermission(PERMISSIONS.DOC_DELETE),
    },
    
    // Escrito capabilities
    escritos: {
      read: hasPermission(PERMISSIONS.ESCRITO_READ),
      write: hasPermission(PERMISSIONS.ESCRITO_WRITE),
      delete: hasPermission(PERMISSIONS.ESCRITO_DELETE),
    },
    
    // Client capabilities
    clients: {
      read: hasPermission(PERMISSIONS.CLIENT_READ),
      write: hasPermission(PERMISSIONS.CLIENT_WRITE),
      delete: hasPermission(PERMISSIONS.CLIENT_DELETE),
    },
    
    // Team capabilities
    teams: {
      read: hasPermission(PERMISSIONS.TEAM_READ),
      write: hasPermission(PERMISSIONS.TEAM_WRITE),
    },
    
    // Chat capability
    chat: hasPermission(PERMISSIONS.CHAT_ACCESS),
  };

  return { 
    ...normalized, 
    hasPermission, 
    can,
    // Backward compatibility aliases
    canView: can.viewCase,
    canAccessDocuments: can.docs.read,
    canAccessEscritos: can.escritos.read,
    canManageClients: can.clients.write,
    canAccessChat: can.chat,
    canManageTeams: can.teams.write,
    canDoEverything: hasPermission(PERMISSIONS.FULL),
  };
} 