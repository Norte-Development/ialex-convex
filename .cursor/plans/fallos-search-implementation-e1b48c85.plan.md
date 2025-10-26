<!-- e1b48c85-7a4d-40c9-8923-31e157df448e e2cd3686-d8cd-4b95-9df7-b6737df1058f -->
# Fallos Search and Filter Implementation Plan

## Overview

Extend the legislation utilities architecture to support fallos (jurisprudencia) search and filtering, following the same patterns used for legislation.

## Architecture Components

### 1. Type Definitions

**File**: `apps/application/types/fallos.ts` (NEW)

Create comprehensive TypeScript types for fallos:

- `FalloDoc`: Main document interface matching MongoDB structure
- `FalloFilters`: Filter parameters (jurisdiccion, tribunal, materia, dates, parties, etc.)
- `ListFallosParams`: Pagination and sorting parameters
- `PaginatedResult<T>`: Reusable pagination response type

Key fields from sample data:

- document_id, tipo_contenido, tipo_general, jurisdiccion
- tribunal, magistrados, actor, demandado, sala
- titulo, contenido, fecha, promulgacion, publicacion
- sumario, materia, tags, referencias_normativas, citas

### 2. MongoDB Service Layer

**File**: `apps/application/convex/utils/fallosService.ts` (NEW)

Implement MongoDB operations following `legislationService.ts` pattern:

**Functions to create**:

- `getMongoClient()`: Lazy MongoDB client initialization
- `buildMongoFilter(filters: FalloFilters)`: Convert filters to MongoDB query
  - Exact match: jurisdiccion, tribunal, materia, estado
  - Regex search: actor, demandado, magistrados (case-insensitive)
  - Date ranges: fecha_from/to, promulgacion_from/to
  - Array filters: tags (using $in)
  - Text search: titulo, contenido, materia (using $or with $regex)
- `buildMongoSort()`: Handle sorting by fecha, promulgacion, relevancia
- `getFallos(params: ListFallosParams)`: Paginated list with filters
  - Exclude large fields (contenido, relaciones) in projection
  - Validate limit (1-100), offset (>=0)
  - Return PaginatedResult with items, total, pagination metadata
- `getFalloById(documentId: string)`: Fetch single fallo with full content

**Collection**: `ialex_jurisprudencia_ar`

### 3. Qdrant Configuration

**File**: `apps/application/convex/rag/qdrantUtils/fallosConfig.ts` (NEW)

```typescript
export const FALLOS_COLLECTION_NAME = "ialex_jurisprudencia_ar";
```

### 4. Qdrant Search Utilities

**File**: `apps/application/convex/rag/qdrantUtils/fallos.ts` (NEW)

Implement semantic search following `legislation.ts` pattern:

**Functions to create**:

- `generateSparseEmbeddings()`: Reuse existing sparse embedding API
- `searchFallos` (internalAction):
  - Args: query (optional), filters, limit, contextWindow
  - Hybrid search: sparse (keywords) + dense (text-embedding-3-small) with RRF fusion
  - Filter-only mode: Use scroll when no query provided
  - Build Qdrant filters for: jurisdiccion, tribunal, materia, dates, parties, tags
  - Return scored results with payload fields
- `getFalloChunksByRange` (action):
  - Fetch chunked content by document_id and index range
  - Sort by index, return text array

**Search Strategy**:

- Query provided: Hybrid vector search with filters
- No query: Filter-only scroll search
- Collection validation before search

### 5. Convex Functions (Public API)

**File**: `apps/application/convex/functions/fallos.ts` (NEW)

Expose MongoDB service via Convex actions:

**Functions**:

- `listFallos` (action):
  - Args: filters, limit, offset, sortBy, sortOrder
  - Returns: PaginatedResult from getFallosService
  - Validates and forwards to MongoDB service
- `getFallo` (action):
  - Args: documentId
  - Returns: Single FalloDoc or null
  - Fetches full document including contenido

Mark as `'use node'` for MongoDB compatibility.

### 6. Agent Tool

**File**: `apps/application/convex/agents/tools/fallos/searchFallosTool.ts` (NEW)

Create unified search tool following `legislationFindTool.ts` pattern:

**Operations**:

- `search`: Semantic search using Qdrant hybrid search
  - Required: query parameter
  - Optional: filters for refinement
  - Returns: Formatted results with relevance scores
