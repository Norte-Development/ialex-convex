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
  getCaseById,
  addClientToCase,
  removeClientFromCase,
  getClientsForCase,
  getCasesForClient,
  checkUserCaseAccess,
} from "./cases";

// Permission Management
export {
  grantUserCaseAccess,
  revokeUserCaseAccess,
  getUsersWithCaseAccess,
  getUserCasePermissions,
  hasPermission,
  grantTeamMemberCaseAccess,
  getTeamMembersWithCaseAccess,
} from "./permissions";

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
  deleteDocument,
} from "./documents";

// Template Management (Modelos)
export {
  createModelo,
  getModelos,
  incrementModeloUsage,
} from "./templates";


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