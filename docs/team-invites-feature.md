# Team Invites Feature Documentation

## Overview

The team invite functionality allows team administrators and leaders to invite new users to join their teams via email. The system supports two scenarios:
1. **Existing users**: Users who already have an iAlex account
2. **New users**: Users who need to create an account first

## Features

### 🚀 Core Functionality
- **Email-based invitations** with Spanish templates
- **Role-based invites** (Secretario, Abogado, Admin)
- **7-day expiration** on all invitations
- **Automatic user detection** (existing vs new users)
- **Invitation management** (cancel, resend)
- **Secure token-based system**

### 🔒 Security & Permissions
- Only team leads and admins can send invitations
- Email format validation
- Duplicate invitation prevention
- Token expiration and validation
- User email verification on acceptance

## User Interface Components

### 1. InviteUserDialog
**Location**: Team Management Page  
**Purpose**: Send new invitations

**Features**:
- Email input with validation
- Role selection dropdown
- Form submission with loading states
- Error handling and user feedback

### 2. PendingInvitesTable
**Location**: Team Management Page  
**Purpose**: Manage pending invitations

**Features**:
- List all pending invitations
- Show expiration dates
- Resend invitation emails
- Cancel pending invitations
- Role badges with color coding

### 3. AcceptInvitePage
**Route**: `/invites/accept?token=xxx`  
**Purpose**: Accept team invitations (existing users)

**Features**:
- Token validation
- Team and role information display
- One-click acceptance
- Automatic redirect to teams page
- Authentication requirement

### 4. SignupInvitePage
**Route**: `/invites/signup?token=xxx`  
**Purpose**: Sign up and join team (new users)

**Features**:
- Invitation details preview
- Integrated Clerk signup form
- Automatic team joining after signup
- Welcome messaging
- Brand introduction

## Email Templates

### Existing User Email
```
Subject: Invitación para unirte al equipo [TEAM_NAME]

¡Hola!

Has sido invitado/a por [INVITER_NAME] para unirte al equipo "[TEAM_NAME]" 
en iAlex como [ROLE].

[Aceptar Invitación Button]

Esta invitación expira el [DATE].
```

### New User Email
```
Subject: Invitación para crear cuenta y unirte al equipo [TEAM_NAME]

¡Hola!

Has sido invitado/a por [INVITER_NAME] para unirte al equipo "[TEAM_NAME]" 
en iAlex como [ROLE].

Para comenzar, necesitas crear una cuenta en iAlex y automáticamente 
serás agregado/a al equipo.

[Crear Cuenta y Unirse al Equipo Button]

Esta invitación expira el [DATE].
```

## Backend Functions

### Core Functions

#### `sendTeamInvite`
- **Type**: Mutation
- **Permission**: Team leads and admins only
- **Purpose**: Create invitation and send email
- **Validation**: Email format, duplicate prevention, team permissions

#### `acceptTeamInvite`
- **Type**: Mutation
- **Permission**: Authenticated users
- **Purpose**: Accept invitation using token (for existing users)
- **Validation**: Token validity, email matching, expiration check

#### `createUserAndJoinTeam`
- **Type**: Mutation
- **Permission**: Authenticated users (newly signed up)
- **Purpose**: Create user account and automatically join team (for new users)
- **Validation**: Clerk identity verification, token validity, email matching

#### `cancelTeamInvite`
- **Type**: Mutation
- **Permission**: Team leads, admins, or invitation creator
- **Purpose**: Cancel pending invitations

#### `getTeams`
- **Type**: Query
- **Permission**: Authenticated users
- **Purpose**: Get only teams where the user is a member or team lead
- **Improvement**: Now returns only relevant teams instead of all teams

#### `getTeamInvites`
- **Type**: Query
- **Permission**: Team members
- **Purpose**: List pending invitations for a team

#### `validateInviteToken`
- **Type**: Query
- **Permission**: Public (no authentication required)
- **Purpose**: Validate invitation tokens for preview

#### `resendTeamInvite`
- **Type**: Mutation
- **Permission**: Team leads and admins
- **Purpose**: Resend invitation emails

## Database Schema

### teamInvites Table
```typescript
{
  teamId: Id<"teams">,
  email: string,
  invitedBy: Id<"users">,
  token: string, // Unique invitation token
  role: "secretario" | "abogado" | "admin",
  status: "pending" | "accepted" | "expired" | "cancelled",
  expiresAt: number, // Timestamp
  acceptedAt?: number,
  acceptedBy?: Id<"users">
}
```

