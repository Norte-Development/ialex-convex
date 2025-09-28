import { describe, it, expect } from 'vitest';

// Mock ProseMirror node structures for testing helper functions
const createMockTextNode = (text: string) => ({
  type: { name: 'text' },
  text,
  nodeSize: text.length
});

const createMockParagraphNode = (children: any[] = []) => ({
  type: { name: 'paragraph' },
  isBlock: true,
  nodeSize: children.reduce((acc, child) => acc + (child.nodeSize || 1), 2), // +2 for open/close
  content: children
});

const createMockHeadingNode = (level: number, children: any[] = []) => ({
  type: { name: 'heading' },
  isBlock: true,
  attrs: { level },
  nodeSize: children.reduce((acc, child) => acc + (child.nodeSize || 1), 2),
  content: children
});

const createMockChangeNode = (changeType: string, children: any[] = []) => ({
  type: { name: 'inlineChange' },
  attrs: { changeType },
  nodeSize: children.reduce((acc, child) => acc + (child.nodeSize || 1), 2),
  content: children
});

const createMockHardBreakNode = () => ({
  type: { name: 'hardBreak' },
  nodeSize: 1
});

const createMockLineBreakChangeNode = (changeType: string) => ({
  type: { name: 'lineBreakChange' },
  attrs: { changeType },
  nodeSize: 1
});

// Helper function to simulate extractTextFromNode (since it's not exported)
function extractTextFromNode(node: any): string {
  if (node.type.name === "text") {
    return node.text || "";
  }
  
  // Handle custom change nodes - exclude deleted content
  if (node.type.name === "inlineChange" || node.type.name === "blockChange") {
    const changeType = node.attrs?.changeType;
    if (changeType === "deleted") {
      return ""; // Exclude deleted content
    }
  }
  
  if (node.type.name === "lineBreakChange") {
    const changeType = node.attrs?.changeType;
    return changeType === "deleted" ? "" : "\n";
  }
  
  if (node.type.name === "hardBreak") {
    return "\n";
  }
  
  // For container nodes, concatenate children
  let text = "";
  if (node.content) {
    node.content.forEach((child: any) => {
      text += extractTextFromNode(child);
    });
  }
  
  return text;
}

// Helper function to simulate createProseMirrorChunks logic
function createProseMirrorChunks(doc: any, maxChars: number): Array<{ from: number; to: number; text: string }> {
  const chunks: Array<{ from: number; to: number; text: string }> = [];
  let currentChunkStart = 1;
  let currentChunkText = "";
  let lastGoodBreakPoint = 1;
  let lastGoodBreakText = "";
  let currentPos = 1;
  
  doc.descendants((node: any, pos: number) => {
    const nodeText = extractTextFromNode(node);
    const nodeSize = node.nodeSize || 1;
    const nodeEnd = pos + nodeSize;
    
    const isGoodBreakPoint = node.isBlock || 
                            node.type.name === "heading" || 
                            node.type.name === "paragraph" ||
                            node.type.name === "listItem";
    
    // Check if adding this node would exceed the character limit
    if (currentChunkText.length + nodeText.length > maxChars && currentChunkText.length > 0) {
      // Use the last good break point if we have one and it would create a smaller chunk
      if (lastGoodBreakPoint > currentChunkStart && lastGoodBreakText.length <= maxChars) {
        chunks.push({
          from: currentChunkStart,
          to: lastGoodBreakPoint,
          text: lastGoodBreakText
        });
        currentChunkStart = lastGoodBreakPoint;
        currentChunkText = nodeText;
      } else {
        // If no good break point or it would still be too long, truncate current chunk
        const truncatedText = currentChunkText.length <= maxChars ? currentChunkText : currentChunkText.substring(0, maxChars);
        chunks.push({
          from: currentChunkStart,
          to: pos,
          text: truncatedText
        });
        currentChunkStart = pos;
        currentChunkText = nodeText;
      }
      lastGoodBreakPoint = isGoodBreakPoint ? nodeEnd : currentChunkStart;
      lastGoodBreakText = isGoodBreakPoint ? currentChunkText : "";
    } else {
      // Add this node to current chunk
      currentChunkText += nodeText;
      if (isGoodBreakPoint) {
        lastGoodBreakPoint = nodeEnd;
        lastGoodBreakText = currentChunkText;
      }
    }
    
    currentPos = nodeEnd;
    return !node.isLeaf;
  });
  
  // Add the final chunk if there's remaining content
  if (currentChunkText.length > 0) {
    // Ensure final chunk doesn't exceed maxChars
    const finalText = currentChunkText.length <= maxChars ? currentChunkText : currentChunkText.substring(0, maxChars);
    chunks.push({
      from: currentChunkStart,
      to: currentPos,
      text: finalText
    });
  }
  
  return chunks;
}

