import { logger } from '../middleware/logging.js';
import { extractWithMistralOCR } from './mistralOcrService.js';
import { extractWithPdfFallback } from './pdfFallbackService.js';
import {
  extractTextFromTxt,
  extractTextFromDocx,
  extractTextFromXlsx,
  extractTextFromPptx,
  extractTextFromCsv,
  extractTextFromAudio,
  extractTextFromVideo
} from './textExtractionService.js';
import {
  guessMimeTypeFromExtension,
  isTextFile,
  isDocxFile,
  isXlsxFile,
  isPptxFile,
  isCsvFile,
  isAudioFile,
  isVideoFile,
  isPdfFile
} from '../utils/mimeTypeUtils.js';

export type ExtractionMethod = 
  | 'mistral-ocr-latest'
  | 'pdf-fallback'
  | 'docx-mammoth'
  | 'xlsx-sheetjs'
  | 'pptx-jszip'
  | 'csv-text'
  | 'txt-text'
  | 'audio-deepgram'
  | 'video-deepgram';

export interface ExtractionResult {
  text: string;
  method: ExtractionMethod;
}

/**
 * Main document extraction service that routes to appropriate processors
 * based on file type and content.
 */
export async function extractDocumentText(
  buffer: Buffer,
  signedUrl: string,
  fileName?: string,
  contentType?: string,
  options: { pageWindow?: number } = {}
): Promise<ExtractionResult> {
  
  const pageWindow = options.pageWindow ?? 50;
  
  // Determine MIME type
  let mimeType = contentType;
  if (!mimeType && fileName) {
    mimeType = guessMimeTypeFromExtension(fileName);
  }
  
  if (!mimeType) {
    throw new Error("Unable to determine file type");
  }
  
  logger.info("Extracting text from document", { 
    mimeType, 
    fileName,
    bufferSize: buffer.length 
  });

  try {
    // Handle TXT files
    if (isTextFile(mimeType)) {
      const text = await extractTextFromTxt(buffer);
      return { text, method: 'txt-text' };
    }

    // Handle DOCX files  
    if (isDocxFile(mimeType)) {
      const text = await extractTextFromDocx(buffer);
      return { text, method: 'docx-mammoth' };
    }

    // Handle XLSX files
    if (isXlsxFile(mimeType)) {
      const text = await extractTextFromXlsx(buffer);
      return { text, method: 'xlsx-sheetjs' };
    }

    // Handle PPTX files
    if (isPptxFile(mimeType)) {
      const text = await extractTextFromPptx(buffer);
      return { text, method: 'pptx-jszip' };
    }

    // Handle CSV files
    if (isCsvFile(mimeType)) {
      const text = await extractTextFromCsv(buffer);
      return { text, method: 'csv-text' };
    }

    // Handle audio files
    if (isAudioFile(mimeType)) {
      const text = await extractTextFromAudio(buffer, mimeType);
      return { text, method: 'audio-deepgram' };
    }

    // Handle video files
    if (isVideoFile(mimeType)) {
      const text = await extractTextFromVideo(buffer, mimeType);
      return { text, method: 'video-deepgram' };
    }

    // Handle PDF files - try OCR first, fall back to text extraction
    if (isPdfFile(mimeType)) {
      let text = "";
      let method: ExtractionMethod = "mistral-ocr-latest";
      
      try {
        text = await extractWithMistralOCR(signedUrl, { pageWindow });
      } catch (err) {
        logger.warn("Mistral OCR failed, using PDF fallback", { err: String(err) });
        method = "pdf-fallback";
        text = await extractWithPdfFallback(buffer, { pageWindow });
      }
      
      return { text, method };
    }

    // Handle legacy DOC files
    if (mimeType === 'application/msword') {
      throw new Error("Legacy .doc files are not supported. Please convert to .docx format.");
    }

    // Default case - try to extract as text
    logger.warn(`Unknown MIME type: ${mimeType}. Attempting to extract as text.`);
    const text = await extractTextFromTxt(buffer);
    return { text, method: 'txt-text' };

  } catch (error) {
    logger.error("Error extracting document text:", error);
    throw new Error(`Failed to extract text from document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