### Indexes
- `by_team`: Fast team-based queries
- `by_email`: Email lookup
- `by_token`: Token validation
- `by_status`: Status filtering
- `by_team_and_email`: Duplicate prevention

## Environment Variables

Required for email functionality:

```env
# Resend Configuration
RESEND_FROM_EMAIL=noreply@ialex.com

# Application URLs
VITE_APP_URL=http://localhost:3000  # For development
VITE_APP_URL=https://ialex.com      # For production
```

## User Flows

### Flow 1: Invite Existing User
1. Team admin opens team management page
2. Clicks "Invitar Usuario" button
3. Enters email and selects role
4. System detects existing user
5. Sends "join team" email
6. User clicks email link → AcceptInvitePage
7. User accepts invitation
8. User is added to team with specified role

### Flow 2: Invite New User
1. Team admin opens team management page
2. Clicks "Invitar Usuario" button
3. Enters email and selects role
4. System detects new user
5. Sends "create account and join" email
6. User clicks email link → SignupInvitePage
7. User creates account via Clerk
8. System automatically calls `createUserAndJoinTeam` (atomic operation)
9. User is successfully added to team and redirected to main application

### Flow 3: Manage Invitations
1. Team admin views pending invitations table
2. Can resend invitations (for lost emails)
3. Can cancel invitations (for mistakes)
4. Invitations automatically expire after 7 days

## Error Handling

### Improved Error Handling (v2.0)
- **No more alert() popups**: Replaced with elegant inline error messages
- **Visual feedback**: Success/error states with color-coded messages
- **Auto-dismiss**: Success messages automatically disappear after 3 seconds
- **Loading states**: Proper loading indicators for all async operations
- **Contextual errors**: Errors appear exactly where they're relevant

### Common Errors
- **Invalid email format**: Frontend validation with immediate feedback
- **User already in team**: Backend validation with clear message
- **Duplicate invitation**: Backend prevention with helpful guidance
- **Expired invitation**: Automatic detection and status update
- **Permission denied**: Role-based validation with explanation
- **Token not found**: Graceful handling with redirect options

### User-Friendly Messages
All error messages are in Spanish and provide clear guidance on resolution. The UI now shows:
- **Green banners** for successful operations
- **Red banners** for errors that need attention
- **Loading spinners** during operations
- **Disabled states** to prevent double-submissions

## Testing Scenarios

### Test Cases
1. **Send invitation to existing user**
2. **Send invitation to new user**
3. **Accept invitation as existing user**
4. **Sign up and auto-join as new user**
5. **Try to accept expired invitation**
6. **Try to send duplicate invitation**
7. **Cancel pending invitation**
8. **Resend invitation email**
9. **Non-admin tries to send invitation**
10. **Accept invitation with wrong email**

## Integration Points

### With Existing Systems
- **Team Management**: Integrated into existing team pages
- **User Authentication**: Uses Clerk for signup/signin
- **Email Service**: Uses Resend for email delivery
- **Database**: Extends existing team schema
- **Routing**: Adds public invitation routes

### Future Enhancements
- **Bulk invitations**: Invite multiple users at once
- **Custom expiration**: Allow custom expiration times
- **Invitation templates**: Customizable email templates
- **Analytics**: Track invitation success rates
- **Role restrictions**: Limit who can invite certain roles

## Troubleshooting

### Common Issues

#### Emails not sending
- Check Resend API key configuration
- Verify `RESEND_FROM_EMAIL` environment variable
- Check email service logs

#### Invitations not working
- Verify token in URL is complete
- Check invitation hasn't expired
- Ensure user email matches invitation

#### Permission errors
- Confirm user has admin/lead role in team
- Check team membership status
- Verify authentication state

## API Reference

### Frontend APIs
```typescript
// Send invitation
useMutation(api.functions.teams.sendTeamInvite)

// Accept invitation
useMutation(api.functions.teams.acceptTeamInvite)

// Get team invitations
useQuery(api.functions.teams.getTeamInvites)

// Validate token
useQuery(api.functions.teams.validateInviteToken)
```

### Routes
- `/invites/accept?token=xxx` - Accept invitation (existing users)
- `/invites/signup?token=xxx` - Signup and join (new users)

This feature provides a complete, secure, and user-friendly way to grow teams in iAlex while maintaining proper access control and user experience. 