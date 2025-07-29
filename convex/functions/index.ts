// ========================================
// CONVEX FUNCTIONS INDEX
// This file re-exports all functions from modularized files
// for backward compatibility and centralized access
// ========================================

// User Management
export {
  // Clerk integration functions
  getOrCreateUser,
  getCurrentUser,
  updateOnboardingInfo,
} from "./users";

// Client Management
export {
  createClient,
  getClients,
} from "./clients";

// Case Management
export {
  createCase,
  getCases,
  addClientToCase,
  removeClientFromCase,
  getClientsForCase,
  getCasesForClient,
  checkUserCaseAccess,
} from "./cases";

// Document Management
export {
  createDocument,
  getDocuments,
  createEscrito,
  updateEscrito,
  getEscritos,
  getEscrito,
  archiveEscrito,
  getArchivedEscritos,
} from "./documents";

// Template Management (Modelos)
export {
  createModelo,
  getModelos,
  incrementModeloUsage,
} from "./templates";

// Chat Management
export {
  createThreadMetadata,
  getThreadMetadata,
  archiveThread,
} from "./chat";

// Team Management
export {
  createTeam,
  getTeams,
  addUserToTeam,
  removeUserFromTeam,
  leaveTeam,
  getTeamMembers,
  getUserTeams,
  grantTeamCaseAccess,
  revokeTeamCaseAccess,
  getTeamsWithCaseAccess,
  getCasesAccessibleByTeam,
} from "./teams";