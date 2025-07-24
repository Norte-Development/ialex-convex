# Authentication Implementation Guide

## Overview

This document outlines the comprehensive authentication and authorization system implemented across all Convex functions using Clerk authentication. All functions are now properly protected with role-based access control and case-level permissions.

## Frontend Authentication Flow

### Routing Structure

The application uses React Router with Clerk's `<Protect>` component for seamless route protection:

#### Routes
- `/signin` - Public sign-in page using Clerk's SignIn component
- All other routes (`/`, `/casos`, `/clientes`, etc.) - Protected routes using Clerk's `<Protect>` component

#### Authentication Components

**Clerk's `<Protect>` Component (`@clerk/clerk-react`)**
- Single component that handles both authentication and authorization
- Automatically renders children only when user meets protection criteria
- Provides `fallback` prop for unauthorized access (redirects to sign-in)
- Supports role-based and permission-based authorization when needed
- Works seamlessly with React Router applications

**SignInPage (`src/components/Auth/SignInPage.tsx`)**
- Renders Clerk's SignIn component with custom styling
- Redirects to `/` after successful authentication
- Used as fallback for protected routes

**OnboardingWrapper (`src/components/Auth/OnboardingWrapper.tsx`)**
- Handles user synchronization between Clerk and Convex database
- Manages onboarding flow for new users
- Shows loading states during user data synchronization
- No authentication logic (handled by `<Protect>` component)

**ProtectedRoute Helper Component (`src/App.tsx`)**
- Wrapper that combines `<Protect>` with OnboardingWrapper and Layout
- Reduces code repetition across routes
- Provides consistent fallback behavior (redirects to SignInPage)
- Applied to all protected routes

```tsx
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <Protect fallback={<SignInPage />}>
      <OnboardingWrapper>
        <Layout>
          {children}
        </Layout>
      </OnboardingWrapper>
    </Protect>
  );
};
```

#### Authentication Flow
1. User visits any protected route
2. Clerk's `<Protect>` component checks authentication status
3. If not authenticated → renders `fallback` (SignInPage)
4. If authenticated → renders children (OnboardingWrapper → Layout → Page)
5. OnboardingWrapper handles user sync and onboarding checks
6. If user hasn't completed onboarding → shows OnboardingFlow
7. If fully authenticated and onboarded → shows requested page

#### Key Features
- **Single Component Protection** - `<Protect>` handles all authentication logic
- **React Router Compatible** - Works seamlessly with React Router applications
- **Extensible Authorization** - Easy to add role/permission checks when needed
- **Automatic user synchronization** between Clerk and Convex
- **Graceful fallbacks** with custom UI for unauthorized access
- **Loading states** using suspense with skeletons
- **Onboarding flow** for new users
- **Minimal custom code** - leverages Clerk's battle-tested components

#### Advanced Authorization (Available)

The `<Protect>` component supports advanced authorization patterns:

```tsx
// Role-based protection
<Protect role="org:admin" fallback={<AccessDenied />}>
  <AdminPanel />
</Protect>

// Permission-based protection  
<Protect permission="org:cases:create" fallback={<AccessDenied />}>
  <CreateCaseButton />
</Protect>

// Conditional authorization
<Protect 
  condition={(has) => has({ role: "org:admin" }) || has({ permission: "org:cases:read" })}
  fallback={<AccessDenied />}
>
  <CasesList />
</Protect>
```

## Authentication Utilities

### Core Helper Functions (`convex/functions/auth_utils.ts`)

#### `getCurrentUserFromAuth(ctx)`
- Retrieves the current authenticated user from the database
- Throws error if not authenticated or user not found
- Used in most functions to get the current user

#### `requireAuth(ctx)`
- Basic authentication check
- Returns the Clerk identity object
- Used for functions that only need to verify login status

#### `requireAdmin(ctx)`
- Requires admin role for access
- Throws error if user is not an admin
- Used for administrative functions

#### `checkCaseAccess(ctx, caseId, userId)`
- Checks if a user has access to a specific case
- Returns access level and source (direct or team-based)
- Used internally by other access control functions

#### `requireCaseAccess(ctx, caseId, requiredLevel)`
- Requires specific access level to a case ("read" or "full")
- Throws error if user doesn't have sufficient access
- Used for case-related operations

## Authentication by Function Category

### User Management (`users.ts`)

**Public Functions:**
- `getOrCreateUser` - Used during Clerk auth flow, validates clerkId matches
- `getCurrentUser` - Users can only view their own data (admins can view others)
- `updateOnboardingInfo` - Users can only update their own data (admins can update others)

**Admin-Only Functions:**
- `createUser` - Manual user creation
- `getUsers` - View all users
- `getUsersNeedingOnboarding` - View onboarding status

