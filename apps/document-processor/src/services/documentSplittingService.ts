import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import { PDFDocument } from "pdf-lib";
import { logger } from "../middleware/logging";

// Configure PDF.js
GlobalWorkerOptions.workerSrc = "node_modules/pdfjs-dist/build/pdf.worker.js";

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
    const pdf = await getDocument({ data: buffer }).promise;
    return pdf.numPages;
  } catch (error) {
    logger.error("Error getting PDF page count", { error: error instanceof Error ? error.message : String(error) });
    throw new Error(`Failed to get PDF page count: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Upload a PDF chunk to temporary storage and return a signed URL
 * This is a placeholder - in production you'd upload to your storage service
 */
export async function uploadPdfChunk(chunkBuffer: Buffer, chunkIndex: number): Promise<string> {
  // For now, we'll use a data URL approach
  // In production, you'd upload to your storage service (GCS, S3, etc.)
  const base64 = chunkBuffer.toString('base64');
  return `data:application/pdf;base64,${base64}`;
}
