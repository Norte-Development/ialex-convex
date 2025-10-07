import { visit } from 'unist-util-visit';
import type { Root, Text, Parent } from 'mdast';
import type { Plugin } from 'unified';
import type { Node } from 'unist';

/**
 * Citation node definition - extends the mdast AST with a custom citation node type
 */
export interface CitationNode extends Node {
  type: 'citation';
  data: {
    hName: 'span';
    hProperties: {
      className: string[];
      'data-citation-id': string;
      'data-citation-type': string;
    };
  };
  id: string;
  citationType: string;
}

/**
 * Regex pattern to match citations in the format: [CIT:type:id]
 * Examples: [CIT:leg:abc123], [CIT:doc:xyz789], [CIT:fallo:case456]
 */
const CITATION_PATTERN = /\[CIT:([^:]+):([^\]]+)\]/g;

/**
 * Plugin options for customizing citation parsing behavior
 */
interface RemarkCitationOptions {
  /**
   * Custom class name to add to citation nodes
   * @default 'citation'
   */
  className?: string;
  
  /**
   * Whether to validate citation format strictly
   * @default false
   */
  strict?: boolean;
}

/**
 * Citation match information
 */
interface CitationMatch {
  match: RegExpExecArray;
  start: number;
  end: number;
  citationType: string;
  citationId: string;
}

/**
 * Remark plugin to parse citations in the format [CIT:type:id]
 * and transform them into custom citation nodes in the AST.
 * 
 * This plugin:
 * 1. Traverses all text nodes in the markdown AST
 * 2. Finds citations using regex pattern matching
 * 3. Splits text nodes at citation boundaries
 * 4. Creates custom citation nodes with metadata for rendering
 * 
 * @example
 * ```typescript
 * import { unified } from 'unified';
 * import remarkParse from 'remark-parse';
 * import remarkCitation from './remark-citation';
 * 
 * const processor = unified()
 *   .use(remarkParse)
 *   .use(remarkCitation);
 * ```
 */
const remarkCitation: Plugin<[RemarkCitationOptions?], Root> = (options) => {
  const className = options?.className || 'citation';
  const strict = options?.strict || false;

  return (tree: Root) => {
    // Visit all text nodes in the AST
    visit(tree, 'text', (node: Text, index, parent: Parent | undefined) => {
      // Skip if we don't have a parent or index (shouldn't happen, but TypeScript safety)
      if (!parent || typeof index !== 'number') {
        return;
      }

      const { value } = node;
      
      // Quick check: if text doesn't contain '[CIT:', skip it entirely for performance
      if (!value.includes('[CIT:')) {
        return;
      }

      // Find all citation matches in this text node
      const matches: CitationMatch[] = [];
      const regex = new RegExp(CITATION_PATTERN.source, CITATION_PATTERN.flags);
      let match: RegExpExecArray | null;

      while ((match = regex.exec(value)) !== null) {
        const [fullMatch, citationType, citationId] = match;
        
        // Validate citation has required parts
        if (!citationType || !citationId) {
          if (strict) {
            console.warn(`Invalid citation format: ${fullMatch}`);
            continue;
          }
        }

        matches.push({
          match,
          start: match.index,
          end: match.index + fullMatch.length,
          citationType: citationType.trim(),
          citationId: citationId.trim(),
        });
      }

      // If no valid citations found, skip this node
      if (matches.length === 0) {
        return;
      }

      // Build new nodes by splitting the text at citation boundaries
      const newNodes: Array<Text | CitationNode> = [];
      let lastIndex = 0;

      for (const { start, end, citationType, citationId } of matches) {
        // Add text before the citation (if any)
        if (start > lastIndex) {
          const textBefore = value.slice(lastIndex, start);
          if (textBefore) {
            newNodes.push({
              type: 'text',
              value: textBefore,
            });
          }
        }

        // Add the citation node
        newNodes.push({
          type: 'citation',
          data: {
            hName: 'span',
            hProperties: {
              className: [className],
              'data-citation-id': citationId,
              'data-citation-type': citationType,
            },
          },
          id: citationId,
          citationType,
        } as CitationNode);

        lastIndex = end;
      }

      // Add remaining text after last citation (if any)
      if (lastIndex < value.length) {
        const textAfter = value.slice(lastIndex);
        if (textAfter) {
          newNodes.push({
            type: 'text',
            value: textAfter,
          });
        }
      }

      // Replace the original text node with our new nodes
      // Cast to any to avoid TypeScript issues with custom node types
      parent.children.splice(index, 1, ...(newNodes as any));

      // Return the new index to continue visiting after our inserted nodes
      // This prevents re-processing the nodes we just created
      return index + newNodes.length;
    });
  };
};

export default remarkCitation;
