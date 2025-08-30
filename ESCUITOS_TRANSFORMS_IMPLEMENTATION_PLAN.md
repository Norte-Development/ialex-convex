# Escritos Transforms Implementation Plan

## Overview

This plan outlines the enhancement of the `applyTextBasedOperations` function to support comprehensive document transformations, from small text edits to large section rewrites. The implementation is divided into phases that build upon each other, with each phase addressing specific use cases and complexity levels.

## Current State Analysis

### Existing Capabilities
- **Text Operations**: Replace, insert, delete text with context matching
- **Position-based**: Converts text operations to ProseMirror position operations
- **Change Tracking**: Integrates with existing diff engine and change tracking system
- **Context Support**: Before/after context for precise text matching

### Limitations
- **No Mark Support**: Cannot add/remove/change text formatting (bold, italic, etc.)
- **No Block Operations**: Cannot modify paragraph types, headings, lists
- **Performance Issues**: Multiple small operations for large changes
- **Accuracy Problems**: Context ambiguity in large documents
- **No Section Management**: Cannot handle large rewrites efficiently

## Phase 1: Mark Operations Enhancement
**Duration**: 2-3 days  
**Priority**: High  
**Complexity**: Medium

### Motivation
Marks (bold, italic, code, etc.) are fundamental text formatting that users expect to be able to manipulate programmatically. This phase extends the current text-based approach to handle inline formatting, which is a natural evolution of the existing system.

### Objectives
- Add support for mark operations (add, remove, replace)
- Maintain compatibility with existing text operations
- Leverage existing context matching system
- Ensure proper mark hierarchy and nesting

### Implementation Details

#### 1.1 Extend Operation Types
```typescript
// Add to existing union types
v.object({
  type: v.literal("add_mark"),
  text: v.string(),
  markType: v.union(
    v.literal("bold"),
    v.literal("italic"), 
    v.literal("code"),
    v.literal("strike"),
    v.literal("underline")
  ),
  contextBefore: v.optional(v.string()),
  contextAfter: v.optional(v.string()),
}),

v.object({
  type: v.literal("remove_mark"),
  text: v.string(),
  markType: v.union(
    v.literal("bold"),
    v.literal("italic"),
    v.literal("code"), 
    v.literal("strike"),
    v.literal("underline")
  ),
  contextBefore: v.optional(v.string()),
  contextAfter: v.optional(v.string()),
}),

v.object({
  type: v.literal("replace_mark"),
  text: v.string(),
  oldMarkType: v.union(
    v.literal("bold"),
    v.literal("italic"),
    v.literal("code"),
    v.literal("strike"), 
    v.literal("underline")
  ),
  newMarkType: v.union(
    v.literal("bold"),
    v.literal("italic"),
    v.literal("code"),
    v.literal("strike"),
    v.literal("underline")
  ),
  contextBefore: v.optional(v.string()),
  contextAfter: v.optional(v.string()),
})
```

#### 1.2 Implement Mark Finding Logic
```typescript
// Add to transform function
const findTextWithMark = (doc: any, text: string, markType: string) => {
  const matches: Array<{ start: number; end: number; marks: any[] }> = [];
  
  doc.descendants((node: any, pos: number) => {
    if (node.isText) {
      const textContent = node.text || "";
      let index = 0;
      
      while (true) {
        const foundIndex = textContent.indexOf(text, index);
        if (foundIndex === -1) break;
        
        const start = pos + foundIndex;
        const end = pos + foundIndex + text.length;
        
        // Check if text has the specified mark
        const marks = node.marks || [];
        const hasMark = marks.some((mark: any) => mark.type.name === markType);
        
        if (hasMark) {
          matches.push({ start, end, marks });
        }
        
        index = foundIndex + 1;
      }
    }
  });
  
  return matches;
};
```

#### 1.3 Add Mark Operation Handlers
```typescript
// Add to operation processing loop
if (op.type === "add_mark") {
  const matches = findTextWithMark(tr.doc, op.text, op.markType);
  matches.reverse().forEach(match => {
    const mark = schema.marks[op.markType].create();
    tr = tr.addMark(match.start, match.end, mark);
  });
} else if (op.type === "remove_mark") {
  const matches = findTextWithMark(tr.doc, op.text, op.markType);
  matches.reverse().forEach(match => {
    const mark = schema.marks[op.markType].create();
    tr = tr.removeMark(match.start, match.end, mark);
  });
} else if (op.type === "replace_mark") {
  const matches = findTextWithMark(tr.doc, op.text, op.oldMarkType);
  matches.reverse().forEach(match => {
    const oldMark = schema.marks[op.oldMarkType].create();
    const newMark = schema.marks[op.newMarkType].create();
    tr = tr.removeMark(match.start, match.end, oldMark)
           .addMark(match.start, match.end, newMark);
  });
}
```

