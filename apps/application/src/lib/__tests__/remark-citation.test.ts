import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkCitation from '../remark-citation';
import type { Root } from 'mdast';
import type { CitationNode } from '../remark-citation';

describe('remarkCitation', () => {
  it('should parse a single citation correctly', async () => {
    const processor = unified()
      .use(remarkParse)
      .use(remarkCitation);

    const markdown = 'Check this law [CIT:leg:abc123] for details.';
    const result = processor.parse(markdown);
    processor.runSync(result as Root);

    // Find the paragraph node
    const paragraph = (result as Root).children[0];
    expect(paragraph.type).toBe('paragraph');

    // Check that we have 3 children: text, citation, text
    if ('children' in paragraph) {
      expect(paragraph.children).toHaveLength(3);
      
      // First child: text before citation
      expect(paragraph.children[0].type).toBe('text');
      expect((paragraph.children[0] as any).value).toBe('Check this law ');
      
      // Second child: citation node
      expect(paragraph.children[1].type).toBe('citation');
      const citation = paragraph.children[1] as unknown as CitationNode;
      expect(citation.id).toBe('abc123');
      expect(citation.citationType).toBe('leg');
      
      // Third child: text after citation
      expect(paragraph.children[2].type).toBe('text');
      expect((paragraph.children[2] as any).value).toBe(' for details.');
    }
  });

  it('should parse multiple citations in one text node', async () => {
    const processor = unified()
      .use(remarkParse)
      .use(remarkCitation);

    const markdown = 'See [CIT:leg:abc123] and [CIT:doc:xyz789] for more info.';
    const result = processor.parse(markdown);
    processor.runSync(result as Root);

    const paragraph = (result as Root).children[0];
    
    if ('children' in paragraph) {
      // Should have: text, citation, text, citation, text = 5 children
      expect(paragraph.children).toHaveLength(5);
      
      expect(paragraph.children[0].type).toBe('text');
      expect(paragraph.children[1].type).toBe('citation');
      expect(paragraph.children[2].type).toBe('text');
      expect(paragraph.children[3].type).toBe('citation');
      expect(paragraph.children[4].type).toBe('text');
      
      // Check citation data
      const firstCitation = paragraph.children[1] as unknown as CitationNode;
      expect(firstCitation.id).toBe('abc123');
      expect(firstCitation.citationType).toBe('leg');
      
      const secondCitation = paragraph.children[3] as unknown as CitationNode;
      expect(secondCitation.id).toBe('xyz789');
      expect(secondCitation.citationType).toBe('doc');
    }
  });

  it('should handle citations at the start of text', async () => {
    const processor = unified()
      .use(remarkParse)
      .use(remarkCitation);

    const markdown = '[CIT:fallo:case456] is an important case.';
    const result = processor.parse(markdown);
    processor.runSync(result as Root);

    const paragraph = (result as Root).children[0];
    
    if ('children' in paragraph) {
      // Should have: citation, text = 2 children
      expect(paragraph.children).toHaveLength(2);
      expect(paragraph.children[0].type).toBe('citation');
      expect(paragraph.children[1].type).toBe('text');
    }
  });

  it('should handle citations at the end of text', async () => {
    const processor = unified()
      .use(remarkParse)
      .use(remarkCitation);

    const markdown = 'Important reference: [CIT:doc:final789]';
    const result = processor.parse(markdown);
    processor.runSync(result as Root);

    const paragraph = (result as Root).children[0];
    
    if ('children' in paragraph) {
      // Should have: text, citation = 2 children
      expect(paragraph.children).toHaveLength(2);
      expect(paragraph.children[0].type).toBe('text');
      expect(paragraph.children[1].type).toBe('citation');
    }
  });

  it('should handle adjacent citations', async () => {
    const processor = unified()
      .use(remarkParse)
      .use(remarkCitation);

    const markdown = 'References: [CIT:leg:abc123][CIT:doc:xyz789]';
    const result = processor.parse(markdown);
    processor.runSync(result as Root);

    const paragraph = (result as Root).children[0];
    
    if ('children' in paragraph) {
      // Should have: text, citation, citation = 3 children
      expect(paragraph.children).toHaveLength(3);
      expect(paragraph.children[0].type).toBe('text');
      expect(paragraph.children[1].type).toBe('citation');
      expect(paragraph.children[2].type).toBe('citation');
    }
  });

  it('should not parse text without citations', async () => {
    const processor = unified()
      .use(remarkParse)
      .use(remarkCitation);

    const markdown = 'This is plain text without any citations.';
    const result = processor.parse(markdown);
    processor.runSync(result as Root);

    const paragraph = (result as Root).children[0];
    
    if ('children' in paragraph) {
      // Should have only 1 text node
      expect(paragraph.children).toHaveLength(1);
      expect(paragraph.children[0].type).toBe('text');
    }
  });

  it('should handle citations in lists', async () => {
    const processor = unified()
      .use(remarkParse)
      .use(remarkCitation);

    const markdown = `- Item with [CIT:leg:abc123]
- Another item [CIT:doc:xyz789]`;

    const result = processor.parse(markdown);
    processor.runSync(result as Root);

    // Find the list
    const list = (result as Root).children[0];
    expect(list.type).toBe('list');
    
    if ('children' in list) {
      // Check first list item
      const firstItem = list.children[0];
      if ('children' in firstItem) {
        const firstParagraph = firstItem.children[0];
        if ('children' in firstParagraph) {
          expect(firstParagraph.children.some((child: any) => child.type === 'citation')).toBe(true);
        }
      }
    }
  });

  it('should add correct data attributes to citation nodes', async () => {
    const processor = unified()
      .use(remarkParse)
      .use(remarkCitation);

    const markdown = 'Test [CIT:leg:abc123] citation.';
    const result = processor.parse(markdown);
    processor.runSync(result as Root);

    const paragraph = (result as Root).children[0];
    
    if ('children' in paragraph) {
      const citation = paragraph.children[1] as unknown as CitationNode;
      
      expect(citation.data).toBeDefined();
      expect(citation.data.hName).toBe('span');
      expect(citation.data.hProperties.className).toContain('citation');
      expect(citation.data.hProperties['data-citation-id']).toBe('abc123');
      expect(citation.data.hProperties['data-citation-type']).toBe('leg');
    }
  });

  it('should handle custom className option', async () => {
    const processor = unified()
      .use(remarkParse)
      .use(remarkCitation, { className: 'custom-citation' });

    const markdown = 'Test [CIT:leg:abc123] citation.';
    const result = processor.parse(markdown);
    processor.runSync(result as Root);

    const paragraph = (result as Root).children[0];
    
    if ('children' in paragraph) {
      const citation = paragraph.children[1] as unknown as CitationNode;
      expect(citation.data.hProperties.className).toContain('custom-citation');
    }
  });

  it('should correctly parse legislation citation with full ID', async () => {
    const processor = unified()
      .use(remarkParse)
      .use(remarkCitation);

    const markdown = 'Reference [CIT:leg:leg_py_nac_ley_006891_20220518] here.';
    const result = processor.parse(markdown);
    processor.runSync(result as Root);

    const paragraph = (result as Root).children[0];
    
    if ('children' in paragraph) {
      const citation = paragraph.children[1] as unknown as CitationNode;
      
      // Type should be "leg"
      expect(citation.citationType).toBe('leg');
      expect(citation.data.hProperties['data-citation-type']).toBe('leg');
      
      // ID should be the full identifier
      expect(citation.id).toBe('leg_py_nac_ley_006891_20220518');
      expect(citation.data.hProperties['data-citation-id']).toBe('leg_py_nac_ley_006891_20220518');
    }
  });
});
