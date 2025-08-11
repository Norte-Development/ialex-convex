# Flask API Agent Tools

This document describes the agent tools that integrate with the external Flask-based search API service. These tools provide AI agents with the ability to search legal documents, legislation, court decisions, and user documents.

## Overview

The Flask API provides vector-based search capabilities using hybrid search (dense + sparse embeddings) powered by Qdrant vector database and OpenAI embeddings. The agent tools act as a bridge between the Convex-based legal case management system and the external search service.

## Environment Variables Required

The following environment variables must be set for the tools to function:

- `FLASK_API_URL`: The base URL of the Flask API service
- `FLASK_API_KEY`: The API key for authenticating with the Flask service (matches `APP_SECRET_KEY` in Flask)

## Available Tools

### 1. searchLegislationTool

**Purpose**: Search legal legislation using hybrid search with support for filtering by category, date range, and jurisdiction.

**Arguments**:
- `query` (string, required): The search query text
- `jurisdiccion` (string, optional): Jurisdiction to search in (default: "nacional")
  - Examples: "nacional", "provincial", "municipal"
- `category` (string or string[], optional): Category filter(s)
  - Examples: "disposicion", "ley", "decreto", "resolucion"
  - Can be a single string or array of strings for multiple categories
- `startDate` (string, optional): Start date for date range filter (ISO format)
- `endDate` (string, optional): End date for date range filter (ISO format)

**Use Cases**:
- Finding specific laws or regulations
- Searching for legislation within a date range
- Filtering by document type (laws, decrees, dispositions)
- Cross-jurisdictional legal research

**Example Usage**:
```typescript
// Search for labor laws from 2023
await searchLegislationTool.handler(ctx, {
  query: "derecho laboral salario mínimo",
  category: ["ley", "decreto"],
  startDate: "2023-01-01T00:00:00",
  endDate: "2023-12-31T23:59:59"
});

// Search across multiple categories
await searchLegislationTool.handler(ctx, {
  query: "contrato de trabajo",
  category: ["ley", "disposicion", "resolucion"]
});
```

### 2. searchDocumentsTool

**Purpose**: Search user and team documents within the legal case management system using hybrid search.

**Arguments**:
- `query` (string, required): The search query text to find relevant documents
- `user_id` (string, optional): Filter documents by specific user ID
- `team_id` (string, optional): Filter documents by specific team ID  
- `limit` (number, optional): Maximum number of results (default: 30)

**Use Cases**:
- Finding documents related to specific cases
- Searching within team-specific document collections
- Locating user-created documents
- Cross-referencing case materials

**Example Usage**:
```typescript
// Search team documents for contract-related materials
await searchDocumentsTool.handler(ctx, {
  query: "contrato de compraventa inmueble",
  team_id: "team_123",
  limit: 20
});

// Search user's personal documents
await searchDocumentsTool.handler(ctx, {
  query: "poder judicial expediente",
  user_id: "user_456"
});
```

### 3. searchFallosTool

**Purpose**: Search court decisions and legal precedents (fallos) using dense embeddings for finding relevant case law.

**Arguments**:
- `query` (string, required): The search query text to find relevant court decisions
- `limit` (number, optional): Maximum number of results (default: 10)

**Use Cases**:
- Finding relevant case law and judicial precedents
- Researching court decisions on specific legal topics
- Building legal arguments based on jurisprudence
- Comparative legal analysis

**Example Usage**:
```typescript
// Search for employment-related court decisions
await searchFallosTool.handler(ctx, {
  query: "despido sin causa justa indemnización",
  limit: 15
});

// Find precedents on contract disputes
await searchFallosTool.handler(ctx, {
  query: "incumplimiento contractual daños y perjuicios"
});
```

### 4. healthCheckTool

**Purpose**: Check the health status of the Flask API search service for monitoring and debugging.

**Arguments**: None

**Use Cases**:
- Service health monitoring
- Debugging connectivity issues
- System status verification
- Automated health checks

**Example Usage**:
```typescript
// Check if the search service is available
const health = await healthCheckTool.handler(ctx, {});
console.log("Service status:", health.status);
```

## Response Formats

### Search Tools Response Format

All search tools return responses in the following format:

```typescript
{
  results: Array<{
    id?: string,
    score?: number,
    payload: {
      // Document-specific fields vary by collection
      title?: string,
      content?: string,
      date?: string,
      category?: string,
      type?: string,
      number?: string,
      // Additional metadata fields
    }
  }>,
  cached: boolean // Indicates if results were served from cache
}
```

### Health Check Response Format

```typescript
{
  status: "healthy" | "unhealthy"
}
```

## Error Handling

All tools implement comprehensive error handling:

- **Network Errors**: HTTP request failures are caught and re-thrown with descriptive messages
- **Authentication Errors**: Invalid API keys result in 401 errors
- **Validation Errors**: Missing required parameters result in 400 errors
- **Service Errors**: Internal Flask API errors are propagated with context

## Performance Considerations

- **Caching**: The Flask API implements intelligent caching with 24-hour default timeout
- **Timeouts**: Qdrant client is configured with 60-second timeout
- **Rate Limiting**: Consider implementing rate limiting for production usage
- **Parallel Requests**: Tools can be called in parallel for better performance

## Security Notes

- All API requests require authentication via `X-API-Key` header
- CORS is configured for specific domains
- Environment variables should be securely managed
- API keys should be rotated regularly

## Integration with Legal Workflow

These tools are designed to enhance the legal case management workflow by providing:

1. **Research Capabilities**: Quick access to legislation and case law
2. **Document Discovery**: Finding relevant documents across cases and teams
3. **Precedent Analysis**: Searching court decisions for building legal arguments
4. **Cross-Reference**: Linking case materials with external legal sources

## Troubleshooting

Common issues and solutions:

1. **Connection Errors**: Verify `FLASK_API_URL` and network connectivity
2. **Authentication Failures**: Check `FLASK_API_KEY` environment variable
3. **Empty Results**: Verify search query and collection data availability
4. **Timeout Issues**: Check Qdrant service status and network latency

## Future Enhancements

Potential improvements for the agent tools:

- **Advanced Filtering**: Support for more complex query filters
- **Result Ranking**: Custom scoring and ranking algorithms
- **Semantic Clustering**: Grouping similar results
- **Real-time Updates**: Live search result updates
- **Multi-language Support**: Cross-language search capabilities 