export function extractTextFromParagraph(paragraph: any): string {
    if (!paragraph.content) return '';
    return paragraph.content
      .filter((node: any) => node.type === 'text')
      .map((node: any) => node.text || '')
      .join('');
  }
  
export function normalizeText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }


/**
 * Extracts combined text content from an array of content nodes
 * @param content - Array of content nodes
 * @returns Combined text content
 */
export function extractCombinedText(content: any[]): string {
    if (!content || content.length === 0) return '';
    return content
      .filter((node: any) => node.type === 'text')
      .map((node: any) => node.text || '')
      .join('');
  }

