/**
 * Utility functions for sanitizing and cleaning content for agent responses
 */

/**
 * Removes HTML tags from content while preserving text content
 * @param content - The content to sanitize (HTML or plain text)
 * @returns Sanitized plain text content
 */
export function stripHtmlTags(content: string): string {
  if (!content) return '';
  
  // Remove HTML tags but preserve the text content
  return content.replace(/<[^>]*>/g, '');
}

/**
 * Creates a brief summary of template content for agent responses
 * @param content - The template content (HTML or plain text)
 * @param maxLength - Maximum length of the summary (default: 150)
 * @returns A brief summary of the template content
 */
export function createContentSummary(content: string, maxLength: number = 150): string {
  if (!content) return 'Sin contenido';
  
  // Strip HTML tags first
  const plainText = stripHtmlTags(content);
  
  // If content is already short enough, return it
  if (plainText.length <= maxLength) {
    return plainText;
  }
  
  // Truncate and add ellipsis
  return plainText.substring(0, maxLength).trim() + '...';
}

/**
 * Generates a template summary for agent responses
 * @param template - The template object
 * @returns A formatted summary string
 */
export function generateTemplateSummary(template: any): string {
  const contentSummary = createContentSummary(template.content, 100);
  
  return `**${template.name}** - ${template.category}
${template.description || contentSummary}
*${template.isPublic ? 'Pública' : 'Privada'} • ${template.usageCount} usos • ${template.content_type || 'text'}*`;
}
