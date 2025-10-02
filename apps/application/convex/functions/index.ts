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
export { createClient, getClients } from "./clients";

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
  getNewUsersWithCaseAccess,
  grantNewUserCaseAccess,
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

// Escrito Transforms
export { applyTextBasedOperations } from "./escritosTransforms";

// Test Read Escrito Helpers
export {
  testReadEscritoHelpers,
} from "./testReadEscritoHelpers";

// Template Management (Modelos)
export { createModelo, getModelos, getModelo, incrementModeloUsage } from "./templates";
export { seedTemplates } from "./seedTemplates";

// Team Management
export {
  createTeam,
  getTeams,
  addUserToTeam,
  removeUserFromTeam,
  leaveTeam,
  getTeamMembers,
  getUserTeams,
  grantNewTeamCaseAccess,
  revokeNewTeamCaseAccess,
  getCasesAccessibleByTeam,
  getTeamMembersWithCaseAccess,
  getTeamsWithCaseAccess,
  grantTeamMemberCaseAccess,
} from "./teams";

// Todo Planning & Tracking (Phase 1)
export {
  createTodoList,
  addTodoItem,
  updateTodoItem,
  listTodoListsByThread,
  listTodoItemsByList,
  getOrCreateThreadTodoList,
} from "./todos";
