// ========================================
// CONVEX FUNCTIONS INDEX
// This file re-exports all functions from modularized files
// for backward compatibility and centralized access
// ========================================

// User Management
export {
  createUser,
  getUsers,
} from "./users";

// Client Management
export {
  createClient,
  getClients,
} from "./clients";

// Case Management & Client-Case Relationships
export {
  createCase,
  getCases,
  addClientToCase,
  removeClientFromCase,
  getClientsForCase,
  getCasesForClient,
  checkUserCaseAccess,
} from "./cases";

// Document & Escrito Management
export {
  createDocument,
  getDocuments,
  createEscrito,
  updateEscrito,
  getEscritos,
} from "./documents";

// Template Management
export {
  createModelo,
  getModelos,
  incrementModeloUsage,
} from "./templates";

// Chat Management
export {
  createChatSession,
  getChatSessions,
  addChatMessage,
  getChatMessages,
} from "./chat";

// Team Management
export {
  createTeam,
  getTeams,
  addUserToTeam,
  removeUserFromTeam,
  getTeamMembers,
  getUserTeams,
  grantTeamCaseAccess,
  revokeTeamCaseAccess,
  getTeamsWithCaseAccess,
  getCasesAccessibleByTeam,
} from "./teams"; 