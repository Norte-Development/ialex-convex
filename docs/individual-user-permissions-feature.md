# Individual User Permissions Feature

## Overview

The Individual User Permissions feature allows case administrators to grant specific permissions to individual users outside of team memberships. This provides granular access control for cases where users need specific access without being part of a formal team.

## Key Features

### 🔍 User Search and Selection
- **Real-time Search**: Search users by email or name with instant results
- **Comprehensive Duplicate Prevention**: Automatically filters out users who already have access through any means (direct access, individual permissions, or team access)
- **User Information Display**: Shows user details including name, email, and role

### 🛡️ Granular Permission Levels
- **Solo Lectura (Read Only)**: View case, documents, escritos, and clients
- **Lectura y Escritura (Read/Write)**: All read permissions plus chat access
- **Acceso Completo (Full Access)**: Complete access including team management

### 📋 Permission Management Table
- **Visual Permission Display**: Clear badges showing access levels
- **Detailed Permission Lists**: Shows specific permissions granted
- **Grant Date Tracking**: Displays when permissions were granted
- **Action Buttons**: Edit or revoke permissions with single clicks

### 🔄 Real-time Updates
- **Live Data**: All changes reflect immediately across the UI
- **Permission Context Integration**: Seamlessly works with existing permission system
- **Loading States**: Smooth user experience during operations

## Components

### 1. IndividualUserPermissionsDialog
**Location**: `src/components/Cases/IndividualUserPermissionsDialog.tsx`

**Purpose**: Dialog for searching and adding individual users to a case with specific permissions.

**Key Features**:
- User search with 2+ character minimum
- Permission level selection with descriptions
- Duplicate user prevention
- Form validation and error handling

**Usage**:
```tsx
<IndividualUserPermissionsDialog
  isOpen={isDialogOpen}
  onClose={() => setIsDialogOpen(false)}
  caseId={currentCase._id}
/>
```

### 2. IndividualUserPermissionsTable
**Location**: `src/components/Cases/IndividualUserPermissionsTable.tsx`

**Purpose**: Table component for viewing and managing individual user permissions.

**Key Features**:
- Paginated user list with access details
- Permission level badges with color coding
- Edit and revoke actions for each user
- Confirmation dialogs for destructive actions
- Loading states and empty states

**Usage**:
```tsx
<IndividualUserPermissionsTable
  caseId={currentCase._id}
  onEditUser={(userId, permissions) => {
    // Handle edit functionality
  }}
/>
```

### 3. Backend Integration
**Location**: `convex/functions/permissions.ts` and `convex/functions/users.ts`

**New Functions**:
- `searchUsers`: Search users by email or name
- `searchAvailableUsersForCase`: Efficiently search and filter users available for case access (combines search + filtering)
- `grantUserCaseAccess`: Grant permissions to individual users
- `revokeUserCaseAccess`: Remove user access from cases
- `getUsersWithCaseAccess`: Get all users with individual case access
- `getAllUsersWithCaseAccess`: Get all users with access to a case (including team access)

## Permission System Integration

### Permission Mapping
The system converts high-level access levels to specific permission arrays:

```typescript
const getPermissionsFromLevel = (level: "read" | "write" | "full") => {
  switch (level) {
    case "read":
      return ["view", "documents", "escritos", "clients"];
    case "write":  
      return ["view", "documents", "escritos", "clients", "chat"];
    case "full":
      return ["full"];
  }
};
```

### Context Integration
- Works seamlessly with existing `CasePermissionsProvider`
- Integrates with team-based permissions
- Respects hierarchical permission structure

## User Interface

### Case Teams Page Integration
**Location**: `src/pages/CaseOpen/CaseTeamsPage.tsx`

The individual user permissions section is added as a separate card below the teams section:

```tsx
{/* Individual User Permissions Section */}
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <UserPlus className="h-5 w-5 text-green-600" />
      Usuarios Individuales
    </CardTitle>
  </CardHeader>
  <CardContent>
    <IndividualUserPermissionsTable caseId={currentCase._id} />
  </CardContent>
</Card>
```

### Permission-Based Visibility
- Only users with team management permissions can add/edit individual users
- All users with case access can view the individual permissions table
- Actions are disabled based on user permissions

## Security Considerations

