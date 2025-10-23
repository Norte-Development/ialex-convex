# Teams Page Pagination Implementation

## Overview
Add pagination to the Teams Page (`/pages/TeamPage.tsx`) and team cards grid to handle large numbers of teams efficiently.

## Current State
- **File**: `src/pages/TeamPage.tsx`
- **Component**: `TeamCard` in `src/components/Teams/TeamCard.tsx`
- **Query**: `api.functions.teams.getTeams`
- **Current Behavior**: Loads all teams in a grid layout
- **Issues**: Performance degradation with many teams, no pagination controls

## Implementation Plan

### 1. Backend Changes (Convex Functions)

#### Update `convex/functions/teams.ts`
```typescript
// Add pagination support to getTeams function
export const getTeams = query({
  args: {
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.string()),
  },
  returns: v.object({
    page: v.array(teamValidator),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    // Implementation with pagination, search, and filtering
  },
});
```

### 2. Frontend Changes

#### Update `src/pages/TeamPage.tsx`
```typescript
// Add pagination state
const [paginationOpts, setPaginationOpts] = useState({
  numItems: 12, // 3x4 grid
  cursor: null,
});

const [searchQuery, setSearchQuery] = useState("");
const [activeFilter, setActiveFilter] = useState<boolean | undefined>();

// Update query call
const teamsResult = useQuery(api.functions.teams.getTeams, {
  paginationOpts,
  search: searchQuery,
  isActive: activeFilter,
  sortBy: "name",
  sortOrder: "asc",
});
```

#### Update `src/components/Teams/TeamCard.tsx`
```typescript
// Add pagination props
interface TeamCardProps {
  team: Team;
  onLoadMore?: () => void;
  isLastInPage?: boolean;
}

// Add load more functionality for last card
const TeamCard = ({ team, onLoadMore, isLastInPage }) => {
  // Implementation with load more trigger
};
```

### 3. UI Components

#### Create `src/components/Teams/TeamPaginationControls.tsx`
- Reuse pattern from `DataBase/PaginationControls.tsx`
- Add "Load More" button for infinite scroll
- Show team count and pagination info
- Add search bar
- Add active/inactive filter

#### Create `src/components/Teams/TeamFilters.tsx`
```typescript
const TeamFilters = ({ searchQuery, setSearchQuery, activeFilter, setActiveFilter }) => {
  return (
    <div className="flex gap-4 items-center">
      <Input
        placeholder="Buscar equipos..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-64"
      />
      <Select value={activeFilter} onValueChange={setActiveFilter}>
        <SelectTrigger>
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="active">Activos</SelectItem>
          <SelectItem value="inactive">Inactivos</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
```

### 4. State Management

#### Add to `src/context/TeamContext.tsx` (if needed)
```typescript
interface TeamContextState {
  pagination: {
    currentPage: number;
    pageSize: number;
    totalTeams: number;
  };
  searchQuery: string;
  activeFilter: boolean;
  sortBy: string;
  sortOrder: string;
}
```

### 5. Implementation Steps

1. **Backend Implementation**
   - [ ] Update `getTeams` function to support pagination
   - [ ] Add search functionality
   - [ ] Add active/inactive filtering
   - [ ] Add sorting options
   - [ ] Test with large datasets

2. **Frontend Implementation**
   - [ ] Add pagination state to TeamPage
   - [ ] Update team cards grid
   - [ ] Create pagination controls component
   - [ ] Implement search functionality
   - [ ] Add active/inactive filter

3. **UI/UX Improvements**
   - [ ] Add loading states
   - [ ] Add empty states
   - [ ] Add search bar
   - [ ] Add status filter
   - [ ] Add team count display
   - [ ] Improve grid layout

4. **Testing**
   - [ ] Test with 50+ teams
   - [ ] Test search functionality
   - [ ] Test pagination controls
   - [ ] Test active/inactive filtering
   - [ ] Test performance
   - [ ] Test responsive design

### 6. Files to Modify

- `convex/functions/teams.ts` - Add pagination support
- `src/pages/TeamPage.tsx` - Add pagination state
- `src/components/Teams/TeamCard.tsx` - Update component
- `src/components/Teams/TeamPaginationControls.tsx` - New component
- `src/components/Teams/TeamFilters.tsx` - New component for filters

### 7. Dependencies

- Existing `paginationOptsValidator` from Convex
- Existing `PaginationControls` pattern from DataBase
- `Input` and `Select` components from UI library
- `useDebounce` hook for search

### 8. Success Criteria

- [ ] Teams page loads quickly with 50+ teams
- [ ] Search works efficiently with pagination
- [ ] Active/inactive filtering works
- [ ] Pagination controls work correctly
- [ ] Grid layout is responsive
- [ ] No performance degradation
- [ ] Maintains existing functionality
- [ ] Responsive design preserved

### 9. Estimated Effort

- **Backend**: 3-4 hours
- **Frontend**: 5-6 hours
- **Testing**: 2-3 hours
- **Total**: 10-13 hours
