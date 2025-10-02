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
 * Custom hook to fetch and process a template for use in the TipTap editor.
 * 
 * This hook retrieves a template from the database and converts its HTML content
 * to JSON format that can be consumed by the TipTap editor.
 * 
 * @param templateId - The unique identifier of the template to fetch (null to skip)
 * @returns The template content converted to TipTap JSON format, or EMPTY_DOC if no template
 * 
 * @example
 * ```tsx
 * const templateId = "k1234567890abcdef" as Id<"modelos">;
 * const jsonDoc = useTemplate({ templateId });
 * 
 * // Or skip loading template
 * const jsonDoc = useTemplate({ templateId: null });
 * ```
 */
export function useTemplate({ templateId }: { templateId: Id<"modelos"> | null }) {

    const template = useQuery(
        api.functions.templates.getModelo, 
        templateId ? { modeloId: templateId } : "skip"
    );
    
    if (!templateId) {
        return EMPTY_DOC;
    }
    
    const jsonDoc = generateJSON(template?.content || "", extensions);  
    
    return jsonDoc;
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