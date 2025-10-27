<!-- 48c41c52-a199-45d5-a83a-1b7fd4327f6c cece7c14-a42c-48c3-8063-3b31ea9ada45 -->
# Fix Team Invitation Flow

## Overview

Fix critical bugs in the team invitation system, use the existing email template for consistent styling, and implement atomic error handling so invitations are only created if emails send successfully.

## Critical Bug Fixes

### 1. Fix `createUserAndJoinTeam` function syntax error

**File**: `apps/application/convex/functions/teams.ts` (lines ~1949-1957)

**Problem**: Missing table name and incorrect syntax in `ctx.db.insert`

**Fix**: Change from:

```typescript
const userId = await ctx.db.insert
  clerkId: args.clerkId,
  ...
;
```

To:

```typescript
const userId = await ctx.db.insert("users", {
  clerkId: args.clerkId,
  name: args.name,
  email: args.email,
  isActive: true,
  isOnboardingComplete: false,
  onboardingStep: 1,
  hasUsedTrial: false,
});
```

### 2. Fix incomplete error in `acceptTeamInvite`

**File**: `apps/application/convex/functions/teams.ts` (lines ~1477-1479)

**Problem**: Incomplete throw statement

**Fix**: Change from:

```typescript
if (existingMembership) {
  throw
}
```

To:

```typescript
if (existingMembership) {
  throw new Error("Ya eres miembro de este equipo");
}
```

## Email Template Integration

### 3. Create new email template functions for both invitation types

**File**: `apps/application/convex/services/emailTemplates.ts` (after existing templates)

**Add two new template functions**:

- `teamInviteExistingUserTemplate(teamName, inviterName, roleName, inviteUrl, expiryDate)` - for users who already have accounts
- `teamInviteNewUserTemplate(teamName, inviterName, roleName, signupUrl, expiryDate)` - for new users who need to create accounts

Both should follow the same styling pattern as the existing `teamInviteTemplate` but with additional information (role, expiry date).

### 4. Update `sendTeamInvite` to use email templates

**File**: `apps/application/convex/functions/teams.ts` (lines ~1331-1408)

**Replace inline HTML** with template function calls:

- Import the new template functions from `emailTemplates.ts`
- Replace the inline HTML strings with template function calls
- Include proper role display names (admin -> Administrador, etc.)

### 5. Update `resendTeamInvite` to use email templates

**File**: `apps/application/convex/functions/teams.ts` (lines ~1773-1850)

**Apply same template changes** as in `sendTeamInvite`

## Error Handling Implementation

### 6. Make invitation creation atomic with email sending

**File**: `apps/application/convex/functions/teams.ts` in `sendTeamInvite` function

**Current flow** (lines ~1316-1408):

1. Create invitation in DB
2. Schedule email sending (fire and forget)

**New flow**:

1. Try to send email immediately (not scheduled)
2. If email fails, throw error (prevents invitation creation)
3. If email succeeds, create invitation in DB

**Implementation approach**:

- Change from using `ctx.scheduler.runAfter` to directly calling an internal mutation
- Wrap the email send in a try-catch block
- Delete the invitation if email fails after it was created
- This ensures atomic operation: invitation exists only if email was sent

### 7. Add helper function for role display names

**File**: `apps/application/convex/functions/teams.ts` (before mutations)

**Add utility function**:

```typescript
function getRoleDisplayName(role: string): string {
  switch (role) {
    case "admin": return "Administrador";
    case "abogado": return "Abogado";
    case "secretario": return "Secretario";
    default: return role;
  }
}
```

## Testing Considerations

- Test existing user invitation flow
- Test new user invitation flow  
- Test email sending failure scenario
- Test duplicate invitation prevention
- Test expired invitation handling

### To-dos

- [ ] Fix syntax error in createUserAndJoinTeam function - add missing table name and proper object syntax
- [ ] Complete the incomplete throw statement in acceptTeamInvite function
- [ ] Create teamInviteExistingUserTemplate and teamInviteNewUserTemplate functions in emailTemplates.ts
- [ ] Add getRoleDisplayName helper function to teams.ts
- [ ] Replace inline HTML with email templates and implement atomic error handling in sendTeamInvite
- [ ] Replace inline HTML with email templates in resendTeamInvite function