### Success Criteria
- [ ] Can add bold, italic, code, strike, underline marks to text
- [ ] Can remove marks from text
- [ ] Can replace one mark type with another
- [ ] Maintains mark hierarchy and nesting
- [ ] Works with existing context matching
- [ ] Comprehensive test coverage

---

## Phase 2: Basic Paragraph Operations
**Duration**: 3-4 days  
**Priority**: High  
**Complexity**: High

### Motivation
Paragraph operations are essential for document structure manipulation. This phase introduces block-level operations while building on the mark operations from Phase 1. It addresses the need to modify document structure beyond just text content.

### Objectives
- Add support for paragraph type conversions
- Implement paragraph add/delete operations
- Handle basic block-level transformations
- Maintain document structure integrity

### Implementation Details

#### 2.1 Extend Operation Types
```typescript
// Add paragraph operation types
v.object({
  type: v.literal("convert_paragraph"),
  findText: v.string(),
  newType: v.union(
    v.literal("paragraph"),
    v.literal("heading"),
    v.literal("blockquote"),
    v.literal("bulletList"),
    v.literal("orderedList"),
    v.literal("codeBlock")
  ),
  headingLevel: v.optional(v.number()),
  contextBefore: v.optional(v.string()),
  contextAfter: v.optional(v.string()),
}),

v.object({
  type: v.literal("add_paragraph"),
  content: v.string(),
  paragraphType: v.union(
    v.literal("paragraph"),
    v.literal("heading"),
    v.literal("blockquote"),
    v.literal("bulletList"),
    v.literal("orderedList"),
    v.literal("codeBlock")
  ),
  headingLevel: v.optional(v.number()),
  afterText: v.optional(v.string()),
  beforeText: v.optional(v.string()),
}),

v.object({
  type: v.literal("delete_paragraph"),
  findText: v.string(),
  contextBefore: v.optional(v.string()),
  contextAfter: v.optional(v.string()),
})
```

#### 2.2 Implement Block Finding Logic
```typescript
const findBlockWithText = (doc: any, text: string) => {
  const matches: Array<{ node: any; pos: number; start: number; end: number }> = [];
  
  doc.descendants((node: any, pos: number) => {
    if (node.isBlock && !node.isText) {
      const blockText = node.textContent || "";
      if (blockText.includes(text)) {
        matches.push({
          node,
          pos,
          start: pos,
          end: pos + node.nodeSize
        });
      }
    }
  });
  
  return matches;
};
```

#### 2.3 Add Block Operation Handlers
```typescript
// Add to operation processing loop
if (op.type === "convert_paragraph") {
  const matches = findBlockWithText(tr.doc, op.findText);
  matches.reverse().forEach(match => {
    const newNode = createNodeOfType(schema, op.newType, match.node.content, op.headingLevel);
    tr = tr.replaceWith(match.start, match.end, newNode);
  });
} else if (op.type === "add_paragraph") {
  const insertPos = findInsertPosition(tr.doc, op.afterText, op.beforeText);
  const newNode = createNodeOfType(schema, op.paragraphType, op.content, op.headingLevel);
  tr = tr.insert(insertPos, newNode);
} else if (op.type === "delete_paragraph") {
  const matches = findBlockWithText(tr.doc, op.findText);
  matches.reverse().forEach(match => {
    tr = tr.delete(match.start, match.end);
  });
}
```

#### 2.4 Helper Functions
```typescript
const createNodeOfType = (schema: any, type: string, content: any, headingLevel?: number) => {
  switch (type) {
    case "paragraph":
      return schema.nodes.paragraph.createAndFill(content);
    case "heading":
      return schema.nodes.heading.createAndFill({ level: headingLevel || 1 }, content);
    case "blockquote":
      return schema.nodes.blockquote.createAndFill(content);
    case "bulletList":
      return schema.nodes.bulletList.createAndFill(content);
    case "orderedList":
      return schema.nodes.orderedList.createAndFill(content);
    case "codeBlock":
      return schema.nodes.codeBlock.createAndFill(content);
    default:
      return schema.nodes.paragraph.createAndFill(content);
  }
};
```

