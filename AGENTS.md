# Agent Guidelines for Ialex Codebase

## Project Overview

Monorepo using pnpm workspaces: apps/application (React+Convex), apps/document-processor (Express+BullMQ), apps/pjn-scraper (Express+Playwright), packages/shared, packages/database

## Build & Test Commands

### Root Level

```bash
pnpm dev          # Main app (web + convex)
pnpm dev:all      # All services
pnpm build        # Build all packages
pnpm lint         # TypeScript + ESLint
pnpm preview      # Production preview
```

### Application App (`apps/application/`)

```bash
pnpm dev:web              # Vite dev server
pnpm dev:convex           # Convex dev server
pnpm test                 # Watch mode (Vitest)
pnpm test:once            # Run once
pnpm test:debug            # Debug with --inspect-brk
pnpm test:coverage        # Coverage report
pnpm test path/to/test.test.ts    # Run single test
```

### Document Processor (`apps/document-processor/`)

```bash
pnpm dev; pnpm build; pnpm test; pnpm test:streaming; pnpm test:all
```

### PJN Scraper (`apps/pjn-scraper/`)

```bash
pnpm dev; pnpm build; pnpm test
```

## Code Style Guidelines

### Import Conventions

```typescript
// ✅ Use absolute imports with aliases
import { cn } from "@/lib/utils";
import { UserTable } from "@/components/Users";
import type { Doc } from "types/teams";

// ❌ Avoid relative imports for cross-file references
import { cn } from "../../lib/utils";
```

Import aliases: `@/*` → `src/*`, `types/*` → `types/*`, `convex/*` → `convex/*`

### TypeScript Conventions

```typescript
// ✅ Explicit function return types
function getUser(id: string): Promise<User | null> {
  return ctx.db.get(id);
}

// ✅ Use Id<> types for Convex document IDs
function getCase(caseId: Id<"cases">): Promise<Doc<"cases"> | null> {
  return ctx.db.get(caseId);
}

// ✅ Proper array and record types
const users: Array<Id<"users">> = [];
const userMap: Record<Id<"users">, string> = {};
```

### Naming Conventions

- **Components**: PascalCase (`UserTable.tsx`, `SearchBar.tsx`)
- **Files**: PascalCase for components, camelCase for utilities (`formatters.ts`)
- **Functions**: camelCase (`getUserById`, `handleSubmit`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`, `API_BASE_URL`)
- **Interfaces/Types**: PascalCase with descriptive suffixes (`UserData`, `ApiResponse`)
- **Component Props**: `[ComponentName]Props` interface (`UserTableProps`)

### Component Architecture

Use **Component Folder Pattern** for complex components (>200 lines):

```
components/UserTable/
├── UserTable.tsx              # Main container (state + effects)
├── UserTableHeader.tsx        # UI controls
├── UserTableBody.tsx          # Data display
├── UserTablePagination.tsx    # Navigation
└── index.ts                   # Barrel exports
```

Key rules:

- Main component: max 400 lines, sub-components: max 150 lines
- Container manages all state and side effects
- Always create `index.ts` barrel for exports
- Import from folder: `import { UserTable } from '@/components/UserTable'`

Refactor triggers: 200+ lines, multiple UI concerns, deep nesting (>4 levels JSX)

### Convex Function Guidelines

```typescript
// ✅ Always use new function syntax with validators
export const getUser = query({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return user ?? null;
  },
});

// ✅ Function references
import { api, internal } from "./_generated/api";
const user = await ctx.runQuery(api.users.getUser, { userId });
```

- Always include `args` and `returns` validators
- Use `v.null()` for null returns (functions returning `undefined` will return `null`)
- Use indexes instead of `.filter()` in queries
- Use `ctx.runQuery`/`ctx.runMutation`/`ctx.runAction` to call functions
- Actions require `"use node";` at top for Node.js built-ins

### Error Handling

```typescript
// ✅ Type guards and checks
if (!user) throw new Error("User not found");

// ✅ Async error handling
try {
  const result = await fetchUserData();
} catch (error) {
  console.error("Failed to fetch user:", error);
  throw new Error("User fetch failed");
}
```

### Testing

- **Framework**: Vitest (application), tsx (backend services)
- **Test files**: `*.test.ts`, `*.test.tsx` in `__tests__/` directories
- Run single test: `pnpm test path/to/test.test.ts`

### Formatting & Linting

- **TypeScript**: Strict mode enabled
- **ESLint**: Run `pnpm lint` before committing
- **Unused vars**: Ignored if prefixed with `_` (`_unused`)
- **`any` types**: Allowed but discouraged; prefer `unknown` and type guards
- **No semicolons**: Follow existing codebase patterns

### Additional Guidelines

- Use `cn()` utility for conditional class merging (clsx + tailwind-merge)
- Prefer async/await over Promise chains
- Use `as const` for string literals in discriminated unions

### Cursor/Copilot Integration

This codebase includes Cursor rules in `.cursor/rules/`:

- `convex_rules.mdc` - Convex-specific guidelines and patterns
- `component_architecture.mdc` - Component organization and folder patterns

## Repository-Specific Patterns

### File Upload & Processing

- Documents flow through document-processor service
- Streaming processing for large files (BullMQ + Redis)
- PDF extraction with page-based batching
- Chunking and embedding for vector search

### AI Integration

- Convex Agent for LLM operations
- Streaming responses for real-time UI
- Tool-based agent architecture for complex workflows
- Context management for multi-turn conversations

### Authentication

- Clerk for user authentication
- Clerk tokens validated in Convex functions
- Role-based access control via user roles table
