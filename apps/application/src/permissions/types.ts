// ========================================
// NEW UNIFIED PERMISSIONS SYSTEM
// Matches backend: basic < advanced < admin
// ========================================

export const ACCESS_LEVELS = {
  BASIC: "basic" as const,
  ADVANCED: "advanced" as const,
  ADMIN: "admin" as const,
} as const;

export type AccessLevel = (typeof ACCESS_LEVELS)[keyof typeof ACCESS_LEVELS];

// New simplified user permissions type
export type UserCasePermissions = {
  hasAccess: boolean;
  accessLevel: AccessLevel | null;
  source: "user" | "team" | null;
  isLoading: boolean;
};

// ========================================
// LEGACY SYSTEM (DEPRECATED - Keep for compatibility during migration)
// ========================================

export const PERMISSIONS = {
  // Case-level permissions
  CASE_VIEW: "case.view",
  CASE_EDIT: "case.edit",
  CASE_DELETE: "case.delete",

  // Document permissions
  DOC_READ: "documents.read",
  DOC_WRITE: "documents.write",
  DOC_DELETE: "documents.delete",

  // Escrito permissions
  ESCRITO_READ: "escritos.read",
  ESCRITO_WRITE: "escritos.write",
  ESCRITO_DELETE: "escritos.delete",

  // Client permissions
  CLIENT_READ: "clients.read",
  CLIENT_WRITE: "clients.write",
  CLIENT_DELETE: "clients.delete",

  // Team permissions
  TEAM_READ: "teams.read",
  TEAM_WRITE: "teams.write",

  // Chat permissions
  CHAT_ACCESS: "chat.access",

  // Full access
  FULL: "full",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// ========================================
// NEW SIMPLIFIED CAPABILITIES SYSTEM
// Based on access levels rather than granular permissions
// ========================================

export type PermissionCapabilities = {
  // Case capabilities - based on access level
  viewCase: boolean; // basic+
  editCase: boolean; // advanced+
  deleteCase: boolean; // admin
  manageCase: boolean; // admin

  // Document capabilities
  docs: {
    read: boolean; // basic+
    write: boolean; // advanced+
    delete: boolean; // admin
  };

  // Escrito capabilities
  escritos: {
    read: boolean; // basic+
    write: boolean; // advanced+
    delete: boolean; // admin
  };

  // Client capabilities
  clients: {
    read: boolean; // basic+
    write: boolean; // advanced+
    delete: boolean; // admin
  };

  // Team capabilities
  teams: {
    read: boolean; // basic+
    write: boolean; // admin
  };

  // Chat capability
  chat: boolean; // basic+

  // Permission management
  permissions: {
    grant: boolean; // admin
    revoke: boolean; // admin
  };
};

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Check if an access level meets the minimum required level
 * admin > advanced > basic
 */
export function hasMinimumAccess(
  userLevel: AccessLevel | null,
  requiredLevel: AccessLevel,
): boolean {
  if (!userLevel) return false;

  const levels = {
    [ACCESS_LEVELS.BASIC]: 1,
    [ACCESS_LEVELS.ADVANCED]: 2,
    [ACCESS_LEVELS.ADMIN]: 3,
  };

  return levels[userLevel] >= levels[requiredLevel];
}
