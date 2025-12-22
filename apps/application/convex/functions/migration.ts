// /**
//  * Migration Functions - User-Facing
//  *
//  * Public functions for users to check migration status,
//  * give consent, and start data migration.
//  */

// import { v } from "convex/values";
// import { query, mutation, action } from "../_generated/server";
// import { internal } from "../_generated/api";
// import { getCurrentUserFromAuth } from "../auth_utils";
// /**
//  * Get current user's migration status
//  * Returns null if user has no migration pending
//  */
// export const getMyMigrationStatus = query({
//   args: {},
//   returns: v.union(
//     v.object({
//       status: v.string(),
//       oldKindeId: v.string(),
//       consentGiven: v.boolean(),
//     }),
//     v.null()
//   ),
//   handler: async (ctx) => {
//     const currentUser = await getCurrentUserFromAuth(ctx);

//     // Check if user has migration metadata
//     const user = await ctx.db.get(currentUser._id);
//     const migration = (user as any).migration;

//     if (!migration) {
//       return null;
//     }

//     return {
//       status: migration.status,
//       oldKindeId: migration.oldKindeId,
//       consentGiven: migration.consentGiven,
//     };
//   },
// });

// /**
//  * Give consent to migrate data
//  */
// export const giveMigrationConsent = mutation({
//   args: {},
//   returns: v.null(),
//   handler: async (ctx) => {
//     const currentUser = await getCurrentUserFromAuth(ctx);

//     // Check if user has migration metadata
//     const user = await ctx.db.get(currentUser._id);
//     const migration = (user as any).migration;

//     if (!migration) {
//       throw new Error("No migration data found for user");
//     }

//     // Update consent
//     await ctx.db.patch(currentUser._id, {
//       migration: {
//         ...migration,
//         consentGiven: true,
//       },
//     } as any);

//     console.log(`User ${currentUser._id} gave migration consent`);
//     return null;
//   },
// });

// /**
//  * Start data migration for current user
//  * This will trigger the full migration process
//  */
// export const startMyMigration = action({
//   args: {},
//   returns: v.object({
//     success: v.boolean(),
//     message: v.string(),
//   }),
//   handler: async (ctx) => {
//     // Get current user ID
//     const identity = await ctx.auth.getUserIdentity();
//     if (!identity) {
//       throw new Error("Not authenticated");
//     }

//     // Get user from database
//     const user = await ctx.runQuery(internal.migrations.helpers.getByEmail, {
//       email: identity.email!,
//     });

//     if (!user) {
//       throw new Error("User not found");
//     }

//     // Check migration status
//     const migrationStatus = await ctx.runQuery(
//       internal.migrations.helpers.getMigrationStatus,
//       { userId: user._id }
//     );

//     if (!migrationStatus) {
//       throw new Error("No migration data found");
//     }

//     if (!migrationStatus.consentGiven) {
//       throw new Error("Migration consent not given");
//     }

//     if (migrationStatus.status === "completed") {
//       return {
//         success: false,
//         message: "Migration already completed",
//       };
//     }

//     if (migrationStatus.status === "in_progress") {
//       return {
//         success: false,
//         message: "Migration already in progress",
//       };
//     }

//     // Start migration
//     try {
//       await ctx.runAction(internal.migrations.migrateUserData.migrateUserData, {
//         userId: user._id,
//       });

//       return {
//         success: true,
//         message: "Migration started successfully",
//       };
//     } catch (error: any) {
//       console.error("Migration start error:", error);
//       throw new Error(`Failed to start migration: ${error.message}`);
//     }
//   },
// });

// /**
//  * Get migration progress details
//  * Returns counts of migrated data
//  */
// export const getMyMigrationProgress = query({
//   args: {},
//   returns: v.union(
//     v.object({
//       casesCount: v.number(),
//       clientsCount: v.number(),
//       documentsCount: v.number(),
//       libraryDocumentsCount: v.number(),
//       status: v.string(),
//     }),
//     v.null()
//   ),
//   handler: async (ctx) => {
//     const currentUser = await getCurrentUserFromAuth(ctx);

//     // Check migration status
//     const user = await ctx.db.get(currentUser._id);
//     const migration = (user as any).migration;

//     if (!migration) {
//       return null;
//     }

//     // Count migrated data
//     const [cases, clients, documents, libraryDocuments] = await Promise.all([
//       ctx.db
//         .query("cases")
//         .withIndex("by_created_by", (q) => q.eq("createdBy", currentUser._id))
//         .collect(),
//       ctx.db
//         .query("clients")
//         .withIndex("by_created_by", (q) => q.eq("createdBy", currentUser._id))
//         .collect(),
//       ctx.db
//         .query("documents")
//         .withIndex("by_created_by", (q) => q.eq("createdBy", currentUser._id))
//         .collect(),
//       ctx.db
//         .query("libraryDocuments")
//         .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
//         .collect(),
//     ]);

//     return {
//       casesCount: cases.length,
//       clientsCount: clients.length,
//       documentsCount: documents.length,
//       libraryDocumentsCount: libraryDocuments.length,
//       status: migration.status,
//     };
//   },
// });
