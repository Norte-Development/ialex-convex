# Migration Phase 1: Bulk User Migration (Pre-Launch)

This directory contains all the code needed for Phase 1 of the Kinde to Clerk migration.

## 📁 Files Created

### Core Configuration
- **`constants.ts`** - All migration constants and environment validation

### Migration Functions (1.0 - Handle Existing Users)
- **`identifyExistingUsers.ts`** - Detect users in both systems (1.0.1)
- **`handleEmailConflicts.ts`** - Resolve email conflicts (1.0.2)
- **`helpers.ts`** - Common utility functions (1.1.3)

### Migration Functions (1.1 - Create Clerk Accounts)
- **`migrateTestUsers.ts`** - Test migration with small batch (1.1.1)
- **`bulkUserMigration.ts`** - Full migration of all users (1.1.2)

### Announcement
- **`sendAnnouncement.ts`** - Send migration emails to users (1.2)

### UI Components
- **`/src/pages/MigrationConflictPage.tsx`** - User-facing conflict resolution UI (1.0.3)

### Documentation
- **`.env.migration.example`** - Example environment variables
- **`README.md`** - This file

## 🚀 Quick Start

### 1. Set Up Environment Variables

Copy the environment example and fill in your values:

```bash
cp apps/application/.env.migration.example apps/application/.env.local
```

Required environment variables:
- `CLERK_SECRET_KEY` - Your Clerk secret key
- `VITE_CLERK_PUBLISHABLE_KEY` - Your Clerk publishable key
- `KINDE_DOMAIN` - Your Kinde domain (format: yourbusiness.kinde.com)
- `KINDE_M2M_CLIENT_ID` - Your Kinde M2M application client ID
- `KINDE_M2M_CLIENT_SECRET` - Your Kinde M2M application client secret
- `FIREBASE_PROJECT_ID` - Your Firebase project ID
- `FIREBASE_CLIENT_EMAIL` - Firebase service account email
- `FIREBASE_PRIVATE_KEY` - Firebase service account private key
- `GCS_BUCKET` - Google Cloud Storage bucket name
- `FRONTEND_URL` - Your frontend URL (for email links)

### 2. Set Up Kinde M2M Application

Before running the migration, you need to create a Machine-to-Machine (M2M) application in Kinde:

1. Log in to your Kinde dashboard at https://app.kinde.com
2. Go to **Settings** → **Applications** → **Add Application**
3. Choose **Machine to Machine** application type
4. Name it "Migration M2M" and save
5. In the M2M app, go to **APIs** tab → Select **Kinde Management API**
6. Grant the `read:users` permission
7. Copy your credentials:
   - Domain (format: `yourbusiness.kinde.com`)
   - Client ID
   - Client Secret

Add these to your `.env.local` file.

### 3. Install Required Dependencies

Make sure you have the following packages installed:

```bash
# In apps/application
pnpm add @clerk/clerk-sdk-node firebase-admin
```

### 4. Validate Configuration

Before running any migrations, validate your environment:

```typescript
import { validateMigrationEnvironment } from './constants';

const validation = validateMigrationEnvironment();
if (!validation.isValid) {
  console.error('Missing variables:', validation.missingVars);
}
```

## 📝 Migration Workflow

### Step 1: Pre-Migration Testing (Day -1)

#### 1.1 Identify Existing Users

Run this first to see how many conflicts you'll need to handle:

```typescript
// From Convex dashboard or CLI
const result = await ctx.runAction(
  internal.migrations.identifyExistingUsers, 
  {}
);
console.log(`Found ${result.conflictCount} conflicts`);
```

#### 1.2 Test Migration with Small Batch

Test with 5 users before running the full migration:

```typescript
const testResult = await ctx.runAction(
  internal.migrations.migrateTestUsers,
  { limit: 5 }
);
console.log('Test migration results:', testResult);
```

**Review the results carefully!** Check that:
- ✅ Users were created in Clerk
- ✅ Users were created in Convex with migration metadata
- ✅ No unexpected errors occurred

### Step 2: Full Migration (Day 0)

#### 2.1 Handle Email Conflicts

Resolve any conflicts between Kinde and Convex users:

```typescript
const conflictResult = await ctx.runAction(
  internal.migrations.handleEmailConflicts,
  {}
);
console.log('Conflict resolution:', conflictResult);
```

#### 2.2 Run Bulk Migration

Migrate ALL users from Kinde to Clerk:

```typescript
const migrationResult = await ctx.runAction(
  internal.migrations.migrateAllUsersToClerk,
  {}
);
console.log('Migration completed:', migrationResult);
```

This will:
- Create Clerk accounts for all Kinde users
- Create Convex user stubs with migration metadata
- Skip users who already exist (merge them instead)
- Retry failed operations up to 3 times
- Log progress every 10 users

#### 2.3 Send Announcement Emails

Send migration announcement emails to all users:

```typescript
const emailResult = await ctx.runAction(
  internal.migrations.sendMigrationAnnouncement,
  {}
);
console.log('Emails sent:', emailResult);
```

**Note:** Update the `sendEmail` function in `sendAnnouncement.ts` to use your actual email provider (SendGrid, Resend, etc.).

### Step 3: Monitor Migration (Day 1+)

Monitor user logins and migration progress using Convex dashboard queries:

```typescript
// Check migration status for a specific user
const status = await ctx.runQuery(
  internal.migrations.helpers.getMigrationStatus,
  { userId: "user_id_here" }
);

// Get user data counts
const dataCount = await ctx.runQuery(
  internal.migrations.helpers.getUserDataCount,
  { userId: "user_id_here" }
);
```

