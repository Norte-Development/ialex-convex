// Permission constants for type safety and consistency
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

export type UserCasePermissions = {
  hasAccess: boolean;
  permissions: Permission[];
  accessLevel: "none" | "read" | "write" | "full";
  source: "owner" | "team" | "direct" | "none";
  isLoading: boolean;
};

export type PermissionCapabilities = {
  // Case capabilities
  viewCase: boolean;
  editCase: boolean;
  deleteCase: boolean;
  
  // Document capabilities
  docs: {
    read: boolean;
    write: boolean;
    delete: boolean;
  };
  
  // Escrito capabilities
  escritos: {
    read: boolean;
    write: boolean;
    delete: boolean;
  };
  
  // Client capabilities
  clients: {
    read: boolean;
    write: boolean;
    delete: boolean;
  };
  
  // Team capabilities
  teams: {
    read: boolean;
    write: boolean;
  };
  
  // Chat capability
  chat: boolean;
}; 