### Access Control
- Only users with "full" or "teams" permissions can grant individual access
- Users cannot grant permissions to themselves
- All permission changes are logged with grantor information

### Data Protection
- User search results are limited to essential information only
- Permission changes require confirmation dialogs
- All operations use proper authentication and authorization

### Audit Trail
- Grant dates and grantor information are tracked
- Permission changes are logged in the activity system
- Revocation actions are permanent and tracked

## Usage Scenarios

### 1. External Collaborators
Grant specific access to external lawyers, consultants, or clients who need limited access to case information without formal team membership.

### 2. Temporary Access
Provide time-limited access to users for specific tasks or review periods.

### 3. Cross-Department Collaboration
Allow users from different departments to access specific cases without adding them to formal teams.

### 4. Client Access
Grant clients read-only access to their own cases for transparency and collaboration.

## Best Practices

### 1. Principle of Least Privilege
- Start with read-only access and escalate as needed
- Regularly review and audit individual permissions
- Use team memberships for ongoing access needs

### 2. Clear Communication
- Document why individual access was granted
- Set clear expectations about access duration
- Communicate access changes to relevant stakeholders

### 3. Regular Cleanup
- Review individual permissions periodically
- Remove unused or expired access
- Transition temporary individual access to team memberships when appropriate

## Technical Implementation Details

### Database Schema
Individual user permissions are stored in the `userCaseAccess` table with the following structure:

```typescript
interface UserCaseAccess {
  caseId: Id<"cases">;
  userId: Id<"users">;
  permissions: string[];
  grantedBy: Id<"users">;
  grantedAt: number;
  expiresAt?: number;
  isActive: boolean;
}
```

### Permission Resolution
The system resolves permissions in the following order:
1. Case owner (full access)
2. Assigned lawyer (full access)
3. Individual user permissions
4. Team-based permissions
5. Default (no access)

### User Access Filtering
The system now comprehensively filters out users who already have access to a case through any means:

1. **Direct Access**: Case owner and assigned lawyer
2. **Individual Permissions**: Users with specific case permissions
3. **Team Access**: Users who have access through team memberships
4. **Team Member Permissions**: Users with specific permissions as team members

This prevents duplicate access grants and ensures users only appear in search results if they don't already have access to the case.

### Query Optimization
The system uses a single optimized query (`searchAvailableUsersForCase`) that combines:
1. **User Search**: Finds users matching the search term
2. **Access Filtering**: Filters out users who already have access
3. **Single Database Round-trip**: Eliminates the need for multiple queries and client-side filtering

This approach significantly improves performance by:
- Reducing network overhead
- Minimizing database queries
- Eliminating query waterfalls
- Providing faster user experience

### Performance Considerations
- User search results are limited to 20 users
- Search requires minimum 1 character to prevent excessive queries
- **Optimized Single Query**: Combined search and filtering in one efficient database query
- Permission checks are cached at the component level
- Table pagination for large user lists
- Reduced network overhead by eliminating multiple query waterfalls

## Future Enhancements

### 1. Advanced Permission Templates
- Predefined permission sets for common scenarios
- Custom permission combinations
- Role-based permission templates

### 2. Time-Based Access
- Automatic expiration of individual permissions
- Scheduled access grants and revocations
- Notification system for expiring access

### 3. Enhanced Audit Trail
- Detailed permission change history
- Export capabilities for compliance reporting
- Integration with external audit systems

### 4. Bulk Operations
- Bulk user addition from CSV files
- Batch permission updates
- Mass revocation capabilities

## Troubleshooting

### Common Issues

**User Not Found in Search**
- Verify user exists in the system
- Check spelling of email or name
- Ensure user has completed onboarding

**Permission Changes Not Reflected**
- Refresh the page to reload permissions
- Check if user has conflicting team permissions
- Verify grantor has sufficient permissions

**Cannot Add User**
- User may already have access via team membership, direct assignment, or individual permissions
- Check if user is case owner or assigned lawyer
- Verify search results are not filtered out due to existing access

### Error Messages

**"User already has access"**
- User has individual, team-based, or direct access already
- Check existing permissions before adding
- The system now comprehensively checks all access sources

**"Cannot grant permissions to yourself"**
- Self-granting is prohibited for security
- Ask another administrator to grant permissions

**"Insufficient permissions"**
- Only users with team management rights can grant individual access
- Contact a case administrator for assistance 