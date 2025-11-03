# Phase 1 Migration Setup Guide

## 📋 Overview

This guide walks you through setting up and executing Phase 1 of the Kinde to Clerk migration.

**Phase 1 Goal**: Create Clerk accounts for all existing Kinde users and prepare them for data migration.

## 🎯 What Was Created

### Backend (Convex Functions)

All files are in `apps/application/convex/migrations/`:

| File | Purpose | Type |
|------|---------|------|
| `constants.ts` | Configuration & validation | Constants |
| `helpers.ts` | Common utility functions | Queries & Mutations |
| `identifyExistingUsers.ts` | Find conflicts (1.0.1) | Internal Action |
| `handleEmailConflicts.ts` | Resolve conflicts (1.0.2) | Internal Action |
| `migrateTestUsers.ts` | Test migration (1.1.1) | Internal Action |
| `bulkUserMigration.ts` | Full migration (1.1.2) | Internal Action |
| `sendAnnouncement.ts` | Email announcements (1.2) | Internal Action |
| `README.md` | Detailed documentation | Documentation |

### Frontend (UI Components)

| File | Purpose |
|------|---------|
| `src/pages/MigrationConflictPage.tsx` | User conflict resolution UI (1.0.3) |

### Configuration Files

| File | Purpose |
|------|---------|
| `.env.migration.example` | Environment variable template |
| `PHASE_1_SETUP_GUIDE.md` | This file |

## 🔧 Setup Instructions

### Step 1: Install Dependencies

```bash
cd apps/application
pnpm add @clerk/clerk-sdk-node firebase-admin
```

### Step 2: Configure Environment Variables

1. Copy the example file:
```bash
cp .env.migration.example .env.local
```

2. Fill in all required values in `.env.local`:

```bash
# Clerk Configuration
CLERK_SECRET_KEY=sk_test_xxxxx
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx

# Kinde Configuration
KINDE_DOMAIN=yourbusiness.kinde.com
KINDE_M2M_CLIENT_ID=your_m2m_client_id
KINDE_M2M_CLIENT_SECRET=your_m2m_client_secret

# Firebase Configuration (for data migration)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"

# Google Cloud Storage
GCS_BUCKET=your-bucket-name

# Application URLs
FRONTEND_URL=http://localhost:5173
VITE_APP_URL=http://localhost:5173
```

#### How to Get Kinde M2M Credentials

1. **Log in to your Kinde dashboard**
   - Go to https://app.kinde.com

2. **Create a Machine-to-Machine (M2M) Application**
   - Navigate to **Settings** → **Applications**
   - Click **Add Application**
   - Choose **Machine to Machine** application type
   - Give it a name like "Migration M2M"
   - Click **Save**

3. **Get your credentials**
   - **Domain**: Found in Settings → Details (format: `yourbusiness.kinde.com`)
   - **Client ID**: In your M2M app → **Details** tab
   - **Client Secret**: In your M2M app → **Details** tab (click to reveal)

4. **Grant API permissions**
   - In your M2M app, go to the **APIs** tab
   - Select **Kinde Management API**
   - Grant the following permissions:
     - `read:users` (required for fetching users)
   - Click **Save**

### Step 3: Update Schema (Important!)

Add the `_migration` field to your users table in `apps/application/convex/schema.ts`:

```typescript
// Add this inside the users table definition:
_migration: v.optional(
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

Push the schema changes:
```bash
npx convex dev
```

### Step 4: Configure Email Service

Update `apps/application/convex/migrations/sendAnnouncement.ts`:

1. Choose your email provider (Resend, SendGrid, etc.)
2. Install the SDK:
```bash
pnpm add resend
# or
pnpm add @sendgrid/mail
```

3. Uncomment and configure the email sending code in the `sendEmail` function

4. Add email API key to `.env.local`:
```bash
RESEND_API_KEY=re_xxxxx
# or
SENDGRID_API_KEY=SG.xxxxx
```

### Step 5: Validate Configuration

Open Convex dashboard and run this validation:

```typescript
import { validateMigrationEnvironment } from './migrations/constants';

const validation = validateMigrationEnvironment();
console.log('Valid:', validation.isValid);
console.log('Missing:', validation.missingVars);
```

All values should be present before proceeding.

## 🚀 Execution Steps

### Pre-Migration (Day -1)

#### 1. Backup Your Data

```bash
# Backup Firestore
gcloud firestore export gs://your-backup-bucket/firestore-backup-$(date +%Y%m%d)

