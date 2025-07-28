# Dynamic Escritos Creation in Case Sidebar

## Overview

The Case Sidebar has been enhanced to support dynamic creation and management of escritos (legal writings/briefs) instead of showing placeholder content. This feature allows users to create, view, manage, and archive case-related escritos directly from the sidebar interface.

## Features

### Dynamic Escritos Management

#### Real-time Escritos Display
- **Live Data**: The sidebar now fetches and displays actual escritos from the database using the `getEscritos` query
- **Status Indicators**: Each escrito shows its current status (Borrador/Terminado) with color-coded badges
- **Last Modified Date**: Displays when each escrito was last edited
- **Active State**: Highlights the currently selected escrito with a blue border

#### Escrito Creation
- **Quick Create Button**: Plus icon next to "Escritos" section opens the creation dialog
- **Form Validation**: Ensures required fields are completed before submission
- **Rich Metadata**: Supports court name, expedient number, and presentation date
- **Default Content**: Automatically creates a basic Tiptap JSON structure for new escritos

#### Archive Management
- **Archive Button**: Each escrito has an archive button (archive icon) for easy archiving
- **Tooltip Support**: Hover over archive buttons to see action descriptions
- **Archived Section**: Collapsible "Archivados" section shows all archived escritos
- **Restore Functionality**: Archived escritos can be restored using the restore button (rotate icon)
- **Visual Distinction**: Archived escritos are separated from active escritos

#### Navigation Integration
- **Direct Links**: Clicking on an escrito navigates to the full editor view
- **URL Synchronization**: Active escrito is highlighted based on current route
- **Context Preservation**: Maintains case context during navigation

### Enhanced User Experience

#### Visual Improvements
- **Status Badges**: Color-coded status indicators (green for completed, yellow for drafts)
- **Hover Effects**: Interactive hover states for better user feedback
- **Loading States**: Proper loading indicators while fetching data
- **Empty States**: Helpful messages when no escritos exist
- **Archive Icons**: Clear visual indicators for archive/restore actions

#### Accessibility
- **Keyboard Navigation**: Full keyboard support for all interactive elements
- **Screen Reader Support**: Proper ARIA labels and semantic HTML
- **Focus Management**: Logical tab order and focus indicators
- **Tooltips**: Helpful tooltips for archive and restore actions

## Technical Implementation

### Data Fetching

```typescript
// Fetch active escritos for current case
const escritos = useQuery(
  api.functions.documents.getEscritos,
  currentCase ? { caseId: currentCase._id } : "skip"
);

// Fetch archived escritos for current case
const archivedEscritos = useQuery(
  api.functions.documents.getArchivedEscritos,
  currentCase ? { caseId: currentCase._id } : "skip"
);
```

### Archive Operations

```typescript
// Archive mutation
const archiveEscrito = useMutation(api.functions.documents.archiveEscrito);

// Handle archive/unarchive
const handleArchiveEscrito = async (escritoId: string, isArchived: boolean) => {
  try {
    await archiveEscrito({
      escritoId: escritoId as any,
      isArchived: isArchived,
    });
  } catch (error) {
    console.error("Error archiving/unarchiving escrito:", error);
    alert("Error al archivar/desarchivar el escrito. Por favor intenta de nuevo.");
  }
};
```

### Component Structure

```
CaseSidebar
├── Escritos Section
│   ├── Collapsible Header with Create Button
│   ├── Escritos List (dynamic with archive buttons)
│   └── CreateEscritoDialog
├── Documents Section (placeholder)
│   └── Static placeholder content
├── Chat History Section
│   └── AIAgentThreadSelector
└── Archivados Section
    ├── Collapsible Header
    └── Archived Escritos List (with restore buttons)
```

### State Management

```typescript
// Dialog state management
const [isCreateEscritoOpen, setIsCreateEscritoOpen] = useState(false);
const [isArchivadosOpen, setIsArchivadosOpen] = useState(false);

// Layout context integration
const {
  isEscritosOpen,
  toggleEscritos,
  isDocumentosOpen,
  toggleDocumentos,
} = useLayout();
```

## API Integration

### Escritos Functions

- **`getEscritos`**: Fetches all active (non-archived) escritos for a case
- **`getArchivedEscritos`**: Fetches all archived escritos for a case
- **`createEscrito`**: Creates new escrito with Tiptap JSON content
- **`updateEscrito`**: Updates existing escrito metadata and content
- **`getEscrito`**: Retrieves specific escrito by ID
- **`archiveEscrito`**: Archives or unarchives an escrito

## Usage Examples

### Creating a New Escrito

1. Navigate to a case
2. Open the case sidebar
3. Click the plus icon next to "Escritos"
4. Fill in the required fields:
   - Title: "Demanda por Daños y Perjuicios"
   - Court: "Juzgado Civil N° 1"
   - Expedient: "EXP-2024-001"
5. Click "Crear Escrito"
6. The new escrito appears in the sidebar list

### Archiving an Escrito

1. Find the escrito in the "Escritos" section
2. Click the archive icon (📦) next to the escrito title
3. The escrito disappears from the active list
4. The escrito appears in the "Archivados" section

### Restoring an Archived Escrito

1. Click on "Archivados" to expand the section
2. Find the archived escrito
3. Click the restore icon (🔄) next to the escrito title
4. The escrito moves back to the active "Escritos" section

### Navigating Between Escritos

1. Click on any escrito in the sidebar (active or archived)
2. Automatically navigates to the full editor view
3. The selected escrito is highlighted in the sidebar
4. Use browser back/forward for navigation

## Error Handling

### Network Errors
- Graceful fallback when queries fail
- Loading states during data fetching
- Error messages for user feedback

### Validation Errors
- Form validation before submission
- Required field indicators
- Clear error messages for missing data

### Archive Operation Errors
- Error handling for archive/unarchive operations
- User-friendly error messages
- Automatic retry suggestions

## Future Enhancements

### Planned Features
1. **Document Management**: Add file-based document upload functionality
2. **Search and Filter**: Filter escritos by status, date, or title
3. **Version Control**: Track escrito versions and changes
4. **Collaboration**: Real-time collaborative editing indicators
5. **Templates**: Pre-built escrito templates for common legal documents
6. **Bulk Operations**: Select multiple escritos for batch archiving
7. **Archive Categories**: Organize archived escritos by reason or category

### Performance Optimizations
1. **Pagination**: Load escritos in chunks for better performance
2. **Caching**: Implement client-side caching for frequently accessed data
3. **Lazy Loading**: Load escrito content on demand
4. **Optimistic Updates**: Immediate UI updates with background sync

## Configuration

### User Preferences
- Default escrito settings
- Auto-save settings
- Display preferences
- Archive behavior preferences

## Troubleshooting

### Common Issues

1. **Escritos Not Loading**
   - Check case access permissions
   - Verify network connectivity
   - Review browser console for errors

2. **Creation Dialog Not Opening**
   - Ensure user has full case access
   - Check for JavaScript errors
   - Verify component imports

3. **Archive Operations Failing**
   - Check user permissions (requires full case access)
   - Verify escrito exists and is accessible
   - Review network connectivity

### Debug Information
- Enable debug logging for detailed error information
- Check Convex dashboard for function execution logs
- Review browser network tab for API calls

## Related Documentation

- [Database Schema](./database-schema.md) - Escrito table structure with archive fields
- [Authentication Implementation](./authentication-implementation.md) - Access control details
- [Thread Context Implementation](./thread-context-implementation.md) - Chat integration
- [Team Management](./team-invites-feature.md) - Team-based access control 