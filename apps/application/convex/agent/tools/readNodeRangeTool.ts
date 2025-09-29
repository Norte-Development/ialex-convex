import { createTool, ToolCtx } from "@convex-dev/agent";
import { api, internal } from "../../_generated/api";
import { z } from "zod";
import { getUserAndCaseIds, createErrorResponse, validateStringParam } from "./utils";
import { Id } from "../../_generated/dataModel";

/**
 * Represents a document section with position information
 */
interface DocumentSection {
  type: 'heading' | 'paragraph' | 'list' | 'listItem' | 'other';
  content: string;
  range: { from: number; to: number };
  level?: number; // for headings
  isDefinition?: boolean; // for definition paragraphs
  preview: string; // first 100 chars for display
}

/**
 * Suggested ranges for common editing operations
 */
interface EditSuggestion {
  from: number;
  to: number;
  description: string;
  recommendedTool: 'insertContentTool' | 'applyDiffTool';
  reason: string;
}

/**
 * Enhanced response structure with position information
 */
interface EnhancedReadResponse {
  // Original fields
  totalNodeCount: null;
  activeNodeRange: string;
  content: string;
  message: string;
  
  // New structured data
  structure?: {
    totalLength: number;
    sections: DocumentSection[];
    suggestions: EditSuggestion[];
    contentAnalysis: {
      hasMultipleParagraphs: boolean;
      hasHeadings: boolean;
      hasLists: boolean;
      complexity: 'simple' | 'medium' | 'complex';
      recommendedApproach: string;
    };
  };
}

/**
 * Analyze HTML content and extract document structure with positions
 */
function analyzeDocumentStructure(htmlContent: string): {
  sections: DocumentSection[];
  contentAnalysis: any;
} {
  const sections: DocumentSection[] = [];
  let currentPosition = 0;

  // Split into major blocks (paragraphs, headings, lists)
  const blockRegex = /<(h[1-6]|p|ul|ol|li)[^>]*>.*?<\/\1>/gi;
  const matches = htmlContent.matchAll(blockRegex);

  for (const match of matches) {
    const fullMatch = match[0];
    const tagName = match[1].toLowerCase();
    const startPos = htmlContent.indexOf(fullMatch, currentPosition);
    const endPos = startPos + fullMatch.length;

    // Extract plain text content for preview
    const textContent = fullMatch.replace(/<[^>]*>/g, '').trim();
    const preview = textContent.length > 100 ? textContent.substring(0, 100) + '...' : textContent;

    let sectionType: DocumentSection['type'] = 'other';
    let level: number | undefined;
    let isDefinition = false;

    // Determine section type
    if (tagName.startsWith('h')) {
      sectionType = 'heading';
      level = parseInt(tagName.charAt(1));
    } else if (tagName === 'p') {
      sectionType = 'paragraph';
      // Check if it's a definition (contains bold term followed by colon)
      isDefinition = /<strong[^>]*>[^<]*:<\/strong>/.test(fullMatch) || 
                     /<b[^>]*>[^<]*:<\/b>/.test(fullMatch);
    } else if (tagName === 'ul' || tagName === 'ol') {
      sectionType = 'list';
    } else if (tagName === 'li') {
      sectionType = 'listItem';
    }

    sections.push({
      type: sectionType,
      content: fullMatch,
      range: { from: startPos, to: endPos },
      level,
      isDefinition,
      preview
    });

    currentPosition = endPos;
  }

  // Content analysis
  const hasMultipleParagraphs = sections.filter(s => s.type === 'paragraph').length > 1;
  const hasHeadings = sections.some(s => s.type === 'heading');
  const hasLists = sections.some(s => s.type === 'list');
  const totalSections = sections.length;

  let complexity: 'simple' | 'medium' | 'complex' = 'simple';
  if (totalSections > 10 || hasHeadings) complexity = 'complex';
  else if (totalSections > 3 || hasLists) complexity = 'medium';

  const contentAnalysis = {
    hasMultipleParagraphs,
    hasHeadings,
    hasLists,
    complexity,
    recommendedApproach: complexity === 'complex' 
      ? 'Use insertContentTool with ranges for any multi-paragraph changes'
      : complexity === 'medium'
      ? 'Use insertContentTool for section replacements, applyDiffTool for single corrections'
      : 'Either tool is suitable, prefer applyDiffTool for simple changes'
  };

  return { sections, contentAnalysis };
}

