# Documents List Pagination Implementation

## Overview
Add pagination to the Documents List component (`/components/Documents/DocumentsList.tsx`) to handle large numbers of documents and folders efficiently within a case.

## Current State
- **File**: `src/components/Documents/DocumentsList.tsx`
- **Queries**: `api.functions.documents.getDocumentsInFolder` and `api.functions.folders.getFoldersForCase`
- **Current Behavior**: Loads all documents and folders for a case at once
- **Issues**: Performance degradation with many documents, no pagination controls

## Implementation Plan

### 1. Backend Changes (Convex Functions)

#### Update `convex/functions/documents.ts`
```typescript
// Add pagination support to getDocumentsInFolder function
export const getDocumentsInFolder = query({
  args: {
    caseId: v.id("cases"),
    folderId: v.optional(v.id("folders")),
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    documentType: v.optional(v.string()),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.string()),
  },
  returns: v.object({
    page: v.array(documentValidator),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    // Implementation with pagination, search, and filtering
  },
});

// Add pagination support to getFoldersForCase function
export const getFoldersForCase = query({
  args: {
    caseId: v.id("cases"),
    parentFolderId: v.optional(v.id("folders")),
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.string()),
  },
  returns: v.object({
    page: v.array(folderValidator),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    // Implementation with pagination and search
  },
});
```

### 2. Frontend Changes

#### Update `src/components/Documents/DocumentsList.tsx`
```typescript
// Add pagination props
interface DocumentsListProps {
  caseId: Id<"cases">;
  currentFolderId?: Id<"folders">;
  paginationOpts: PaginationOpts;
  searchQuery?: string;
  documentTypeFilter?: string;
  onLoadMore: () => void;
  onSearchChange: (query: string) => void;
  onDocumentTypeFilterChange: (type: string) => void;
  onFolderClick?: (folderId: Id<"folders">) => void;
  breadcrumb?: React.ReactNode;
  onCreateFolder?: () => void;
  onCreateDocument?: () => void;
}

// Add pagination state
const [paginationOpts, setPaginationOpts] = useState({
  numItems: 25,
  cursor: null,
});

const [searchQuery, setSearchQuery] = useState("");
const [documentTypeFilter, setDocumentTypeFilter] = useState<string | undefined>();

// Update query calls
const documentsResult = useQuery(api.functions.documents.getDocumentsInFolder, {
  caseId,
  folderId: currentFolderId,
  paginationOpts,
  search: searchQuery,
  documentType: documentTypeFilter,
  sortBy: "createdAt",
  sortOrder: "desc",
});

const foldersResult = useQuery(api.functions.folders.getFoldersForCase, {
  caseId,
  parentFolderId: currentFolderId,
  paginationOpts,
  search: searchQuery,
  sortBy: "name",
  sortOrder: "asc",
});
```

#### Update `src/pages/CaseOpen/CaseDocumentsList.tsx`
```typescript
// Add pagination state and pass to DocumentsList
const [paginationOpts, setPaginationOpts] = useState({
  numItems: 25,
  cursor: null,
});

const [searchQuery, setSearchQuery] = useState("");
const [documentTypeFilter, setDocumentTypeFilter] = useState<string | undefined>();

// Pass pagination props to DocumentsList
<DocumentsList
  documents={documentsResult}
  folders={foldersResult}
  caseId={currentCase?._id}
  currentFolderId={currentFolderId}
  paginationOpts={paginationOpts}
  searchQuery={searchQuery}
  documentTypeFilter={documentTypeFilter}
  onLoadMore={handleLoadMore}
  onSearchChange={setSearchQuery}
  onDocumentTypeFilterChange={setDocumentTypeFilter}
  onFolderClick={handleFolderClick}
  breadcrumb={breadcrumb}
  onCreateFolder={handleCreateFolder}
  onCreateDocument={handleCreateDocument}
/>
```

### 3. UI Components

#### Create `src/components/Documents/DocumentsPaginationControls.tsx`
- Reuse pattern from `DataBase/PaginationControls.tsx`
- Add "Load More" button for infinite scroll
- Show documents count and pagination info
- Add search bar
- Add document type filter

#### Create `src/components/Documents/DocumentsFilters.tsx`
```typescript
const DocumentsFilters = ({ 
  searchQuery, 
  setSearchQuery, 
  documentTypeFilter, 
  setDocumentTypeFilter 
}) => {
  return (
    <div className="flex gap-4 items-center mb-4">
      <Input
        placeholder="Buscar documentos..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-64"
      />
      <Select value={documentTypeFilter} onValueChange={setDocumentTypeFilter}>
        <SelectTrigger>
          <SelectValue placeholder="Tipo de documento" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="contract">Contrato</SelectItem>
          <SelectItem value="evidence">Evidencia</SelectItem>
          <SelectItem value="correspondence">Correspondencia</SelectItem>
          <SelectItem value="legal_brief">Escrito Legal</SelectItem>
          <SelectItem value="court_filing">Presentación Judicial</SelectItem>
          <SelectItem value="other">Otro</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
```

### 4. State Management

#### Add to `src/context/DocumentContext.tsx` (if needed)
```typescript
interface DocumentContextState {
  pagination: {
    currentPage: number;
    pageSize: number;
    totalDocuments: number;
  };
  searchQuery: string;
  documentTypeFilter: string;
  sortBy: string;
  sortOrder: string;
}
```

### 5. Implementation Steps

1. **Backend Implementation**
   - [ ] Update `getDocumentsInFolder` function to support pagination
   - [ ] Update `getFoldersForCase` function to support pagination
   - [ ] Add search functionality
   - [ ] Add document type filtering
   - [ ] Add sorting options
   - [ ] Test with large datasets

2. **Frontend Implementation**
   - [ ] Add pagination state to DocumentsList
   - [ ] Update CaseDocumentsList to pass pagination props
   - [ ] Create pagination controls component
   - [ ] Implement search functionality
   - [ ] Add document type filter

3. **UI/UX Improvements**
   - [ ] Add loading states
   - [ ] Add empty states
   - [ ] Add search bar
   - [ ] Add document type filter
   - [ ] Add documents count display
   - [ ] Improve table layout

4. **Testing**
   - [ ] Test with 100+ documents
   - [ ] Test search functionality
   - [ ] Test pagination controls
   - [ ] Test document type filtering
   - [ ] Test folder navigation
   - [ ] Test performance
   - [ ] Test responsive design

### 6. Files to Modify

- `convex/functions/documents.ts` - Add pagination support
- `convex/functions/folders.ts` - Add pagination support
- `src/components/Documents/DocumentsList.tsx` - Update component
- `src/pages/CaseOpen/CaseDocumentsList.tsx` - Add pagination state
- `src/components/Documents/DocumentsPaginationControls.tsx` - New component
- `src/components/Documents/DocumentsFilters.tsx` - New component for filters

### 7. Dependencies

- Existing `paginationOptsValidator` from Convex
- Existing `PaginationControls` pattern from DataBase
- `Input` and `Select` components from UI library
- `useDebounce` hook for search

### 8. Success Criteria

- [ ] Documents list loads quickly with 100+ documents
- [ ] Search works efficiently with pagination
- [ ] Document type filtering works
- [ ] Folder navigation works with pagination
- [ ] Pagination controls work correctly
- [ ] Table layout is responsive
- [ ] No performance degradation
- [ ] Maintains existing functionality
- [ ] Responsive design preserved

### 9. Estimated Effort

- **Backend**: 4-5 hours
- **Frontend**: 6-7 hours
- **Testing**: 3-4 hours
- **Total**: 13-16 hours
