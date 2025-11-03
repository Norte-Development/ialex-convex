# Migration Function Reference

## Overview

All migration functions are **internal** and can only be called from other Convex functions (queries, mutations, or actions). They are NOT visible in the Convex dashboard's "Functions" tab or accessible from client code.

## How to Call Migration Functions

### Functions Exported from `migrations/index.ts`

These functions are re-exported from the main index file and should be called directly:

```typescript
// ✅ CORRECT - Call directly from internal.migrations
await ctx.runQuery(internal.migrations.getAllUsers, {});
await ctx.runQuery(internal.migrations.getMigrationStatus, { userId });
await ctx.runMutation(internal.migrations.updateMigrationStatus, { userId, status: "completed" });
await ctx.runMutation(internal.migrations.createCase, { ...args });
await ctx.runMutation(internal.migrations.createClient, { ...args });
await ctx.runMutation(internal.migrations.createDocument, { ...args });
await ctx.runAction(internal.migrations.migrateUserData, { userId, kindeUserId });

// ❌ WRONG - Don't use .helpers or other sub-paths for exported functions
await ctx.runQuery(internal.migrations.helpers.getAllUsers, {});
await ctx.runQuery(internal.migrations.helpers.getMigrationStatus, { userId });
```

### Functions in Separate Module Files (with "use node")

These functions are NOT re-exported because they use Node.js APIs. Call them via their full path:

```typescript
// ✅ CORRECT - Use full path for Node.js modules
await ctx.runAction(internal.migrations.firebaseHelpers.getAllFirestoreUsers, {});
await ctx.runAction(internal.migrations.firestoreDataHelpers.getUserCases, { kindeUserId });
await ctx.runAction(internal.migrations.firestoreDataHelpers.getUserClients, { kindeUserId });
await ctx.runAction(internal.migrations.firestoreDataHelpers.getUserDocuments, { kindeUserId });
await ctx.runAction(internal.migrations.fileStorageHelpers.uploadFileToGCS, { url, fileName });
```

## Complete Function List

### From `migrations/index.ts` (exported)

| Function | Type | Path | Purpose |
|----------|------|------|---------|
| `getAllUsers` | Query | `internal.migrations.getAllUsers` | Get all users for migration |
| `getByEmail` | Query | `internal.migrations.getByEmail` | Find user by email |
| `getMigrationStatus` | Query | `internal.migrations.getMigrationStatus` | Get user's migration status |
| `getUserDataCount` | Query | `internal.migrations.getUserDataCount` | Count user's data across tables |
| `createMigrationStub` | Mutation | `internal.migrations.createMigrationStub` | Create new user stub |
| `addMigrationMetadata` | Mutation | `internal.migrations.addMigrationMetadata` | Add migration data to existing user |
| `updateMigrationStatus` | Mutation | `internal.migrations.updateMigrationStatus` | Update migration status |
| `createCase` | Mutation | `internal.migrations.createCase` | Migrate a case |
| `createClient` | Mutation | `internal.migrations.createClient` | Migrate a client |
| `createDocument` | Mutation | `internal.migrations.createDocument` | Migrate a case document |
| `createLibraryDocument` | Mutation | `internal.migrations.createLibraryDocument` | Migrate a library document |
| `migrateUserData` | Action | `internal.migrations.migrateUserData` | Main migration orchestration |

### From Separate Module Files (not exported)

| Function | Type | Path | Purpose |
|----------|------|------|---------|
| `getAllFirestoreUsers` | Action | `internal.migrations.firebaseHelpers.getAllFirestoreUsers` | Fetch users from Firestore |
| `getUserCases` | Action | `internal.migrations.firestoreDataHelpers.getUserCases` | Get user's cases from Firestore |
| `getUserClients` | Action | `internal.migrations.firestoreDataHelpers.getUserClients` | Get user's clients from Firestore |
| `getUserDocuments` | Action | `internal.migrations.firestoreDataHelpers.getUserDocuments` | Get ALL user's documents from Firestore |
| `getDocumentsByIds` | Action | `internal.migrations.firestoreDataHelpers.getDocumentsByIds` | Get specific documents by IDs |
| `uploadFileToGCS` | Action | `internal.migrations.fileStorageHelpers.uploadFileToGCS` | Upload file to Cloud Storage |
| `triggerDocumentProcessing` | Action | `internal.migrations.processingHelpers.triggerDocumentProcessing` | Trigger case document processing |
| `triggerLibraryDocumentProcessing` | Action | `internal.migrations.processingHelpers.triggerLibraryDocumentProcessing` | Trigger library document processing |

## Why This Structure?

1. **Security**: All migration functions are internal-only to prevent unauthorized access
2. **Organization**: Related functions are grouped in separate files
3. **Re-exports**: Common functions are re-exported from index.ts for convenience
4. **Node.js Modules**: Functions using Node.js APIs are kept separate to avoid bundling issues

## Testing in Convex Dashboard

Since all migration functions are internal, you cannot call them directly from the dashboard. Instead:

1. Create a test action/mutation in your convex folder
2. Call the migration functions from within that test function
3. Run the test function from the dashboard

Example test function:

```typescript
// convex/testMigration.ts
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export const testGetMigrationStatus = internalAction({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const status = await ctx.runQuery(
      internal.migrations.getMigrationStatus,
      { userId: args.userId }
    );
    console.log("Migration status:", status);
    return null;
  },
});
```

Then call `internal.testMigration.testGetMigrationStatus` from the dashboard with a test user ID.

