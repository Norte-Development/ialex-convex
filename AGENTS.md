# iAlex - AI Coding Agent Guide

This document provides essential information for AI coding agents working on the iAlex legal management platform.

## Project Overview

**iAlex** is a comprehensive legal practice management platform combining traditional case organization with advanced AI capabilities, specifically designed for law firms and legal professionals in Argentina.

### Key Features
- **Case Management**: Complete legal case organization with clients, documents, and deadlines
- **AI Legal Assistant**: GPT-4 powered chat with specialized tools for legal research
- **Document Management**: Intelligent document processing with OCR, chunking, and semantic search (RAG)
- **Legal Document Editor**: Tiptap-based collaborative editor for legal briefs (escritos)
- **Team Collaboration**: Granular permissions and team-based access control
- **Legal Database**: Searchable database of Argentine legislation and case law
- **PJN Integration**: Sync with Poder Judicial de la Nación (Argentine judicial system)

## Technology Stack

### Core Technologies
| Layer | Technology |
|-------|------------|
| **Backend** | [Convex](https://convex.dev/) - Database, serverless functions, real-time sync |
| **Frontend** | React 19 + Vite 7 + TypeScript 5.9 |
| **UI Framework** | Tailwind CSS 4 + shadcn/ui + Radix UI |
| **Authentication** | Clerk (with Firebase Auth migration support) |
| **AI/LLM** | OpenAI GPT-4o-mini, Anthropic Claude (via AI SDK) |
| **State Management** | Convex reactive queries + React Context |

### Supporting Services
| Service | Purpose |
|---------|---------|
| **Google Cloud Storage** | Document file storage |
| **Qdrant** | Vector database for semantic search |
| **Redis** | Queue management for document processing |
| **BullMQ** | Job queue for background processing |
| **Stripe** | Subscription billing and payments |
| **Resend** | Email notifications |

### Package Manager
- **pnpm** 9.1.0 (required)
- Node.js 18+ (specified in `.nvmrc`)

## Project Structure

```
ialex-convex/
├── apps/
│   ├── application/          # Main React + Convex application
│   │   ├── convex/          # Convex functions, schema, agents
│   │   │   ├── agents/      # AI agents (case, home, whatsapp)
│   │   │   ├── functions/   # Core business logic
│   │   │   ├── schema.ts    # Database schema
│   │   │   └── ...
│   │   ├── src/             # React frontend
│   │   │   ├── components/  # UI components (organized by feature)
│   │   │   ├── pages/       # Page components
│   │   │   ├── hooks/       # Custom React hooks
│   │   │   ├── lib/         # Utilities and helpers
│   │   │   └── context/     # React contexts
│   │   └── package.json
│   ├── document-processor/  # Microservice for document processing
│   │   ├── src/
│   │   │   ├── jobs/        # Queue job handlers
│   │   │   ├── services/    # Processing services (OCR, embedding, etc.)
│   │   │   └── types/       # TypeScript types
│   │   └── package.json
│   └── pjn-scraper/         # PJN (judicial system) scraper service
│       └── src/
├── packages/
│   ├── database/            # Qdrant client shared package (@ialex/database)
│   └── shared/              # Shared utilities (@ialex/shared)
│       └── src/
│           ├── diff/        # Diff utilities for document comparison
│           └── tiptap/      # Shared Tiptap extensions
├── docs/                    # Technical documentation
├── rules/                   # AI coding rules and guidelines
└── docker-compose.yml       # Local development services
```

## Development Commands

### Root Level Commands
```bash
# Install all dependencies
pnpm install

# Start development (frontend + convex)
pnpm dev

# Start only the web frontend
pnpm dev:app:web

# Start only convex backend
pnpm dev:app:convex

# Start document processor
pnpm dev:processor

# Start everything in parallel
pnpm dev:all

# Build for production
pnpm build

# Lint the codebase
pnpm lint

# Add shadcn/ui components
pnpm ui:add <component-name>
```

### Application-Specific Commands
```bash
cd apps/application

# Development
pnpm dev              # Start Vite dev server + Convex
pnpm dev:web          # Start only Vite
pnpm dev:convex       # Start only Convex

# Testing
pnpm test             # Run Vitest in watch mode
pnpm test:once        # Run tests once
pnpm test:coverage    # Run with coverage

# Build
pnpm build            # Production build
pnpm preview          # Preview production build
```

### Document Processor Commands
```bash
cd apps/document-processor

pnpm dev              # Run with tsx (development)
pnpm build            # Build with tsup
pnpm start            # Run production build
```

## Database Schema (Convex)

The main database schema is defined in `apps/application/convex/schema.ts`. Key tables include:

### Core Tables
- `users` - User accounts (Clerk integration)
- `clients` - Legal clients (personas humanas/jurídicas per Argentine law)
- `cases` - Legal cases/expedientes
- `clientCases` - Many-to-many relationship
- `documents` - Document metadata and processing status
- `escritos` - Legal briefs/documents (Tiptap/ProseMirror content)

### Team & Permissions
- `teams` - Law firm teams
- `teamMemberships` - User-team relationships
- `teamCaseAccess` - Team-level case access
- `userCaseAccess` - Granular user permissions
- `caseAccess` - Unified permission system (new)
- `teamInvites` - Pending team invitations

### AI & Workflow
- `agentRules` - Custom rules for AI agents
- `prompts` - Reusable prompt templates
- `todoLists` / `todoItems` - Task management
- `events` / `eventParticipants` - Calendar system

### Billing
- `usageLimits` - Feature usage tracking
- `aiCredits` / `aiCreditPurchases` - AI credit system
- Stripe tables (via `@raideno/convex-stripe`)

### Library
- `libraryFolders` - Personal/team document folders
- `libraryDocuments` - Reference documents
- `modelos` - Document templates

## Convex Development Guidelines

### Function Types
- Use `query` / `mutation` / `action` for public APIs
- Use `internalQuery` / `internalMutation` / `internalAction` for private functions
- Always include argument and return validators

### Important Rules
1. **Never use `filter()` in queries** - Use indexes with `withIndex()` instead
2. **Always define validators** - Include `returns: v.null()` if no return value
3. **Use proper types** - Import `Id<'tableName'>` from `_generated/dataModel`
4. **Actions cannot use `ctx.db`** - Call queries/mutations via `ctx.runQuery()` / `ctx.runMutation()`

### Example Convex Function
```typescript
import { query } from "./_generated/server";
import { v } from "convex/values";

export const getCase = query({
  args: { caseId: v.id("cases") },
  returns: v.union(v.null(), v.object({
    _id: v.id("cases"),
    _creationTime: v.number(),
    title: v.string(),
    // ... other fields
  })),
  handler: async (ctx, args) => {
    const case_ = await ctx.db.get(args.caseId);
    return case_ ?? null;
  },
});
```

## Frontend Architecture

### Component Organization
Components are organized by feature/domain:
- `components/Cases/` - Case management components
- `components/Clients/` - Client management
- `components/Documents/` - Document handling
- `components/Editor/` - Tiptap-based legal editor
- `components/CaseAgent/` - AI assistant sidebar
- `components/ui/` - shadcn/ui base components

### Key Libraries
- **Routing**: React Router 7
- **Forms**: Native React + validation
- **Query**: Convex React integration (`convex/react`)
- **Styling**: Tailwind CSS 4 with custom theme
- **Icons**: Lucide React
- **Editor**: Tiptap 3 with custom extensions
- **PDF**: react-pdf, jspdf, html2canvas-pro

### Path Aliases
```typescript
// tsconfig.json paths
"@/*": ["./src/*"]
"types/*": ["./types/*"]
"convex/*": ["./convex/*"]
```

## Document Processing Pipeline

The document processor (`apps/document-processor`) handles:

1. **File Upload** → Google Cloud Storage
2. **Text Extraction**
   - PDFs: Mistral OCR → fallback to pdfjs
   - Audio/Video: Deepgram transcription
   - Office docs: Mammoth/jszip
3. **Chunking** - Smart document segmentation
4. **Embedding** - OpenAI embeddings
5. **Vector Storage** - Qdrant for semantic search

### Queue System
- Redis + BullMQ for job management
- Streaming pipeline for large files
- Progress tracking via Convex mutations

## Environment Variables

### Required for Development (.env.local)
```bash
# Convex
VITE_CONVEX_URL=https://your-deployment.convex.cloud

# AI Services
OPENAI_API_KEY=sk-...
MISTRAL_API_KEY=...
DEEPGRAM_API_KEY=...

# Vector DB
QDRANT_URL=https://...
QDRANT_API_KEY=...

# Security
HMAC_SECRET=your-secret-key

# Document Processor
VITE_DOCUMENT_PROCESSOR_URL=http://localhost:4001
```

### Required for Production
Additional variables needed:
```bash
# Stripe (Billing)
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
VITE_APP_URL=https://your-domain.com

# Clerk (Auth)
VITE_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Google Cloud
GOOGLE_CLOUD_STORAGE_BUCKET=...
GOOGLE_CLOUD_PROJECT_ID=...
```

See `docs/ENVIRONMENT_VARIABLES.md` for complete list.

## Testing Strategy

### Frontend Tests
- **Framework**: Vitest
- **Location**: `apps/application/src/**/*.test.ts`
- **Run**: `pnpm test` (watch mode) or `pnpm test:once`

### Convex Tests
- **Framework**: `convex-test`
- **Location**: `apps/application/convex/**/*.test.ts`
- **Setup**: `convex/test.setup.ts`

### Test Files Pattern
```
*.test.ts         # Unit tests
*.integration.test.ts  # Integration tests
```

## Code Style Guidelines

### TypeScript
- Strict mode enabled
- Always type function parameters and returns
- Use `Id<'tableName'>` for document IDs
- Prefer explicit types over inference for public APIs

### ESLint Configuration
Located in `eslint.config.js`:
- Extends recommended TypeScript and React rules
- Allows `any` types (pragmatic for AI integration)
- Warns on unused variables (allows `_` prefix)
- Ignores generated files in `convex/_generated/`

### React Patterns
- Functional components with hooks
- Context for global state (Auth, Case, etc.)
- Convex queries for server state
- Custom hooks for reusable logic

## Deployment

### Convex Deployment
```bash
cd apps/application
npx convex deploy
```

### Frontend (Docker)
```bash
# Build image
docker build -f apps/application/Dockerfile -t ialex-app .

# Run
docker run -p 80:80 ialex-app
```

### Document Processor (Docker Compose)
```bash
# Start all services
docker-compose up -d

# Includes: Redis, 3 document-processor instances
```

### Google Cloud Run
- Build using Cloud Build (`cloudbuild.yaml`)
- Multi-service deployment (app + processor)
- Environment variables from Secret Manager

## Key Files Reference

| File | Purpose |
|------|---------|
| `apps/application/convex/schema.ts` | Database schema definition |
| `apps/application/convex/convex.config.ts` | Convex app configuration |
| `apps/application/vite.config.ts` | Vite build configuration |
| `apps/application/src/main.tsx` | React app entry point |
| `apps/application/src/App.tsx` | Root component |
| `package.json` | Root workspace configuration |
| `pnpm-workspace.yaml` | pnpm workspace definition |
| `turbo.json` | Turborepo task configuration |
| `components.json` | shadcn/ui configuration |

## Security Considerations

1. **Authentication**: All Convex functions use Clerk auth context
2. **Authorization**: Granular permission checks in queries/mutations
3. **File Upload**: Server-side validation + type checking
4. **API Keys**: Never commit to repo, use environment variables
5. **CORS**: Configured in Vite preview for production domains

## Common Development Tasks

### Adding a New Convex Function
1. Create in appropriate file under `convex/functions/` or `convex/agents/tools/`
2. Use proper validators for args and returns
3. Export from `convex/functions/index.ts` if needed
4. Import and use via `api.path.function` from generated API

### Adding a New AI Tool
1. Create in `convex/agents/tools/<category>/`
2. Define tool schema and handler
3. Export from `convex/agents/tools/index.ts`
4. Add to agent's tool list in `convex/agents/<agent>/agent.ts`

### Adding a shadcn/ui Component
```bash
pnpm ui:add <component-name>
# Component is added to apps/application/src/components/ui/
```

### Creating a New Page
1. Create component in `apps/application/src/pages/`
2. Add route in `apps/application/src/App.tsx`
3. Add to navigation if needed

## Troubleshooting

### Common Issues

**Convex sync issues**
- Check `VITE_CONVEX_URL` is correct
- Ensure Convex dev server is running

**Type generation**
- Run `npx convex dev` to regenerate types
- Check `_generated/` folder exists

**Document processor not processing**
- Verify Redis is running
- Check document-processor logs
- Ensure HMAC_SECRET matches between app and processor

**Permission errors**
- Check user has proper case access
- Verify team membership status
- Review `caseAccess` table entries

## Additional Documentation

- `PRD_IALEX.md` - Product Requirements Document
- `README.md` - Project overview and setup
- `docs/` - Technical documentation directory
- `rules/convex_rules.mdc` - Detailed Convex coding rules

## Support

- Convex Docs: https://docs.convex.dev/
- React Docs: https://react.dev/
- Project Issues: Use GitHub Issues
