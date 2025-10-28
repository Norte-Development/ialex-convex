/**
 * Migration Functions Index
 * 
 * This file exports all migration-related functions so they can be
 * properly referenced via the internal API.
 * 
 * NOTE: We do NOT re-export functions from kindeHelpers.ts, firebaseHelpers.ts, 
 * or clerkHelpers.ts because those files have "use node" and re-exporting them 
 * causes bundling issues.
 * Instead, call them directly via:
 * - internal.migrations.kindeHelpers.getAllKindeUsers
 * - internal.migrations.firebaseHelpers.getAllFirestoreUsers
 * - internal.migrations.clerkHelpers.createClerkUser
 */

// Export Convex helper functions (queries and mutations)
export {
  getUserDataCount,
  getByEmail,
  getAllUsers,
  addMigrationMetadata,
  createMigrationStub,
  updateMigrationStatus,
  getMigrationStatus,
} from "./helpers";

// Export phase 1.0 functions (Handle Existing Users)
export { identifyExistingUsers } from "./identifyExistingUsers";
export { handleEmailConflicts } from "./handleEmailConflicts";

// Export phase 1.1 functions (Create Clerk Accounts)
export { migrateTestUsers } from "./migrateTestUsers";
export { migrateAllUsersToClerk } from "./bulkUserMigration";

// Export phase 1.2 functions (Send Announcements)
export {
  sendMigrationAnnouncement,
  sendTestAnnouncement,
} from "./sendAnnouncement";

// Export phase 2 functions (Data Migration)
export { migrateUserData } from "./migrateUserData";
export { createCase } from "./migrateCases";
export { createClient } from "./migrateClients";
export { createDocument } from "./migrateDocuments";
export { createLibraryDocument } from "./migrateLibraryDocuments";

