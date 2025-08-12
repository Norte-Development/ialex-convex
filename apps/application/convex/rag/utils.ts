'use node'

import mammoth from 'mammoth';
import { defaultChunker, guessMimeTypeFromContents, guessMimeTypeFromExtension } from "@convex-dev/rag";
import { internalAction } from "../_generated/server";
import { v } from 'convex/values';
import { Mistral } from '@mistralai/mistralai';
import { PDFDocument } from 'pdf-lib';
import { createClient } from '@deepgram/sdk'
import XLSX from 'xlsx'
import JSZip from 'jszip'

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
        let fileType = file?.type;

        if (!file) {
            throw new Error("File not found");
        }

        if (!fileType) {
            fileType = guessMimeTypeFromExtension(args.fileName);
        }

        const mimeType = fileType;
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

        // Handle CSV files
        if (
            mimeType === 'text/csv' ||
            mimeType === 'application/csv' ||
            mimeType === 'application/vnd.ms-excel'
        ) {
            return await extractTextFromCsv(file);
        }

        // Handle XLSX files
        if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
            return await extractTextFromXlsx(file);
        }

        // Handle PPTX files
        if (mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
            return await extractTextFromPptx(file);
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
        if (pageCount > 100) {
            throw new Error("PDF has more than 100 pages. Please split into smaller chunks.");
        }
        
        console.log(`Processing PDF with ${pageCount} pages`);
        
        // Convert PDF to base64 and process with Mistral OCR
        const arrayBuffer = await file.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        
        // Process with Mistral OCR
        const ocrResponse = await mistral.ocr.process({
            model: "mistral-ocr-latest",
            document: {
                type: "document_url",
                documentUrl: "data:application/pdf;base64," + base64
            },
            includeImageBase64: false,
        });
        
        const content = ocrResponse.pages.map((page) => page.markdown).join("\n\n");
        
        console.log(`Successfully processed PDF: ${content.length} characters`);
        return content;

    } catch (error) {
        console.error("Error extracting text from PDF file:", error);
        throw new Error(`Failed to extract text from PDF file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}




async function extractTextFromCsv(file: Blob): Promise<string> {
    try {
        const text = await file.text();
        const normalized = text
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .trim();
        return normalized;
    } catch (error) {
        console.error("Error extracting text from CSV file:", error);
        throw new Error(`Failed to read CSV file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

async function extractTextFromXlsx(file: Blob): Promise<string> {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const texts: string[] = [];
        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: true });
            texts.push(`# ${sheetName}`);
            for (const row of rows) {
                const cells = (row || []).map((c) => (c === null || c === undefined) ? '' : String(c));
                texts.push(cells.join('\t'));
            }
            texts.push('');
        }
        return texts.join('\n');
    } catch (error) {
        console.error("Error extracting text from XLSX file:", error);
        throw new Error(`Failed to read XLSX file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

async function extractTextFromPptx(file: Blob): Promise<string> {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);
        const slideFiles = Object.keys(zip.files)
            .filter((name) => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'))
            .sort();
        const texts: string[] = [];
        for (const slideName of slideFiles) {
            const xml = await zip.file(slideName)!.async('string');
            // Extract text nodes inside <a:t>...</a:t>
            const matches = Array.from(xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g));
            const slideText = matches.map((m) => m[1]).join(' ');
            texts.push(slideText.trim());
        }
        return texts.join('\n\n');
    } catch (error) {
        console.error("Error extracting text from PPTX file:", error);
        throw new Error(`Failed to read PPTX file: ${error instanceof Error ? error.message : 'Unknown error'}`);
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