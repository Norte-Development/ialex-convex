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

// Case Summary (AI-powered)
export {
  generateCaseSummary,
  updateCaseSummary,
} from "./caseSummary";

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
export { testReadEscritoHelpers } from "./testReadEscritoHelpers";

// Template Management (Modelos)
export {
  createModelo,
  getModelos,
  getModelo,
  searchModelos,
  incrementModeloUsage,
  internalGetModelo,
  internalSearchModelos,
  internalGetModelos,
} from "./templates";

// Prompts Library Management
export {
  createPrompt,
  getPrompts,
  getPrompt,
  searchPrompts,
  updatePrompt,
  incrementPromptUsage,
  deletePrompt,
  getPromptCategories,
} from "./prompts";

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

// Library Document Management
export {
  generateUploadUrl as generateLibraryUploadUrl,
  createLibraryDocument,
  getLibraryDocuments,
  getAllAccessibleLibraryDocuments,
  getLibraryDocument,
  getLibraryDocumentTranscription,
  getLibraryDocumentUrl,
  deleteLibraryDocument,
  moveLibraryDocument,
  updateLibraryDocument,
} from "./libraryDocument";

// Library Folder Management
export {
  createLibraryFolder,
  getLibraryFolders,
  getLibraryFolder,
  updateLibraryFolder,
  archiveLibraryFolder,
  restoreLibraryFolder,
  moveLibraryFolder,
  getLibraryFolderPath,
  deleteLibraryFolder,
} from "./libraryFolders";

// Agent Rules Management
export {
  createRule as createAgentRule,
  updateRule as updateAgentRule,
  deleteRule as deleteAgentRule,
  toggleRuleActive as toggleAgentRuleActive,
  getUserRules,
  getCaseRules,
} from "./agentRules";

// Global Search
export { globalSearch } from "./search";

// Seed Functions
export { seedPrompts } from "./seedPrompts";