### Case Management (`cases.ts`)

**Protected Functions:**
- `createCase` - Auto-assigns to current user, requires authentication
- `getCases` - Filters results based on user's case access (direct or team-based)
- `addClientToCase` - Requires full access to the case
- `removeClientFromCase` - Requires full access to the case
- `getClientsForCase` - Requires read access to the case
- `getCasesForClient` - Filters results based on user's case access
- `checkUserCaseAccess` - Users can check their own access (admins can check others)

### Client Management (`clients.ts`)

**Protected Functions:**
- `createClient` - Auto-assigns createdBy to current user
- `getClients` - Requires authentication to view any clients

### Document Management (`documents.ts`)

**Case-Protected Functions:**
- `createDocument` - Requires full access to the associated case
- `getDocuments` - Requires read access to the associated case
- `createEscrito` - Requires full access to the associated case
- `updateEscrito` - Requires full access to the associated case
- `getEscritos` - Requires read access to the associated case

### Template Management (`templates.ts`)

**Access-Controlled Functions:**
- `createModelo` - Auto-assigns createdBy to current user
- `getModelos` - Returns public templates + user's private templates
- `incrementModeloUsage` - Validates template access before incrementing

### Chat Management (`chat.ts`)

**Ownership-Protected Functions:**
- `createChatSession` - Auto-assigns to current user, validates case access if specified
- `getChatSessions` - Users can only view their own sessions
- `addChatMessage` - Validates session ownership, supports new role types and message types
- `getChatMessages` - Validates session ownership
- `updateChatMessageStatus` - Validates session ownership, updates message status for async operations
- `archiveChatSession` - Validates session ownership, soft deletes chat sessions

### Team Management (`teams.ts`)

**Team Creation:**
- `createTeam` - Any authenticated user can create teams
- Team creator is automatically added as an admin member
- If no team lead is specified, creator becomes team lead

**Team Membership Management:**
- `addUserToTeam` - Team leads and team admins can add users to their teams
- `removeUserFromTeam` - Team leads and team admins can remove users from their teams

**Access-Controlled Functions:**
- `getTeams` - Requires authentication to view teams
- `getTeamMembers` - Requires authentication to view team members
- `getUserTeams` - Users can view their own teams (admins can view others)

**Case-Access-Controlled Functions:**
- `grantTeamCaseAccess` - Requires full access to the case
- `revokeTeamCaseAccess` - Requires full access to the case
- `getTeamsWithCaseAccess` - Requires read access to the case
- `getCasesAccessibleByTeam` - Requires authentication

## Access Control Levels

### Team-Based Permissions
The system now uses team-based permissions instead of global user roles:

- **Team Roles**: Users have roles within specific teams (`"secretario"`, `"abogado"`, `"admin"`)
- **Team Leadership**: Team leads and team admins can manage team memberships
- **Team Creation**: Any authenticated user can create teams

### Case Access Levels
- `full` - Can edit case, add/remove clients, create documents
- `read` - Can view case details and documents (read-only)

### Access Sources
- `direct` - User is assigned lawyer or case creator
- `team` - User has access through team membership

## Security Features

### Authentication Validation
- All functions verify Clerk authentication
- Functions auto-assign current user to avoid impersonation
- Users cannot access other users' data without proper permissions

### Authorization Levels
- Team-based access control for management functions
- Case-level access control for legal data
- Ownership validation for user-specific data (chat sessions, private templates)

### Data Filtering
- Functions automatically filter results based on user access
- No unauthorized data leakage through queries
- Private templates only visible to creators

## Error Handling

### Common Error Messages
- `"Not authenticated"` - User not logged in
- `"Unauthorized: Only team leads and team admins can add members"` - Team management access required
- `"Unauthorized: No access to this case"` - Case access required
- `"Unauthorized: Full access required for this operation"` - Write access needed

### Best Practices
- All errors throw meaningful messages
- Functions fail securely (deny by default)
- Consistent error handling across all functions

## Implementation Notes

### Performance Considerations
- Authentication checks are lightweight
- Case access validation includes efficient team lookups
- Results are filtered at the database level where possible

### Extensibility
- Team role system can be extended with additional roles
- Case access levels can be expanded
- Team-based permissions are highly flexible

### Team Management Workflow
1. **Any user** can create a team
2. **Team creators** become team leads and team admins automatically
3. **Team leads and team admins** can invite users to their teams
4. **Users** can voluntarily leave teams (except team leads)
5. **Team leads** must transfer leadership before leaving

### Testing
- All functions require valid authentication
- Integration tests should use proper Clerk test tokens
- Team-based permission testing covers various team configurations 