- `browse`: Filtered listing using MongoDB
  - Optional: all filter parameters
  - Returns: Paginated results sorted by date/promulgacion

**Tool Schema**:

```typescript
args: z.object({
  operation: z.union([z.literal("search"), z.literal("browse")]),
  query: z.string().optional(),
  filters: z.object({
    jurisdiccion, tribunal, materia, fecha_from, fecha_to,
    promulgacion_from, promulgacion_to, actor, demandado,
    magistrados, tags, estado
  }).optional(),
  limit, offset, sortBy, sortOrder
})
```

**Output Formatting**:

- `formatSearchResults()`: Display title, tribunal, jurisdiccion, fecha, parties, materia, tags, document_id
- `formatBrowseResults()`: Similar but emphasize filtering context
- Include pagination hints when hasNext is true

### 7. Agent Integration

**Files**:

- `apps/application/convex/agents/case/agent.ts`
- `apps/application/convex/agents/home/agent.ts`

Add to tools object:

```typescript
import { searchFallosTool } from "../tools/fallos/searchFallosTool";

tools: {
  // ... existing tools
  searchFallos: searchFallosTool,
}
```

### 8. Export Updates

**File**: `apps/application/convex/rag/qdrantUtils/index.ts`

Add export:

```typescript
export * from './fallos';
```

## Implementation Sequence

1. **Create type definitions** (fallos.ts in types/)

   - Define all interfaces matching MongoDB schema
   - Ensure compatibility with existing patterns

2. **Implement MongoDB service** (fallosService.ts)

   - Build filter and sort logic
   - Implement getFallos with pagination
   - Implement getFalloById

3. **Add Qdrant configuration** (fallosConfig.ts)

   - Export collection name constant

4. **Implement Qdrant utilities** (fallos.ts in qdrantUtils/)

   - searchFallos with hybrid search
   - getFalloChunksByRange for document reading
   - Handle filter-only and vector search modes

5. **Create Convex functions** (functions/fallos.ts)

   - Expose listFallos and getFallo actions
   - Wire to MongoDB service

6. **Build agent tool** (searchFallosTool.ts)

   - Implement search and browse operations
   - Format output for agent consumption
   - Add validation and error handling

7. **Integrate with agents** (agent.ts files)

   - Import and register searchFallosTool
   - Test with both case and home agents

8. **Update exports** (index.ts)

   - Export fallos utilities

## Key Design Decisions

- **Reuse patterns**: Follow legislation utilities architecture exactly
- **Hybrid search**: Use sparse + dense embeddings with RRF fusion for semantic queries
- **MongoDB for filtering**: Use MongoDB for structured browse/filter operations
- **Projection optimization**: Exclude large fields (contenido, relaciones) in list operations
- **Dual operation modes**: Support both semantic search and structured filtering
- **Pagination**: Limit results to 1-100 per request with offset-based pagination

## Testing Considerations

- Verify Qdrant collection exists (ialex_jurisprudencia_ar)
- Test filter combinations (jurisdiccion + tribunal + date range)
- Validate text search in titulo, contenido, materia
- Test party name searches (actor, demandado, magistrados)
- Verify pagination with hasNext/hasPrev
- Test both search and browse operations in agent context

## Environment Requirements

- MONGODB_URI: MongoDB connection string
- MONGODB_DATABASE_NAME: Database name
- QDRANT_URL: Qdrant instance URL
- QDRANT_API_KEY: Qdrant API key
- OPENAI_API_KEY: For dense embeddings
- Sparse embedding API access (https://api.ialex.com.ar/search/embed)

### To-dos

- [ ] Create apps/application/types/fallos.ts with FalloDoc, FalloFilters, ListFallosParams interfaces
- [ ] Implement apps/application/convex/utils/fallosService.ts with getFallos, getFalloById, filter/sort builders
- [ ] Create apps/application/convex/rag/qdrantUtils/fallosConfig.ts with collection name
- [ ] Implement apps/application/convex/rag/qdrantUtils/fallos.ts with searchFallos and getFalloChunksByRange
- [ ] Create apps/application/convex/functions/fallos.ts with listFallos and getFallo actions
- [ ] Create apps/application/convex/agents/tools/fallos/searchFallosTool.ts with search and browse operations
- [ ] Add searchFallosTool to case and home agents in agent.ts files
- [ ] Update apps/application/convex/rag/qdrantUtils/index.ts to export fallos utilities