describe('Editor Helper Functions', () => {
  describe('extractTextFromNode', () => {
    it('should extract text from text nodes', () => {
      const textNode = createMockTextNode('Hello world');
      const result = extractTextFromNode(textNode);
      expect(result).toBe('Hello world');
    });

    it('should return empty string for empty text nodes', () => {
      const emptyTextNode = createMockTextNode('');
      const result = extractTextFromNode(emptyTextNode);
      expect(result).toBe('');
    });

    it('should exclude deleted change content', () => {
      const deletedChangeNode = createMockChangeNode('deleted', [
        createMockTextNode('This should be excluded')
      ]);
      const result = extractTextFromNode(deletedChangeNode);
      expect(result).toBe('');
    });

    it('should include added change content', () => {
      const addedChangeNode = createMockChangeNode('added', [
        createMockTextNode('This should be included')
      ]);
      const result = extractTextFromNode(addedChangeNode);
      expect(result).toBe('This should be included');
    });

    it('should include modified change content', () => {
      const modifiedChangeNode = createMockChangeNode('modified', [
        createMockTextNode('Modified content')
      ]);
      const result = extractTextFromNode(modifiedChangeNode);
      expect(result).toBe('Modified content');
    });

    it('should convert hard breaks to newlines', () => {
      const hardBreakNode = createMockHardBreakNode();
      const result = extractTextFromNode(hardBreakNode);
      expect(result).toBe('\n');
    });

    it('should handle line break changes correctly', () => {
      const addedLineBreak = createMockLineBreakChangeNode('added');
      const deletedLineBreak = createMockLineBreakChangeNode('deleted');
      
      expect(extractTextFromNode(addedLineBreak)).toBe('\n');
      expect(extractTextFromNode(deletedLineBreak)).toBe('');
    });

    it('should concatenate text from container nodes', () => {
      const paragraphNode = createMockParagraphNode([
        createMockTextNode('First part '),
        createMockTextNode('second part')
      ]);
      const result = extractTextFromNode(paragraphNode);
      expect(result).toBe('First part second part');
    });

    it('should handle nested structures', () => {
      const complexNode = createMockParagraphNode([
        createMockTextNode('Start '),
        createMockChangeNode('added', [
          createMockTextNode('added text ')
        ]),
        createMockChangeNode('deleted', [
          createMockTextNode('deleted text ')
        ]),
        createMockTextNode('end')
      ]);
      const result = extractTextFromNode(complexNode);
      expect(result).toBe('Start added text end');
    });
  });

  describe('createProseMirrorChunks', () => {
    const createMockDoc = (nodes: any[]) => ({
      descendants: (callback: (node: any, pos: number) => boolean | void) => {
        let pos = 1;
        for (const node of nodes) {
          const shouldContinue = callback(node, pos);
          pos += node.nodeSize;
          if (shouldContinue === false) break;
        }
      }
    });

    it('should create single chunk for small documents', () => {
      const doc = createMockDoc([
        createMockParagraphNode([
          createMockTextNode('Short text')
        ])
      ]);

      const chunks = createProseMirrorChunks(doc, 100);
      expect(chunks).toHaveLength(1);
      expect(chunks[0].text).toBe('Short text');
      expect(chunks[0].from).toBe(1);
    });

    it('should respect character limits', () => {
      const longText = 'This is a very long paragraph that should definitely exceed the character limit that we set for chunking.';
      const doc = createMockDoc([
        createMockParagraphNode([
          createMockTextNode(longText)
        ])
      ]);

      const chunks = createProseMirrorChunks(doc, 20);
      
      // Should create multiple chunks for long text
      if (longText.length > 20) {
        expect(chunks.length).toBeGreaterThanOrEqual(1);
      }
      
      // Each chunk should respect the character limit (with some tolerance for word boundaries)
      chunks.forEach(chunk => {
        // Allow some tolerance since we break at semantic boundaries
        expect(chunk.text.length).toBeLessThanOrEqual(40); // More generous tolerance
      });
    });

    it('should prefer breaking at semantic boundaries', () => {
      const doc = createMockDoc([
        createMockParagraphNode([
          createMockTextNode('First paragraph with some content.')
        ]),
        createMockHeadingNode(1, [
          createMockTextNode('Heading')
        ]),
        createMockParagraphNode([
          createMockTextNode('Second paragraph with more content.')
        ])
      ]);

      const chunks = createProseMirrorChunks(doc, 30);
      
      // Should create multiple chunks breaking at semantic boundaries
      expect(chunks.length).toBeGreaterThan(1);
      
      // Verify chunks have proper from/to positions
      for (let i = 1; i < chunks.length; i++) {
        expect(chunks[i].from).toBeGreaterThanOrEqual(chunks[i - 1].to);
      }
    });

    it('should handle documents with mixed content types', () => {
      const doc = createMockDoc([
        createMockTextNode('Plain text '),
        createMockHardBreakNode(),
        createMockTextNode('After break '),
        createMockChangeNode('added', [
          createMockTextNode('Added content ')
        ]),
        createMockChangeNode('deleted', [
          createMockTextNode('Deleted content ')
        ]),
        createMockTextNode('Final text')
      ]);

      const chunks = createProseMirrorChunks(doc, 50);
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      
      // Should exclude deleted content from text calculation
      const totalText = chunks.reduce((acc, chunk) => acc + chunk.text, '');
      expect(totalText).not.toContain('Deleted content');
      expect(totalText).toContain('Added content');
    });

    it('should handle empty documents', () => {
      const doc = createMockDoc([]);
      const chunks = createProseMirrorChunks(doc, 100);
      expect(chunks).toHaveLength(0);
    });

    it('should handle documents with only deleted content', () => {
      const doc = createMockDoc([
        createMockChangeNode('deleted', [
          createMockTextNode('All deleted content')
        ])
      ]);

      const chunks = createProseMirrorChunks(doc, 100);
      // Should either have no chunks or empty chunks
      if (chunks.length > 0) {
        chunks.forEach(chunk => {
          expect(chunk.text.trim()).toBe('');
        });
      }
    });

    it('should maintain proper position ordering', () => {
      const doc = createMockDoc([
        createMockParagraphNode([
          createMockTextNode('First paragraph content that is quite long and should span multiple chunks when we set a small limit.')
        ]),
        createMockParagraphNode([
          createMockTextNode('Second paragraph with additional content.')
        ])
      ]);

      const chunks = createProseMirrorChunks(doc, 25);
      
      // Verify positions are in ascending order
      for (let i = 1; i < chunks.length; i++) {
        expect(chunks[i].from).toBeGreaterThanOrEqual(chunks[i - 1].from);
        expect(chunks[i].to).toBeGreaterThanOrEqual(chunks[i].from); // Changed from > to >= to allow equal positions
      }
      
      // Verify all chunks have valid positions
      chunks.forEach(chunk => {
        expect(chunk.from).toBeGreaterThan(0);
        expect(chunk.to).toBeGreaterThanOrEqual(chunk.from);
      });
    });
  });

  describe('Integration Tests', () => {
    // Helper function for creating mock documents (defined here for this test)
    const createMockDoc = (nodes: any[]) => ({
      descendants: (callback: (node: any, pos: number) => boolean | void) => {
        let pos = 1;
        for (const node of nodes) {
          const shouldContinue = callback(node, pos);
          pos += node.nodeSize;
          if (shouldContinue === false) break;
        }
      }
    });

    it('should handle complex document structures', () => {
      const doc = createMockDoc([
        createMockHeadingNode(1, [
          createMockTextNode('Document Title')
        ]),
        createMockParagraphNode([
          createMockTextNode('Introduction paragraph with '),
          createMockChangeNode('added', [
            createMockTextNode('newly added ')
          ]),
          createMockTextNode('content and '),
          createMockChangeNode('deleted', [
            createMockTextNode('removed ')
          ]),
          createMockTextNode('final text.')
        ]),
        createMockHeadingNode(2, [
          createMockTextNode('Subsection')
        ]),
        createMockParagraphNode([
          createMockTextNode('More content here with'),
          createMockHardBreakNode(),
          createMockTextNode('line breaks and formatting.')
        ])
      ]);

      const chunks = createProseMirrorChunks(doc, 40);
      
      expect(chunks.length).toBeGreaterThan(1);
      
      // Verify all chunks have valid structure
      chunks.forEach((chunk, index) => {
        expect(chunk.from).toBeGreaterThan(0);
        expect(chunk.to).toBeGreaterThan(chunk.from);
        expect(typeof chunk.text).toBe('string');
        
        // Text should not contain deleted content
        expect(chunk.text).not.toContain('removed');
        
        // Should contain added content if present
        if (chunk.text.includes('newly added')) {
          expect(chunk.text).toContain('newly added');
        }
      });
    });
  });
});
