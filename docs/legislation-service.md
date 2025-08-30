# Legislation Service Documentation

## Overview

The Legislation Service provides semantic search and retrieval capabilities for legal normatives using external MongoDB and Qdrant infrastructure. This service is implemented as a native Convex module that interfaces with existing external data sources.

## Architecture

- **MongoDB**: Canonical source for full documents and relaciones
- **Qdrant**: Semantic search engine for corpus-level and intra-document search
- **Convex**: Unified API layer with actions for external service integration

## Core Components

### 1. Type Definitions (`types/legislation.ts`)

Defines TypeScript interfaces for all legislation data structures:

- `Estado`: Union type for normative states (vigente, derogada, etc.)
- `Subestado`: Union type for sub-states
- `TipoRelacion`: Union type for relationship types
- `NormativeDoc`: Main normative document interface
- `Relacion`: Relationship interface
- `SearchResult`: Search result interface
- `ChunkSearchResult`: Chunk-level search result interface

### 2. Service Layer (`convex/utils/legislationService.ts`)

The `LegislationService` class provides the core functionality:

```typescript
class LegislationService {
  // Corpus-level semantic search
  async searchNormativesCorpus(params: CorpusSearchParams): Promise<SearchResult[]>
  
  // Intra-document semantic search
  async searchNormativeChunks(params: IntraDocSearchParams): Promise<ChunkSearchResult[]>
  
  // Get full normative by ID
  async getNormative(id: string): Promise<NormativeDoc | null>
  
  // List normatives with filters
  async listNormatives(params: ListNormativesParams): Promise<NormativeDoc[]>
  
  // Get related normatives
  async getRelatedNormatives(id: string): Promise<Relacion[]>
  
  // Test external service connections
  async testConnections(): Promise<{ mongodb: boolean; qdrant: boolean }>
}
```

### 3. Convex Functions (`convex/functions/legislation.ts`)

Exposes the service functionality as Convex actions:

- `searchNormatives`: Corpus-level semantic search
- `queryNormatives`: Intra-document semantic search
- `getNormative`: Retrieve full normative by ID
- `listNormatives`: Filter-based retrieval
- `getRelatedNormatives`: Get related normatives
- `testLegislationConnections`: Test external service connections

### 4. Agent Integration (`convex/agent/legislationTools.ts`)

Provides MCP-style tools for the AI agent:

- `search_normatives`: Find relevant normatives across the corpus
- `get_normative`: Retrieve complete normative information
- `list_normatives`: Browse normatives with filters
- `get_related_normatives`: Find related normatives
- `query_normatives`: Search within specific normatives

## Usage Examples

### Corpus-Level Search

```typescript
// Search for contract-related laws
const results = await searchNormatives({
  query: "contract law obligations",
  filters: {
    tipo: "ley",
    estado: "vigente",
    provincia: "nacional"
  },
  limit: 10
});
```

### Intra-Document Search

```typescript
// Search within specific normatives
const chunks = await queryNormatives({
  query: "penalty for breach",
  normative_ids: ["ley_123", "decreto_456"],
  limit: 5
});
```

### Get Full Normative

```typescript
// Retrieve complete normative information
const normative = await getNormative("ley_123");
```

### List with Filters

```typescript
// Browse normatives with filters
const normatives = await listNormatives({
  filters: {
    tipo: "decreto",
    estado: "vigente",
    vigencia_actual: true
  },
  limit: 50,
  offset: 0
});
```

### Get Related Normatives

```typescript
// Find related normatives
const relaciones = await getRelatedNormatives("ley_123");
```

## Environment Variables

The service requires the following environment variables:

```bash
# MongoDB connection
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=legislation_db

# Qdrant connection
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your_qdrant_api_key

# OpenAI for embeddings
OPENAI_API_KEY=your_openai_api_key
```

## Qdrant Collections

The service expects two Qdrant collections:

### 1. `legislation_normatives`
For corpus-level semantic search:
- Vector: 1536-dimensional embeddings (OpenAI text-embedding-3-small)
- Payload: id, tipo, titulo, resumen, provincia, estado, promulgacion, vigencia_actual

### 2. `legislation_chunks`
For intra-document semantic search:
- Vector: 1536-dimensional embeddings
- Payload: normative_id, article, section, text, chunk_index

## MongoDB Collections

The service expects a MongoDB collection:

### `normatives`
Contains full normative documents with relaciones:
- Core fields: id, tipo, numero, titulo, provincia, promulgacion, estado, subestado
- Content: texto, resumen
- Relationships: relaciones array
- Metadata: created_at, updated_at

## Error Handling

All functions include comprehensive error handling:

- Connection failures to external services
- Invalid query parameters
- Missing or malformed data
- Rate limiting and timeout handling

## Performance Considerations

- **Embedding Generation**: Uses OpenAI's text-embedding-3-small for cost efficiency
- **Query Optimization**: Proper filtering to reduce vector search space
- **Pagination**: Support for offset-based pagination in list operations
- **Caching**: Consider implementing result caching for frequently accessed normatives

## Integration with AI Agent

The legislation tools are integrated with the existing AI agent system:

```typescript
// Agent can use legislation tools
const agent = new Agent(components.agent, {
  tools: {
    // ... existing tools
    searchNormatives: legislationTools[0],
    getNormative: legislationTools[1],
    listNormatives: legislationTools[2],
    getRelatedNormatives: legislationTools[3],
    queryNormatives: legislationTools[4]
  }
});
```

## Testing

Use the `testLegislationConnections` function to verify external service connectivity:

```typescript
const connections = await testLegislationConnections();
console.log("MongoDB:", connections.mongodb);
console.log("Qdrant:", connections.qdrant);
```

## Future Enhancements

- **Caching Layer**: Implement Redis caching for frequently accessed data
- **Advanced Filtering**: Add more sophisticated filtering options
- **Batch Operations**: Support for bulk normative operations
- **Analytics**: Track search patterns and popular queries
- **Real-time Updates**: Webhook integration for normative updates

## Troubleshooting

### Common Issues

1. **Connection Failures**: Check environment variables and network connectivity
2. **Empty Results**: Verify Qdrant collections exist and contain data
3. **Slow Performance**: Check embedding generation and Qdrant query optimization
4. **Authentication Errors**: Verify API keys and permissions

### Debug Mode

Enable detailed logging by setting the appropriate log levels in your Convex environment.

## API Reference

For detailed API documentation, see the TypeScript interfaces in `types/legislation.ts` and the function definitions in `convex/functions/legislation.ts`.
