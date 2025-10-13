import "dotenv/config";
import { logger } from "../middleware/logging";
import { Mistral } from "@mistralai/mistralai";
import { timeoutWrappers } from "../utils/timeoutUtils";
import { splitPdfForMistralOCR, splitPdfBySizeAndPages, getPdfPageCount } from "./documentSplittingService";

type Options = { pageWindow: number };

// Initialize a single SDK client instance
const mistral = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY,

});

// No PDF.js worker configuration needed here; PDF operations happen in splitting service

// Mistral OCR size and page constraints
const MAX_CHUNK_SIZE_BYTES = 20 * 1024 * 1024; // 20MB raw PDF size
const MAX_BASE64_SIZE_ESTIMATE = MAX_CHUNK_SIZE_BYTES * 1.33; // ~26MB after encoding
const MAX_PAGES_PER_CHUNK = 1000; // Mistral's hard page limit

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
 * Process a single PDF chunk with Mistral OCR
 */
async function processPdfChunk(chunkBuffer: Buffer, chunkIndex: number, totalChunks: number): Promise<string> {
  try {
    logger.info("Processing PDF chunk with Mistral OCR", {
      chunkIndex: chunkIndex + 1,
      totalChunks,
      chunkSize: chunkBuffer.length
    });

    // Convert chunk to base64 for direct processing
    const base64Pdf = await encodePdf(chunkBuffer);

    const ocrResponse = await timeoutWrappers.ocrRequest(
      () => mistral.ocr.process({
        model: "mistral-ocr-latest",
        document: {
          type: "document_url",
          documentUrl: `data:application/pdf;base64,${base64Pdf}`
        },
        includeImageBase64: false
      }),
      'Mistral OCR request'
    );

    const pages = ocrResponse.pages || [];
    if (pages.length === 0) {
      throw new Error("Mistral OCR returned no pages for chunk");
    }

    // Extract text from pages
    const pageTexts = pages.map((page) => page.markdown || "").filter(text => text.trim());
    
    if (pageTexts.length === 0) {
      throw new Error("Mistral OCR returned no readable text for chunk");
    }

    const chunkText = pageTexts.join('\n\n--- Page Break ---\n\n');
    
    logger.info("PDF chunk processed successfully", {
      chunkIndex: chunkIndex + 1,
      totalChunks,
      pagesInChunk: pages.length,
      textLength: chunkText.length
    });

    return chunkText;
  } catch (error) {
    logger.error("Error processing PDF chunk", {
      chunkIndex: chunkIndex + 1,
      totalChunks,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Extract text from PDF using Mistral OCR with base64 data
 */
export async function extractWithMistralOCRFromBase64(base64Pdf: string | null, opts: Options): Promise<string> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error("Missing Mistral OCR config");

  if (!base64Pdf) throw new Error("Missing base64 PDF");

  try {
    logger.info("Starting Mistral OCR extraction from base64", { base64Length: base64Pdf.length });

    const ocrResponse = await timeoutWrappers.ocrRequest(
      () => mistral.ocr.process({
        model: "mistral-ocr-latest",
        document: {
          type: "document_url",
          documentUrl: `data:application/pdf;base64,${base64Pdf}`
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

/**
 * Extract text from PDF using Mistral OCR with chunking support
 * Handles large documents by splitting them into 500-page chunks
 */
export async function extractWithMistralOCR(documentUrl: string, opts: Options): Promise<string> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error("Missing Mistral OCR config");

  try {
    logger.info("Starting Mistral OCR extraction", { documentUrl });

    // First, try to process the entire document
    try {
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

    } catch (error: any) {
      // Check if it's a page limit error
      if (error.message && error.message.includes("more than the maximum allowed of 1000")) {
        logger.warn("Document exceeds Mistral page limit, attempting to split", {
          error: error.message
        });
        
        // For URL-based documents, we need to download first to split
        // This is a limitation of the current approach - we'd need the actual file buffer
        throw new Error("Document too large for Mistral OCR - falling back to PDF text extraction");
      }
      
      // Re-throw other errors
      throw error;
    }

  } catch (err) {
    logger.error("Mistral OCR error", { err: err instanceof Error ? err.message : String(err) });
    throw new Error("Mistral OCR failed");
  }
}

/**
 * Extract text from PDF using Mistral OCR with chunking support for large documents
 * This version works with file buffers and can split large documents
 * Respects BOTH size (20MB) and page (1000 pages) constraints
 */
export async function extractWithMistralOCRFromBuffer(buffer: Buffer, opts: Options): Promise<string> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error("Missing Mistral OCR config");

  try {
    const bufferSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
    logger.info("Starting Mistral OCR extraction from buffer", { 
      bufferSize: buffer.length,
      bufferSizeMB 
    });

    // Check if document needs splitting based on BOTH constraints
    const pageCount = await getPdfPageCount(buffer);
    const estimatedBase64Size = buffer.length * 1.33;
    
    logger.info("Checking if document needs splitting", {
      pageCount,
      bufferSizeMB,
      estimatedBase64SizeMB: (estimatedBase64Size / (1024 * 1024)).toFixed(2),
      maxPages: MAX_PAGES_PER_CHUNK,
      maxSizeMB: (MAX_CHUNK_SIZE_BYTES / (1024 * 1024)).toFixed(0)
    });
    
    // Process directly only if BOTH constraints are satisfied
    const canProcessDirectly = pageCount <= MAX_PAGES_PER_CHUNK && buffer.length <= MAX_CHUNK_SIZE_BYTES;
    
    if (canProcessDirectly) {
      logger.info("Document is small enough, processing directly", { 
        pageCount,
        bufferSizeMB,
        estimatedBase64SizeMB: (estimatedBase64Size / (1024 * 1024)).toFixed(2)
      });
      // Convert buffer to base64 and process directly
      const base64Pdf = await encodePdf(buffer);
      return await extractWithMistralOCRFromBase64(base64Pdf, opts);
    }

    // Document needs splitting - determine reason
    const reasons: string[] = [];
    if (pageCount > MAX_PAGES_PER_CHUNK) {
      reasons.push(`page count (${pageCount} > ${MAX_PAGES_PER_CHUNK})`);
    }
    if (buffer.length > MAX_CHUNK_SIZE_BYTES) {
      reasons.push(`size (${bufferSizeMB}MB > ${(MAX_CHUNK_SIZE_BYTES / (1024 * 1024)).toFixed(0)}MB)`);
    }
    
    logger.info("Document is large, splitting into chunks", { 
      pageCount,
      bufferSizeMB,
      reasons: reasons.join(', ')
    });
    
    // Split the document using size and page-aware splitting
    const chunks = await splitPdfBySizeAndPages(buffer, MAX_CHUNK_SIZE_BYTES, MAX_PAGES_PER_CHUNK);
    const chunkResults: string[] = [];

    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      try {
        const chunkSizeMB = (chunks[i].length / (1024 * 1024)).toFixed(2);
        logger.info("Processing chunk", { 
          chunkIndex: i + 1, 
          totalChunks: chunks.length,
          chunkSizeMB 
        });
        const chunkText = await processPdfChunk(chunks[i], i, chunks.length);
        chunkResults.push(chunkText);
      } catch (error) {
        logger.error("Failed to process chunk", {
          chunkIndex: i + 1,
          totalChunks: chunks.length,
          error: error instanceof Error ? error.message : String(error)
        });
        // Continue with other chunks even if one fails
        chunkResults.push(`[Chunk ${i + 1} processing failed: ${error instanceof Error ? error.message : String(error)}]`);
      }
    }

    // Combine all chunk results
    const finalText = chunkResults.join('\n\n=== CHUNK BREAK ===\n\n').trim();

    logger.info("Mistral OCR chunked extraction completed", {
      originalPages: pageCount,
      originalSizeMB: bufferSizeMB,
      chunksProcessed: chunks.length,
      totalTextLength: finalText.length
    });

    return finalText;

  } catch (err) {
    logger.error("Mistral OCR chunked extraction error", { err: err instanceof Error ? err.message : String(err) });
    throw new Error("Mistral OCR chunked extraction failed");
  }
}


