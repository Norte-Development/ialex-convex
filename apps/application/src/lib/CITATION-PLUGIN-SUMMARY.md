# Citation Plugin Implementation Summary

## What Was Done

Successfully migrated from regex-based citation parsing to a unified remark plugin approach.

## Changes Made

### 1. Created Remark Citation Plugin (`src/lib/remark-citation.ts`)
- **Purpose**: Custom remark plugin that transforms `[CIT:type:id]` syntax into AST nodes
- **How it works**: 
  - Traverses markdown AST looking for text nodes containing citations
  - Splits text nodes at citation boundaries
  - Creates custom `citation` nodes with metadata for rendering
- **Features**:
  - Context-aware parsing (understands markdown structure)
  - Handles multiple citations per text node
  - Supports citations at start, middle, or end of text
  - Configurable with options (className, strict mode)
  - Fully tested (9 passing tests)

### 2. Created React Component Mapping (`src/lib/markdown-components.tsx`)
- **Purpose**: Maps citation AST nodes to React `CitationBadge` components
- **Components**:
  - `CitationBadge`: Displays clickable badges with color coding by type
  - `createMarkdownComponents`: Factory function that creates component mappings
- **Features**:
  - Color-coded badges (leg=blue, doc=green, fallo=purple)
  - Click handlers for interactivity
  - Reusable across the application

### 3. Updated Response Component (`src/components/ai-elements/response.tsx`)
- **Changes**:
  - Added `onCitationClick` prop
  - Configured `remarkPlugins` with `[remarkGfm, remarkCitation]`
  - Passes custom components to Streamdown
- **Result**: All markdown rendering now uses the unified plugin pipeline

### 4. Simplified MessageText Component (`src/components/ai-elements/message-text.tsx`)
- **Before**: 119 lines with manual regex parsing
- **After**: 43 lines, delegates to Response component
- **Removed**:
  - Manual regex citation parsing logic
  - Manual text splitting and React node creation
  - Duplicate CitationBadge implementation

### 5. Removed Legacy Code
- **Deleted**: `citation-parser.tsx` (no longer needed)
- **Unified**: Now only one citation parsing approach across the entire app

## Architecture Benefits

### ✅ Single Source of Truth
- One plugin handles all citation parsing
- No duplicate logic between user and assistant messages
- Easier to maintain and extend

### ✅ Context-Aware Parsing
- Understands markdown structure (paragraphs, lists, blockquotes)
- Won't parse citations in code blocks
- Properly handles nested markdown features

### ✅ Type-Safe
- Full TypeScript support with proper AST types
- Custom `CitationNode` interface
- Compile-time error checking

### ✅ Testable
- Unit tests for plugin logic
- Tests cover edge cases (adjacent citations, positions, lists)
- All 9 tests passing

### ✅ Composable
- Works alongside other remark plugins (remark-gfm)
- Clean plugin pipeline
- Easy to add new plugins

### ✅ Performance
- Single-pass parsing
- Early exit optimizations
- No redundant regex operations

## How It Works

```
Markdown Text
    ↓
Remark Parser (remarkParse)
    ↓
Markdown AST
    ↓
Remark GFM Plugin (tables, strikethrough, etc.)
    ↓
Remark Citation Plugin (transforms [CIT:type:id])
    ↓
Enhanced AST with Citation Nodes
    ↓
Streamdown Renderer
    ↓
React Components (via component mapping)
    ↓
CitationBadge Components
```

## Usage

### Basic Usage
```tsx
<MessageText
  text="Check this law [CIT:leg:abc123] for details."
  renderMarkdown={true}
  onCitationClick={(id, type) => {
    console.log('Citation clicked:', { id, type });
  }}
/>
```

### SidebarMessage Usage (Already Integrated)
```tsx
<MessageText
  text={displayText}
  renderMarkdown={true}
  onCitationClick={!isUser ? (id, type) => {
    setOpen(true);
    setNormativeId(id);
  } : undefined}
/>
```

## Citation Format

Citations follow the format: `[CIT:type:id]`

- **type**: Citation type (leg, doc, fallo)
- **id**: Unique identifier for the citation

Examples:
- `[CIT:leg:abc123]` → Blue "Ley" badge
- `[CIT:doc:xyz789]` → Green "Doc" badge  
- `[CIT:fallo:case456]` → Purple "Fallo" badge

## Testing

All tests passing:
```bash
pnpm test remark-citation

✓ should parse a single citation correctly
✓ should parse multiple citations in one text node
✓ should handle citations at the start of text
✓ should handle citations at the end of text
✓ should handle adjacent citations
✓ should not parse text without citations
✓ should handle citations in lists
✓ should add correct data attributes to citation nodes
✓ should handle custom className option
```

## Files Modified/Created

### Created:
- `src/lib/remark-citation.ts` (184 lines)
- `src/lib/markdown-components.tsx` (111 lines)
- `src/lib/__tests__/remark-citation.test.ts` (216 lines)
- `src/lib/CITATION-PLUGIN-SUMMARY.md` (this file)

### Modified:
- `src/components/ai-elements/response.tsx` (simplified, added plugin support)
- `src/components/ai-elements/message-text.tsx` (drastically simplified: 119 → 43 lines)

### Deleted:
- `src/components/ai-elements/citation-parser.tsx` (82 lines, no longer needed)

### Dependencies Added:
- `unist-util-visit` (AST traversal)
- `@types/mdast` (TypeScript types for markdown AST)
- `@types/unist` (TypeScript types for unified AST)
- `@types/hast` (TypeScript types for HTML AST)
- `unified` (unified processing framework)
- `remark-parse` (markdown parser for testing)

## Future Enhancements

Potential improvements that can be easily added:

1. **Metadata Extraction**: Extract all citations from a document
2. **Validation**: Strict citation format validation with warnings
3. **Multiple Formats**: Support alternative citation syntaxes
4. **Citation Registry**: Track which citations are used where
5. **Broken Citations**: Detect and highlight invalid citation references
6. **Citation Tooltips**: Show preview on hover
7. **Export Citations**: Generate bibliography/reference list

## Migration Notes

No migration needed! The new implementation:
- ✅ Uses the same `[CIT:type:id]` format
- ✅ Has the same `onCitationClick` API
- ✅ Renders the same CitationBadge components
- ✅ Works in all existing locations (SidebarMessage, etc.)

The change is transparent to consumers of MessageText component.
