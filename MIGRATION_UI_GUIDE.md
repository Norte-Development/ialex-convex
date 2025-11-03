# Migration UI Guide

## Overview

This document describes the user-facing migration UI that allows users to give consent and start data migration from Firestore to Convex.

## Components Created

### Backend Functions (`convex/functions/migration.ts`)

#### `getMyMigrationStatus` (Query)
- Returns the current user's migration status
- Returns `null` if no migration is pending
- Returns: `{ status, oldKindeId, consentGiven }`

#### `giveMigrationConsent` (Mutation)
- Allows user to give consent for data migration
- Updates the `consentGiven` flag in user's migration metadata

#### `startMyMigration` (Action)
- Starts the actual data migration process
- Validates that consent has been given
- Prevents duplicate migrations (checks if already in progress or completed)
- Calls `internal.migrations.migrateUserData` to perform the migration

#### `getMyMigrationProgress` (Query)
- Returns current migration progress with counts
- Shows: casesCount, clientsCount, documentsCount, libraryDocumentsCount, status

### Frontend Components

#### 1. `MigrationConsentDialog.tsx`
**Purpose:** Shows migration information and collects user consent

**Features:**
- Beautiful UI showing what will be migrated (cases, clients, documents)
- Important notes and warnings
- Consent checkbox that user must check
- "Authorize Migration" button

**Props:**
- `open`: boolean - controls dialog visibility
- `onOpenChange`: (open: boolean) => void - callback when dialog open state changes
- `onConsentGiven`: () => void - callback when user gives consent

#### 2. `MigrationProgressDialog.tsx`
**Purpose:** Shows migration progress and allows starting the migration

**Features:**
- Status banner showing current state (pending, in_progress, completed, failed)
- Progress bars and counts of migrated items
- Auto-refresh every 3 seconds during migration
- "Start Migration" button (only shown when status is pending)
- Detailed breakdown of:
  - Expedientes (Cases)
  - Clientes (Clients)
  - Documentos de Expedientes (Case Documents)
  - Documentos de Biblioteca (Library Documents)

**Props:**
- `open`: boolean - controls dialog visibility
- `onOpenChange`: (open: boolean) => void - callback when dialog open state changes
- `onMigrationComplete`: () => void - callback when migration completes

#### 3. `MigrationWrapper.tsx`
**Purpose:** Orchestrates the migration flow and decides which dialog to show

**Logic Flow:**
```
1. Query user's migration status
2. If no migration metadata → Show nothing (no migration needed)
3. If status === "completed" → Show nothing (already migrated)
4. If status === "pending" && !consentGiven → Show ConsentDialog
5. If consentGiven && (status === "pending" || "in_progress") → Show ProgressDialog
6. If status === "failed" → Show ProgressDialog (for retry)
```

**Props:**
- `children`: React.ReactNode - wrapped content

## User Flow

### Scenario 1: New User with Pending Migration

1. User logs in after Phase 1 migration (account created, but data not migrated)
2. `MigrationWrapper` detects migration status: `{ status: "pending", consentGiven: false }`
3. **Consent Dialog appears automatically:**
   - Shows what will be migrated
   - User must check consent box
   - User clicks "Authorize Migration"
4. **Progress Dialog appears:**
   - Shows "Start Migration" button
   - User clicks "Start Migration"
   - Dialog shows progress (auto-refreshes every 3 seconds)
   - Shows counts of migrated items
5. **Migration completes:**
   - Success message appears
   - User can click "Continue to Application"
   - Dialogs close, user can use the app normally

### Scenario 2: Migration Already in Progress

1. User logs in while migration is in progress (maybe they started it, closed browser, came back)
2. `MigrationWrapper` detects migration status: `{ status: "in_progress", consentGiven: true }`
3. **Progress Dialog appears automatically:**
   - Shows current progress
   - User can close dialog and continue using app
   - Migration continues in background

### Scenario 3: Migration Completed

1. User logs in after migration completed
2. `MigrationWrapper` detects migration status: `{ status: "completed" }`
3. **No dialogs appear** - user can use app normally