### Success Criteria
- [ ] Can convert paragraphs to headings, blockquotes, lists
- [ ] Can add new paragraphs at specific positions
- [ ] Can delete paragraphs containing specific text
- [ ] Maintains proper document structure
- [ ] Handles edge cases (empty blocks, nested structures)
- [ ] Comprehensive test coverage

---

## Phase 3: Advanced Paragraph Operations
**Duration**: 4-5 days  
**Priority**: Medium  
**Complexity**: Very High

### Motivation
Advanced paragraph operations address complex document restructuring needs. This phase introduces operations that require understanding of document structure and relationships between blocks, enabling sophisticated document manipulation.

### Objectives
- Implement split/merge paragraph operations
- Add list handling and manipulation
- Handle complex block transformations
- Improve error handling and validation

### Implementation Details

#### 3.1 Extend Operation Types
```typescript
// Add advanced paragraph operations
v.object({
  type: v.literal("split_paragraph"),
  splitText: v.string(),
  contextBefore: v.optional(v.string()),
  contextAfter: v.optional(v.string()),
}),

v.object({
  type: v.literal("merge_paragraphs"),
  firstText: v.string(),
  secondText: v.string(),
  contextBefore: v.optional(v.string()),
  contextAfter: v.optional(v.string()),
}),

v.object({
  type: v.literal("wrap_in_list"),
  text: v.string(),
  listType: v.union(v.literal("bulletList"), v.literal("orderedList")),
  contextBefore: v.optional(v.string()),
  contextAfter: v.optional(v.string()),
}),

v.object({
  type: v.literal("unwrap_from_list"),
  text: v.string(),
  contextBefore: v.optional(v.string()),
  contextAfter: v.optional(v.string()),
})
```

#### 3.2 Implement Complex Block Operations
```typescript
const splitParagraphAtText = (tr: any, schema: any, splitText: string) => {
  const matches = findBlockWithText(tr.doc, splitText);
  
  matches.reverse().forEach(match => {
    const node = match.node;
    const text = node.textContent || "";
    const splitIndex = text.indexOf(splitText);
    
    if (splitIndex !== -1) {
      // Create two new paragraphs
      const beforeText = text.substring(0, splitIndex);
      const afterText = text.substring(splitIndex + splitText.length);
      
      const beforeNode = schema.nodes.paragraph.createAndFill(beforeText);
      const afterNode = schema.nodes.paragraph.createAndFill(afterText);
      
      tr = tr.replaceWith(match.start, match.end, [beforeNode, afterNode]);
    }
  });
  
  return tr;
};

const mergeParagraphs = (tr: any, schema: any, firstText: string, secondText: string) => {
  const firstMatches = findBlockWithText(tr.doc, firstText);
  const secondMatches = findBlockWithText(tr.doc, secondText);
  
  // Find adjacent paragraphs
  const adjacentPairs = findAdjacentParagraphs(firstMatches, secondMatches);
  
  adjacentPairs.reverse().forEach(({ first, second }) => {
    const mergedText = (first.node.textContent || "") + " " + (second.node.textContent || "");
    const mergedNode = schema.nodes.paragraph.createAndFill(mergedText);
    
    tr = tr.replaceWith(first.start, second.end, mergedNode);
  });
  
  return tr;
};
```

#### 3.3 List Handling
```typescript
const wrapInList = (tr: any, schema: any, text: string, listType: string) => {
  const matches = findBlockWithText(tr.doc, text);
  
  matches.reverse().forEach(match => {
    const listItem = schema.nodes.listItem.createAndFill(match.node.content);
    const list = schema.nodes[listType].createAndFill(listItem);
    
    tr = tr.replaceWith(match.start, match.end, list);
  });
  
  return tr;
};
```

### Success Criteria
- [ ] Can split paragraphs at specific text
- [ ] Can merge adjacent paragraphs
- [ ] Can wrap paragraphs in lists
- [ ] Can unwrap list items to paragraphs
- [ ] Handles complex nested structures
- [ ] Robust error handling and validation
- [ ] Comprehensive test coverage

---

## Phase 4: Large Document Operations
**Duration**: 5-6 days  
**Priority**: Medium  
**Complexity**: Very High

### Motivation
Large document operations address the performance and accuracy limitations of the text-based approach when dealing with substantial changes. This phase introduces section-based operations that can handle rewrites of entire document sections efficiently.

### Objectives
- Implement section-based operations for large changes
- Add JSON-based document manipulation
- Create hybrid approach with smart routing
- Improve performance for large operations

