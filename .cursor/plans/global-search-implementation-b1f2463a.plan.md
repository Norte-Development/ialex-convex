<!-- b1f2463a-e339-4d48-80ba-9f2008ca2b36 38727d7a-b9f4-4813-b398-942da95157fa -->
# Global Search Implementation

## Overview

Add a fully functional global search bar to the navbar that searches across all major entities (cases, clients, documents, escritos, templates, library documents, and legislation) with as-you-type suggestions and grouped results in a dropdown panel.

## Architecture

### Backend (Convex)

**File: `convex/schema.ts`**

- Add search indexes for searchable tables:
- `cases`: search on `title` field, filter by `isArchived`
- `clients`: search on `name` field, filter by `isActive`
- `escritos`: search on `title` field, filter by `isArchived`
- `documents`: search on `title` field, filter by case access
- `libraryDocuments`: search on `title` field, filter by user/team
- (Note: `modelos` already has search index)

**File: `convex/functions/search.ts` (new file)**

- Create `globalSearch` query that:
- Takes search query string and optional limit
- Searches across all entities using their search indexes
- Applies proper access control (users only see what they have permission to)
- Returns grouped results by type with essential fields:
- Cases: `_id`, `title`, `status`, `category`
- Clients: `_id`, `name`, `clientType`, `email`
- Documents: `_id`, `title`, `caseId`, `documentType`
- Escritos: `_id`, `title`, `caseId`, `status`
- Templates: `_id`, `name`, `category`, `templateType`
- Library Documents: `_id`, `title`, `teamId`, `userId`
- Limits results per type (e.g., 5 per type for suggestions, more for full search)

### Frontend Components

**File: `apps/application/src/components/Search/SearchDropdown.tsx` (new)**

- Dropdown panel component that displays below the search bar
- Shows loading state while searching
- Groups results by type with section headers
- Each result shows relevant preview info
- Highlights matched text
- Shows "See all X results" footer for each type
- Handles click-outside to close

**File: `apps/application/src/components/Search/SearchResultItem.tsx` (new)**

- Individual search result component
- Displays icon based on type
- Shows title and relevant metadata
- Handles click navigation based on type

**File: `apps/application/src/hooks/useGlobalSearch.ts` (new)**

- Custom hook managing search state:
- Debounced search query (300ms)
- Loading state
- Results state
- Functions: `handleSearch`, `clearSearch`, `handleResultClick`

**File: `apps/application/src/components/Layout/Navbar/NavBar.tsx` (update)**

- Replace static Input with controlled search input
- Add SearchDropdown component
- Manage focus/blur states
- Handle Enter key for full results
- Wire up useGlobalSearch hook

## Navigation Logic

Result clicks navigate based on type:

- **Cases**: Navigate to `/caso/:caseId`
- **Clients**: Navigate to `/clientes` (could enhance with a modal later)
- **Documents**: Navigate to `/caso/:caseId/documentos/:documentId`
- **Escritos**: Navigate to `/caso/:caseId/escritos/:escritoId`
- **Templates**: Open preview modal (reuse existing modal component)
- **Library Documents**: Navigate to `/biblioteca/documento/:documentId`
- **Legislation**: Navigate to `/base-de-datos` with pre-filled search

## Key Implementation Details

1. **Access Control**: Search respects existing permissions - users only see results they have access to
2. **Debouncing**: Search input debounced at 300ms to avoid excessive queries
3. **Result Limits**: 5 results per type for dropdown suggestions
4. **Empty States**: Show "No results found" when search returns nothing
5. **Keyboard Navigation**: Support arrow keys and Enter (future enhancement noted in comments)
6. **Mobile Responsive**: Dropdown adjusts to screen size

## Files to Create

- `convex/functions/search.ts`
- `apps/application/src/components/Search/SearchDropdown.tsx`
- `apps/application/src/components/Search/SearchResultItem.tsx`
- `apps/application/src/hooks/useGlobalSearch.ts`

## Files to Modify

- `convex/schema.ts` (add search indexes)
- `apps/application/src/components/Layout/Navbar/NavBar.tsx` (integrate search)
- `convex/functions/index.ts` (export search function)

### To-dos

- [ ] Add search indexes to schema.ts for cases, clients, escritos, documents, and libraryDocuments
- [ ] Create globalSearch query in convex/functions/search.ts with access control
- [ ] Create useGlobalSearch hook with debouncing and state management
- [ ] Create SearchResultItem component for individual results with navigation logic
- [ ] Create SearchDropdown component with grouped results and loading states
- [ ] Update NavBar component to integrate search functionality