### Scenario 4: Migration Failed

1. User logs in after a failed migration attempt
2. `MigrationWrapper` detects migration status: `{ status: "failed" }`
3. **Progress Dialog appears:**
   - Shows error state
   - User can click "Start Migration" again to retry

## Integration Points

### App.tsx
The `MigrationWrapper` is integrated at two key points:

1. **ProtectedRoute wrapper:**
```tsx
<Protect fallback={<SignInPage />}>
  <OnboardingWrapper>
    <MigrationWrapper>
      <Layout>{children}</Layout>
    </MigrationWrapper>
  </OnboardingWrapper>
</Protect>
```

2. **Case routes wrapper:**
```tsx
<Protect fallback={<SignInPage />}>
  <OnboardingWrapper>
    <MigrationWrapper>
      <CaseRoutesWrapper />
    </MigrationWrapper>
  </OnboardingWrapper>
</Protect>
```

This ensures migration check happens **after** authentication and onboarding, but **before** the main app renders.

## Styling & UX

- **Modern, clean design** using shadcn/ui components
- **Color-coded status indicators:**
  - Yellow: Pending
  - Blue: In Progress
  - Green: Completed
  - Red: Failed
- **Non-blocking:** User can close progress dialog and use app (migration continues in background)
- **Auto-refresh:** Progress updates every 3 seconds without user interaction
- **Toast notifications:** Success/error feedback using sonner
- **Accessible:** Proper ARIA labels, keyboard navigation

## Technical Details

### Data Migration Process

When user clicks "Start Migration":

1. Frontend calls `api.functions.migration.startMyMigration`
2. Backend validates:
   - User is authenticated
   - Migration metadata exists
   - Consent has been given
   - Migration not already running/completed
3. Backend calls `internal.migrations.migrateUserData`
4. Migration process:
   - Fetches all user data from Firestore
   - Separates case-linked documents from library documents
   - Migrates cases with their documents
   - Migrates standalone library documents
   - Migrates clients
   - Updates migration status to "completed"

### Error Handling

- Network errors: Shown via toast notifications
- Migration errors: Status set to "failed", user can retry
- Validation errors: Shown in toast with clear message
- Loading states: Disabled buttons, loading spinners

## Testing

To test the migration UI:

1. **Set up test user with migration metadata:**
```typescript
// In Convex dashboard
const userId = await ctx.runMutation(
  internal.migrations.createMigrationStub,
  {
    clerkId: "test_clerk_id",
    name: "Test User",
    email: "test@example.com",
    isActive: true,
    isOnboardingComplete: true,
    migration: {
      status: "pending",
      oldKindeId: "kinde_test_user",
      consentGiven: false,
    },
  }
);
```

2. **Log in as that user** - Consent dialog should appear

3. **Give consent** - Progress dialog should appear

4. **Start migration** - Should see progress updates

5. **Check migrated data** - Verify cases, clients, documents in Convex tables

## Future Enhancements

Potential improvements:
- [ ] Show estimated time remaining
- [ ] Detailed migration logs viewable by user
- [ ] Email notification when migration completes
- [ ] Progress percentage (requires backend support)
- [ ] Retry individual failed items
- [ ] Cancel migration option
- [ ] Migration history/audit log

## Troubleshooting

### Dialog doesn't appear
- Check user has migration metadata in database
- Verify `consentGiven` is false and `status` is "pending"
- Check browser console for errors

### Migration doesn't start
- Verify consent was given successfully
- Check backend logs for validation errors
- Ensure document processor service is running

### Progress not updating
- Check network tab for query responses
- Verify auto-refresh interval is working
- Check if migration actually running in backend logs

## Related Files

- Backend: `convex/functions/migration.ts`
- Components:
  - `src/components/Migration/MigrationConsentDialog.tsx`
  - `src/components/Migration/MigrationProgressDialog.tsx`
  - `src/components/Migration/MigrationWrapper.tsx`
  - `src/components/Migration/index.ts`
- Integration: `src/App.tsx`
- Migration logic: `convex/migrations/migrateUserData.ts`

