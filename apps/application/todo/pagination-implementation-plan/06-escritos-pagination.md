# Escritos List Pagination Implementation

## Overview
Add pagination to the Escritos List component (`/components/Escritos/EscritosList.tsx`) to handle large numbers of legal documents efficiently within a case.

## Current State
- **File**: `src/components/Escritos/EscritosList.tsx`
- **Query**: `api.functions.documents.getEscritos`
- **Current Behavior**: Loads all escritos for a case at once
- **Issues**: Performance degradation with many escritos, no pagination controls

## Implementation Plan

### 1. Backend Changes (Convex Functions)

#### Update `convex/functions/documents.ts`
```typescript
// Add pagination support to getEscritos function
export const getEscritos = query({
  args: {
    caseId: v.id("cases"),
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    status: v.optional(v.string()), // borrador, terminado
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.string()),
  },
  returns: v.object({
    page: v.array(escritoValidator),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    // Implementation with pagination, search, and filtering
  },
});
```

### 2. Frontend Changes

#### Update `src/components/Escritos/EscritosList.tsx`
```typescript
// Add pagination props
interface EscritosListProps {
  caseId: Id<"cases">;
  templateId?: Id<"modelos">;
  paginationOpts: PaginationOpts;
  searchQuery?: string;
  statusFilter?: string;
  onLoadMore: () => void;
  onSearchChange: (query: string) => void;
  onStatusFilterChange: (status: string) => void;
}

// Add pagination state
const [paginationOpts, setPaginationOpts] = useState({
  numItems: 20,
  cursor: null,
});

const [searchQuery, setSearchQuery] = useState("");
const [statusFilter, setStatusFilter] = useState<string | undefined>();

// Update query call
const escritosResult = useQuery(api.functions.documents.getEscritos, {
  caseId,
  paginationOpts,
  search: searchQuery,
  status: statusFilter,
  sortBy: "createdAt",
  sortOrder: "desc",
});
```

#### Update `src/pages/CaseOpen/EscritosPage.tsx`
```typescript
// Add pagination state and pass to EscritosList
const [paginationOpts, setPaginationOpts] = useState({
  numItems: 20,
  cursor: null,
});

const [searchQuery, setSearchQuery] = useState("");
const [statusFilter, setStatusFilter] = useState<string | undefined>();

// Pass pagination props to EscritosList
<EscritosList
  all_escritos={escritosResult}
  caseId={currentCase?._id}
  paginationOpts={paginationOpts}
  searchQuery={searchQuery}
  statusFilter={statusFilter}
  onLoadMore={handleLoadMore}
  onSearchChange={setSearchQuery}
  onStatusFilterChange={setStatusFilter}
/>
```

### 3. UI Components

#### Create `src/components/Escritos/EscritosPaginationControls.tsx`
- Reuse pattern from `DataBase/PaginationControls.tsx`
- Add "Load More" button for infinite scroll
- Show escritos count and pagination info
- Add search bar
- Add status filter

#### Create `src/components/Escritos/EscritosFilters.tsx`
```typescript
const EscritosFilters = ({ 
  searchQuery, 
  setSearchQuery, 
  statusFilter, 
  setStatusFilter 
}) => {
  return (
    <div className="flex gap-4 items-center mb-4">
      <Input
        placeholder="Buscar escritos..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-64"
      />
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger>
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="borrador">Borrador</SelectItem>
          <SelectItem value="terminado">Terminado</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
```

### 4. State Management

#### Add to `src/context/EscritoContext.tsx`
```typescript
interface EscritoContextState {
  pagination: {
    currentPage: number;
    pageSize: number;
    totalEscritos: number;
  };
  searchQuery: string;
  statusFilter: string;
  sortBy: string;
  sortOrder: string;
}
```

### 5. Implementation Steps

1. **Backend Implementation**
   - [ ] Update `getEscritos` function to support pagination
   - [ ] Add search functionality
   - [ ] Add status filtering
   - [ ] Add sorting options
   - [ ] Test with large datasets

2. **Frontend Implementation**
   - [ ] Add pagination state to EscritosList
   - [ ] Update EscritosPage to pass pagination props
   - [ ] Create pagination controls component
   - [ ] Implement search functionality
   - [ ] Add status filter

3. **UI/UX Improvements**
   - [ ] Add loading states
   - [ ] Add empty states
   - [ ] Add search bar
   - [ ] Add status filter
   - [ ] Add escritos count display
   - [ ] Improve table layout

4. **Testing**
   - [ ] Test with 50+ escritos
   - [ ] Test search functionality
   - [ ] Test pagination controls
   - [ ] Test status filtering
   - [ ] Test performance
   - [ ] Test responsive design

### 6. Files to Modify

- `convex/functions/documents.ts` - Add pagination support
- `src/components/Escritos/EscritosList.tsx` - Update component
- `src/pages/CaseOpen/EscritosPage.tsx` - Add pagination state
- `src/components/Escritos/EscritosPaginationControls.tsx` - New component
- `src/components/Escritos/EscritosFilters.tsx` - New component for filters

### 7. Dependencies

- Existing `paginationOptsValidator` from Convex
- Existing `PaginationControls` pattern from DataBase
- `Input` and `Select` components from UI library
- `useDebounce` hook for search

### 8. Success Criteria

- [ ] Escritos list loads quickly with 50+ escritos
- [ ] Search works efficiently with pagination
- [ ] Status filtering works
- [ ] Pagination controls work correctly
- [ ] Table layout is responsive
- [ ] No performance degradation
- [ ] Maintains existing functionality
- [ ] Responsive design preserved

### 9. Estimated Effort

- **Backend**: 3-4 hours
- **Frontend**: 5-6 hours
- **Testing**: 2-3 hours
- **Total**: 10-13 hours