/**
 * Generate suggested ranges for common editing operations
 */
function generateEditSuggestions(sections: DocumentSection[], totalLength: number): EditSuggestion[] {
  const suggestions: EditSuggestion[] = [];

  // Suggest full document replacement for complex content
  if (sections.length > 5) {
    suggestions.push({
      from: 0,
      to: totalLength,
      description: 'Replace entire document',
      recommendedTool: 'insertContentTool',
      reason: 'Complex document with multiple sections - use insertContentTool for large changes'
    });
  }

  // Find major sections (headings + following paragraphs)
  let currentSectionStart = 0;
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    
    if (section.type === 'heading') {
      // Find the end of this section (next heading or end of document)
      let sectionEnd = totalLength;
      for (let j = i + 1; j < sections.length; j++) {
        if (sections[j].type === 'heading' && sections[j].level! <= section.level!) {
          sectionEnd = sections[j].range.from;
          break;
        }
      }

      suggestions.push({
        from: section.range.from,
        to: sectionEnd,
        description: `Replace section: ${section.preview}`,
        recommendedTool: 'insertContentTool',
        reason: 'Section replacement - use insertContentTool with range'
      });
    }

    // Individual paragraph suggestions
    if (section.type === 'paragraph') {
      const isLarge = section.content.length > 200;
      suggestions.push({
        from: section.range.from,
        to: section.range.to,
        description: `${isLarge ? 'Replace' : 'Edit'} paragraph: ${section.preview}`,
        recommendedTool: isLarge ? 'insertContentTool' : 'applyDiffTool',
        reason: isLarge 
          ? 'Large paragraph - use insertContentTool with range for replacement'
          : 'Small paragraph - can use applyDiffTool for corrections or insertContentTool for replacement'
      });
    }
  }

  // Sort by position
  suggestions.sort((a, b) => a.from - b.from);

  return suggestions.slice(0, 10); // Limit to 10 suggestions
}

/**
 * Enhanced tool for reading Escrito content with structured position information.
 * 
 * Provides both raw content and structured data including character positions,
 * document sections, and suggested ranges for editing operations.
 * This enables the agent to use insertContentTool with precise ranges.
 * Automatically excludes deleted content from all read operations.
 */
