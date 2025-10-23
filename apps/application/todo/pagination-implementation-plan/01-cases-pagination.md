# Cases Page Pagination Implementation

## Overview
Add pagination to the Cases Page (`/pages/CasesPage.tsx`) and `CaseTable` component to handle large numbers of cases efficiently.

## Current State
- **File**: `src/pages/CasesPage.tsx`
- **Component**: `CaseTable` in `src/components/Cases/CaseTable.tsx`
- **Query**: `api.functions.cases.getCases`
- **Current Behavior**: Loads all cases at once
- **Issues**: Performance degradation with many cases, no pagination controls

## Implementation Plan

### 1. Backend Changes (Convex Functions)

#### Update `convex/functions/cases.ts`
```typescript
// Add pagination support to getCases function
export const getCases = query({
  args: {
    paginationOpts: paginationOptsValidator,
    search?: v.optional(v.string()),
    status?: v.optional(v.string()),
    sortBy?: v.optional(v.string()),
    sortOrder?: v.optional(v.string()),
  },
  returns: v.object({
    page: v.array(caseValidator),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    // Implementation with pagination, search, and sorting
  },
});
```

### 2. Frontend Changes

#### Update `src/pages/CasesPage.tsx`
```typescript
// Add pagination state
const [paginationOpts, setPaginationOpts] = useState({
  numItems: 20,
  cursor: null,
});

// Update query call
const casesResult = useQuery(api.functions.cases.getCases, {
  paginationOpts,
  search: searchQuery,
  status: statusFilter,
  sortBy: "createdAt",
  sortOrder: "desc",
});
```

#### Update `src/components/Cases/CaseTable.tsx`
```typescript
// Add pagination props
interface CaseTableProps {
  casesResult: {
    page: Case[];
    isDone: boolean;
    continueCursor: string | null;
  } | undefined;
  onLoadMore: () => void;
  isLoading: boolean;
}

// Add pagination controls
const PaginationControls = ({ onLoadMore, isDone, isLoading }) => {
  // Implementation similar to DataBase/PaginationControls.tsx
};
```

### 3. UI Components

#### Create `src/components/Cases/CasePaginationControls.tsx`
- Reuse pattern from `DataBase/PaginationControls.tsx`
- Add "Load More" button for infinite scroll
- Show case count and pagination info

### 4. State Management

#### Add to `src/context/CaseContext.tsx`
```typescript
interface CaseContextState {
  // ... existing state
  pagination: {
    currentPage: number;
    pageSize: number;
    totalCases: number;
  };
  searchQuery: string;
  statusFilter: string;
}
```

### 5. Implementation Steps

1. **Backend Implementation**
   - [ ] Update `getCases` function to support pagination
   - [ ] Add search functionality
   - [ ] Add sorting options
   - [ ] Test with large datasets

2. **Frontend Implementation**
   - [ ] Add pagination state to CasesPage
   - [ ] Update CaseTable component
   - [ ] Create pagination controls component
   - [ ] Implement search and filtering

3. **UI/UX Improvements**
   - [ ] Add loading states
   - [ ] Add empty states
   - [ ] Add search bar
   - [ ] Add status filters

4. **Testing**
   - [ ] Test with 100+ cases
   - [ ] Test search functionality
   - [ ] Test pagination controls
   - [ ] Test performance

### 6. Files to Modify

- `convex/functions/cases.ts` - Add pagination support
- `src/pages/CasesPage.tsx` - Add pagination state
- `src/components/Cases/CaseTable.tsx` - Update component
- `src/components/Cases/CasePaginationControls.tsx` - New component
- `src/context/CaseContext.tsx` - Add pagination state

### 7. Dependencies

- Existing `paginationOptsValidator` from Convex
- Existing `PaginationControls` pattern from DataBase
- `usePaginatedQuery` hook from Convex React

### 8. Success Criteria

- [ ] Cases page loads quickly with 100+ cases
- [ ] Pagination controls work correctly
- [ ] Search functionality works
- [ ] No performance degradation
- [ ] Maintains existing functionality
- [ ] Responsive design preserved

### 9. Estimated Effort

- **Backend**: 4-6 hours
- **Frontend**: 6-8 hours
- **Testing**: 2-3 hours
- **Total**: 12-17 hours
