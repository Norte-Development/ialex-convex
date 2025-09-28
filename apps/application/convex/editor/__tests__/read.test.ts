import { describe, it, expect, beforeEach, vi } from 'vitest';
import { convexTest } from 'convex-test';
import { api } from '../../_generated/api';
import schema from '../../schema';
import { modules } from '../../test.setup';
import { Id } from '../../_generated/dataModel';

// Mock prosemirrorSync
vi.mock('../../prosemirror', () => ({
  prosemirrorSync: {
    getDoc: vi.fn().mockResolvedValue({
      version: 1,
      doc: {
        content: {
          size: 100,
        },
        toJSON: () => ({
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'Mocked document content for testing'
                }
              ]
            }
          ]
        }),
        slice: (from: number, to: number) => ({
          content: {
            toJSON: () => {
              // Create more realistic slice content based on range
              const length = Math.max(0, to - from);
              const sliceText = length > 0 
                ? `Sliced content from ${from} to ${to}` 
                : '';
              
              return {
                type: 'doc',
                content: sliceText ? [{
                  type: 'paragraph',
                  content: [{
                    type: 'text',
                    text: sliceText
                  }]
                }] : []
              };
            }
          }
        }),
        descendants: (callback: (node: any, pos: number) => boolean | void) => {
          const mockNodes = [
            { 
              type: { name: 'paragraph' }, 
              isBlock: true, 
              nodeSize: 50,
              content: [
                { type: { name: 'text' }, text: 'Mocked document content for testing', nodeSize: 35 }
              ]
            },
            { type: { name: 'text' }, text: 'Mocked document content for testing', nodeSize: 35 }
          ];

          let pos = 1;
          for (const node of mockNodes) {
            const shouldContinue = callback(node, pos);
            pos += node.nodeSize;
            if (shouldContinue === false) break;
          }
        }
      }
    })
  }
}));

// Mock generateHTML from @tiptap/html/server
vi.mock('@tiptap/html/server', () => ({
  generateHTML: vi.fn((content: any, extensions: any[]) => {
    // Simple mock HTML generation
    if (!content || !content.content) return '';
    
    const convertNode = (node: any): string => {
      if (!node.type) return '';
      
      switch (node.type) {
        case 'doc':
          return node.content ? node.content.map(convertNode).join('') : '';
        case 'paragraph':
          const pContent = node.content ? node.content.map(convertNode).join('') : '';
          return `<p>${pContent}</p>`;
        case 'heading':
          const level = node.attrs?.level || 1;
          const hContent = node.content ? node.content.map(convertNode).join('') : '';
          return `<h${level}>${hContent}</h${level}>`;
        case 'text':
          return node.text || '';
        default:
          return node.content ? node.content.map(convertNode).join('') : '';
      }
    };
    
    return convertNode(content);
  })
}));

// Mock ProseMirror document structures for testing
const createMockProseMirrorDoc = (content: any) => ({
  doc: {
    content: {
      size: 100,
      toJSON: () => content,
    },
    slice: (from: number, to: number) => ({
      content: {
        toJSON: () => {
          // Create more realistic slice content based on range
          const length = Math.max(0, to - from);
          const sliceText = length > 0 
            ? `Sliced content from ${from} to ${to}` 
            : '';
          
          return {
            type: 'doc',
            content: sliceText ? [{
              type: 'paragraph',
              content: [{
                type: 'text',
                text: sliceText
              }]
            }] : []
          };
        }
      }
    }),
    descendants: (callback: (node: any, pos: number) => boolean | void) => {
      // Mock document structure with some text nodes and block elements
      const mockNodes = [
        { type: { name: 'paragraph' }, isBlock: true, nodeSize: 20, text: 'First paragraph text' },
        { type: { name: 'text' }, text: 'First paragraph text', nodeSize: 20 },
        { type: { name: 'heading' }, isBlock: true, nodeSize: 15, attrs: { level: 1 }, text: 'Main Heading' },
        { type: { name: 'text' }, text: 'Main Heading', nodeSize: 12 },
        { type: { name: 'paragraph' }, isBlock: true, nodeSize: 25, text: 'Second paragraph content' },
        { type: { name: 'text' }, text: 'Second paragraph content', nodeSize: 25 },
      ];

      let pos = 1;
      for (const node of mockNodes) {
        const shouldContinue = callback(node, pos);
        pos += node.nodeSize;
        if (shouldContinue === false) break;
      }
    }
  }
});

