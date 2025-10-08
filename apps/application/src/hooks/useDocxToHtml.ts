import { useState, useCallback } from "react";

/**
 * Configuration options for DOCX to HTML conversion
 */
export interface DocxToHtmlOptions {
  /** Whether to preserve original styling */
  preserveFormatting?: boolean;
  /** Whether to include images as base64 data URLs */
  includeImages?: boolean;
  /** Whether to convert tables to HTML tables */
  convertTables?: boolean;
  /** Custom style mapping for better TipTap compatibility */
  useCustomStyleMapping?: boolean;
}

/**
 * Result of DOCX to HTML conversion
 */
export interface DocxToHtmlResult {
  /** Generated HTML content */
  html: string;
  /** Extracted raw text (fallback) */
  text: string;
  /** Any warnings or messages from conversion */
  messages: string[];
  /** Whether conversion was successful */
  success: boolean;
  /** Error message if conversion failed */
  error?: string;
  /** Analysis of the document structure */
  analysis?: {
    hasImages: boolean;
    hasTables: boolean;
    hasHeadings: boolean;
    paragraphCount: number;
    estimatedComplexity: "low" | "medium" | "high";
  };
}

/**
 * Hook for converting DOCX files to HTML optimized for TipTap editor
 */
export function useDocxToHtml() {
  const [isConverting, setIsConverting] = useState(false);
  const [lastResult, setLastResult] = useState<DocxToHtmlResult | null>(null);

  /**
   * Style mapping optimized for TipTap editor
   */
  const getTipTapStyleMapping = useCallback(() => {
    return {
      // Convert DOCX paragraph styles to semantic HTML
      paragraphStyleMap: [
        // Legal document headings
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Heading 4'] => h4:fresh",
        "p[style-name='Heading 5'] => h5:fresh",
        "p[style-name='Heading 6'] => h6:fresh",

        // Common legal document styles
        "p[style-name='Title'] => h1.document-title:fresh",
        "p[style-name='Subtitle'] => h2.document-subtitle:fresh",
        "p[style-name='Quote'] => blockquote:fresh",
        "p[style-name='Intense Quote'] => blockquote.intense:fresh",

        // Lists - TipTap handles these well
        "p[style-name='List Paragraph'] => p",

        // Default paragraph with proper spacing
        "p => p:fresh",
      ],
    };
  }, []);

  /**
   * Clean HTML to ensure TipTap compatibility
   */
  const cleanHtmlForTipTap = useCallback((html: string): string => {
    return (
      html
        // Remove XML namespaces and Office-specific attributes
        .replace(/\s*xmlns[^=]*="[^"]*"/g, "")
        .replace(/\s*xml:[^=]*="[^"]*"/g, "")
        .replace(/\s*o:[^=]*="[^"]*"/g, "")
        .replace(/\s*w:[^=]*="[^"]*"/g, "")

        // Remove empty paragraphs and excessive whitespace (but preserve table structure)
        .replace(/<p[^>]*>\s*<\/p>/g, "")
        .replace(/<p[^>]*>(\s|&nbsp;)*<\/p>/g, "")

        // Clean up spacing but preserve table formatting
        .replace(/\n\s*\n/g, "\n")
        .replace(/>\s+</g, (match) => {
          // Don't compress whitespace inside table elements
          if (
            match.includes("table") ||
            match.includes("tr") ||
            match.includes("td") ||
            match.includes("th")
          ) {
            return match;
          }
          return "><";
        })

        // Remove most inline styles but preserve essential table styles
        .replace(/style="[^"]*"/g, (match) => {
          // Keep table-related styles that might be important
          if (
            match.includes("width") ||
            match.includes("border") ||
            match.includes("text-align")
          ) {
            return match;
          }
          return "";
        })

        // Ensure table elements have proper structure
        .replace(/<table[^>]*>/g, "<table>")
        .replace(/<tr[^>]*>/g, "<tr>")
        .replace(/<td[^>]*>/g, "<td>")
        .replace(/<th[^>]*>/g, "<th>")

        // Clean up any remaining whitespace
        .trim()
    );
  }, []);

  /**
   * Analyze DOCX structure to provide insights
   */
  const analyzeHtmlStructure = useCallback((html: string, text: string) => {
    const hasImages = html.includes("<img");
    const hasTables = html.includes("<table");
    const hasHeadings = /h[1-6]/i.test(html);
    const paragraphCount = text
      .split("\n")
      .filter((line) => line.trim()).length;

    let estimatedComplexity: "low" | "medium" | "high" = "low";
    if (hasImages || hasTables || paragraphCount > 100) {
      estimatedComplexity = "high";
    } else if (hasHeadings || paragraphCount > 20) {
      estimatedComplexity = "medium";
    }

    return {
      hasImages,
      hasTables,
      hasHeadings,
      paragraphCount,
      estimatedComplexity,
    };
  }, []);

  /**
   * Convert DOCX file to HTML optimized for TipTap
   */
  const convertDocxToHtml = useCallback(
    async (
      file: File | ArrayBuffer,
      options: DocxToHtmlOptions = {},
    ): Promise<DocxToHtmlResult> => {
      const { includeImages = false, useCustomStyleMapping = true } = options;

      setIsConverting(true);

      try {
        console.log("Starting DOCX to HTML conversion", {
          fileSize: file instanceof File ? file.size : file.byteLength,
          options,
        });

        // Convert File to ArrayBuffer if needed
        let arrayBuffer: ArrayBuffer;
        if (file instanceof File) {
          arrayBuffer = await file.arrayBuffer();
        } else {
          arrayBuffer = file;
        }

        // Import mammoth dynamically to avoid TypeScript issues
        const mammothMod = await import("mammoth");
        const mammothAny = mammothMod as any;

        // Configure mammoth options for TipTap compatibility
        const mammothOptions: any = {
          // Custom style mapping for better TipTap integration
          ...(useCustomStyleMapping && getTipTapStyleMapping()),

          // Image handling
          convertImage: includeImages
            ? mammothAny.images.inline(async (element: any) => {
                try {
                  const imageBuffer = await element.read("base64");
                  return {
                    src: `data:${element.contentType};base64,${imageBuffer}`,
                  };
                } catch (error) {
                  console.warn("Failed to process image in DOCX", error);
                  return { src: "" }; // Return empty src to avoid broken images
                }
              })
            : mammothAny.images.ignore,
        };

        // Perform the conversion
        const [htmlResult, textResult] = await Promise.all([
          mammothAny.convertToHtml({ arrayBuffer }, mammothOptions),
          mammothAny.extractRawText({ arrayBuffer }),
        ]);

        if (!htmlResult.value) {
          throw new Error("Mammoth returned empty HTML content");
        }

        // Clean HTML for TipTap compatibility
        const cleanedHtml = cleanHtmlForTipTap(htmlResult.value);

        // Analyze the document structure
        const analysis = analyzeHtmlStructure(cleanedHtml, textResult.value);

        console.log("DOCX to HTML conversion completed successfully", {
          htmlLength: cleanedHtml.length,
          textLength: textResult.value.length,
          messagesCount: htmlResult.messages.length,
          analysis,
        });

        // Log any conversion messages/warnings
        if (htmlResult.messages.length > 0) {
          console.warn("DOCX conversion messages", htmlResult.messages);
        }

        const result: DocxToHtmlResult = {
          html: cleanedHtml,
          text: textResult.value,
          messages: htmlResult.messages.map((msg: any) => msg.message),
          success: true,
          analysis,
        };

        setLastResult(result);
        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Failed to convert DOCX to HTML", error);

        // Try to extract at least the text as fallback
        try {
          const arrayBuffer =
            file instanceof File ? await file.arrayBuffer() : file;
          const mammothMod = await import("mammoth");
          const mammothAny = mammothMod as any;
          const textResult = await mammothAny.extractRawText({ arrayBuffer });

          const fallbackResult: DocxToHtmlResult = {
            html: `<p>${textResult.value.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>")}</p>`,
            text: textResult.value,
            messages: [],
            success: false,
            error: errorMessage,
          };

          setLastResult(fallbackResult);
          return fallbackResult;
        } catch (textError) {
          const failureResult: DocxToHtmlResult = {
            html: "",
            text: "",
            messages: [],
            success: false,
            error: `Complete conversion failure: ${errorMessage}`,
          };

          setLastResult(failureResult);
          return failureResult;
        }
      } finally {
        setIsConverting(false);
      }
    },
    [getTipTapStyleMapping, cleanHtmlForTipTap, analyzeHtmlStructure],
  );

  /**
   * Validate that the generated HTML is suitable for TipTap
   */
  const validateHtmlForTipTap = useCallback(
    (
      html: string,
    ): {
      isValid: boolean;
      issues: string[];
      suggestions: string[];
    } => {
      const issues: string[] = [];
      const suggestions: string[] = [];

      // Check for supported features
      if (html.includes("<table")) {
        // Tables are now supported, just inform about the feature
        console.log(
          "Document contains tables - will be converted with table support",
        );
      }

      if (html.includes("<img")) {
        issues.push("Contains images");
        suggestions.push("Ensure images are properly sized and accessible");
      }

      if (html.includes("style=")) {
        issues.push("Contains inline styles");
        suggestions.push(
          "TipTap prefers class-based styling - consider cleaning inline styles",
        );
      }

      // Check for empty content
      const textContent = html.replace(/<[^>]*>/g, "").trim();
      if (!textContent) {
        issues.push("No readable text content found");
        suggestions.push(
          "Verify the DOCX file contains actual content and not just formatting",
        );
      }

      return {
        isValid: issues.length === 0,
        issues,
        suggestions,
      };
    },
    [],
  );

  return {
    convertDocxToHtml,
    validateHtmlForTipTap,
    isConverting,
    lastResult,
  };
}
