import mammoth from 'mammoth';
import XLSX from 'xlsx';
import JSZip from 'jszip';
import { createClient } from '@deepgram/sdk';
import { logger } from '../middleware/logging.js';

/**
 * Extracts text from TXT files.
 */
export async function extractTextFromTxt(buffer: Buffer): Promise<string> {
  try {
    const text = buffer.toString('utf-8');
    
    // Normalize line endings and remove excessive whitespace
    const normalizedText = text
      .replace(/\r\n/g, '\n')  // Convert Windows line endings
      .replace(/\r/g, '\n')    // Convert Mac line endings
      .replace(/\n{3,}/g, '\n\n')  // Remove excessive blank lines
      .trim();
    
    if (!normalizedText) {
      throw new Error("Document appears to be empty or contains no readable text");
    }
    
    logger.info(`Successfully extracted ${normalizedText.length} characters from TXT file`);
    return normalizedText;
    
  } catch (error) {
    logger.error("Error extracting text from TXT file:", error);
    throw new Error(`Failed to read TXT file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extracts text from DOCX files.
 */
export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  try {
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
    
    logger.info(`Successfully extracted ${normalizedText.length} characters from DOCX file`);
    
    // Log any warnings from mammoth
    if (result.messages && result.messages.length > 0) {
      logger.warn("Mammoth extraction warnings:", result.messages);
    }
    
    return normalizedText;
    
  } catch (error) {
    logger.error("Error extracting text from DOCX file:", error);
    throw new Error(`Failed to read DOCX file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extracts text from XLSX files.
 */
export async function extractTextFromXlsx(buffer: Buffer): Promise<string> {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
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
    
    const result = texts.join('\n');
    logger.info(`Successfully extracted ${result.length} characters from XLSX file`);
    return result;
    
  } catch (error) {
    logger.error("Error extracting text from XLSX file:", error);
    throw new Error(`Failed to read XLSX file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extracts text from PPTX files.
 */
export async function extractTextFromPptx(buffer: Buffer): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(buffer);
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
    
    const result = texts.join('\n\n');
    logger.info(`Successfully extracted ${result.length} characters from PPTX file`);
    return result;
    
  } catch (error) {
    logger.error("Error extracting text from PPTX file:", error);
    throw new Error(`Failed to read PPTX file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extracts text from CSV files.
 */
export async function extractTextFromCsv(buffer: Buffer): Promise<string> {
  try {
    const text = buffer.toString('utf-8');
    const normalized = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();
    
    logger.info(`Successfully extracted ${normalized.length} characters from CSV file`);
    return normalized;
    
  } catch (error) {
    logger.error("Error extracting text from CSV file:", error);
    throw new Error(`Failed to read CSV file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extracts text from audio files through transcription.
 */
export async function extractTextFromAudio(buffer: Buffer): Promise<string> {
  try {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      throw new Error("Missing Deepgram API key for audio transcription");
    }
    
    const deepgram = createClient(apiKey);

    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(buffer, {
      model: 'nova-2',
    });
    
    if (error) {
      throw new Error(`Error transcribing audio: ${error.message}`);
    }

    const transcript = result.results?.channels[0]?.alternatives[0]?.transcript || '';
    
    if (!transcript.trim()) {
      throw new Error("No speech detected in audio file");
    }
    
    logger.info(`Successfully transcribed ${transcript.length} characters from audio file`);
    return transcript;

  } catch (error) {
    logger.error("Error extracting text from audio file:", error);
    throw new Error(`Failed to transcribe audio file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extracts text from video files through audio transcription.
 */
export async function extractTextFromVideo(buffer: Buffer): Promise<string> {
  try {
    // For video files, we use the same transcription approach as audio
    // The Deepgram API can handle video files and extract audio for transcription
    return await extractTextFromAudio(buffer);
    
  } catch (error) {
    logger.error("Error extracting text from video file:", error);
    throw new Error(`Failed to transcribe video file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
