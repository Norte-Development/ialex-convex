import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { generateHTML } from "@tiptap/html";
import { extensions } from "../Editor/extensions";
import { useMemo } from "react";

/**
 * Hook to fetch and generate HTML preview for an escrito
 *
 * @param prosemirrorId - The ProseMirror document ID
 * @returns Object with HTML preview and loading state
 */
export function useEscritoPreview(prosemirrorId: string | undefined) {
  // Fetch the snapshot from ProseMirror
  const snapshot = useQuery(
    api.prosemirror.getSnapshot,
    prosemirrorId ? { id: prosemirrorId } : "skip",
  );

  // Generate HTML from the JSON snapshot
  const htmlContent = useMemo(() => {
    // Check if snapshot has content
    const snapshotData: any = snapshot;
    if (!snapshotData || !snapshotData.content) return null;

    try {
      // Parse content if it's a string, otherwise use as-is
      const content =
        typeof snapshotData.content === "string"
          ? JSON.parse(snapshotData.content)
          : snapshotData.content;

      let html = generateHTML(content, extensions);
      console.log("Generated HTML preview:", html);

      // Remove xmlns attributes that can cause rendering issues
      html = html.replace(/\s*xmlns="[^"]*"/g, "");

      // Process images - replace base64 with placeholders for preview
      html = html.replace(
        /<img([^>]*?)src="data:image\/[^;]+;base64,[^"]*"([^>]*?)>/gi,
        '<div class="image-placeholder">📷 Imagen</div>',
      );

      return html;
    } catch (error) {
      console.error("Error generating HTML preview:", error);
      return null;
    }
  }, [snapshot]);

  // Extract plain text for character counting (optional)
  const plainText = useMemo(() => {
    if (!htmlContent) return "";

    // Remove HTML tags to get plain text
    const temp = document.createElement("div");
    temp.innerHTML = htmlContent;
    return temp.textContent || temp.innerText || "";
  }, [htmlContent]);

  // Check if there's actual content (not just empty tags)
  const hasContent = useMemo(() => {
    if (!htmlContent) return false;

    // Check if plainText has any non-whitespace characters
    const textContent = plainText.trim();
    return textContent.length > 0;
  }, [htmlContent, plainText]);

  return {
    htmlContent,
    plainText,
    isLoading: snapshot === undefined,
    hasContent,
  };
}

/**
 * Truncate HTML content intelligently for preview
 * Tries to keep complete elements (paragraphs, tables, etc.) and avoid cutting in the middle
 *
 * @param html - The full HTML content
 * @param maxLength - Maximum character length (default: 300)
 * @returns Truncated HTML
 */
export function truncateHTML(html: string, maxLength: number = 300): string {
  const temp = document.createElement("div");
  temp.innerHTML = html;

  const text = temp.textContent || temp.innerText || "";

  if (text.length <= maxLength) {
    return html;
  }

  // Get all block-level elements including tables
  const elements = temp.querySelectorAll(
    "p, h1, h2, h3, h4, h5, h6, table, ul, ol",
  );
  let accumulated = "";
  let charCount = 0;

  for (const element of elements) {
    const elementText = element.textContent || "";

    // For tables, check if we have enough space to show at least part of it
    if (element.tagName.toLowerCase() === "table") {
      if (charCount + elementText.length <= maxLength || charCount === 0) {
        // Include the whole table if it fits or if it's the first element
        accumulated += element.outerHTML;
        charCount += elementText.length;
      } else {
        // Skip table if we don't have space
        break;
      }
    } else {
      // For other elements (p, h1-h6, ul, ol)
      if (charCount + elementText.length <= maxLength) {
        accumulated += element.outerHTML;
        charCount += elementText.length;
      } else {
        // Try to add part of this element
        const remaining = maxLength - charCount;
        if (remaining > 50) {
          // Only add if we can show at least 50 chars
          const truncatedText = elementText.substring(0, remaining) + "...";
          const clonedElement = element.cloneNode(false) as HTMLElement;
          clonedElement.textContent = truncatedText;
          accumulated += clonedElement.outerHTML;
        }
        break;
      }
    }
  }

  return accumulated || html.substring(0, maxLength) + "...";
}
