import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import {
  ACCESS_LEVELS,
  type AccessLevel,
  type UserCasePermissions,
  type PermissionCapabilities,
  hasMinimumAccess,
  // Keep legacy for compatibility during migration
  PERMISSIONS,
  type Permission,
} from "@/permissions/types";

export function useCasePermissions(caseId: Id<"cases"> | null) {
  // Use the new backend function
  const data = useQuery(
    api.functions.cases.checkUserCaseAccess,
    caseId ? { caseId } : "skip",
  );

  const isLoading = data === undefined;

  // Normalize return shape for new system
  const normalized: UserCasePermissions = {
    hasAccess: Boolean(data?.hasAccess),
    accessLevel: (data?.userLevel as AccessLevel) ?? null,
    source: (data?.source as "user" | "team") ?? null,
    isLoading,
  };

  // New access level checking function
  const hasAccessLevel = (requiredLevel: AccessLevel): boolean => {
    if (
      !normalized.hasAccess ||
      normalized.isLoading ||
      !normalized.accessLevel
    )
      return false;
    return hasMinimumAccess(normalized.accessLevel, requiredLevel);
  };

  // Legacy function for backwards compatibility during migration
  const hasPermission = (permission: Permission): boolean => {
    if (!normalized.hasAccess || normalized.isLoading) return false;

    // Map old permissions to new access levels
    const permissionMap: Record<Permission, AccessLevel> = {
      [PERMISSIONS.CASE_VIEW]: ACCESS_LEVELS.BASIC,
      [PERMISSIONS.DOC_READ]: ACCESS_LEVELS.BASIC,
      [PERMISSIONS.ESCRITO_READ]: ACCESS_LEVELS.BASIC,
      [PERMISSIONS.CLIENT_READ]: ACCESS_LEVELS.BASIC,
      [PERMISSIONS.TEAM_READ]: ACCESS_LEVELS.BASIC,
      [PERMISSIONS.CHAT_ACCESS]: ACCESS_LEVELS.BASIC,

      [PERMISSIONS.CASE_EDIT]: ACCESS_LEVELS.ADVANCED,
      [PERMISSIONS.DOC_WRITE]: ACCESS_LEVELS.ADVANCED,
      [PERMISSIONS.ESCRITO_WRITE]: ACCESS_LEVELS.ADVANCED,
      [PERMISSIONS.CLIENT_WRITE]: ACCESS_LEVELS.ADVANCED,

      [PERMISSIONS.CASE_DELETE]: ACCESS_LEVELS.ADMIN,
      [PERMISSIONS.DOC_DELETE]: ACCESS_LEVELS.ADMIN,
      [PERMISSIONS.ESCRITO_DELETE]: ACCESS_LEVELS.ADMIN,
      [PERMISSIONS.CLIENT_DELETE]: ACCESS_LEVELS.ADMIN,
      [PERMISSIONS.TEAM_WRITE]: ACCESS_LEVELS.ADMIN,
      [PERMISSIONS.FULL]: ACCESS_LEVELS.ADMIN,
    };

    const requiredLevel = permissionMap[permission];
    return requiredLevel ? hasAccessLevel(requiredLevel) : false;
  };

  // New simplified capability object based on access levels
  const can: PermissionCapabilities = {
    // Case capabilities - based on access level hierarchy
    viewCase: hasAccessLevel(ACCESS_LEVELS.BASIC),
    editCase: hasAccessLevel(ACCESS_LEVELS.ADVANCED),
    deleteCase: hasAccessLevel(ACCESS_LEVELS.ADMIN),
    manageCase: hasAccessLevel(ACCESS_LEVELS.ADMIN),

    // Document capabilities
    docs: {
      read: hasAccessLevel(ACCESS_LEVELS.BASIC),
      write: hasAccessLevel(ACCESS_LEVELS.ADVANCED),
      delete: hasAccessLevel(ACCESS_LEVELS.ADMIN),
    },

    // Escrito capabilities
    escritos: {
      read: hasAccessLevel(ACCESS_LEVELS.BASIC),
      write: hasAccessLevel(ACCESS_LEVELS.ADVANCED),
      delete: hasAccessLevel(ACCESS_LEVELS.ADMIN),
    },

    // Client capabilities
    clients: {
      read: hasAccessLevel(ACCESS_LEVELS.BASIC),
      write: hasAccessLevel(ACCESS_LEVELS.ADVANCED),
      delete: hasAccessLevel(ACCESS_LEVELS.ADMIN),
    },

    // Team capabilities
    teams: {
      read: hasAccessLevel(ACCESS_LEVELS.BASIC),
      write: hasAccessLevel(ACCESS_LEVELS.ADMIN), // Only admins can manage teams
    },

    // Chat capability
    chat: hasAccessLevel(ACCESS_LEVELS.BASIC),

    // Permission management
    permissions: {
      grant: hasAccessLevel(ACCESS_LEVELS.ADMIN),
      revoke: hasAccessLevel(ACCESS_LEVELS.ADMIN),
    },
  };

  return {
    ...normalized,
    hasAccessLevel, // New function
    hasPermission, // Legacy function for compatibility
    can,
  };
}
