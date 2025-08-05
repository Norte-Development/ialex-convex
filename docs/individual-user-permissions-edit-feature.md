# Individual User Permissions Edit Feature

## Overview

This feature allows users with appropriate permissions to edit the access levels of individual users who have been granted case-specific permissions. The edit functionality is integrated into the `IndividualUserPermissionsTable` component and provides a user-friendly dialog for modifying permission levels.

## Components

### EditUserPermissionsDialog

A new dialog component (`src/components/Cases/EditUserPermissionsDialog.tsx`) that provides:

- **User Information Display**: Shows the user's name and email
- **Quick Access Levels**: Buttons for rapid selection of predefined permission sets
- **Granular Permission Control**: Individual checkboxes for each specific permission
- **Categorized Permissions**: Permissions organized by category (Caso, Documentos, Escritos, Clientes, Equipos, Chat)
- **Real-time Summary**: Shows current access level and number of active permissions
- **Smart Permission Logic**: Automatically handles conflicts (e.g., selecting FULL removes other permissions)
- **Validation**: Prevents unnecessary updates when no changes are made

### Updated IndividualUserPermissionsTable

The existing table component has been enhanced to:

- **Integrated Edit Button**: Each user row now has an edit button that opens the `EditUserPermissionsDialog`
- **Removed Callback Pattern**: No longer requires an `onEditUser` callback prop
- **Direct Dialog Integration**: Edit functionality is now self-contained within the table

## Permission Categories and Granular Control

The edit dialog provides both quick access levels and granular permission control:

### Quick Access Levels
- **Solo Lectura**: Basic view permissions for case, documents, escritos, clients, and teams
- **Lectura y Escritura**: View and edit permissions plus chat access
- **Acceso Completo**: Full system access

### Granular Permissions by Category

#### Caso (Case)
- **Ver Caso** (`case.view`): Can view basic case information
- **Editar Caso** (`case.edit`): Can modify case information

#### Documentos (Documents)
- **Ver Documentos** (`documents.read`): Can view and download documents
- **Editar Documentos** (`documents.write`): Can upload, edit, and delete documents

#### Escritos (Legal Writings)
- **Ver Escritos** (`escritos.read`): Can view legal writings
- **Editar Escritos** (`escritos.write`): Can create and edit legal writings

#### Clientes (Clients)
- **Ver Clientes** (`clients.read`): Can view client information
- **Editar Clientes** (`clients.write`): Can modify client information

#### Equipos (Teams)
- **Ver Equipos** (`teams.read`): Can view team assignments

#### Chat
- **Acceso al Chat IA** (`chat.access`): Can use AI chat functionality

#### Sistema (System)
- **Acceso Completo** (`full`): Comprehensive access to all functionalities

## Usage

### In CaseTeamsPage

The feature is automatically available in the Case Teams page:

```tsx
<IndividualUserPermissionsTable caseId={currentCase._id} />
```

### Standalone Usage

The edit dialog can also be used independently:

```tsx
<EditUserPermissionsDialog
  caseId={caseId}
  userId={userId}
  userName={userName}
  userEmail={userEmail}
  currentPermissions={currentPermissions}
  trigger={<Button>Edit Permissions</Button>}
  onSuccess={() => {
    // Optional callback after successful update
  }}
/>
```

## User Experience

1. **Dual Interface**: Quick access buttons for common scenarios + granular checkboxes for fine-tuning
2. **Visual Organization**: Permissions grouped by category with descriptive icons
3. **Real-time Feedback**: Live summary showing current access level and permission count
4. **Smart Logic**: Automatic handling of permission conflicts (e.g., FULL access overrides others)
5. **Validation**: Update button disabled when no changes are detected
6. **Success Notifications**: Toast notifications confirm successful permission updates
7. **Error Handling**: Clear error messages if updates fail

## Technical Implementation

### State Management
- Uses local state for dialog open/close
- Tracks the selected access level
- Manages loading states during updates

### API Integration
- Uses the existing `grantUserCaseAccess` mutation
- Automatically converts access levels to granular permissions
- Handles errors gracefully with user feedback

### Permission Management
- Uses `Set<string>` for efficient permission tracking and comparison
- Implements smart permission logic to handle conflicts automatically
- Groups permissions by category for better organization
- Uses the centralized `PERMISSIONS` constants for consistency
- Maintains backward compatibility with existing permission structures

## Security Considerations

- Only users with `canManageTeams` permission can access the edit functionality
- Permission updates are validated on the server side
- All changes are logged in the activity log for audit purposes

## Future Enhancements

Potential improvements for future iterations:

1. **Permission Templates**: Save and reuse common permission configurations
2. **Bulk Operations**: Edit permissions for multiple users at once
3. **Audit Trail**: Show history of permission changes for each user
4. **Temporary Permissions**: Set expiration dates for temporary access grants
5. **Advanced Logic**: Implement dependency rules (e.g., write access requires read access)
6. **Permission Inheritance**: Allow permissions to be inherited from team memberships 