## 🔧 Helper Functions Reference

### Query Functions

#### `getAllUsers()`
Returns all users with basic info (for conflict detection).

```typescript
const users = await ctx.runQuery(internal.migrations.helpers.getAllUsers, {});
```

#### `getByEmail(email: string)`
Get a user by email address.

```typescript
const user = await ctx.runQuery(internal.migrations.helpers.getByEmail, {
  email: "user@example.com"
});
```

#### `getUserDataCount(userId: Id<"users">)`
Get count of all data owned by a user.

```typescript
const counts = await ctx.runQuery(internal.migrations.helpers.getUserDataCount, {
  userId: "user_id"
});
// Returns: { casesCount, documentsCount, clientsCount, escritosCount, totalCount }
```

#### `getMigrationStatus(userId: Id<"users">)`
Get migration status for a user.

```typescript
const status = await ctx.runQuery(internal.migrations.helpers.getMigrationStatus, {
  userId: "user_id"
});
// Returns: { status, oldKindeId, consentGiven } or null
```

### Mutation Functions

#### `createMigrationStub(...)`
Create a minimal user record for migration.

```typescript
const userId = await ctx.runMutation(internal.migrations.helpers.createMigrationStub, {
  clerkId: "clerk_user_id",
  name: "John Doe",
  email: "john@example.com",
  isActive: true,
  isOnboardingComplete: false,
  migration: {
    status: "pending",
    oldKindeId: "kinde_user_id",
    consentGiven: false,
  },
});
```

#### `addMigrationMetadata(...)`
Add migration metadata to an existing user.

```typescript
await ctx.runMutation(internal.migrations.helpers.addMigrationMetadata, {
  userId: "user_id",
  oldKindeId: "kinde_user_id",
  migrationStatus: "pending",
});
```

#### `updateMigrationStatus(...)`
Update a user's migration status.

```typescript
await ctx.runMutation(internal.migrations.helpers.updateMigrationStatus, {
  userId: "user_id",
  status: "completed",
  consentGiven: true,
});
```

## 📊 Expected Results

After running the full migration, you should see:

```
{
  total: 100,          // Total Kinde users
  success: 85,         // New users created
  skipped: 15,         // Existing users merged
  errors: 0,           // Failed migrations
  details: [...]       // Detailed results per user
}
```

## ⚠️ Important Notes

### Schema Changes Required

The migration uses a `migration` field on users that is not yet in the schema. You'll need to add this to your schema:

```typescript
// In convex/schema.ts, add to users table:
migration: v.optional(
  v.object({
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("failed")
    ),
    oldKindeId: v.string(),
    consentGiven: v.boolean(),
  })
),
```

### Email Configuration

The `sendAnnouncement.ts` file currently logs emails to console. You must:

1. Choose an email provider (Resend, SendGrid, etc.)
2. Add the provider's SDK to your dependencies
3. Update the `sendEmail` function with actual implementation
4. Test with `sendTestAnnouncement` before sending to all users

### Clerk Configuration

Make sure in your Clerk dashboard:
1. "Password" authentication is enabled
2. "Skip password requirement" is allowed (for SSO users)
3. Rate limits are appropriate for bulk user creation

### Firestore Permissions

Ensure your Firebase service account has:
- Read access to the `users` collection
- Access to any other collections you'll migrate in Phase 2

## 🐛 Troubleshooting

### "Missing required environment variables"

Run the validation function to see which variables are missing:

```typescript
import { validateMigrationEnvironment } from './constants';
const validation = validateMigrationEnvironment();
console.log('Missing:', validation.missingVars);
```

### "User already exists in Clerk"

This can happen if:
1. You ran the migration twice
2. The user signed up directly on the new platform

The migration handles this by merging the accounts instead of creating duplicates.

### "Firebase permission denied"

Check that:
1. Your service account credentials are correct
2. The service account has read access to Firestore
3. The private key includes the BEGIN/END markers

### Rate Limiting

If you hit Clerk rate limits:
1. Increase `MIGRATION_RETRY_DELAY` in constants.ts
2. Reduce `MIGRATION_BATCH_SIZE`
3. Contact Clerk support for temporary rate limit increase

## 📞 Support

If you encounter issues during migration:

1. Check the Convex logs for detailed error messages
2. Review the migration results in the returned objects
3. Contact the development team with:
   - Error messages
   - Number of users affected
   - Migration results object

## ✅ Migration Checklist

Use this checklist to track your progress:

- [ ] Environment variables configured
- [ ] Dependencies installed
- [ ] Configuration validated
- [ ] Test migration run (5 users)
- [ ] Test results reviewed
- [ ] Email provider configured
- [ ] Test email sent and received
- [ ] Conflicts identified
- [ ] Conflicts handled
- [ ] Full migration run
- [ ] Migration results reviewed
- [ ] Announcement emails sent
- [ ] Migration monitoring dashboard set up
- [ ] Support team briefed

## 🎯 Next Steps

After completing Phase 1, proceed to:
- **Phase 2**: Data Migration (cases, documents, clients, etc.)
- **Phase 3**: User consent and data activation
- **Phase 4**: Cleanup and decommissioning

## 📚 Additional Resources

- [Clerk SDK Documentation](https://clerk.com/docs)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Convex Actions Documentation](https://docs.convex.dev/functions/actions)
- [Migration Plan Full Document](../../../MIGRATION_PLAN_KINDE_TO_CLERK.md)

