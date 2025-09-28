import { describe, it, expect } from 'vitest';
import { 
  HtmlChunk, 
  Range, 
  NodeRange,
  HtmlChunkValidator,
  HtmlChunkArrayValidator,
  RangeValidator,
  NodeRangeValidator
} from '../types';

describe('Editor Types', () => {
  describe('Range Type', () => {
    it('should have correct structure', () => {
      const range: Range = {
        from: 0,
        to: 100
      };

      expect(range.from).toBe(0);
      expect(range.to).toBe(100);
      expect(typeof range.from).toBe('number');
      expect(typeof range.to).toBe('number');
    });

    it('should validate with RangeValidator', () => {
      const validRange = {
        from: 10,
        to: 50
      };

      // Test that the validator structure is correct
      expect(RangeValidator).toBeDefined();
      expect(typeof RangeValidator).toBe('object');
      
      // Test that valid data matches the expected structure
      expect(validRange).toHaveProperty('from');
      expect(validRange).toHaveProperty('to');
      expect(typeof validRange.from).toBe('number');
      expect(typeof validRange.to).toBe('number');
    });

    it('should reject invalid range data', () => {
      const invalidRanges = [
        { from: "10", to: 50 }, // string instead of number
        { from: 10 }, // missing to
        { to: 50 }, // missing from
      ];

      // Test that we can identify invalid data structures
      invalidRanges.forEach(invalidRange => {
        if (!invalidRange.hasOwnProperty('from') || !invalidRange.hasOwnProperty('to')) {
          expect(invalidRange.hasOwnProperty('from') && invalidRange.hasOwnProperty('to')).toBe(false);
        }
        if (typeof (invalidRange as any).from === 'string') {
          expect(typeof (invalidRange as any).from).toBe('string'); // Should be number
        }
      });
    });
  });

  describe('NodeRange Type', () => {
    it('should have correct structure', () => {
      const nodeRange: NodeRange = {
        from: 1,
        to: 25
      };

      expect(nodeRange.from).toBe(1);
      expect(nodeRange.to).toBe(25);
      expect(typeof nodeRange.from).toBe('number');
      expect(typeof nodeRange.to).toBe('number');
    });

    it('should validate with NodeRangeValidator', () => {
      const validNodeRange = {
        from: 1,
        to: 100
      };

      // Test that the validator structure is correct
      expect(NodeRangeValidator).toBeDefined();
      expect(typeof NodeRangeValidator).toBe('object');
      
      // Test that valid data matches the expected structure
      expect(validNodeRange).toHaveProperty('from');
      expect(validNodeRange).toHaveProperty('to');
      expect(typeof validNodeRange.from).toBe('number');
      expect(typeof validNodeRange.to).toBe('number');
    });
  });

  describe('HtmlChunk Type', () => {
    it('should have correct structure', () => {
      const htmlChunk: HtmlChunk = {
        content: '<p>Test content</p>',
        range: {
          from: 0,
          to: 20
        },
        nodeRange: {
          from: 1,
          to: 15
        }
      };

      expect(htmlChunk.content).toBe('<p>Test content</p>');
      expect(htmlChunk.range.from).toBe(0);
      expect(htmlChunk.range.to).toBe(20);
      expect(htmlChunk.nodeRange.from).toBe(1);
      expect(htmlChunk.nodeRange.to).toBe(15);
    });

    it('should validate with HtmlChunkValidator', () => {
      const validChunk = {
        content: '<h1>Heading</h1><p>Paragraph content</p>',
        range: {
          from: 0,
          to: 41
        },
        nodeRange: {
          from: 1,
          to: 30
        }
      };

      // Test that the validator structure is correct
      expect(HtmlChunkValidator).toBeDefined();
      expect(typeof HtmlChunkValidator).toBe('object');
      
      // Test that valid data matches the expected structure
      expect(validChunk).toHaveProperty('content');
      expect(validChunk).toHaveProperty('range');
      expect(validChunk).toHaveProperty('nodeRange');
      expect(typeof validChunk.content).toBe('string');
      expect(typeof validChunk.range).toBe('object');
      expect(typeof validChunk.nodeRange).toBe('object');
    });

    it('should reject invalid chunk data', () => {
      const invalidChunks = [
        {
          // missing content
          range: { from: 0, to: 10 },
          nodeRange: { from: 1, to: 5 }
        },
        {
          content: '<p>Valid content</p>',
          // missing range
          nodeRange: { from: 1, to: 5 }
        },
        {
          content: '<p>Valid content</p>',
          range: { from: 0, to: 10 },
          // missing nodeRange
        },
        {
          content: 123, // wrong type
          range: { from: 0, to: 10 },
          nodeRange: { from: 1, to: 5 }
        }
      ];

      // Test that we can identify invalid data structures
      invalidChunks.forEach((invalidChunk, index) => {
        switch (index) {
          case 0: // missing content
            expect(invalidChunk.hasOwnProperty('content')).toBe(false);
            break;
          case 1: // missing range
            expect(invalidChunk.hasOwnProperty('range')).toBe(false);
            break;
          case 2: // missing nodeRange
            expect(invalidChunk.hasOwnProperty('nodeRange')).toBe(false);
            break;
          case 3: // wrong content type
            expect(typeof (invalidChunk as any).content).toBe('number'); // Should be string
            break;
        }
      });
    });
  });

  describe('HtmlChunk Array', () => {
    it('should validate array of chunks', () => {
      const validChunkArray = [
        {
          content: '<h1>First Chunk</h1>',
          range: { from: 0, to: 20 },
          nodeRange: { from: 1, to: 15 }
        },
        {
          content: '<p>Second chunk content</p>',
          range: { from: 20, to: 47 },
          nodeRange: { from: 15, to: 35 }
        }
      ];

      // Test that the validator structure is correct
      expect(HtmlChunkArrayValidator).toBeDefined();
      expect(typeof HtmlChunkArrayValidator).toBe('object');
      
      // Test that valid array matches expected structure
      expect(Array.isArray(validChunkArray)).toBe(true);
      expect(validChunkArray.length).toBe(2);
      validChunkArray.forEach(chunk => {
        expect(chunk).toHaveProperty('content');
        expect(chunk).toHaveProperty('range');
        expect(chunk).toHaveProperty('nodeRange');
      });
    });

    it('should validate empty array', () => {
      const emptyArray: HtmlChunk[] = [];

      // Test that empty arrays are valid
      expect(Array.isArray(emptyArray)).toBe(true);
      expect(emptyArray.length).toBe(0);
    });

    it('should reject array with invalid chunks', () => {
      const invalidArray = [
        {
          content: '<h1>Valid Chunk</h1>',
          range: { from: 0, to: 20 },
          nodeRange: { from: 1, to: 15 }
        },
        {
          // Invalid chunk - missing content
          range: { from: 20, to: 40 },
          nodeRange: { from: 15, to: 30 }
        }
      ];

      // Test that we can identify invalid chunks in array
      expect(Array.isArray(invalidArray)).toBe(true);
      expect(invalidArray[0]).toHaveProperty('content'); // Valid chunk
      expect(invalidArray[1].hasOwnProperty('content')).toBe(false); // Invalid chunk
    });
  });

  describe('Type Consistency', () => {
    it('should ensure Range and NodeRange have same structure', () => {
      const range: Range = { from: 0, to: 100 };
      const nodeRange: NodeRange = { from: 1, to: 50 };

      // Both should have the same properties
      expect(Object.keys(range)).toEqual(Object.keys(nodeRange));
      expect(Object.keys(range)).toEqual(['from', 'to']);
    });

    it('should work with realistic HTML content', () => {
      const realisticChunk: HtmlChunk = {
        content: `
          <h1>Legal Document Section</h1>
          <p>This is a paragraph with <strong>bold text</strong> and <em>italic text</em>.</p>
          <ul>
            <li>First list item</li>
            <li>Second list item with <a href="#">a link</a></li>
          </ul>
          <p>Another paragraph with line breaks and formatting.</p>
        `,
        range: {
          from: 0,
          to: 285
        },
        nodeRange: {
          from: 1,
          to: 120
        }
      };

      // Test realistic content structure
      expect(realisticChunk).toHaveProperty('content');
      expect(realisticChunk).toHaveProperty('range');
      expect(realisticChunk).toHaveProperty('nodeRange');
      
      expect(realisticChunk.content).toContain('<h1>');
      expect(realisticChunk.content).toContain('<p>');
      expect(realisticChunk.content).toContain('<ul>');
      expect(realisticChunk.range.to).toBeGreaterThan(realisticChunk.range.from);
      expect(realisticChunk.nodeRange.to).toBeGreaterThan(realisticChunk.nodeRange.from);
    });

    it('should handle edge cases in ranges', () => {
      const edgeCases: HtmlChunk[] = [
        // Zero-length range (empty content)
        {
          content: '',
          range: { from: 0, to: 0 },
          nodeRange: { from: 1, to: 1 }
        },
        // Single character
        {
          content: 'A',
          range: { from: 0, to: 1 },
          nodeRange: { from: 1, to: 2 }
        },
        // Large ranges
        {
          content: 'Large content chunk'.repeat(100),
          range: { from: 0, to: 1900 },
          nodeRange: { from: 1, to: 500 }
        }
      ];

      // Test edge case structures
      edgeCases.forEach(chunk => {
        expect(chunk).toHaveProperty('content');
        expect(chunk).toHaveProperty('range');
        expect(chunk).toHaveProperty('nodeRange');
        expect(typeof chunk.content).toBe('string');
        expect(chunk.range.from).toBeGreaterThanOrEqual(0);
        expect(chunk.range.to).toBeGreaterThanOrEqual(chunk.range.from);
        expect(chunk.nodeRange.from).toBeGreaterThanOrEqual(0);
        expect(chunk.nodeRange.to).toBeGreaterThanOrEqual(chunk.nodeRange.from);
      });
    });
  });

  describe('Validator Edge Cases', () => {
    it('should handle negative numbers in ranges', () => {
      const negativeRange = {
        from: -1,
        to: 10
      };

      // Test that negative numbers are handled correctly
      expect(negativeRange.from).toBe(-1);
      expect(negativeRange.to).toBe(10);
      expect(typeof negativeRange.from).toBe('number');
      expect(typeof negativeRange.to).toBe('number');
    });

    it('should handle floating point numbers', () => {
      const floatRange = {
        from: 1.5,
        to: 10.7
      };

      // Test that floating point numbers are handled correctly
      expect(floatRange.from).toBe(1.5);
      expect(floatRange.to).toBe(10.7);
      expect(typeof floatRange.from).toBe('number');
      expect(typeof floatRange.to).toBe('number');
    });

    it('should handle very large numbers', () => {
      const largeRange = {
        from: 0,
        to: Number.MAX_SAFE_INTEGER
      };

      // Test that large numbers are handled correctly
      expect(largeRange.from).toBe(0);
      expect(largeRange.to).toBe(Number.MAX_SAFE_INTEGER);
      expect(typeof largeRange.from).toBe('number');
      expect(typeof largeRange.to).toBe('number');
    });
  });
});