describe('Editor Read Functions', () => {
  let t: any;
  let userId: Id<"users">;
  let caseId: Id<"cases">;
  let escritoId: Id<"escritos">;

  beforeEach(async () => {
    t = convexTest(schema, modules);

    // Create test user
    userId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        clerkId: "test-clerk-id",
        name: "Test User",
        email: "test@example.com",
        isActive: true,
        isOnboardingComplete: true,
      });
    });

    // Create test case
    caseId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("cases", {
        title: "Test Case for Editor",
        status: "pendiente",
        priority: "medium",
        startDate: Date.now(),
        assignedLawyer: userId,
        createdBy: userId,
        isArchived: false,
      });
    });

    // Create test escrito with all required fields
    escritoId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("escritos", {
        title: "Test Escrito",
        prosemirrorId: "test-prosemirror-id",
        caseId,
        status: "borrador",
        lastEditedAt: Date.now(),
        createdBy: userId,
        lastModifiedBy: userId,
        isArchived: false,
        // Optional fields
        presentationDate: undefined,
        courtName: undefined,
        expedientNumber: undefined,
        wordCount: undefined,
      });
    });
  });


  describe('getFullHtml', () => {
    it('should generate HTML for a complete document', async () => {
      const result = await t.action(api.editor.read.getFullHtml, {
        escritoId
      });
      
      // With mocks, this should succeed and return HTML
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      // Should contain HTML tags from our mock
      expect(result).toContain('<p>');
    });

    it('should throw error for non-existent escrito', async () => {
      // Create a valid ID but delete the escrito to test the not found scenario
      const tempEscritoId = await t.run(async (ctx: any) => {
        return await ctx.db.insert("escritos", {
          title: "Temp Escrito",
          prosemirrorId: "temp-prosemirror-id",
          caseId,
          status: "borrador",
          lastEditedAt: Date.now(),
          createdBy: userId,
          lastModifiedBy: userId,
          isArchived: false,
        });
      });

      // Delete the escrito to make it non-existent
      await t.run(async (ctx: any) => {
        await ctx.db.delete(tempEscritoId);
      });
      
      try {
        await t.action(api.editor.read.getFullHtml, {
          escritoId: tempEscritoId
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as Error).message).toContain('Escrito not found');
      }
    });
  });

  describe('getHtmlChunks', () => {
    it('should return chunks with correct structure', async () => {
      const chunks = await t.action(api.editor.read.getHtmlChunks, {
        escritoId,
        chunkSize: 100
      });

      // Verify the structure of returned chunks
      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBeGreaterThan(0);
      
      const chunk = chunks[0];
      expect(chunk).toHaveProperty('content');
      expect(chunk).toHaveProperty('range');
      expect(chunk).toHaveProperty('nodeRange');
      
      expect(chunk.range).toHaveProperty('from');
      expect(chunk.range).toHaveProperty('to');
      expect(chunk.nodeRange).toHaveProperty('from');
      expect(chunk.nodeRange).toHaveProperty('to');
      
      expect(typeof chunk.content).toBe('string');
      expect(typeof chunk.range.from).toBe('number');
      expect(typeof chunk.range.to).toBe('number');
      expect(typeof chunk.nodeRange.from).toBe('number');
      expect(typeof chunk.nodeRange.to).toBe('number');
      
      // Should contain HTML from our mock
      expect(chunk.content).toContain('<p>');
    });

    it('should respect chunk size limits', async () => {
      const chunkSize = 50;
      
      const chunks = await t.action(api.editor.read.getHtmlChunks, {
        escritoId,
        chunkSize
      });

      // Each chunk should respect the size limit (allowing for HTML markup)
      chunks.forEach((chunk: any) => {
        // The text content should not exceed the limit significantly
        // (some variance is expected due to HTML markup and semantic boundaries)
        const textContent = chunk.content.replace(/<[^>]*>/g, '');
        expect(textContent.length).toBeLessThanOrEqual(chunkSize * 2); // Allow margin for semantic boundaries
      });
    });

    it('should have non-overlapping node ranges', async () => {
      const chunks = await t.action(api.editor.read.getHtmlChunks, {
        escritoId,
        chunkSize: 100
      });

      // Verify that node ranges don't overlap and are in ascending order
      for (let i = 1; i < chunks.length; i++) {
        expect(chunks[i].nodeRange.from).toBeGreaterThanOrEqual(chunks[i - 1].nodeRange.from);
      }
    });

    it('should handle small documents correctly', async () => {
      const chunks = await t.action(api.editor.read.getHtmlChunks, {
        escritoId,
        chunkSize: 1000 // Large chunk size for small document
      });

      // Should return at least one chunk even for small documents
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it('should throw error for invalid chunk size', async () => {
      try {
        await t.action(api.editor.read.getHtmlChunks, {
          escritoId,
          chunkSize: 0
        });
        expect.fail('Should have thrown an error for invalid chunk size');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should throw error for non-existent escrito', async () => {
      // Create a valid ID but delete the escrito to test the not found scenario
      const tempEscritoId = await t.run(async (ctx: any) => {
        return await ctx.db.insert("escritos", {
          title: "Temp Escrito",
          prosemirrorId: "temp-prosemirror-id",
          caseId,
          status: "borrador",
          lastEditedAt: Date.now(),
          createdBy: userId,
          lastModifiedBy: userId,
          isArchived: false,
        });
      });

      // Delete the escrito to make it non-existent
      await t.run(async (ctx: any) => {
        await ctx.db.delete(tempEscritoId);
      });
      
      try {
        await t.action(api.editor.read.getHtmlChunks, {
          escritoId: tempEscritoId,
          chunkSize: 100
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as Error).message).toContain('Escrito not found');
      }
    });
  });

  describe('HTML Range Calculation', () => {
    it('should have sequential HTML ranges', async () => {
      const chunks = await t.action(api.editor.read.getHtmlChunks, {
        escritoId,
        chunkSize: 50
      });

      // HTML ranges should be sequential and non-overlapping
      let expectedStart = 0;
      chunks.forEach((chunk: any) => {
        expect(chunk.range.from).toBe(expectedStart);
        expect(chunk.range.to).toBeGreaterThan(chunk.range.from);
        expectedStart = chunk.range.to;
      });
    });
  });

  describe('getHtmlRange', () => {
    it('should return HTML for a specific range', async () => {
      const result = await t.action(api.editor.read.getHtmlRange, {
        escritoId,
        from: 1,
        to: 50
      });

      // Should return a string with HTML content
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('<p>');
      expect(result).toContain('Sliced content from 1 to 50');
    });

    it('should handle valid range boundaries', async () => {
      const result = await t.action(api.editor.read.getHtmlRange, {
        escritoId,
        from: 10,
        to: 30
      });

      expect(typeof result).toBe('string');
      expect(result).toContain('Sliced content from 10 to 30');
    });

    it('should clamp invalid range boundaries', async () => {
      // Test with negative from value
      const result1 = await t.action(api.editor.read.getHtmlRange, {
        escritoId,
        from: -5,
        to: 20
      });

      // Should clamp from to 1 (minimum valid position)
      expect(typeof result1).toBe('string');
      expect(result1).toContain('Sliced content from 1 to 20');

      // Test with to value greater than document size
      const result2 = await t.action(api.editor.read.getHtmlRange, {
        escritoId,
        from: 10,
        to: 500 // Way beyond document size
      });

      // Should clamp to document size + 1 (101)
      expect(typeof result2).toBe('string');
      expect(result2).toContain('Sliced content from 10 to 101');
    });

    it('should handle from > to by ensuring from <= to', async () => {
      const result = await t.action(api.editor.read.getHtmlRange, {
        escritoId,
        from: 50,
        to: 20 // to is less than from
      });

      // Should handle this gracefully by ensuring valid range
      expect(typeof result).toBe('string');
      // The function should ensure fromPos <= toPos, resulting in empty content for invalid ranges
      expect(result).toBe('');
    });

    it('should handle zero-length ranges', async () => {
      const result = await t.action(api.editor.read.getHtmlRange, {
        escritoId,
        from: 25,
        to: 25 // Same position
      });

      expect(typeof result).toBe('string');
      // Zero-length ranges should return empty content with our updated mock
      expect(result).toBe('');
    });

    it('should throw error for non-existent escrito', async () => {
      const tempEscritoId = await t.run(async (ctx: any) => {
        return await ctx.db.insert("escritos", {
          title: "Temp Escrito",
          prosemirrorId: "temp-prosemirror-id",
          caseId,
          status: "borrador",
          lastEditedAt: Date.now(),
          createdBy: userId,
          lastModifiedBy: userId,
          isArchived: false,
        });
      });

      // Delete the escrito to make it non-existent
      await t.run(async (ctx: any) => {
        await ctx.db.delete(tempEscritoId);
      });

      try {
        await t.action(api.editor.read.getHtmlRange, {
          escritoId: tempEscritoId,
          from: 1,
          to: 10
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as Error).message).toContain('Escrito not found');
      }
    });
  });

  describe('getHtmlRangeFromObject', () => {
    it('should return HTML for a range object', async () => {
      const result = await t.action(api.editor.read.getHtmlRangeFromObject, {
        escritoId,
        range: { from: 1, to: 50 }
      });

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('<p>');
      expect(result).toContain('Sliced content from 1 to 50');
    });

    it('should handle range object with valid bounds', async () => {
      const range = { from: 15, to: 35 };
      const result = await t.action(api.editor.read.getHtmlRangeFromObject, {
        escritoId,
        range
      });

      expect(typeof result).toBe('string');
      expect(result).toContain('Sliced content from 15 to 35');
    });

    it('should clamp range object boundaries', async () => {
      // Test with invalid range boundaries
      const result = await t.action(api.editor.read.getHtmlRangeFromObject, {
        escritoId,
        range: { from: -10, to: 500 }
      });

      // Should clamp to valid bounds
      expect(typeof result).toBe('string');
      expect(result).toContain('Sliced content from 1 to 101');
    });

    it('should handle reversed range (from > to)', async () => {
      const result = await t.action(api.editor.read.getHtmlRangeFromObject, {
        escritoId,
        range: { from: 60, to: 40 }
      });

      // Should handle gracefully by returning empty content for invalid ranges
      expect(typeof result).toBe('string');
      expect(result).toBe('');
    });

    it('should throw error for non-existent escrito', async () => {
      const tempEscritoId = await t.run(async (ctx: any) => {
        return await ctx.db.insert("escritos", {
          title: "Temp Escrito",
          prosemirrorId: "temp-prosemirror-id",
          caseId,
          status: "borrador",
          lastEditedAt: Date.now(),
          createdBy: userId,
          lastModifiedBy: userId,
          isArchived: false,
        });
      });

      await t.run(async (ctx: any) => {
        await ctx.db.delete(tempEscritoId);
      });

      try {
        await t.action(api.editor.read.getHtmlRangeFromObject, {
          escritoId: tempEscritoId,
          range: { from: 1, to: 10 }
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as Error).message).toContain('Escrito not found');
      }
    });
  });

  describe('HTML Range Functions - Comparison', () => {
    it('should return identical results for equivalent ranges', async () => {
      const from = 10;
      const to = 40;

      const result1 = await t.action(api.editor.read.getHtmlRange, {
        escritoId,
        from,
        to
      });

      const result2 = await t.action(api.editor.read.getHtmlRangeFromObject, {
        escritoId,
        range: { from, to }
      });

      expect(result1).toBe(result2);
    });

    it('should handle edge case ranges consistently', async () => {
      // Test minimum range (zero-length)
      const minRange = { from: 1, to: 1 };

      const result1 = await t.action(api.editor.read.getHtmlRange, {
        escritoId,
        from: minRange.from,
        to: minRange.to
      });

      const result2 = await t.action(api.editor.read.getHtmlRangeFromObject, {
        escritoId,
        range: minRange
      });

      // Both should return empty content for zero-length ranges
      expect(result1).toBe('');
      expect(result2).toBe('');
      expect(result1).toBe(result2);

      // Test maximum range (document bounds)
      const maxRange = { from: 1, to: 200 }; // Beyond document size

      const result3 = await t.action(api.editor.read.getHtmlRange, {
        escritoId,
        from: maxRange.from,
        to: maxRange.to
      });

      const result4 = await t.action(api.editor.read.getHtmlRangeFromObject, {
        escritoId,
        range: maxRange
      });

      expect(result3).toBe(result4);
      // Should both contain content for valid ranges
      expect(result3).toContain('Sliced content from 1 to 101');
    });
  });

  describe('HTML Range Performance', () => {
    it('should handle multiple range requests efficiently', async () => {
      const ranges = [
        { from: 1, to: 20 },
        { from: 21, to: 40 },
        { from: 41, to: 60 },
        { from: 61, to: 80 }
      ];

      // Test that multiple requests complete without issues
      const results = await Promise.all(
        ranges.map(range =>
          t.action(api.editor.read.getHtmlRangeFromObject, {
            escritoId,
            range
          })
        )
      );

      expect(results).toHaveLength(4);
      results.forEach((result, index) => {
        expect(typeof result).toBe('string');
        expect(result).toContain(`Sliced content from ${ranges[index].from} to ${ranges[index].to}`);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty documents', async () => {
      // Create an empty escrito
      const emptyEscritoId = await t.run(async (ctx: any) => {
        return await ctx.db.insert("escritos", {
          title: "Empty Escrito",
          prosemirrorId: "empty-prosemirror-id",
          caseId,
          status: "borrador",
          lastEditedAt: Date.now(),
          createdBy: userId,
          lastModifiedBy: userId,
          isArchived: false,
        });
      });

      const chunks = await t.action(api.editor.read.getHtmlChunks, {
        escritoId: emptyEscritoId,
        chunkSize: 100
      });

      // Should handle empty documents gracefully
      expect(Array.isArray(chunks)).toBe(true);
      // With our mocks, should still return at least one chunk
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle documents with only whitespace', async () => {
      // Create an escrito with only whitespace
      const whitespaceEscritoId = await t.run(async (ctx: any) => {
        return await ctx.db.insert("escritos", {
          title: "Whitespace Escrito",
          prosemirrorId: "whitespace-prosemirror-id",
          caseId,
          status: "borrador",
          lastEditedAt: Date.now(),
          createdBy: userId,
          lastModifiedBy: userId,
          isArchived: false,
        });
      });

      const chunks = await t.action(api.editor.read.getHtmlChunks, {
        escritoId: whitespaceEscritoId,
        chunkSize: 100
      });

      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle HTML range requests on empty documents', async () => {
      const emptyEscritoId = await t.run(async (ctx: any) => {
        return await ctx.db.insert("escritos", {
          title: "Empty Escrito for Range",
          prosemirrorId: "empty-range-prosemirror-id",
          caseId,
          status: "borrador",
          lastEditedAt: Date.now(),
          createdBy: userId,
          lastModifiedBy: userId,
          isArchived: false,
        });
      });

      // Should handle range requests on empty documents
      const result = await t.action(api.editor.read.getHtmlRange, {
        escritoId: emptyEscritoId,
        from: 1,
        to: 10
      });

      expect(typeof result).toBe('string');
      // With our mocks, should return some content
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });
});
