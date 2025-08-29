# Multi-Jurisdiction Legislation Service

## Overview

The legislation service has been updated to support multiple jurisdictions, where each jurisdiction has its own separate collections in both MongoDB and Qdrant. This allows for better organization and isolation of legislation data by jurisdiction.

## Architecture

### Collection Naming Convention

#### Qdrant Collections
- **Normatives Collection**: `legislacion_{jurisdiction}`
  - Example: `legislacion_caba`, `legislacion_chaco`, `legislacion_buenos_aires`
- **Chunks Collection**: `legislacion_{jurisdiction}_chunks`
  - Example: `legislacion_caba_chunks`, `legislacion_chaco_chunks`

#### MongoDB Collections
- **Normatives Collection**: `normatives_{jurisdiction}`
  - Example: `normatives_caba`, `normatives_chaco`, `normatives_buenos_aires`

### Data Structure

Each jurisdiction maintains its own complete set of:
- Normative documents (laws, regulations, etc.)
- Text chunks for semantic search
- Relationships between normatives
- Metadata and status information

## API Changes

### LegislationService Class

All methods now require a `jurisdiction` parameter:

```typescript
// Before
await legislationService.searchNormativesCorpus(params);

// After
await legislationService.searchNormativesCorpus(jurisdiction, params);
```

### Updated Methods

1. **searchNormativesCorpus(jurisdiction, params)**
   - Searches normatives in the specified jurisdiction's corpus
   - Uses jurisdiction-specific Qdrant collection

2. **searchNormativeChunks(jurisdiction, params)**
   - Searches within normative chunks for the specified jurisdiction
   - Uses jurisdiction-specific chunks collection

3. **getNormative(jurisdiction, id)**
   - Retrieves a normative from the specified jurisdiction's MongoDB collection

4. **listNormatives(jurisdiction, params)**
   - Lists normatives from the specified jurisdiction with filters

5. **getRelatedNormatives(jurisdiction, id)**
   - Gets related normatives for a specific normative in the jurisdiction

6. **testConnections(jurisdiction)**
   - Tests connections for the specified jurisdiction's collections

7. **getAvailableJurisdictions()** (NEW)
   - Returns a list of all available jurisdictions by checking existing collections

### Convex Functions

All legislation functions now require a `jurisdiction` parameter:

```typescript
// Example usage
await ctx.runAction(components.legislation.searchNormatives, {
  jurisdiction: "caba",
  query: "leyes laborales",
  filters: { tipo: "ley", estado: "vigente" }
});
```

### Agent Tools

The AI agent now has access to jurisdiction-aware legislation tools:

1. **searchNormativesTool** - Search normatives in a jurisdiction
2. **getNormativeTool** - Get a specific normative from a jurisdiction
3. **listNormativesTool** - List normatives from a jurisdiction
4. **getRelatedNormativesTool** - Get related normatives from a jurisdiction
5. **queryNormativesTool** - Search within normative texts in a jurisdiction
6. **getAvailableJurisdictionsTool** - Get list of available jurisdictions

## Usage Examples

### Searching Legislation

```typescript
// Search for labor laws in CABA
const results = await legislationService.searchNormativesCorpus("caba", {
  query: "leyes laborales",
  filters: {
    tipo: "ley",
    estado: "vigente"
  },
  limit: 10
});
```

### Getting Available Jurisdictions

```typescript
// Get all available jurisdictions
const jurisdictions = await legislationService.getAvailableJurisdictions();
// Returns: ["caba", "chaco", "buenos_aires", ...]
```

### Testing Jurisdiction Connections

```typescript
// Test if CABA jurisdiction is properly set up
const connections = await legislationService.testConnections("caba");
// Returns: { mongodb: true, qdrant: true }
```

## Migration Notes

### For Existing Code

If you have existing code that uses the legislation service, you'll need to:

1. Add the `jurisdiction` parameter to all function calls
2. Update any hardcoded collection names
3. Consider which jurisdiction(s) your application should support

### For New Implementations

1. Determine which jurisdictions you need to support
2. Ensure the corresponding collections exist in both MongoDB and Qdrant
3. Use the `getAvailableJurisdictions()` method to check available jurisdictions
4. Always pass the jurisdiction parameter in function calls

## Benefits

1. **Data Isolation**: Each jurisdiction's data is completely separate
2. **Scalability**: Easy to add new jurisdictions without affecting existing ones
3. **Performance**: Smaller collections mean faster searches
4. **Maintenance**: Easier to manage and update jurisdiction-specific data
5. **Compliance**: Better support for jurisdiction-specific legal requirements

## Future Considerations

1. **Cross-Jurisdiction Search**: Potential for searching across multiple jurisdictions
2. **Jurisdiction Mapping**: Mapping between different jurisdiction naming conventions
3. **Data Synchronization**: Tools for keeping jurisdiction data in sync
4. **Access Control**: Jurisdiction-based access permissions

## Error Handling

The service includes jurisdiction-specific error messages:

```typescript
// Example error message
"Failed to search normatives corpus for jurisdiction caba: Collection not found"
```

This helps with debugging and identifying jurisdiction-specific issues.
