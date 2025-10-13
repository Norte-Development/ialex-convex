// Use legacy build to run in Node without workers
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { PDFDocument } from "pdf-lib";
import { logger } from "../middleware/logging";

// No worker configuration needed with legacy build in Node

/**
 * Split a large PDF document into smaller chunks that fit within Mistral's page limits
 */
export async function splitPdfForMistralOCR(
  buffer: Buffer, 
  maxPagesPerChunk: number = 500 // 500 pages per chunk as requested
): Promise<Buffer[]> {
  try {
    logger.info("Starting PDF splitting for large document", {
      originalSize: buffer.length,
      maxPagesPerChunk
    });

    // Load the original PDF
    const originalPdf = await PDFDocument.load(buffer);
    const totalPages = originalPdf.getPageCount();
    
    if (totalPages <= maxPagesPerChunk) {
      logger.info("Document is small enough, no splitting needed", { totalPages });
      return [buffer];
    }

    logger.info("Document needs splitting", { 
      totalPages, 
      chunksNeeded: Math.ceil(totalPages / maxPagesPerChunk) 
    });

    const chunks: Buffer[] = [];
    const chunkCount = Math.ceil(totalPages / maxPagesPerChunk);

    for (let i = 0; i < chunkCount; i++) {
      const startPage = i * maxPagesPerChunk;
      const endPage = Math.min(startPage + maxPagesPerChunk, totalPages);
      
      // Create a new PDF document for this chunk
      const chunkPdf = await PDFDocument.create();
      
      // Copy pages from the original PDF to the chunk
      const pagesToCopy = Array.from({ length: endPage - startPage }, (_, idx) => startPage + idx);
      const copiedPages = await chunkPdf.copyPages(originalPdf, pagesToCopy);
      
      // Add copied pages to the chunk document
      copiedPages.forEach((page) => chunkPdf.addPage(page));
      
      // Serialize the chunk to a buffer
      const chunkBuffer = Buffer.from(await chunkPdf.save());
      
      chunks.push(chunkBuffer);
      
      logger.info("Created PDF chunk", {
        chunkIndex: i + 1,
        totalChunks: chunkCount,
        pagesInChunk: endPage - startPage,
        chunkSize: chunkBuffer.length
      });
    }

    logger.info("PDF splitting completed", {
      originalPages: totalPages,
      chunksCreated: chunks.length,
      totalChunkSize: chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    });

    return chunks;
  } catch (error) {
    logger.error("Error splitting PDF", { error: error instanceof Error ? error.message : String(error) });
    throw new Error(`Failed to split PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get the page count of a PDF document
 */
export async function getPdfPageCount(buffer: Buffer): Promise<number> {
  try {
    const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise;
    return pdf.numPages;
  } catch (error) {
    logger.error("Error getting PDF page count", { error: error instanceof Error ? error.message : String(error) });
    throw new Error(`Failed to get PDF page count: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Split a PDF document by BOTH size and page count constraints
 * Creates chunks when EITHER limit is reached (whichever comes first)
 * 
 * @param buffer - The PDF buffer to split
 * @param maxChunkSizeBytes - Maximum size per chunk in bytes (default 20MB)
 * @param maxPagesPerChunk - Maximum pages per chunk (default 1000 - Mistral's limit)
 * @returns Array of PDF chunk buffers
 */
export async function splitPdfBySizeAndPages(
  buffer: Buffer,
  maxChunkSizeBytes: number = 20 * 1024 * 1024, // 20MB default
  maxPagesPerChunk: number = 1000 // Mistral's hard page limit
): Promise<Buffer[]> {
  try {
    logger.info("Starting size and page-aware PDF splitting", {
      originalSize: buffer.length,
      originalSizeMB: Math.round(buffer.length / (1024 * 1024)),
      maxChunkSizeBytes,
      maxChunkSizeMB: Math.round(maxChunkSizeBytes / (1024 * 1024)),
      maxPagesPerChunk
    });

    // Load the original PDF
    const originalPdf = await PDFDocument.load(buffer);
    const totalPages = originalPdf.getPageCount();
    
    logger.info("PDF loaded for splitting", { totalPages });

    // Use 90% of max size as threshold to leave safety margin
    const safeMaxChunkSize = Math.floor(maxChunkSizeBytes * 0.9);
    
    logger.info("Using safety margin for chunk size", {
      maxChunkSizeBytes,
      safeMaxChunkSize,
      safeMaxChunkSizeMB: Math.round(safeMaxChunkSize / (1024 * 1024))
    });

    const chunks: Buffer[] = [];
    let currentChunkPages: number[] = [];
    let currentChunkSize = 0;

    for (let pageNum = 0; pageNum < totalPages; pageNum++) {
      // Extract single page to calculate its size
      const singlePagePdf = await PDFDocument.create();
      const [copiedPage] = await singlePagePdf.copyPages(originalPdf, [pageNum]);
      singlePagePdf.addPage(copiedPage);
      const singlePageBuffer = Buffer.from(await singlePagePdf.save());
      const pageSize = singlePageBuffer.length;

      logger.debug("Processing page", {
        pageNum: pageNum + 1,
        totalPages,
        pageSize,
        pageSizeMB: (pageSize / (1024 * 1024)).toFixed(2),
        currentChunkPages: currentChunkPages.length,
        currentChunkSize,
        currentChunkSizeMB: (currentChunkSize / (1024 * 1024)).toFixed(2)
      });

      // Check if this single page exceeds the maximum allowed size
      if (pageSize > maxChunkSizeBytes) {
        const pageSizeMB = (pageSize / (1024 * 1024)).toFixed(2);
        const limitMB = (maxChunkSizeBytes / (1024 * 1024)).toFixed(0);
        throw new Error(
          `PDF page ${pageNum + 1} exceeds maximum size limit. ` +
          `Page size: ${pageSizeMB}MB, Limit: ${limitMB}MB. ` +
          `This page cannot be processed. Please reduce the image resolution or split the document manually.`
        );
      }

      // Check if adding this page would exceed EITHER constraint
      const wouldExceedSize = currentChunkSize + pageSize > safeMaxChunkSize;
      const wouldExceedPages = currentChunkPages.length >= maxPagesPerChunk;

      if (currentChunkPages.length > 0 && (wouldExceedSize || wouldExceedPages)) {
        // Save current chunk before adding this page
        const chunkPdf = await PDFDocument.create();
        const copiedPages = await chunkPdf.copyPages(originalPdf, currentChunkPages);
        copiedPages.forEach((page) => chunkPdf.addPage(page));
        const chunkBuffer = Buffer.from(await chunkPdf.save());
        
        chunks.push(chunkBuffer);
        
        logger.info("Created PDF chunk", {
          chunkIndex: chunks.length,
          pagesInChunk: currentChunkPages.length,
          chunkSize: chunkBuffer.length,
          chunkSizeMB: (chunkBuffer.length / (1024 * 1024)).toFixed(2),
          reason: wouldExceedSize ? 'size limit' : 'page limit',
          currentChunkSizeMB: (currentChunkSize / (1024 * 1024)).toFixed(2)
        });

        // Reset for new chunk
        currentChunkPages = [];
        currentChunkSize = 0;
      }

      // Add current page to chunk
      currentChunkPages.push(pageNum);
      currentChunkSize += pageSize;
    }

    // Save any remaining pages as final chunk
    if (currentChunkPages.length > 0) {
      const chunkPdf = await PDFDocument.create();
      const copiedPages = await chunkPdf.copyPages(originalPdf, currentChunkPages);
      copiedPages.forEach((page) => chunkPdf.addPage(page));
      const chunkBuffer = Buffer.from(await chunkPdf.save());
      
      chunks.push(chunkBuffer);
      
      logger.info("Created final PDF chunk", {
        chunkIndex: chunks.length,
        pagesInChunk: currentChunkPages.length,
        chunkSize: chunkBuffer.length,
        chunkSizeMB: (chunkBuffer.length / (1024 * 1024)).toFixed(2)
      });
    }

    logger.info("PDF splitting completed", {
      originalPages: totalPages,
      originalSizeMB: Math.round(buffer.length / (1024 * 1024)),
      chunksCreated: chunks.length,
      totalChunkSize: chunks.reduce((sum, chunk) => sum + chunk.length, 0),
      totalChunkSizeMB: Math.round(chunks.reduce((sum, chunk) => sum + chunk.length, 0) / (1024 * 1024))
    });

    return chunks;
  } catch (error) {
    logger.error("Error splitting PDF by size and pages", { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error instanceof Error ? error : new Error(`Failed to split PDF: ${String(error)}`);
  }
}

