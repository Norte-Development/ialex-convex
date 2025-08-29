# Component Architecture Rules

## Component Organization Philosophy

Always organize complex components using the "Component Folder Pattern":
- Create a dedicated folder for each complex component
- Break large components into smaller, focused sub-components
- Use an index.ts barrel file for clean exports
- Follow single responsibility principle

## Component Structure Guidelines

### 1. Component Folder Pattern
When a component becomes complex (>200 lines or handles multiple concerns), break it into:

```
components/[ComponentName]/
├── [ComponentName].tsx          # Main container component
├── [SubComponent1].tsx          # Focused sub-component
├── [SubComponent2].tsx          # Focused sub-component
├── [SubComponent3].tsx          # Focused sub-component
└── index.ts                     # Barrel exports
```

### 2. Component Responsibility Split
Break components based on these concerns:
- **UI Controls**: Search bars, filters, form controls
- **Data Display**: Tables, lists, cards
- **Navigation**: Pagination, sorting controls
- **State Management**: Container components that manage state
- **Business Logic**: Components that handle specific domain logic

### 3. Example Structure (based on DataBase components):
```
components/DataBase/
├── DataBaseTable.tsx           # Main container (state management)
├── SearchBar.tsx              # Search input and controls
├── TableControls.tsx          # Sorting, jurisdiction, page size
├── FiltersPanel.tsx           # All filter controls
├── ActiveFilters.tsx          # Active filter badges
├── TableView.tsx              # Data table rendering
├── PaginationControls.tsx     # Pagination logic
├── DetailsView.tsx            # Detail modal/sheet content
└── index.ts                   # Export barrel
```

## Implementation Rules

### 1. Size Limits
- **Main component**: Should not exceed 400 lines
- **Sub-components**: Should not exceed 150 lines
- **If exceeded**: Split into smaller components

### 2. Props Pattern
- Pass specific props, not entire state objects
- Use callback functions for state updates
- Keep prop interfaces focused and minimal

### 3. State Management
- **Container component**: Manages all state and side effects
- **Sub-components**: Receive props and call callbacks
- **No state sharing**: Between sibling components (use container)

### 4. File Naming
- **PascalCase**: For component files (`SearchBar.tsx`)
- **camelCase**: For utility files (`formatters.ts`)
- **kebab-case**: For folders if multi-word (`data-base/`)

### 5. Export Pattern
Always create an `index.ts` barrel file:
```typescript
export { default as ComponentName } from './ComponentName'
export { SubComponent1 } from './SubComponent1'
export { SubComponent2 } from './SubComponent2'
// ... other exports
```

### 6. Import Pattern
Import from the folder, not individual files:
```typescript
// ✅ Good
import { DataBaseTable, SearchBar } from '@/components/DataBase'

// ❌ Avoid
import DataBaseTable from '@/components/DataBase/DataBaseTable'
import { SearchBar } from '@/components/DataBase/SearchBar'
```

## TypeScript Guidelines

### 1. Interface Organization
- Define interfaces in the same file as the component that uses them
- Share common interfaces via separate type files
- Use descriptive prop interface names: `[ComponentName]Props`

### 2. Type Safety
- Always type component props
- Use strict TypeScript settings
- Avoid `any` types

## Refactoring Triggers

Refactor a component when it:
- **Exceeds 200 lines**
- **Handles multiple UI concerns**
- **Has complex state management**
- **Mixes data fetching with presentation**
- **Becomes difficult to test**
- **Has deeply nested JSX (>4 levels)**

## Benefits of This Pattern

1. **Maintainability**: Easier to understand and modify
2. **Reusability**: Sub-components can be reused elsewhere
3. **Testing**: Smaller components are easier to test
4. **Performance**: Better tree-shaking and code splitting
5. **Collaboration**: Multiple developers can work on different parts
6. **Debugging**: Easier to isolate issues

## Anti-Patterns to Avoid

- **God Components**: Single files with 500+ lines
- **Prop Drilling**: Passing props through many levels
- **Mixed Concerns**: UI and business logic in same component
- **No Abstractions**: Repetitive code across components
- **Deep Nesting**: Components nested more than 4 levels deep

## Example Implementation

When you encounter a complex component, ask:
1. What are the distinct UI concerns?
2. What parts handle different types of user interaction?
3. What can be reused in other contexts?
4. How can I minimize prop dependencies?

Then split accordingly, always maintaining the folder structure with proper exports.
