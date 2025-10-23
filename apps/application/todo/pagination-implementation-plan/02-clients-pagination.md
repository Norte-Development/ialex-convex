# Clients Page Pagination Implementation

## Overview
Add pagination to the Clients Page (`/pages/ClientsPage.tsx`) and `ClientsTable` component to handle large numbers of clients efficiently.

## Current State
- **File**: `src/pages/ClientsPage.tsx`
- **Component**: `ClientsTable` in `src/components/Clients/ClientsTable.tsx`
- **Query**: `api.functions.clients.getClients`
- **Current Behavior**: Loads all clients with search functionality
- **Issues**: Performance degradation with many clients, search loads all results

## Implementation Plan

### 1. Backend Changes (Convex Functions)

#### Update `convex/functions/clients.ts`
```typescript
// Add pagination support to getClients function
export const getClients = query({
  args: {
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    clientType: v.optional(v.string()), // individual, company
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.string()),
  },
  returns: v.object({
    page: v.array(clientValidator),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    // Implementation with pagination, search, and filtering
  },
});
```

### 2. Frontend Changes

#### Update `src/pages/ClientsPage.tsx`
```typescript
// Add pagination state
const [paginationOpts, setPaginationOpts] = useState({
  numItems: 25,
  cursor: null,
});

const [searchQuery, setSearchQuery] = useState("");
const [clientTypeFilter, setClientTypeFilter] = useState<string | undefined>();

// Update query call
const clientsResult = useQuery(api.functions.clients.getClients, {
  paginationOpts,
  search: searchQuery,
  clientType: clientTypeFilter,
  sortBy: "name",
  sortOrder: "asc",
});
```

#### Update `src/components/Clients/ClientsTable.tsx`
```typescript
// Add pagination props
interface ClientsTableProps {
  clientsResult: {
    page: Client[];
    isDone: boolean;
    continueCursor: string | null;
  } | undefined;
  onLoadMore: () => void;
  isLoading: boolean;
  searchQuery: string;
}

// Add pagination controls
const PaginationControls = ({ onLoadMore, isDone, isLoading, totalResults }) => {
  // Implementation similar to DataBase/PaginationControls.tsx
};
```

### 3. UI Components

#### Create `src/components/Clients/ClientPaginationControls.tsx`
- Reuse pattern from `DataBase/PaginationControls.tsx`
- Add "Load More" button for infinite scroll
- Show client count and pagination info
- Add client type filter dropdown

#### Update Search Bar
```typescript
// Add debounced search
const [debouncedSearchQuery] = useDebounce(searchQuery, 300);

// Add client type filter
const ClientTypeFilter = () => {
  return (
    <Select value={clientTypeFilter} onValueChange={setClientTypeFilter}>
      <SelectTrigger>
        <SelectValue placeholder="Tipo de cliente" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos</SelectItem>
        <SelectItem value="individual">Persona</SelectItem>
        <SelectItem value="company">Empresa</SelectItem>
      </SelectContent>
    </Select>
  );
};
```

### 4. State Management

#### Add to `src/context/ClientContext.tsx` (if needed)
```typescript
interface ClientContextState {
  pagination: {
    currentPage: number;
    pageSize: number;
    totalClients: number;
  };
  searchQuery: string;
  clientTypeFilter: string;
  sortBy: string;
  sortOrder: string;
}
```

### 5. Implementation Steps

1. **Backend Implementation**
   - [ ] Update `getClients` function to support pagination
   - [ ] Add search functionality with proper indexing
   - [ ] Add client type filtering
   - [ ] Add sorting options
   - [ ] Test with large datasets

2. **Frontend Implementation**
   - [ ] Add pagination state to ClientsPage
   - [ ] Update ClientsTable component
   - [ ] Create pagination controls component
   - [ ] Implement debounced search
   - [ ] Add client type filter

3. **UI/UX Improvements**
   - [ ] Add loading states
   - [ ] Add empty states
   - [ ] Improve search bar
   - [ ] Add client type filter
   - [ ] Add sorting options

4. **Testing**
   - [ ] Test with 100+ clients
   - [ ] Test search functionality
   - [ ] Test pagination controls
   - [ ] Test client type filtering
   - [ ] Test performance

### 6. Files to Modify

- `convex/functions/clients.ts` - Add pagination support
- `src/pages/ClientsPage.tsx` - Add pagination state
- `src/components/Clients/ClientsTable.tsx` - Update component
- `src/components/Clients/ClientPaginationControls.tsx` - New component
- `src/components/Clients/ClientFilters.tsx` - New component for filters

### 7. Dependencies

- Existing `paginationOptsValidator` from Convex
- Existing `PaginationControls` pattern from DataBase
- `useDebounce` hook for search
- `Select` components from UI library

### 8. Success Criteria

- [ ] Clients page loads quickly with 100+ clients
- [ ] Search works efficiently with pagination
- [ ] Client type filtering works
- [ ] Pagination controls work correctly
- [ ] No performance degradation
- [ ] Maintains existing functionality
- [ ] Responsive design preserved

### 9. Estimated Effort

- **Backend**: 4-6 hours
- **Frontend**: 6-8 hours
- **Testing**: 2-3 hours
- **Total**: 12-17 hours