### Implementation Details

#### 4.1 Section-Based Operations
```typescript
// New operation types for large changes
v.object({
  type: v.literal("replace_section"),
  sectionId: v.string(),
  newContent: v.object({
    type: v.string(),
    content: v.array(v.any()),
    attrs: v.optional(v.any()),
  }),
}),

v.object({
  type: v.literal("insert_section"),
  position: v.union(
    v.object({ afterSectionId: v.string() }),
    v.object({ beforeSectionId: v.string() }),
    v.object({ atIndex: v.number() })
  ),
  content: v.object({
    type: v.string(),
    content: v.array(v.any()),
    attrs: v.optional(v.any()),
  }),
}),

v.object({
  type: v.literal("delete_section"),
  sectionId: v.string(),
})
```

#### 4.2 JSON Manipulation Functions
```typescript
const replaceSectionInJson = (content: any[], sectionId: string, newContent: any) => {
  return content.map(node => {
    if (node.attrs?.sectionId === sectionId) {
      return newContent;
    } else if (node.content) {
      return {
        ...node,
        content: replaceSectionInJson(node.content, sectionId, newContent)
      };
    }
    return node;
  });
};

const insertSectionInJson = (content: any[], position: any, newContent: any) => {
  if (position.atIndex !== undefined) {
    const newContentArray = [...content];
    newContentArray.splice(position.atIndex, 0, newContent);
    return newContentArray;
  }
  
  // Handle after/before sectionId cases
  return content.map(node => {
    if (node.attrs?.sectionId === position.afterSectionId) {
      return [node, newContent];
    } else if (node.attrs?.sectionId === position.beforeSectionId) {
      return [newContent, node];
    } else if (node.content) {
      return {
        ...node,
        content: insertSectionInJson(node.content, position, newContent)
      };
    }
    return node;
  }).flat();
};
```

#### 4.3 Smart Operation Routing
```typescript
const categorizeOperations = (operations: any[]) => {
  const textOperations = operations.filter(op => 
    ['replace', 'insert', 'delete', 'add_mark', 'remove_mark', 'replace_mark'].includes(op.type)
  );
  
  const paragraphOperations = operations.filter(op =>
    ['convert_paragraph', 'add_paragraph', 'delete_paragraph', 'split_paragraph', 'merge_paragraphs'].includes(op.type)
  );
  
  const sectionOperations = operations.filter(op =>
    ['replace_section', 'insert_section', 'delete_section'].includes(op.type)
  );
  
  return { textOperations, paragraphOperations, sectionOperations };
};

const chooseOperationStrategy = (operations: any[]) => {
  const { textOperations, paragraphOperations, sectionOperations } = categorizeOperations(operations);
  
  if (sectionOperations.length > 0) {
    return 'section-based';
  } else if (operations.length > 20 || paragraphOperations.length > 5) {
    return 'hybrid';
  } else {
    return 'text-based';
  }
};
```

#### 4.4 Hybrid Implementation
```typescript
export const applySmartDocumentChanges = mutation({
  args: {
    escritoId: v.id("escritos"),
    changes: v.array(v.any()),
  },
  handler: async (ctx, { escritoId, changes }) => {
    const strategy = chooseOperationStrategy(changes);
    
    switch (strategy) {
      case 'section-based':
        return applySectionBasedChanges(ctx, escritoId, changes);
      case 'hybrid':
        return applyHybridChanges(ctx, escritoId, changes);
      case 'text-based':
        return applyTextBasedOperations(ctx, escritoId, changes);
      default:
        throw new Error(`Unknown strategy: ${strategy}`);
    }
  },
});
```

### Success Criteria
- [ ] Can replace entire document sections
- [ ] Can insert new sections at specific positions
- [ ] Can delete sections by ID
- [ ] Smart routing chooses optimal approach
- [ ] Performance improvement for large operations
- [ ] Maintains document integrity
- [ ] Comprehensive test coverage

---

## Phase 5: Optimization and Polish
**Duration**: 3-4 days  
**Priority**: Low  
**Complexity**: Medium

### Motivation
This phase focuses on performance optimization, error handling, and user experience improvements. It ensures the system is production-ready and handles edge cases gracefully.

### Objectives
- Optimize performance for large documents
- Improve error handling and validation
- Add comprehensive logging and debugging
- Enhance user experience with better feedback

### Implementation Details

