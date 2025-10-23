# Events Page Pagination Implementation

## Overview
Add pagination to the Events Page (`/pages/EventosPage.tsx`) and event cards to handle large numbers of events efficiently across different categories.

## Current State
- **File**: `src/pages/EventosPage.tsx`
- **Component**: Event cards in tabs
- **Queries**: `api.functions.events.getUpcomingEvents` and `api.functions.events.getMyEvents`
- **Current Behavior**: Loads all events in each category
- **Issues**: Performance degradation with many events, no pagination controls, all events loaded at once

## Implementation Plan

### 1. Backend Changes (Convex Functions)

#### Update `convex/functions/events.ts`
```typescript
// Add pagination support to getMyEvents function
export const getMyEvents = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(v.string()), // programado, completado, cancelado
    eventType: v.optional(v.string()),
    dateFrom: v.optional(v.number()),
    dateTo: v.optional(v.number()),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.string()),
  },
  returns: v.object({
    page: v.array(eventValidator),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    // Implementation with pagination and filtering
  },
});

// Update getUpcomingEvents to support pagination
export const getUpcomingEvents = query({
  args: {
    paginationOpts: paginationOptsValidator,
    days: v.number(),
    eventType: v.optional(v.string()),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.string()),
  },
  returns: v.object({
    page: v.array(eventValidator),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    // Implementation with pagination
  },
});
```

### 2. Frontend Changes

#### Update `src/pages/EventosPage.tsx`
```typescript
// Add pagination state for each tab
const [paginationOpts, setPaginationOpts] = useState({
  proximos: { numItems: 12, cursor: null },
  programados: { numItems: 12, cursor: null },
  completados: { numItems: 12, cursor: null },
  cancelados: { numItems: 12, cursor: null },
});

const [activeTab, setActiveTab] = useState("proximos");
const [eventTypeFilter, setEventTypeFilter] = useState<string | undefined>();

// Update query calls
const upcomingEvents = useQuery(api.functions.events.getUpcomingEvents, {
  paginationOpts: paginationOpts.proximos,
  days: 30,
  eventType: eventTypeFilter,
  sortBy: "startDate",
  sortOrder: "asc",
});

const allEvents = useQuery(api.functions.events.getMyEvents, {
  paginationOpts: paginationOpts[activeTab],
  status: getStatusForTab(activeTab),
  eventType: eventTypeFilter,
  sortBy: "startDate",
  sortOrder: "asc",
});
```

#### Update Event Cards
```typescript
// Add pagination props to EventCard
interface EventCardProps {
  event: Event;
  onLoadMore?: () => void;
  isLastInPage?: boolean;
}

const EventCard = ({ event, onLoadMore, isLastInPage }) => {
  // Implementation with load more trigger
};
```

### 3. UI Components

#### Create `src/components/Events/EventPaginationControls.tsx`
- Reuse pattern from `DataBase/PaginationControls.tsx`
- Add "Load More" button for infinite scroll
- Show event count and pagination info
- Add event type filter

#### Create `src/components/Events/EventFilters.tsx`
```typescript
const EventFilters = ({ eventTypeFilter, setEventTypeFilter }) => {
  return (
    <div className="flex gap-4 items-center">
      <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
        <SelectTrigger>
          <SelectValue placeholder="Tipo de evento" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="audiencia">Audiencia</SelectItem>
          <SelectItem value="plazo">Plazo</SelectItem>
          <SelectItem value="reunion_cliente">Reunión Cliente</SelectItem>
          <SelectItem value="presentacion">Presentación</SelectItem>
          <SelectItem value="reunion_equipo">Reunión Equipo</SelectItem>
          <SelectItem value="personal">Personal</SelectItem>
          <SelectItem value="otro">Otro</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
```

### 4. State Management

#### Add to `src/context/EventContext.tsx` (if needed)
```typescript
interface EventContextState {
  pagination: {
    proximos: PaginationState;
    programados: PaginationState;
    completados: PaginationState;
    cancelados: PaginationState;
  };
  activeTab: string;
  eventTypeFilter: string;
  sortBy: string;
  sortOrder: string;
}
```

### 5. Implementation Steps

1. **Backend Implementation**
   - [ ] Update `getMyEvents` function to support pagination
   - [ ] Update `getUpcomingEvents` function to support pagination
   - [ ] Add event type filtering
   - [ ] Add date range filtering
   - [ ] Add sorting options
   - [ ] Test with large datasets

2. **Frontend Implementation**
   - [ ] Add pagination state for each tab
   - [ ] Update event cards grid
   - [ ] Create pagination controls component
   - [ ] Implement event type filtering
   - [ ] Add tab-specific pagination

3. **UI/UX Improvements**
   - [ ] Add loading states for each tab
   - [ ] Add empty states for each tab
   - [ ] Add event type filter
   - [ ] Add event count display
   - [ ] Improve grid layout
   - [ ] Add date range picker

4. **Testing**
   - [ ] Test with 100+ events
   - [ ] Test pagination for each tab
   - [ ] Test event type filtering
   - [ ] Test date range filtering
   - [ ] Test performance
   - [ ] Test responsive design

### 6. Files to Modify

- `convex/functions/events.ts` - Add pagination support
- `src/pages/EventosPage.tsx` - Add pagination state
- `src/components/Events/EventCard.tsx` - Update component
- `src/components/Events/EventPaginationControls.tsx` - New component
- `src/components/Events/EventFilters.tsx` - New component for filters

### 7. Dependencies

- Existing `paginationOptsValidator` from Convex
- Existing `PaginationControls` pattern from DataBase
- `Select` components from UI library
- Date picker components

### 8. Success Criteria

- [ ] Events page loads quickly with 100+ events
- [ ] Pagination works for each tab
- [ ] Event type filtering works
- [ ] Date range filtering works
- [ ] Pagination controls work correctly
- [ ] Grid layout is responsive
- [ ] No performance degradation
- [ ] Maintains existing functionality
- [ ] Responsive design preserved

### 9. Estimated Effort

- **Backend**: 5-7 hours
- **Frontend**: 6-8 hours
- **Testing**: 3-4 hours
- **Total**: 14-19 hours
