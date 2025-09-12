import "dotenv/config";
import { logger } from "../middleware/logging";
import { Mistral } from "@mistralai/mistralai";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import { timeoutWrappers } from "../utils/timeoutUtils";

type Options = { pageWindow: number };

// Initialize a single SDK client instance
const mistral = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY,
  timeoutMs: 600000, // 10 minutes for OCR
});

// Configure PDF.js
GlobalWorkerOptions.workerSrc = "node_modules/pdfjs-dist/build/pdf.worker.js";

async function encodePdf(file: Buffer) {
  try {
      // Read the PDF file as a buffer
      const pdfBuffer = file;

      // Convert the buffer to a Base64-encoded string
      const base64Pdf = pdfBuffer.toString('base64');
      return base64Pdf;
  } catch (error) {
      console.error(`Error: ${error}`);
      return null;
  }
}

/**
 * Extract text from PDF using Mistral OCR
 * Uses page windowing to handle large documents efficiently
 */
export async function extractWithMistralOCR(documentUrl: string, opts: Options): Promise<string> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error("Missing Mistral OCR config");

  try {
    logger.info("Starting Mistral OCR extraction", { documentUrl });

    // Process the entire document with Mistral OCR
    const ocrResponse = await timeoutWrappers.ocrRequest(
      () => mistral.ocr.process({
        model: "mistral-ocr-latest",
        document: {
          type: "document_url",
          documentUrl: documentUrl
        },
        includeImageBase64: false
      }),
      'Mistral OCR request'
    );

    const allPages = ocrResponse.pages || [];

    if (allPages.length === 0) {
      throw new Error("Mistral OCR returned no pages");
    }

    // Apply page windowing to the results
    const pageWindow = opts.pageWindow || 50;
    const totalPages = allPages.length;

    logger.info("OCR completed, applying page windowing", {
      totalPages,
      pageWindow
    });

    // Extract text from all pages
    const pageTexts = allPages.map((page) => page.markdown || "").filter(text => text.trim());

    if (pageTexts.length === 0) {
      throw new Error("Mistral OCR returned no readable text");
    }

    // Group pages into windows and join with separators
    const windowedTexts: string[] = [];
    for (let i = 0; i < pageTexts.length; i += pageWindow) {
      const windowPages = pageTexts.slice(i, i + pageWindow);
      const windowText = windowPages.join('\n\n--- Page Break ---\n\n');
      windowedTexts.push(windowText);
    }

    // Join windows with clear separators
    const finalText = windowedTexts.join('\n\n=== Window Break ===\n\n').trim();

    logger.info("Mistral OCR extraction completed", {
      totalPages: allPages.length,
      readablePages: pageTexts.length,
      windowsCreated: windowedTexts.length,
      totalTextLength: finalText.length
    });

    return finalText;

  } catch (err) {
    logger.error("Mistral OCR error", { err: err instanceof Error ? err.message : String(err) });
    throw new Error("Mistral OCR failed");
  }
}



