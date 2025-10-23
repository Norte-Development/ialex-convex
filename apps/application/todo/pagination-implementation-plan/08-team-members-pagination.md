# Team Members Table Pagination Implementation

## Overview
Add pagination to the Team Members Table component (`/components/Teams/TeamMembersTable.tsx`) to handle large numbers of team members efficiently.

## Current State
- **File**: `src/components/Teams/TeamMembersTable.tsx`
- **Data Source**: Team members from `api.functions.teams.getTeamById`
- **Current Behavior**: Loads all team members at once
- **Issues**: Performance degradation with many team members, no pagination controls

## Implementation Plan

### 1. Backend Changes (Convex Functions)

#### Update `convex/functions/teams.ts`
```typescript
// Add pagination support to getTeamMembers function
export const getTeamMembers = query({
  args: {
    teamId: v.id("teams"),
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    role: v.optional(v.string()), // admin, abogado, secretario
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.string()),
  },
  returns: v.object({
    page: v.array(teamMemberValidator),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    // Implementation with pagination, search, and filtering
  },
});
```

### 2. Frontend Changes

#### Update `src/components/Teams/TeamMembersTable.tsx`
```typescript
// Add pagination props
interface TeamMembersTableProps {
  teamId: Id<"teams">;
  paginationOpts: PaginationOpts;
  searchQuery?: string;
  roleFilter?: string;
  onLoadMore: () => void;
  onSearchChange: (query: string) => void;
  onRoleFilterChange: (role: string) => void;
  onRemoveMember: (memberId: string) => void;
  removingMember: string | null;
  isAdmin?: boolean;
}

// Add pagination state
const [paginationOpts, setPaginationOpts] = useState({
  numItems: 20,
  cursor: null,
});

const [searchQuery, setSearchQuery] = useState("");
const [roleFilter, setRoleFilter] = useState<string | undefined>();

// Update query call
const membersResult = useQuery(api.functions.teams.getTeamMembers, {
  teamId,
  paginationOpts,
  search: searchQuery,
  role: roleFilter,
  sortBy: "name",
  sortOrder: "asc",
});
```

#### Update `src/pages/TeamManagePage.tsx`
```typescript
// Add pagination state and pass to TeamMembersTable
const [paginationOpts, setPaginationOpts] = useState({
  numItems: 20,
  cursor: null,
});

const [searchQuery, setSearchQuery] = useState("");
const [roleFilter, setRoleFilter] = useState<string | undefined>();

// Pass pagination props to TeamMembersTable
<TeamMembersTable
  teamId={id as any}
  paginationOpts={paginationOpts}
  searchQuery={searchQuery}
  roleFilter={roleFilter}
  onLoadMore={handleLoadMore}
  onSearchChange={setSearchQuery}
  onRoleFilterChange={setRoleFilter}
  onRemoveMember={handleRemoveMember}
  removingMember={removingMember}
  isAdmin={isTeamAdmin}
/>
```

### 3. UI Components

#### Create `src/components/Teams/TeamMembersPaginationControls.tsx`
- Reuse pattern from `DataBase/PaginationControls.tsx`
- Add "Load More" button for infinite scroll
- Show members count and pagination info
- Add search bar
- Add role filter

#### Create `src/components/Teams/TeamMembersFilters.tsx`
```typescript
const TeamMembersFilters = ({ 
  searchQuery, 
  setSearchQuery, 
  roleFilter, 
  setRoleFilter 
}) => {
  return (
    <div className="flex gap-4 items-center mb-4">
      <Input
        placeholder="Buscar miembros..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-64"
      />
      <Select value={roleFilter} onValueChange={setRoleFilter}>
        <SelectTrigger>
          <SelectValue placeholder="Rol" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="admin">Admin</SelectItem>
          <SelectItem value="abogado">Abogado</SelectItem>
          <SelectItem value="secretario">Secretario</SelectItem>
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
    totalMembers: number;
  };
  searchQuery: string;
  roleFilter: string;
  sortBy: string;
  sortOrder: string;
}
```

### 5. Implementation Steps

1. **Backend Implementation**
   - [ ] Update `getTeamMembers` function to support pagination
   - [ ] Add search functionality
   - [ ] Add role filtering
   - [ ] Add sorting options
   - [ ] Test with large datasets

2. **Frontend Implementation**
   - [ ] Add pagination state to TeamMembersTable
   - [ ] Update TeamManagePage to pass pagination props
   - [ ] Create pagination controls component
   - [ ] Implement search functionality
   - [ ] Add role filter

3. **UI/UX Improvements**
   - [ ] Add loading states
   - [ ] Add empty states
   - [ ] Add search bar
   - [ ] Add role filter
   - [ ] Add members count display
   - [ ] Improve table layout

4. **Testing**
   - [ ] Test with 50+ team members
   - [ ] Test search functionality
   - [ ] Test pagination controls
   - [ ] Test role filtering
   - [ ] Test member removal
   - [ ] Test performance
   - [ ] Test responsive design

### 6. Files to Modify

- `convex/functions/teams.ts` - Add pagination support
- `src/components/Teams/TeamMembersTable.tsx` - Update component
- `src/pages/TeamManagePage.tsx` - Add pagination state
- `src/components/Teams/TeamMembersPaginationControls.tsx` - New component
- `src/components/Teams/TeamMembersFilters.tsx` - New component for filters

### 7. Dependencies

- Existing `paginationOptsValidator` from Convex
- Existing `PaginationControls` pattern from DataBase
- `Input` and `Select` components from UI library
- `useDebounce` hook for search

### 8. Success Criteria

- [ ] Team members table loads quickly with 50+ members
- [ ] Search works efficiently with pagination
- [ ] Role filtering works
- [ ] Pagination controls work correctly
- [ ] Member removal works with pagination
- [ ] Table layout is responsive
- [ ] No performance degradation
- [ ] Maintains existing functionality
- [ ] Responsive design preserved

### 9. Estimated Effort

- **Backend**: 3-4 hours
- **Frontend**: 5-6 hours
- **Testing**: 2-3 hours
- **Total**: 10-13 hours
