<!-- f9bbd018-699f-49b5-a269-6e8a78d3a858 90b8f010-6e65-4cfc-836d-ca198bb3803b -->
# Fallos Legal Database Integration Plan

## Overview

Add fallos (jurisprudence) support to the existing legal database page (`DataBasePage.tsx`) by creating a unified view that displays both legislation and fallos together. Users can filter by content type, with jurisdiction persisting across switches. The content type selection will be reflected in URL query params for bookmarking/sharing.

## Key Requirements

- **Unified View**: Display both legislation and fallos in the same table
- **Content Type Filter**: Add a filter to switch between "Legislación", "Fallos", or "Todos" (all)
- **Jurisdiction Persistence**: When switching content types, only jurisdiction filter persists
- **URL Integration**: Content type reflected in URL query params (e.g., `?contentType=fallos`)
- **Reuse Existing Components**: Leverage current DataBase component structure

## Implementation Strategy

### 1. Type System Updates

**File: `apps/application/types/legislation.ts`**

- Add union type for combined legislation and fallos documents
- Create discriminated union type to distinguish between content types
- Add combined filter interface supporting both legislation and fallos filters

**File: `apps/application/types/fallos.ts`** (already exists)

- Already has proper types defined

### 2. DataBase Component Updates

**File: `apps/application/src/components/DataBase/DataBaseTable.tsx`**

- Add `contentType` state: `"legislation" | "fallos" | "all"`
- Update `TableState` interface to include `contentType`
- Add URL query param sync using `useSearchParams` from `react-router-dom`
- Update filter logic to handle both legislation and fallos filters
- Modify `handleJurisdictionChange` to preserve jurisdiction when switching content types
- Update facets fetching to call appropriate action based on content type
- Add logic to merge results when `contentType === "all"`

**File: `apps/application/src/components/DataBase/DataTableContainer.tsx`**

- Accept `contentType` prop
- Update query logic to call appropriate Convex action based on content type
- Handle merged results when displaying both types
- Update TypeScript types to handle union of `NormativeDoc | FalloDoc`

**File: `apps/application/src/components/DataBase/StaticControls.tsx`**

- Add `contentType` prop and change handler
- Pass content type to child components

**File: `apps/application/src/components/DataBase/TableControls.tsx`**

- Add content type selector (dropdown or segmented control)
- Position it prominently near jurisdiction selector
- Options: "Todos", "Legislación", "Fallos"

**File: `apps/application/src/components/DataBase/FiltersPanel.tsx`**

- Make filter fields conditional based on content type
- Show legislation-specific filters when `contentType === "legislation"`
- Show fallos-specific filters when `contentType === "fallos"`
- Show common filters (jurisdiction, estado, dates, search) for all types
- Add fallos-specific filters:
- Tribunal (dropdown)
- Materia (dropdown)
- Actor (text input)
- Demandado (text input)
- Magistrados (text input)
- Sala (text input)

**File: `apps/application/src/components/DataBase/TableView.tsx`**

- Update to handle both `NormativeDoc` and `FalloDoc` types
- Add type guard to distinguish between document types
- Adjust table columns to show relevant fields:
- For legislation: current columns
- For fallos: Título, Tribunal, Jurisdicción, Fecha, Actor, Demandado, Estado
- Use conditional rendering for type-specific badges

**File: `apps/application/src/components/DataBase/NormativeDetails.tsx`**

- Rename to `DocumentDetails.tsx` for clarity
- Update to handle both legislation and fallos documents
- Add type guard to render appropriate detail sections
- For fallos, show: tribunal, magistrados, actor, demandado, sala, sumario, materia, referencias_normativas, citas

### 3. Page-Level Updates

**File: `apps/application/src/pages/DataBasePage.tsx`**

- Update to fetch both legislation and fallos jurisdictions
- Initialize with URL query params if present
- Update initial data fetching to respect content type from URL

### 4. Convex Functions (Already Implemented)

The following functions already exist in `apps/application/convex/functions/fallos.ts`:

- `listFallos` - fetch paginated fallos
- `getFallo` - fetch single fallo by document_id
- `getFallosFacets` - get filter facets for fallos
- `getJurisdiccionValues` - get available jurisdictions
- `getTipoGeneralValues` - get available tipo_general values

### 5. New Components to Create

**File: `apps/application/src/components/DataBase/FalloDetails.tsx`**

- Create dedicated component for displaying fallo details
- Show all fallo-specific fields: tribunal, magistrados, actor, demandado, sala, sumario, materia, referencias_normativas, citas
- Similar structure to `NormativeDetails.tsx`

**File: `apps/application/src/components/DataBase/DocumentDetails.tsx`**

- Wrapper component that delegates to either `NormativeDetails` or `FalloDetails` based on document type
- Use type guards to determine which detail component to render

### 6. Sort Field Updates

**Legislation sort fields**: `sanction_date`, `updated_at`, `created_at`, `relevancia`

**Fallos sort fields**: `fecha`, `promulgacion`, `publicacion`, `relevancia`, `created_at`, `updated_at`

Need to map between these when switching content types, defaulting to a common field like `created_at`.

## File Changes Summary

### Files to Modify

1. `apps/application/src/components/DataBase/DataBaseTable.tsx` - Add content type state and URL sync
2. `apps/application/src/components/DataBase/DataTableContainer.tsx` - Handle multiple content types
3. `apps/application/src/components/DataBase/StaticControls.tsx` - Add content type prop
4. `apps/application/src/components/DataBase/TableControls.tsx` - Add content type selector
5. `apps/application/src/components/DataBase/FiltersPanel.tsx` - Conditional filters based on content type
6. `apps/application/src/components/DataBase/TableView.tsx` - Handle both doc types in table
7. `apps/application/src/components/DataBase/NormativeDetails.tsx` - Rename and update for both types
8. `apps/application/src/pages/DataBasePage.tsx` - Update initial data fetching
9. `apps/application/types/legislation.ts` - Add union types

### Files to Create

1. `apps/application/src/components/DataBase/FalloDetails.tsx` - Fallo-specific detail view
2. `apps/application/src/components/DataBase/DocumentDetails.tsx` - Wrapper for both detail types

## Testing Checklist

- [ ] Content type selector switches between legislation/fallos/all
- [ ] URL query params update when content type changes
- [ ] Jurisdiction persists when switching content types
- [ ] Other filters reset when switching content types
- [ ] Appropriate filters show for each content type
- [ ] Table displays correct columns for each content type
- [ ] Detail sheet shows correct information for each document type
- [ ] Pagination works correctly for each content type
- [ ] Sorting works correctly for each content type
- [ ] Search works across both content types when "Todos" is selected
- [ ] Facets update correctly based on content type and filters

### To-dos

- [ ] Update type definitions to support combined legislation and fallos documents
- [ ] Create FalloDetails component for displaying fallo-specific information
- [ ] Create DocumentDetails wrapper component that delegates to NormativeDetails or FalloDetails
- [ ] Add content type selector to TableControls component
- [ ] Make FiltersPanel conditional based on content type with fallos-specific filters
- [ ] Update TableView to handle both NormativeDoc and FalloDoc with appropriate columns
- [ ] Update DataTableContainer to fetch and display data based on content type
- [ ] Update StaticControls to pass content type to child components
- [ ] Add content type state, URL sync, and jurisdiction persistence to DataBaseTable
- [ ] Update DataBasePage to handle content type from URL params and fetch appropriate initial data