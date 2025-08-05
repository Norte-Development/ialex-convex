# Document Viewer Implementation

## Overview

The document viewer feature allows users to preview documents directly within the application. Currently, it supports PDF files and images, while showing a helpful message for unsupported file types like Word documents.

## Features

### Supported File Types
- **PDF Documents** (`application/pdf`) - Displayed using iframe
- **Images** (`image/*`) - Displayed using native `<img>` tag
- **Unsupported Types** - Shows informative message with download option

### Document Viewer Page
- **Route**: `/caso/:id/documentos/:documentId`
- **Component**: `CaseDocumentPage`
- **Layout**: Uses `CaseLayout` for consistent navigation

## Implementation Details

### Frontend Components

#### CaseDocumentPage (`src/pages/CaseOpen/CaseDocumentPage.tsx`)
Main document viewer component that handles:
- Document metadata display (title, type, size, creation date)
- File type detection and appropriate rendering
- Download functionality
- Loading states with skeletons

#### Key Functions
```typescript
const isImage = (mimeType: string) => mimeType.startsWith("image/");
const isPdf = (mimeType: string) => mimeType === "application/pdf";
const isSupported = (mimeType: string) => isImage(mimeType) || isPdf(mimeType);
```

### Backend Functions

#### getDocument (`convex/functions/documents.ts`)
Retrieves a specific document by ID with access control:
```typescript
export const getDocument = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    if (!document) return null;
    await requireCaseAccess(ctx, document.caseId, "read");
    return document;
  },
});
```

#### getDocumentUrl (`convex/functions/documents.ts`)
Generates signed URLs for document download:
```typescript
export const getDocumentUrl = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    if (!document) return null;
    await requireCaseAccess(ctx, document.caseId, "read");
    return await ctx.storage.getUrl(document.fileId);
  },
});
```

## User Experience

### Document Header
- Document title and type badge
- Download button
- File metadata (size, upload date, MIME type)

### Viewer Content
- **PDFs**: Full iframe viewer with browser controls
- **Images**: Centered display with responsive sizing
- **Unsupported**: Clear message with file information and download option

### Loading States
- Skeleton loaders while fetching document data
- Graceful handling of missing documents

## Security & Access Control

### Authentication
- All document access requires authentication via Clerk
- Case-level access control using `requireCaseAccess`

### Authorization
- Users must have read access to the case to view documents
- Document URLs are signed and expire automatically

## Future Enhancements

### Planned Features
1. **Text File Support**: Add preview for `.txt` files
2. **Document Conversion**: Server-side conversion of Word documents to PDF
3. **Thumbnail Generation**: Generate preview thumbnails for images
4. **Full-screen Mode**: Enhanced viewing experience
5. **Document Annotations**: Add commenting and highlighting features

### Technical Improvements
1. **Caching**: Implement document URL caching for better performance
2. **Progressive Loading**: Add progressive image loading for large files
3. **Error Handling**: Enhanced error states for failed loads
4. **Accessibility**: Improve screen reader support and keyboard navigation

## Integration

### Navigation
Documents are accessed via the `CaseDocuments` component in the sidebar:
```tsx
<Link to={`${basePath}/documentos/${document._id}`}>
  {document.title}
</Link>
```

### Routing
Added to the main case routes in `App.tsx`:
```tsx
<Route path="documentos/:documentId" element={<CaseDocumentPage />} />
```

## File Type Support Matrix

| File Type | MIME Type | Preview | Download | Notes |
|-----------|-----------|---------|----------|-------|
| PDF | `application/pdf` | ✅ iframe | ✅ | Full browser controls |
| Images | `image/*` | ✅ native | ✅ | Responsive sizing |
| Word | `application/msword` | ❌ message | ✅ | Future: PDF conversion |
| Word | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | ❌ message | ✅ | Future: PDF conversion |
| Text | `text/plain` | ❌ message | ✅ | Future: native preview |

## Error Handling

### Common Scenarios
1. **Document Not Found**: Shows skeleton loader then error state
2. **Access Denied**: Redirects to sign-in or shows access error
3. **Storage Error**: Shows download-only option
4. **Unsupported Type**: Clear message with file information

### User Feedback
- Loading skeletons during data fetch
- Clear error messages for unsupported types
- Download button always available as fallback
- Responsive design for all screen sizes 