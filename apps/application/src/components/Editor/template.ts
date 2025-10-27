import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { generateHTML, generateJSON } from '@tiptap/html'
import { extensions } from "./extensions";
import { JSONContent } from "@tiptap/core";

const EMPTY_DOC = {
  type: "doc",
  content: [{ type: "paragraph", attrs: { textAlign: null }, content: [] }],
};

/**
 * Validates HTML content before conversion to TipTap JSON
 * @param html - The HTML string to validate
 * @returns Object with validation result and sanitized HTML
 */
function validateHtmlContent(html: string): { isValid: boolean; sanitizedHtml: string; error?: string } {
  if (!html || typeof html !== 'string') {
    return { isValid: false, sanitizedHtml: '', error: 'Invalid HTML content' };
  }

  // Check for basic HTML structure
  const trimmedHtml = html.trim();
  if (trimmedHtml.length === 0) {
    return { isValid: false, sanitizedHtml: '', error: 'Empty HTML content' };
  }

  // Basic validation - check for common issues
  const hasValidStructure = trimmedHtml.includes('<') && trimmedHtml.includes('>');
  if (!hasValidStructure) {
    return { isValid: false, sanitizedHtml: trimmedHtml, error: 'Invalid HTML structure' };
  }

  // Check for potentially problematic content
  const hasScriptTags = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(trimmedHtml);
  if (hasScriptTags) {
    return { isValid: false, sanitizedHtml: trimmedHtml, error: 'HTML contains script tags which are not allowed' };
  }

  // Check for extremely large content
  if (trimmedHtml.length > 1000000) { // 1MB limit
    return { isValid: false, sanitizedHtml: trimmedHtml, error: 'HTML content is too large' };
  }

  return { isValid: true, sanitizedHtml: trimmedHtml };
}

export interface TemplateResult {
  content: JSONContent;
  isLoading: boolean;
  error: string | null;
  templateNotFound: boolean;
}

/**
 * Custom hook to fetch and process a template for use in the TipTap editor.
 * 
 * This hook retrieves a template from the database and converts its HTML content
 * to JSON format that can be consumed by the TipTap editor. Includes proper
 * error handling, loading states, and validation.
 * 
 * @param templateId - The unique identifier of the template to fetch (null to skip)
 * @returns TemplateResult object with content, loading state, and error information
 * 
 * @example
 * ```tsx
 * const templateId = "k1234567890abcdef" as Id<"modelos">;
 * const { content, isLoading, error, templateNotFound } = useTemplate({ templateId });
 * 
 * // Or skip loading template
 * const { content } = useTemplate({ templateId: null });
 * ```
 */
export function useTemplate({ templateId }: { templateId: Id<"modelos"> | null }): TemplateResult {
    const template = useQuery(
        api.functions.templates.getModelo, 
        templateId ? { modeloId: templateId } : "skip"
    );
    
    // No template requested
    if (!templateId) {
        return {
            content: EMPTY_DOC,
            isLoading: false,
            error: null,
            templateNotFound: false
        };
    }
    
    // Template is still loading
    if (template === undefined) {
        return {
            content: EMPTY_DOC,
            isLoading: true,
            error: null,
            templateNotFound: false
        };
    }
    
    // Template not found
    if (template === null) {
        console.warn(`Template with ID ${templateId} not found or access denied`);
        return {
            content: EMPTY_DOC,
            isLoading: false,
            error: `Template not found or you don't have access to it`,
            templateNotFound: true
        };
    }
    
    // Validate template content
    if (!template.content || typeof template.content !== 'string') {
        console.warn(`Template ${templateId} has no content or invalid content type`);
        return {
            content: EMPTY_DOC,
            isLoading: false,
            error: `Template "${template.name}" has no content`,
            templateNotFound: false
        };
    }
    
    // Validate HTML content before conversion
    const htmlValidation = validateHtmlContent(template.content);
    if (!htmlValidation.isValid) {
        console.warn(`Template ${templateId} has invalid HTML content:`, htmlValidation.error);
        return {
            content: EMPTY_DOC,
            isLoading: false,
            error: `Template "${template.name}" has invalid content: ${htmlValidation.error}`,
            templateNotFound: false
        };
    }
    
    // Convert HTML to JSON with error handling
    try {
        const jsonDoc = generateJSON(htmlValidation.sanitizedHtml, extensions);
        
        // Validate the generated JSON has proper structure
        if (!jsonDoc || !jsonDoc.type || jsonDoc.type !== 'doc') {
            throw new Error('Generated JSON is not a valid TipTap document');
        }
        
        // Additional validation: ensure the document has some content
        if (!jsonDoc.content || (Array.isArray(jsonDoc.content) && jsonDoc.content.length === 0)) {
            console.warn(`Template ${templateId} generated empty document content`);
            return {
                content: EMPTY_DOC,
                isLoading: false,
                error: `Template "${template.name}" appears to be empty or contains no valid content`,
                templateNotFound: false
            };
        }
        
        return {
            content: jsonDoc,
            isLoading: false,
            error: null,
            templateNotFound: false
        };
    } catch (error) {
        console.error(`Error converting template ${templateId} to JSON:`, error);
        return {
            content: EMPTY_DOC,
            isLoading: false,
            error: `Failed to load template "${template.name}". The template content may be corrupted or incompatible.`,
            templateNotFound: false
        };
    }
}

/**
 * Saves an escrito (legal document) as a reusable template.
 * 
 * This function takes the content of an escrito in TipTap JSON format,
 * converts it to HTML, and saves it as a template in the database.
 * The template can then be reused for creating new escritos.
 * 
 * @param name - The name of the template
 * @param category - The category/type of the template (e.g., "contract", "brief", "motion")
 * @param content - The TipTap JSON content of the escrito to save as template
 * @param isPublic - Whether the template should be publicly available to all users
 * @param tags - Array of tags to help categorize and search for the template
 * @returns Promise that resolves to the ID of the created template
 * 
 * @throws {Error} When the template creation fails
 * 
 * @example
 * ```tsx
 * const handleSaveAsTemplate = async () => {
 *   try {
 *     const templateId = await saveEscritoAsTemplate({
 *       name: "Standard Contract Template",
 *       category: "contracts",
 *       content: editor.getJSON(),
 *       isPublic: false,
 *       tags: ["contract", "standard", "business"]
 *     });
 *     console.log("Template saved with ID:", templateId);
 *   } catch (error) {
 *     console.error("Failed to save template:", error);
 *   }
 * };
 * ```
 */
export async function saveEscritoAsTemplate({ name, category, content, isPublic, tags, createTemplate }: { name: string, category: string, content: JSONContent, isPublic: boolean, tags: string[], createTemplate: (args: any) => Promise<string> }) {
    const htmlDoc = generateHTML(content, extensions);

    const templateId = await createTemplate({ 
        name: name,
        category: category,
        isPublic: isPublic,
        content: htmlDoc,
        tags: tags,
    })
    return templateId;

}