#### 5.1 Performance Optimizations
```typescript
// Add operation batching
const batchOperations = (operations: any[]) => {
  const batches = [];
  let currentBatch = [];
  
  for (const op of operations) {
    if (currentBatch.length >= 10) {
      batches.push(currentBatch);
      currentBatch = [];
    }
    currentBatch.push(op);
  }
  
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }
  
  return batches;
};

// Add position caching
const createPositionCache = (doc: any) => {
  const cache = new Map();
  
  doc.descendants((node: any, pos: number) => {
    if (node.isText) {
      const text = node.text || "";
      cache.set(text, (cache.get(text) || []).concat(pos));
    }
  });
  
  return cache;
};
```

#### 5.2 Enhanced Error Handling
```typescript
const validateOperation = (op: any, schema: any) => {
  const errors = [];
  
  if (op.type === "add_mark" && !schema.marks[op.markType]) {
    errors.push(`Mark type '${op.markType}' not found in schema`);
  }
  
  if (op.type === "convert_paragraph" && !schema.nodes[op.newType]) {
    errors.push(`Node type '${op.newType}' not found in schema`);
  }
  
  if (op.headingLevel && (op.headingLevel < 1 || op.headingLevel > 6)) {
    errors.push(`Invalid heading level: ${op.headingLevel}`);
  }
  
  return errors;
};

const applyOperationWithValidation = (tr: any, op: any, schema: any) => {
  const errors = validateOperation(op, schema);
  if (errors.length > 0) {
    throw new Error(`Operation validation failed: ${errors.join(', ')}`);
  }
  
  // Apply operation with try-catch
  try {
    return applyOperation(tr, op, schema);
  } catch (error) {
    console.error(`Failed to apply operation:`, op, error);
    throw new Error(`Operation failed: ${error.message}`);
  }
};
```

#### 5.3 Comprehensive Logging
```typescript
const createOperationLogger = () => {
  return {
    logOperation: (op: any, result: any) => {
      console.log(`[EscritosTransform] Applied operation:`, {
        type: op.type,
        timestamp: new Date().toISOString(),
        result: result
      });
    },
    
    logError: (op: any, error: any) => {
      console.error(`[EscritosTransform] Operation failed:`, {
        type: op.type,
        timestamp: new Date().toISOString(),
        error: error.message,
        stack: error.stack
      });
    },
    
    logPerformance: (operations: any[], duration: number) => {
      console.log(`[EscritosTransform] Performance:`, {
        operationCount: operations.length,
        duration: `${duration}ms`,
        averageTime: `${duration / operations.length}ms per operation`
      });
    }
  };
};
```

### Success Criteria
- [ ] Performance optimized for large documents
- [ ] Comprehensive error handling and validation
- [ ] Detailed logging for debugging
- [ ] Better user feedback and progress indicators
- [ ] Production-ready error recovery
- [ ] Performance monitoring and metrics

---

## Testing Strategy

### Unit Tests
- Test each operation type individually
- Test edge cases and error conditions
- Test mark hierarchy and nesting
- Test block structure integrity

### Integration Tests
- Test operation combinations
- Test with real document structures
- Test performance with large documents
- Test error recovery scenarios

### End-to-End Tests
- Test complete document transformation workflows
- Test user interaction scenarios
- Test performance under load
- Test cross-browser compatibility

## Risk Mitigation

### Technical Risks
- **Complexity**: Break down into smaller, manageable phases
- **Performance**: Implement caching and optimization strategies
- **Compatibility**: Maintain backward compatibility with existing operations

### Timeline Risks
- **Scope Creep**: Stick to defined phase objectives
- **Dependencies**: Ensure proper sequencing of phases
- **Resource Constraints**: Allocate sufficient time for testing and debugging

## Success Metrics

### Phase 1-3 (Text and Paragraph Operations)
- [ ] 100% test coverage for all operation types
- [ ] < 100ms response time for operations on documents < 10KB
- [ ] Zero data loss during transformations
- [ ] 95% accuracy in context matching

### Phase 4-5 (Large Document Operations)
- [ ] < 500ms response time for section operations
- [ ] 50% performance improvement for large changes
- [ ] 99.9% uptime for transformation operations
- [ ] < 1% error rate in production

## Conclusion

This implementation plan provides a structured approach to enhancing the `applyTextBasedOperations` function. Each phase builds upon the previous one, addressing specific use cases and complexity levels. The plan ensures that the system can handle both small, precise edits and large document transformations efficiently and reliably.

The key to success is maintaining the existing system's strengths while gradually introducing more sophisticated capabilities. This approach minimizes risk while maximizing the value delivered to users.