export const readNodeRangeTool: any = createTool({
  description: "Read HTML content from an Escrito with detailed position information. Returns both raw content and structured data including character positions, document sections, and suggested ranges for editing. Use 'full'/'entire' for complete document analysis, or specific ranges like '100-200'. The structured data helps determine whether to use insertContentTool (with suggested ranges) or applyDiffTool (for small changes).",
  args: z.object({
    escritoId: z.string().describe("The Escrito ID (Convex doc id)"),
    nodeRange: z.string().describe("A string representing the range of the document to read. If the provided node range is too large, the AI Toolkit reads the first part of it, and informs the AI of what part of the document was actually read. If the range is outside the bounds of the document, the AI Toolkit handles it gracefully and informs the AI model of the mistake."),
  }),
  
  handler: async (ctx: ToolCtx, args: {
    escritoId: string;
    nodeRange: string;
  }) => {
    try {
      const {caseId, userId} = getUserAndCaseIds(ctx.userId as string);
      
      await ctx.runQuery(internal.auth_utils.internalCheckNewCaseAccess, {
        userId: userId as Id<"users">,
        caseId: caseId as Id<"cases">,
        requiredLevel: "basic"
      });

      // Validate inputs
      const escritoIdError = validateStringParam(args.escritoId, "escritoId");
      if (escritoIdError) return escritoIdError;

      const nodeRangeError = validateStringParam(args.nodeRange, "nodeRange");
      if (nodeRangeError) return nodeRangeError;

      const escritoId = args.escritoId.trim();
      const rangeDescription = args.nodeRange.toLowerCase().trim();

      // Range handling using primitives: getFullHtml and getHtmlRange
      const MAX_LENGTH = 32000;

      // If the agent asked for full/all/entire document, return up to MAX_LENGTH
      if (
        rangeDescription.includes('all') ||
        rangeDescription.includes('entire') ||
        rangeDescription.includes('full') ||
        rangeDescription === 'document' ||
        rangeDescription === 'whole'
      ) {
        const fullHtml = await ctx.runAction(api.editor.read.getFullHtml, {
          escritoId: escritoId as Id<'escritos'>
        });

        const isFullContent = fullHtml.length <= MAX_LENGTH;
        const content = isFullContent ? fullHtml : fullHtml.slice(0, MAX_LENGTH);
        
        // Analyze document structure for enhanced response
        const { sections, contentAnalysis } = analyzeDocumentStructure(content);
        const suggestions = generateEditSuggestions(sections, content.length);

        const response: EnhancedReadResponse = {
          totalNodeCount: null,
          activeNodeRange: isFullContent ? 'document' : `document(0-${MAX_LENGTH})`,
          content,
          message: isFullContent 
            ? `Returned full HTML content with ${sections.length} sections analyzed.`
            : `Document is too large; returned first ${MAX_LENGTH} characters with structural analysis.`,
          structure: {
            totalLength: content.length,
            sections,
            suggestions,
            contentAnalysis
          }
        };

        return response;
      }

      // Try to parse numeric ranges in node space: "from-to" or single number
      // Accept formats: "10-200", "from 10 to 200", "10 to 200", "range 10-200"
      const rangeRegexes = [
        /(\d+)\s*-\s*(\d+)/, // 10-200
        /from\s*(\d+)\s*to\s*(\d+)/, // from 10 to 200
        /(\d+)\s*to\s*(\d+)/, // 10 to 200
      ];

      let fromPos: number | null = null;
      let toPos: number | null = null;
      for (const rx of rangeRegexes) {
        const m = rangeDescription.match(rx);
        if (m) {
          fromPos = parseInt(m[1], 10);
          toPos = parseInt(m[2], 10);
          break;
        }
      }

      // If only a single number is provided, read a small window around it
      if (fromPos === null && toPos === null) {
        const singleMatch = rangeDescription.match(/\b(\d+)\b/);
        if (singleMatch) {
          const center = parseInt(singleMatch[1], 10);
          fromPos = Math.max(1, center - 5000);
          toPos = center + 5000;
        }
      }

      if (fromPos !== null && toPos !== null) {
        const html = await ctx.runAction(api.editor.read.getHtmlRange, {
          escritoId: escritoId as Id<'escritos'>,
          from: fromPos,
          to: toPos
        });

        const content = html.length > MAX_LENGTH ? html.slice(0, MAX_LENGTH) : html;
        const truncatedMsg = html.length > MAX_LENGTH ? ` Result truncated to ${MAX_LENGTH} characters.` : '';
        
        // Analyze structure for range content too
        const { sections, contentAnalysis } = analyzeDocumentStructure(content);
        const suggestions = generateEditSuggestions(sections, content.length);

        const response: EnhancedReadResponse = {
          totalNodeCount: null,
          activeNodeRange: `${fromPos}-${toPos}`,
          content,
          message: `Returned HTML for node range ${fromPos}-${toPos} with ${sections.length} sections analyzed.${truncatedMsg}`,
          structure: {
            totalLength: content.length,
            sections,
            suggestions,
            contentAnalysis
          }
        };

        return response;
      }

      // Fallback: default to beginning of document up to MAX_LENGTH
      const fullHtml = await ctx.runAction(api.editor.read.getFullHtml, {
        escritoId: escritoId as Id<'escritos'>
      });
      const content = fullHtml.slice(0, Math.min(MAX_LENGTH, fullHtml.length));
      
      // Analyze structure for fallback content
      const { sections, contentAnalysis } = analyzeDocumentStructure(content);
      const suggestions = generateEditSuggestions(sections, content.length);

      const response: EnhancedReadResponse = {
        totalNodeCount: null,
        activeNodeRange: `document(0-${content.length})`,
        content,
        message: `Could not interpret range. Returned the beginning of the document with ${sections.length} sections analyzed.`,
        structure: {
          totalLength: content.length,
          sections,
          suggestions,
          contentAnalysis
        }
      };

      return response;
    } catch (error) {
      return createErrorResponse(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
});
