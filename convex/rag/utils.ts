'use node'

import mammoth from 'mammoth';
import { defaultChunker, guessMimeTypeFromContents, guessMimeTypeFromExtension } from "@convex-dev/rag";
import { internalAction } from "../_generated/server";
import { v } from 'convex/values';
import { Mistral } from '@mistralai/mistralai';
import { PDFDocument } from 'pdf-lib';
import { createClient } from '@deepgram/sdk'

const mistral = new Mistral({
    apiKey: process.env.MISTRAL_API_KEY,
});

/**
 * Extracts text content from various document formats.
 * 
 * @param file - The file blob to extract text from
 * @returns Promise<string> - The extracted text content
 */
export const extractDocumentText = internalAction({
    args: {
      file: v.id("_storage"),
      fileName: v.string(),
    },
    handler: async (ctx, args) => {
    try {
        const file = await ctx.storage.get(args.file);

        if (!file) {
            throw new Error("File not found");
        }

        const mimeType = guessMimeTypeFromExtension(args.fileName);
        console.log("Extracting text from document with MIME type:", mimeType);

        // Handle TXT files
        if (mimeType === 'text/plain' || mimeType === 'text/plain; charset=utf-8') {
            return await extractTextFromTxt(file);
        }

        // Handle DOCX files
        if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            return await extractTextFromDocx(file);
        }

        // Handle legacy DOC files
        if (mimeType === 'application/msword') {
            throw new Error("Legacy .doc files are not supported. Please convert to .docx format.");
        }

        // Handle PDF files (placeholder for future implementation)
        if (mimeType === 'application/pdf') {
            return await extractTextFromPdf(file);
        }

        // Handle video files (placeholder for future implementation)
        if (mimeType?.startsWith('video/')) {
            return await extractTextFromVideo(file);
        }

        // Handle audio files (placeholder for future implementation)
        if (mimeType?.startsWith('audio/')) {
            return await extractTextFromAudio(file);
        }

        // Default case - try to extract as text
        console.warn(`Unknown MIME type: ${mimeType}. Attempting to extract as text.`);
        return await extractTextFromTxt(file);

    } catch (error) {
        console.error("Error extracting document text:", error);
        throw new Error(`Failed to extract text from document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}});


/**
 * Extracts text from TXT files.
 * 
 * @param file - The text file blob
 * @returns Promise<string> - The extracted text content
 */
async function extractTextFromTxt(file: Blob): Promise<string> {
    try {
        const text = await file.text();
        
        // Normalize line endings and remove excessive whitespace
        const normalizedText = text
            .replace(/\r\n/g, '\n')  // Convert Windows line endings
            .replace(/\r/g, '\n')    // Convert Mac line endings
            .replace(/\n{3,}/g, '\n\n')  // Remove excessive blank lines
            .trim();
        
        if (!normalizedText) {
            throw new Error("Document appears to be empty or contains no readable text");
        }
        
        console.log(`Successfully extracted ${normalizedText.length} characters from TXT file`);
        return normalizedText;
        
    } catch (error) {
        console.error("Error extracting text from TXT file:", error);
        throw new Error(`Failed to read TXT file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Extracts text from DOCX files.
 * 
 * @param file - The DOCX file blob
 * @returns Promise<string> - The extracted text content
 */
async function extractTextFromDocx(file: Blob): Promise<string> {
    try {
        // Convert blob to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Extract text using mammoth
        const result = await mammoth.extractRawText({ buffer });
        
        if (!result.value) {
            throw new Error("No text content found in DOCX file");
        }
        
        // Normalize the extracted text
        const normalizedText = result.value
            .replace(/\r\n/g, '\n')  // Convert Windows line endings
            .replace(/\r/g, '\n')    // Convert Mac line endings
            .replace(/\n{3,}/g, '\n\n')  // Remove excessive blank lines
            .trim();
        
        if (!normalizedText) {
            throw new Error("Document appears to be empty or contains no readable text");
        }
        
        console.log(`Successfully extracted ${normalizedText.length} characters from DOCX file`);
        
        // Log any warnings from mammoth
        if (result.messages && result.messages.length > 0) {
            console.warn("Mammoth extraction warnings:", result.messages);
        }
        
        return normalizedText;
        
    } catch (error) {
        console.error("Error extracting text from DOCX file:", error);
        throw new Error(`Failed to read DOCX file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Extracts text from video files through transcription.
 * 
 * @param file - The video file blob
 * @returns Promise<string> - The transcribed text content
 */
async function extractTextFromVideo(file: Blob): Promise<string> {
    try {
       
        return await extractTextFromAudio(file);
        
    } catch (error) {
        console.error("Error extracting text from video file:", error);
        throw new Error(`Failed to transcribe video file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Extracts text from audio files through transcription.
 * 
 * @param file - The audio file blob
 * @returns Promise<string> - The transcribed text content
 */
async function extractTextFromAudio(file: Blob): Promise<string> {
    try {
        const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const {result, error} = await deepgram.listen.prerecorded.transcribeFile(buffer, {
            model: 'nova-3',
        });
        
        if (error) {
            throw new Error(`Error transcribing video: ${error.message}`);
        }

        return result.results?.channels[0]?.alternatives[0]?.transcript || '';

    } catch (error) {
        console.error("Error extracting text from audio file:", error);
        throw new Error(`Failed to transcribe audio file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}



/**
 * Extracts text from a PDF file.
 * 
 * @param file - The PDF file blob
 * @returns Promise<string> - The extracted text content
 */
async function extractTextFromPdf(file: Blob): Promise<string> {
    try {
        const pageCount = await getPdfPageCount(file);
        const CHUNK_SIZE = 500;
        
        console.log(`Processing PDF with ${pageCount} pages in chunks of ${CHUNK_SIZE}`);
        
        // If PDF has 500 pages or less, process normally
        if (pageCount <= CHUNK_SIZE) {
            return await processPdfChunk(file, 0, pageCount - 1);
        }
        
        // Process PDF in chunks of 500 pages
        const chunks: string[] = [];
        for (let startPage = 0; startPage < pageCount; startPage += CHUNK_SIZE) {
            const endPage = Math.min(startPage + CHUNK_SIZE - 1, pageCount - 1);
            console.log(`Processing pages ${startPage + 1} to ${endPage + 1} of ${pageCount}`);
            
            const chunkText = await processPdfChunk(file, startPage, endPage);
            chunks.push(chunkText);
        }
        
        // Combine all chunks
        const totalContent = chunks.join("\n\n--- Page Break ---\n\n");
        console.log(`Successfully processed PDF in ${chunks.length} chunks`);
        
        return totalContent;

    } catch (error) {
        console.error("Error extracting text from PDF file:", error);
        throw new Error(`Failed to extract text from PDF file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Processes a specific range of pages from a PDF file.
 * 
 * @param file - The PDF file blob
 * @param startPage - Starting page index (0-based)
 * @param endPage - Ending page index (0-based)
 * @returns Promise<string> - The extracted text content for the page range
 */
async function processPdfChunk(file: Blob, startPage: number, endPage: number): Promise<string> {
    try {
        // Create a new PDF with only the specified page range
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        
        // Create a new PDF document for the chunk
        const chunkPdf = await PDFDocument.create();
        
        // Copy pages from startPage to endPage
        const pagesToCopy = [];
        for (let i = startPage; i <= endPage; i++) {
            pagesToCopy.push(i);
        }
        
        const copiedPages = await chunkPdf.copyPages(pdfDoc, pagesToCopy);
        copiedPages.forEach((page) => chunkPdf.addPage(page));
        
        // Convert the chunk PDF to base64
        const chunkPdfBytes = await chunkPdf.save();
        const chunkBase64 = Buffer.from(chunkPdfBytes).toString('base64');
        
        // Process with Mistral OCR
        const ocrResponse = await mistral.ocr.process({
            model: "mistral-ocr-latest",
            document: {
                type: "document_url",
                documentUrl: "data:application/pdf;base64," + chunkBase64
            },
            includeImageBase64: false,
        });
        
        const chunkContent = ocrResponse.pages.map((page) => page.markdown).join("\n\n");
        
        console.log(`Processed pages ${startPage + 1}-${endPage + 1}: ${chunkContent.length} characters`);
        return chunkContent;
        
    } catch (error) {
        console.error(`Error processing PDF chunk (pages ${startPage + 1}-${endPage + 1}):`, error);
        throw new Error(`Failed to process PDF chunk: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}


async function getPdfPageCount(file: Blob): Promise<number> {
    try {
        // Convert blob to array buffer
        const arrayBuffer = await file.arrayBuffer();
        
        // Load the PDF document using pdf-lib
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        
        // Get the page count
        const pageCount = pdfDoc.getPageCount();
        
        console.log(`PDF contains ${pageCount} pages`);
        return pageCount;
        
    } catch (error) {
        console.error("Error getting PDF page count:", error);
        throw new Error(`Failed to get PDF page count: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}


/**
 * TODO: IMPLEMENT DOCUMENT CHUNKING STRATEGY
 * Placeholder function for chunking document content.
 * 
 * @param content - The document text content
 * @param config - Chunking configuration
 * @returns Promise<Array> - Array of chunks with metadata
 */
export const chunkDocumentContent = internalAction({
    args: {
        content: v.string(),
    },
    handler: async (ctx, args) => {
   const chunks = defaultChunker(args.content, {
    minLines: 1,
    minCharsSoftLimit: 100,
    maxCharsSoftLimit: 1000,
    maxCharsHardLimit: 10000,
    delimiter: "\n\n",
    
   })

   return chunks;
}});