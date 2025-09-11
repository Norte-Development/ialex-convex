# Escritos Transforms Algorithm Improvements

## Overview
This document outlines potential improvements to the `escritosTransforms.ts` algorithm, which converts text-based operations into position-based operations for ProseMirror-based rich text editing.

## Current Algorithm Strengths
- Context-aware text matching
- Schema validation and safety
- Position accuracy maintenance
- Rich text formatting support
- Diff engine integration for previews
- Error resilience with fallbacks

## Improvement Points

### 1. **Occurrence Control & Targeting**
**Implementation**: Add `occurrenceIndex` and `maxOccurrences` fields to operation objects. Modify the text-finding loops to track and limit matches.
```typescript
// Add to operation schema
occurrenceIndex?: number;  // "change the 3rd occurrence"
maxOccurrences?: number;   // "change first 2 occurrences"
```
**Effort**: Low - mostly parameter passing and counter logic in existing loops.

### 2. **Enhanced Context Matching**
**Implementation**: 
- **Multi-line**: Extend context checking to traverse across node boundaries
- **Regex**: Replace `indexOf()` with regex matching in context validation
- **Semantic**: Add document structure queries (e.g., `doc.descendants()` with node type filtering)
**Effort**: Medium - requires extending the context validation functions and adding new traversal logic.

### 3. **Advanced Text Selection**
**Implementation**:
- **Fuzzy**: Integrate a fuzzy string matching library (like `fuse.js`)
- **Case sensitivity**: Add `caseSensitive` boolean parameter
- **Whitespace**: Normalize whitespace before comparison
**Effort**: Low-Medium - mostly configuration and preprocessing.

### 4. **Document Structure Awareness**
**Implementation**: Add block-level operation types and extend the `findBlockWithText` helper to support hierarchical queries.
```typescript
// New operation types
type: "replace_block" | "insert_section" | "move_paragraph"
```
**Effort**: Medium-High - requires new operation types and complex document traversal.

### 5. **Operation Sequencing & Dependencies**
**Implementation**: Add dependency tracking and conditional execution logic before the main operation loop.
```typescript
// Add to operation schema
dependsOn?: string[];      // Operation IDs this depends on
condition?: string;        // Condition to check before execution
```
**Effort**: Medium - requires operation ID system and dependency resolution.

### 6. **Performance & Efficiency**
**Implementation**:
- **Batch**: Group operations by type and process similar ones together
- **Caching**: Cache document positions in a Map during traversal
- **Parallel**: Use `Promise.all()` for independent operations
**Effort**: Medium - requires refactoring the operation processing loop.

### 7. **Advanced Matching Strategies**
**Implementation**:
- **Proximity**: Add distance calculations in text-finding functions
- **Pattern**: Replace string matching with regex or pattern matching libraries
- **Semantic**: Integrate NLP libraries for meaning-based matching
**Effort**: High - requires external libraries and complex matching algorithms.

### 8. **Error Handling & Recovery**
**Implementation**: Wrap each operation in try-catch blocks and implement fallback strategies.
```typescript
// Add to operation result
success: boolean;
error?: string;
fallbackApplied?: boolean;
```
**Effort**: Medium - requires comprehensive error handling throughout the pipeline.

### 9. **User Experience Enhancements**
**Implementation**:
- **Progress**: Add progress callbacks and operation counting
- **Undo/Redo**: Store operation history and implement reverse operations
- **History**: Maintain a log of all applied operations
**Effort**: Medium-High - requires state management and operation reversal logic.

### 10. **Advanced Text Manipulation**
**Implementation**:
- **Smart Capitalization**: Add text transformation utilities
- **Punctuation**: Implement punctuation preservation rules
- **Cross-references**: Add reference tracking and update mechanisms
**Effort**: Medium - requires text processing utilities and reference management.

### 11. **Integration & Extensibility**
**Implementation**:
- **Plugin**: Create an operation registry system
- **External Data**: Add data fetching capabilities to operations
- **API**: Design extensible operation interfaces
**Effort**: High - requires architectural changes and plugin system design.

## Implementation Priority Ranking

### 1. **Low Effort, High Impact**
- Occurrence control
- Case sensitivity
- Whitespace handling

### 2. **Medium Effort, High Impact**
- Enhanced context matching
- Error handling
- Performance optimizations

### 3. **High Effort, High Impact**
- Document structure awareness
- Advanced matching strategies

### 4. **High Effort, Medium Impact**
- Plugin architecture
- Semantic matching

## Implementation Strategy

The key is to start with the low-effort, high-impact improvements that build on the existing solid foundation. The current algorithm already has:

- ✅ Diff system for previews
- ✅ Context-aware matching
- ✅ Schema validation
- ✅ Position accuracy
- ✅ Rich text support
- ✅ Error resilience

Focus on enhancing these existing strengths rather than rebuilding from scratch.

## Next Steps

1. **Phase 1**: Implement occurrence control and case sensitivity options
2. **Phase 2**: Add enhanced context matching and error handling
3. **Phase 3**: Introduce document structure awareness
4. **Phase 4**: Build advanced matching strategies and plugin architecture

This approach ensures incremental improvements while maintaining the algorithm's current reliability and performance.
