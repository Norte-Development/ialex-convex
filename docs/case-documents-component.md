# Case Documents Component

## Overview

The `CaseDocuments` component is a React component designed to display and manage documents within a legal case context. It provides a list view of case documents with a drag-and-drop file upload interface.

## Features

### Document Display
- Lists all documents associated with the current case
- Shows document metadata including:
  - Title
  - Document type (with color-coded badges)
  - File size
  - Creation date
- Visual indicators for document types:
  - **Contrato** (Contract) - Blue
  - **Evidencia** (Evidence) - Green
  - **Correspondencia** (Correspondence) - Purple
  - **Escrito Legal** (Legal Brief) - Orange
  - **Presentación Judicial** (Court Filing) - Red
  - **Otro** (Other) - Gray

### File Upload Interface
- Drag-and-drop zone for file uploads
- Supports multiple file types:
  - PDF documents (`.pdf`)
  - Word documents (`.doc`, `.docx`)
  - Images (`.png`, `.jpg`, `.jpeg`, `.gif`)
  - Text files (`.txt`)
- Visual feedback during drag operations
- Click-to-upload functionality

### Document Actions
- **View**: Click on document title to navigate to document view
- **Download**: Download button for each document (placeholder)
- **Delete**: Delete button for each document (placeholder)

## Component Structure

### Props Interface
```typescript
interface CaseDocumentsProps {
  basePath: string;                    // Base URL path for navigation
  onDocumentUpload?: (files: File[]) => void;  // Callback for file uploads
}
```

### Key Functions

#### `getDocumentTypeColor(documentType: string)`
Returns appropriate CSS classes for document type badges based on the document type.

#### `getDocumentTypeText(documentType: string)`
Returns human-readable Spanish text for document types.

#### `formatFileSize(bytes: number)`
Converts file size in bytes to human-readable format (KB, MB, GB).

#### `formatDate(timestamp: number)`
Formats creation timestamp to Spanish locale date format.

## Integration

### Usage in CaseSideBar
The component is integrated into the `CaseSideBar` component within the "Documentos" collapsible section:

```tsx
<CaseDocuments 
  basePath={basePath}
  onDocumentUpload={(files) => {
    console.log("Files to upload:", files);
    // TODO: Implement document upload functionality
  }}
/>
```

### Data Fetching
The component uses Convex queries to fetch documents:

```tsx
const documents = useQuery(
  api.functions.documents.getDocuments,
  currentCase ? { caseId: currentCase._id } : "skip"
);
```

## Dependencies

### External Libraries
- **react-dropzone**: For drag-and-drop file upload functionality
- **lucide-react**: For icons (FileText, Upload, Download, Trash2)

### Internal Dependencies
- **@/context/CaseContext**: For current case information
- **convex/react**: For data fetching
- **react-router-dom**: For navigation

## Styling

The component uses Tailwind CSS classes and follows the existing design system:
- Consistent spacing and typography
- Hover states for interactive elements
- Color-coded badges for document types
- Responsive design within the sidebar constraints

## File Structure

```
src/components/Cases/
├── CaseDocuments.tsx          # Main component
└── CaseSideBar.tsx           # Parent component (updated)
```

## Future Enhancements

### Planned Features
1. **Document Upload Implementation**: Connect to Convex storage and document creation
2. **Download Functionality**: Implement file download from Convex storage
3. **Delete Functionality**: Add document deletion with confirmation
4. **Document Preview**: Inline document preview capabilities
5. **Bulk Operations**: Select multiple documents for bulk actions
6. **Search and Filter**: Add search and filtering capabilities
7. **Document Versioning**: Support for document version history

### Technical Improvements
1. **Error Handling**: Add proper error handling for upload failures
2. **Loading States**: Add loading indicators during operations
3. **File Validation**: Enhanced file type and size validation
4. **Progress Indicators**: Upload progress tracking
5. **Accessibility**: Improve keyboard navigation and screen reader support

## Database Schema

The component works with the `documents` table in the Convex schema:

```typescript
documents: defineTable({
  title: v.string(),
  description: v.optional(v.string()),
  caseId: v.id("cases"),
  documentType: v.optional(v.union(
    v.literal("contract"),
    v.literal("evidence"),
    v.literal("correspondence"),
    v.literal("legal_brief"),
    v.literal("court_filing"),
    v.literal("other")
  )),
  fileId: v.id("_storage"),
  originalFileName: v.string(),
  mimeType: v.string(),
  fileSize: v.number(),
  createdBy: v.id("users"),
  tags: v.optional(v.array(v.string())),
})
```

## Related Components

- **CaseSideBar**: Parent component that contains the documents section
- **CreateEscritoDialog**: Similar pattern for creating legal writings
- **CaseThreadSelector**: Similar list component for chat threads

## Testing Considerations

When implementing tests for this component, consider:

1. **File Upload Testing**: Test drag-and-drop and click-to-upload functionality
2. **Document List Rendering**: Test with various document types and states
3. **Navigation Testing**: Verify correct routing to document views
4. **Error States**: Test behavior with network errors or invalid data
5. **Accessibility Testing**: Ensure keyboard navigation and screen reader compatibility 