# Backup Convex
npx convex export --output backup-$(date +%Y%m%d).json
```

#### 2. Identify Conflicts

Run from Convex dashboard:

```typescript
const conflicts = await ctx.runAction(
  internal.migrations.identifyExistingUsers,
  {}
);
console.log(`Found ${conflicts.conflictCount} conflicts out of ${conflicts.kindeUserCount} Kinde users`);
```

#### 3. Test Migration

Test with 5 users first:

```typescript
const testResult = await ctx.runAction(
  internal.migrations.migrateTestUsers,
  { limit: 5 }
);
console.log('Test Results:', testResult);
```

**Verify the test results:**
- ✅ Check Clerk dashboard for new users
- ✅ Check Convex users table for new entries
- ✅ Verify `_migration` metadata is set
- ✅ No errors in results

#### 4. Test Email (Optional but Recommended)

```typescript
const emailTest = await ctx.runAction(
  internal.migrations.sendTestAnnouncement,
  { 
    email: "your-test-email@example.com",
    name: "Test User"
  }
);
console.log('Email sent:', emailTest.success);
```

### Full Migration (Day 0)

#### 1. Handle Conflicts

```typescript
const conflictResolution = await ctx.runAction(
  internal.migrations.handleEmailConflicts,
  {}
);
console.log('Conflicts resolved:', conflictResolution);
```

#### 2. Run Bulk Migration

**⚠️ WARNING: This will create Clerk accounts for ALL Kinde users!**

```typescript
const migrationResult = await ctx.runAction(
  internal.migrations.migrateAllUsersToClerk,
  {}
);
console.log('Migration completed:', {
  total: migrationResult.total,
  success: migrationResult.success,
  skipped: migrationResult.skipped,
  errors: migrationResult.errors
});
```

This process may take several minutes depending on the number of users.

#### 3. Review Results

Check the `migrationResult.details` array for any errors:

```typescript
const errors = migrationResult.details.filter(d => d.status === 'error');
if (errors.length > 0) {
  console.log('Failed migrations:', errors);
  // Handle failed migrations manually or retry
}
```

#### 4. Send Announcements

```typescript
const emailResult = await ctx.runAction(
  internal.migrations.sendMigrationAnnouncement,
  {}
);
console.log('Emails sent:', emailResult.emailsSent);
console.log('Emails failed:', emailResult.emailsFailed);
```

### Post-Migration (Day 1+)

#### Monitor User Logins

Check migration status for users:

```typescript
// Get migration status for a specific user
const status = await ctx.runQuery(
  internal.migrations.helpers.getMigrationStatus,
  { userId: "user_id_here" }
);
```

#### Handle Failed Migrations

For any users that failed to migrate, you can:

1. Check the error message in the migration results
2. Manually create their Clerk account
3. Use `createMigrationStub` to add them to Convex

## 📊 Monitoring Dashboard

Create a simple monitoring query to track progress:

```typescript
// apps/application/convex/migrations/monitoring.ts
import { query } from "../_generated/server";
import { v } from "convex/values";

export const getMigrationStats = query({
  args: {},
  returns: v.object({
    total: v.number(),
    pending: v.number(),
    inProgress: v.number(),
    completed: v.number(),
    failed: v.number(),
  }),
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    
    let pending = 0;
    let inProgress = 0;
    let completed = 0;
    let failed = 0;

    users.forEach(user => {
      const migration = (user as any)._migration;
      if (!migration) return;
      
      switch (migration.status) {
        case "pending": pending++; break;
        case "in_progress": inProgress++; break;
        case "completed": completed++; break;
        case "failed": failed++; break;
      }
    });

    return {
      total: users.length,
      pending,
      inProgress,
      completed,
      failed,
    };
  },
});
```

## 🐛 Common Issues & Solutions

### Issue: "Missing required environment variables"

**Solution:**
```typescript
import { validateMigrationEnvironment, logMigrationConfig } from './migrations/constants';
const validation = validateMigrationEnvironment();
console.log('Missing:', validation.missingVars);
```

### Issue: Clerk rate limiting

**Solution:** 
- In `constants.ts`, increase `MIGRATION_RETRY_DELAY` to 5000ms
- Reduce `MIGRATION_BATCH_SIZE` to 25
- Contact Clerk support for temporary rate limit increase

### Issue: Firebase authentication error

**Solution:**
- Verify your service account credentials
- Ensure the private key includes `\n` characters (not actual newlines)
- Check that the service account has Firestore read permissions

### Issue: User already exists in Clerk

**Solution:**
The migration automatically handles this by:
1. Skipping the Clerk user creation
2. Merging migration metadata into the existing Convex user

### Issue: Email not sending

**Solution:**
- Verify your email provider API key is correct
- Check that you've implemented the `sendEmail` function
- Test with `sendTestAnnouncement` first
- Check email provider logs/dashboard for errors

## ✅ Pre-Flight Checklist

Before running the full migration:

- [ ] All dependencies installed
- [ ] Environment variables configured and validated
- [ ] Schema updated with `_migration` field
- [ ] Schema pushed to Convex (`npx convex dev`)
- [ ] Email service configured and tested
- [ ] Data backups completed (Firestore + Convex)
- [ ] Test migration completed successfully (5 users)
- [ ] Test email sent and received
- [ ] Clerk dashboard rate limits checked
- [ ] Support team briefed
- [ ] Rollback plan documented

## 🔄 Rollback Plan

If something goes wrong:

1. **Stop the migration immediately**
2. **Document the error** - save all error messages and results
3. **Do NOT delete Clerk users** - they can be cleaned up later
4. **Restore from backup if needed**:
   ```bash
   npx convex import backup-YYYYMMDD.json
   ```
5. **Review and fix issues**
6. **Re-run test migration** to verify fixes
7. **Resume full migration** once issues are resolved

## 📞 Support Contacts

During migration, have these contacts ready:

- **Clerk Support**: support@clerk.com
- **Firebase Support**: firebase.google.com/support
- **Dev Team Lead**: [Your contact]
- **Database Admin**: [Your contact]

## 📈 Success Metrics

Migration is successful when:

- ✅ Success rate > 95% (errors < 5%)
- ✅ All conflicts resolved
- ✅ Announcement emails sent
- ✅ No data loss
- ✅ Users can log in with Clerk
- ✅ Migration metadata properly set

## 🎯 Next Steps

After Phase 1 completion:

1. **Monitor user logins** - track how many users successfully authenticate
2. **Prepare Phase 2** - data migration (cases, documents, clients)
3. **Build consent flow** - allow users to approve data migration
4. **Update documentation** - record any issues and solutions
5. **Team debrief** - discuss what went well and what to improve

## 📚 Additional Documentation

- [Migration README](apps/application/convex/migrations/README.md) - Detailed function reference
- [Full Migration Plan](MIGRATION_PLAN_KINDE_TO_CLERK.md) - Complete migration strategy
- [Environment Variables](apps/application/.env.migration.example) - Configuration template

---

**Ready to migrate?** Follow the execution steps above and good luck! 🚀

