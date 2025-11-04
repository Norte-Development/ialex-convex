// Use legacy build to avoid worker requirements in Node environments
import { promises as fs } from 'fs';
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { logger } from '../../middleware/logging';
import { TempFileManager } from '../../utils/tempFileManager';
import { StreamingJobState } from '../../types/jobState';

export interface PdfStreamOptions {
  pageWindow: number;
  onPageBatch?: (batch: string, startPage: number, endPage: number) => Promise<void>;
}

export class StreamingPdfExtractor {
  private tempFileManager: TempFileManager;

  constructor(tempFileManager: TempFileManager) {
    this.tempFileManager = tempFileManager;
  }

  /**
   * Extract PDF text in page batches to avoid loading entire PDF
   * Supports resume from last processed page
   */
  async extractInBatchesWithResume(
    pdfPath: string,
    state: StreamingJobState,
    options: PdfStreamOptions
  ): Promise<void> {
    const { pageWindow, onPageBatch } = options;

    try {
      const buffer = await fs.readFile(pdfPath);
      // Convert Buffer to Uint8Array (pdfjs requires Uint8Array, not Buffer)
      const data = new Uint8Array(buffer);
      const pdf = await getDocument({ data }).promise;
      const totalPages = pdf.numPages;

      // Resume from last extracted page
      const startPage = state.progress.lastExtractedPage + 1;

      logger.info('Starting PDF extraction with resume', {
        totalPages,
        startPage,
        pageWindow,
        resuming: startPage > 1
      });

      // Process from resume point
      for (let currentPage = startPage; currentPage <= totalPages; currentPage += pageWindow) {
        const endPage = Math.min(currentPage + pageWindow - 1, totalPages);
        
        logger.debug('Processing PDF page batch', { currentPage, endPage });

        const batchText = await this.extractPageRange(pdf, currentPage, endPage);

        if (onPageBatch) {
          await onPageBatch(batchText, currentPage, endPage);
        }

        // Update resume point after successful batch
        state.progress.lastExtractedPage = endPage;
        state.progress.pagesExtracted = endPage;
        state.progress.pagesTotal = totalPages;
      }

      logger.info('PDF extraction completed', { totalPages });

    } catch (error) {
      logger.error('PDF extraction failed', { 
        lastExtractedPage: state.progress.lastExtractedPage,
        error: String(error) 
      });
      throw error;
    }
  }

  private async extractPageRange(
    pdf: Awaited<NonNullable<ReturnType<typeof getDocument>['promise']>>,
    startPage: number,
    endPage: number
  ): Promise<string> {
    const pageTexts: string[] = [];

    for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: unknown) => {
            const textItem = item as { str?: string };
            return textItem.str || '';
          })
          .join(' ');
        
        pageTexts.push(`[Page ${pageNum}]\n${pageText}`);
      } catch (pageError) {
        logger.warn('Failed to extract PDF page', { 
          pageNum, 
          error: String(pageError) 
        });
        pageTexts.push(`[Page ${pageNum}] - Extraction failed`);
      }
    }

    return pageTexts.join('\n\n');
  }
}
