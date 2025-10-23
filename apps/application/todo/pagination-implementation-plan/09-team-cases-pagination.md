# Team Cases List Pagination Implementation

## Overview
Add pagination to the Team Cases List component (`/components/Cases/TeamCasesList.tsx`) to handle large numbers of cases accessible by a team efficiently.

## Current State
- **File**: `src/components/Cases/TeamCasesList.tsx`
- **Query**: `api.functions.teams.getCasesAccessibleByTeam`
- **Current Behavior**: Loads all cases accessible by a team at once
- **Issues**: Performance degradation with many cases, no pagination controls

## Implementation Plan

### 1. Backend Changes (Convex Functions)

#### Update `convex/functions/teams.ts`
```typescript
// Add pagination support to getCasesAccessibleByTeam function
export const getCasesAccessibleByTeam = query({
  args: {
    teamId: v.id("teams"),
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    status: v.optional(v.string()), // active, closed, pending
    accessLevel: v.optional(v.string()), // admin, advanced, basic
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.string()),
  },
  returns: v.object({
    page: v.array(teamCaseValidator),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    // Implementation with pagination, search, and filtering
  },
});
```

### 2. Frontend Changes

#### Update `src/components/Cases/TeamCasesList.tsx`
```typescript
// Add pagination props
interface TeamCasesListProps {
  teamId: Id<"teams">;
  paginationOpts: PaginationOpts;
  searchQuery?: string;
  statusFilter?: string;
  accessLevelFilter?: string;
  onLoadMore: () => void;
  onSearchChange: (query: string) => void;
  onStatusFilterChange: (status: string) => void;
  onAccessLevelFilterChange: (level: string) => void;
}

// Add pagination state
const [paginationOpts, setPaginationOpts] = useState({
  numItems: 12,
  cursor: null,
});

const [searchQuery, setSearchQuery] = useState("");
const [statusFilter, setStatusFilter] = useState<string | undefined>();
const [accessLevelFilter, setAccessLevelFilter] = useState<string | undefined>();

// Update query call
const casesResult = useQuery(api.functions.teams.getCasesAccessibleByTeam, {
  teamId,
  paginationOpts,
  search: searchQuery,
  status: statusFilter,
  accessLevel: accessLevelFilter,
  sortBy: "createdAt",
  sortOrder: "desc",
});
```

#### Update `src/pages/TeamManagePage.tsx`
```typescript
// Add pagination state and pass to TeamCasesList
const [paginationOpts, setPaginationOpts] = useState({
  numItems: 12,
  cursor: null,
});

const [searchQuery, setSearchQuery] = useState("");
const [statusFilter, setStatusFilter] = useState<string | undefined>();
const [accessLevelFilter, setAccessLevelFilter] = useState<string | undefined>();

// Pass pagination props to TeamCasesList
<TeamCasesList
  teamId={id as any}
  paginationOpts={paginationOpts}
  searchQuery={searchQuery}
  statusFilter={statusFilter}
  accessLevelFilter={accessLevelFilter}
  onLoadMore={handleLoadMore}
  onSearchChange={setSearchQuery}
  onStatusFilterChange={setStatusFilter}
  onAccessLevelFilterChange={setAccessLevelFilter}
/>
```

### 3. UI Components

#### Create `src/components/Cases/TeamCasesPaginationControls.tsx`
- Reuse pattern from `DataBase/PaginationControls.tsx`
- Add "Load More" button for infinite scroll
- Show cases count and pagination info
- Add search bar
- Add status and access level filters

#### Create `src/components/Cases/TeamCasesFilters.tsx`
```typescript
const TeamCasesFilters = ({ 
  searchQuery, 
  setSearchQuery, 
  statusFilter, 
  setStatusFilter,
  accessLevelFilter,
  setAccessLevelFilter
}) => {
  return (
    <div className="flex gap-4 items-center mb-4">
      <Input
        placeholder="Buscar casos..."
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
          <SelectItem value="active">Activo</SelectItem>
          <SelectItem value="closed">Cerrado</SelectItem>
          <SelectItem value="pending">Pendiente</SelectItem>
        </SelectContent>
      </Select>
      <Select value={accessLevelFilter} onValueChange={setAccessLevelFilter}>
        <SelectTrigger>
          <SelectValue placeholder="Nivel de acceso" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="admin">Admin</SelectItem>
          <SelectItem value="advanced">Avanzado</SelectItem>
          <SelectItem value="basic">Básico</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
```

### 4. State Management

#### Add to `src/context/TeamContext.tsx`
```typescript
interface TeamContextState {
  pagination: {
    currentPage: number;
    pageSize: number;
    totalCases: number;
  };
  searchQuery: string;
  statusFilter: string;
  accessLevelFilter: string;
  sortBy: string;
  sortOrder: string;
}
```

### 5. Implementation Steps

1. **Backend Implementation**
   - [ ] Update `getCasesAccessibleByTeam` function to support pagination
   - [ ] Add search functionality
   - [ ] Add status filtering
   - [ ] Add access level filtering
   - [ ] Add sorting options
   - [ ] Test with large datasets

2. **Frontend Implementation**
   - [ ] Add pagination state to TeamCasesList
   - [ ] Update TeamManagePage to pass pagination props
   - [ ] Create pagination controls component
   - [ ] Implement search functionality
   - [ ] Add status and access level filters

3. **UI/UX Improvements**
   - [ ] Add loading states
   - [ ] Add empty states
   - [ ] Add search bar
   - [ ] Add status and access level filters
   - [ ] Add cases count display
   - [ ] Improve card layout

4. **Testing**
   - [ ] Test with 50+ cases
   - [ ] Test search functionality
   - [ ] Test pagination controls
   - [ ] Test status filtering
   - [ ] Test access level filtering
   - [ ] Test performance
   - [ ] Test responsive design

### 6. Files to Modify

- `convex/functions/teams.ts` - Add pagination support
- `src/components/Cases/TeamCasesList.tsx` - Update component
- `src/pages/TeamManagePage.tsx` - Add pagination state
- `src/components/Cases/TeamCasesPaginationControls.tsx` - New component
- `src/components/Cases/TeamCasesFilters.tsx` - New component for filters

### 7. Dependencies

- Existing `paginationOptsValidator` from Convex
- Existing `PaginationControls` pattern from DataBase
- `Input` and `Select` components from UI library
- `useDebounce` hook for search

### 8. Success Criteria

- [ ] Team cases list loads quickly with 50+ cases
- [ ] Search works efficiently with pagination
- [ ] Status filtering works
- [ ] Access level filtering works
- [ ] Pagination controls work correctly
- [ ] Card layout is responsive
- [ ] No performance degradation
- [ ] Maintains existing functionality
- [ ] Responsive design preserved

### 9. Estimated Effort

- **Backend**: 4-5 hours
- **Frontend**: 5-6 hours
- **Testing**: 2-3 hours
- **Total**: 11-14 hours
