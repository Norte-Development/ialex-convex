# Models/Templates Page Pagination Implementation

## Overview
Add pagination to the Models Page (`/pages/ModelsPage.tsx`) and `TemplateTable` component to handle large numbers of templates efficiently.

## Current State
- **File**: `src/pages/ModelsPage.tsx`
- **Component**: `TemplateTable` in `src/components/Templates/TemplateTable.tsx`
- **Queries**: `api.functions.templates.getModelos` and `api.functions.templates.searchModelos`
- **Current Behavior**: Hard-coded limit of 100 items, no pagination
- **Issues**: Limited to 100 templates, no pagination controls, search results not paginated

## Implementation Plan

### 1. Backend Changes (Convex Functions)

#### Update `convex/functions/templates.ts`
```typescript
// Update getModelos to support proper pagination
export const getModelos = query({
  args: {
    paginationOpts: paginationOptsValidator,
    category: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.string()),
  },
  returns: v.object({
    page: v.array(templateValidator),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    // Implementation with pagination and filtering
  },
});

// Update searchModelos to support pagination
export const searchModelos = query({
  args: {
    searchTerm: v.string(),
    paginationOpts: paginationOptsValidator,
    category: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
  },
  returns: v.object({
    page: v.array(templateValidator),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    // Implementation with search and pagination
  },
});
```

### 2. Frontend Changes

#### Update `src/pages/ModelsPage.tsx`
```typescript
// Add pagination state
const [paginationOpts, setPaginationOpts] = useState({
  numItems: 20,
  cursor: null,
});

const [searchValue, setSearchValue] = useState("");
const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
const [publicFilter, setPublicFilter] = useState<boolean | undefined>();

// Update query calls
const searchResults = useQuery(
  api.functions.templates.searchModelos,
  hasSearchTerm
    ? {
        searchTerm: searchValue.trim(),
        paginationOpts,
        category: categoryFilter,
        isPublic: publicFilter,
      }
    : "skip",
);

const listResults = useQuery(
  api.functions.templates.getModelos,
  !hasSearchTerm
    ? {
        paginationOpts,
        category: categoryFilter,
        isPublic: publicFilter,
        sortBy: "createdAt",
        sortOrder: "desc",
      }
    : "skip",
);
```

#### Update `src/components/Templates/TemplateTable.tsx`
```typescript
// Add pagination props
interface TemplateTableProps {
  templates: Template[];
  isLoading: boolean;
  onLoadMore: () => void;
  isDone: boolean;
  totalResults: number;
  onPreview: (templateId: Id<"modelos">) => void;
  onCreateFromTemplate: (template: { _id: Id<"modelos">; name: string }) => void;
  canCreate: boolean;
}

// Add pagination controls
const TemplatePaginationControls = ({ onLoadMore, isDone, isLoading, totalResults }) => {
  // Implementation similar to DataBase/PaginationControls.tsx
};
```

### 3. UI Components

#### Create `src/components/Templates/TemplatePaginationControls.tsx`
- Reuse pattern from `DataBase/PaginationControls.tsx`
- Add "Load More" button for infinite scroll
- Show template count and pagination info

#### Update `src/components/Templates/TemplateSearchBar.tsx`
```typescript
// Add category filter
const CategoryFilter = () => {
  return (
    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
      <SelectTrigger>
        <SelectValue placeholder="Categoría" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todas</SelectItem>
        <SelectItem value="legal">Legal</SelectItem>
        <SelectItem value="contract">Contrato</SelectItem>
        <SelectItem value="brief">Escrito</SelectItem>
      </SelectContent>
    </Select>
  );
};

// Add public/private filter
const PublicFilter = () => {
  return (
    <Select value={publicFilter} onValueChange={setPublicFilter}>
      <SelectTrigger>
        <SelectValue placeholder="Visibilidad" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos</SelectItem>
        <SelectItem value="public">Públicos</SelectItem>
        <SelectItem value="private">Privados</SelectItem>
      </SelectContent>
    </Select>
  );
};
```

### 4. State Management

#### Add to `src/context/TemplateContext.tsx` (if needed)
```typescript
interface TemplateContextState {
  pagination: {
    currentPage: number;
    pageSize: number;
    totalTemplates: number;
  };
  searchQuery: string;
  categoryFilter: string;
  publicFilter: boolean;
  sortBy: string;
  sortOrder: string;
}
```

### 5. Implementation Steps

1. **Backend Implementation**
   - [ ] Update `getModelos` function to support pagination
   - [ ] Update `searchModelos` function to support pagination
   - [ ] Add category filtering
   - [ ] Add public/private filtering
   - [ ] Add sorting options
   - [ ] Test with large datasets

2. **Frontend Implementation**
   - [ ] Add pagination state to ModelsPage
   - [ ] Update TemplateTable component
   - [ ] Create pagination controls component
   - [ ] Implement search with pagination
   - [ ] Add category and public filters

3. **UI/UX Improvements**
   - [ ] Add loading states
   - [ ] Add empty states
   - [ ] Improve search bar with filters
   - [ ] Add sorting options
   - [ ] Add template count display

4. **Testing**
   - [ ] Test with 100+ templates
   - [ ] Test search functionality with pagination
   - [ ] Test pagination controls
   - [ ] Test category filtering
   - [ ] Test public/private filtering
   - [ ] Test performance

### 6. Files to Modify

- `convex/functions/templates.ts` - Add pagination support
- `src/pages/ModelsPage.tsx` - Add pagination state
- `src/components/Templates/TemplateTable.tsx` - Update component
- `src/components/Templates/TemplatePaginationControls.tsx` - New component
- `src/components/Templates/TemplateFilters.tsx` - New component for filters
- `src/components/Templates/TemplateSearchBar.tsx` - Update with filters

### 7. Dependencies

- Existing `paginationOptsValidator` from Convex
- Existing `PaginationControls` pattern from DataBase
- `Select` components from UI library
- `useDebounce` hook for search

### 8. Success Criteria

- [ ] Templates page loads quickly with 100+ templates
- [ ] Search works efficiently with pagination
- [ ] Category filtering works
- [ ] Public/private filtering works
- [ ] Pagination controls work correctly
- [ ] No performance degradation
- [ ] Maintains existing functionality
- [ ] Responsive design preserved

### 9. Estimated Effort

- **Backend**: 5-7 hours
- **Frontend**: 6-8 hours
- **Testing**: 2-3 hours
- **Total**: 13-18 hours
