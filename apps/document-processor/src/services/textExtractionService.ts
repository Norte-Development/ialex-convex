import mammoth from 'mammoth';
import XLSX from 'xlsx';
import JSZip from 'jszip';
import { logger } from '../middleware/logging.js';
import { transcribeAudio, isDeepgramAvailable } from './deepgramService.js';
import { validateMediaFile, isMediaFormatSupported } from './mediaProcessingService.js';

/**
 * Extracts text from TXT files with streaming and size limits.
 */
export async function extractTextFromTxt(buffer: Buffer): Promise<string> {
  const maxLines = parseInt(process.env.MAX_TXT_LINES || '500000');
  const maxLineLength = parseInt(process.env.MAX_TXT_LINE_LENGTH || '10000');
  const maxTotalCharacters = parseInt(process.env.MAX_TXT_TOTAL_CHARS || '50000000'); // 50MB

  try {
    logger.info("Starting TXT extraction", {
      bufferSize: buffer.length,
      maxLines,
      maxLineLength,
      maxTotalCharacters
    });

    // For very large buffers, process incrementally
    if (buffer.length > 10 * 1024 * 1024) { // 10MB
      logger.info("Processing large TXT file incrementally");

      const chunkSize = 1024 * 1024; // 1MB chunks
      let fullText = '';
      let offset = 0;

      while (offset < buffer.length && fullText.length < maxTotalCharacters) {
        const chunk = buffer.subarray(offset, offset + chunkSize);
        const chunkText = chunk.toString('utf-8');
        fullText += chunkText;
        offset += chunkSize;

        // Prevent excessive memory usage
        if (fullText.length > maxTotalCharacters * 2) {
          fullText = fullText.substring(0, maxTotalCharacters);
          logger.warn("TXT file truncated during incremental processing", {
            maxTotalCharacters,
            currentLength: fullText.length
          });
          break;
        }
      }

      // Process the accumulated text
      return processTxtContent(fullText, maxLines, maxLineLength, maxTotalCharacters);
    } else {
      // For smaller files, process normally
      const text = buffer.toString('utf-8');
      return processTxtContent(text, maxLines, maxLineLength, maxTotalCharacters);
    }

  } catch (error) {
    logger.error("Error extracting text from TXT file:", error);
    throw new Error(`Failed to read TXT file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Processes TXT content with normalization and limits.
 */
function processTxtContent(
  text: string,
  maxLines: number,
  maxLineLength: number,
  maxTotalCharacters: number
): string {
  // Split into lines first to handle large files efficiently
  const lines = text.split(/\r\n|\r|\n/);

  const processedLines: string[] = [];
  let totalCharacters = 0;
  let linesProcessed = 0;
  let linesTruncated = 0;
  let charactersTruncated = 0;

  for (const line of lines) {
    if (linesProcessed >= maxLines) {
      linesTruncated = lines.length - maxLines;
      logger.warn("TXT line limit reached", {
        maxLines,
        totalLines: lines.length,
        linesProcessed,
        linesTruncated
      });
      break;
    }

    // Limit line length
    let processedLine = line;
    if (line.length > maxLineLength) {
      processedLine = line.substring(0, maxLineLength) + '...[truncated]';
      charactersTruncated += line.length - maxLineLength;
    }

    // Check total character limit
    if (totalCharacters + processedLine.length > maxTotalCharacters) {
      const remainingChars = maxTotalCharacters - totalCharacters;
      if (remainingChars > 0) {
        processedLine = processedLine.substring(0, remainingChars) + '...[truncated]';
        charactersTruncated += processedLine.length - remainingChars;
      } else {
        break;
      }
    }

    processedLines.push(processedLine);
    totalCharacters += processedLine.length;
    linesProcessed++;

    // Final check for total character limit
    if (totalCharacters >= maxTotalCharacters) {
      logger.warn("TXT total character limit reached", {
        maxTotalCharacters,
        totalCharacters,
        linesProcessed
      });
      break;
    }
  }

  // Normalize line endings and remove excessive whitespace
  let normalizedText = processedLines
    .join('\n')
    .replace(/\r\n/g, '\n')  // Convert Windows line endings
    .replace(/\r/g, '\n')    // Convert Mac line endings
    .replace(/\n{3,}/g, '\n\n')  // Remove excessive blank lines
    .trim();

  if (!normalizedText) {
    throw new Error("Document appears to be empty or contains no readable text");
  }

  logger.info("TXT extraction completed", {
    originalLength: text.length,
    totalLines: lines.length,
    linesProcessed,
    linesTruncated,
    totalCharacters,
    charactersTruncated,
    normalizedLength: normalizedText.length,
    limitsApplied: {
      maxLines,
      maxLineLength,
      maxTotalCharacters
    }
  });

  // Add truncation warning if applicable
  if (linesTruncated > 0 || charactersTruncated > 0) {
    const warning = `\n\n--- WARNING: TXT file was truncated ---\n` +
      `Total lines: ${lines.length}, Processed: ${linesProcessed}, Truncated: ${linesTruncated}\n` +
      `Characters truncated: ${charactersTruncated}`;

    normalizedText += warning;
  }

  return normalizedText;
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
 * Extracts text from XLSX files with memory protection and row/column limits.
 */
export async function extractTextFromXlsx(buffer: Buffer): Promise<string> {
  const maxRowsPerSheet = parseInt(process.env.MAX_XLSX_ROWS_PER_SHEET || '10000');
  const maxColumnsPerRow = parseInt(process.env.MAX_XLSX_COLUMNS_PER_ROW || '100');
  const maxSheets = parseInt(process.env.MAX_XLSX_SHEETS || '10');
  const maxTotalCells = parseInt(process.env.MAX_XLSX_TOTAL_CELLS || '500000');

  try {
    logger.info("Starting XLSX extraction", {
      bufferSize: buffer.length,
      maxRowsPerSheet,
      maxColumnsPerRow,
      maxSheets,
      maxTotalCells
    });

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const texts: string[] = [];
    let totalCellsProcessed = 0;
    let truncatedSheets = 0;
    let truncatedRows = 0;

    // Limit the number of sheets to process
    const sheetsToProcess = workbook.SheetNames.slice(0, maxSheets);

    if (workbook.SheetNames.length > maxSheets) {
      logger.warn("XLSX file truncated", {
        totalSheets: workbook.SheetNames.length,
        sheetsProcessed: maxSheets,
        truncatedSheets: workbook.SheetNames.length - maxSheets
      });
    }

    for (const sheetName of sheetsToProcess) {
      const sheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: true });

      // Limit rows per sheet
      const rowsToProcess = rawRows.slice(0, maxRowsPerSheet);
      const sheetCellsProcessed = rowsToProcess.length;

      if (rawRows.length > maxRowsPerSheet) {
        truncatedRows += rawRows.length - maxRowsPerSheet;
      }

      texts.push(`# ${sheetName} (${rowsToProcess.length} rows)`);

      for (const row of rowsToProcess) {
        // Check total cell limit
        if (totalCellsProcessed + (row?.length || 0) > maxTotalCells) {
          const remainingCells = maxTotalCells - totalCellsProcessed;
          const cellsToProcess = Math.min(remainingCells, maxColumnsPerRow);

          if (row && cellsToProcess > 0) {
            const cells = row.slice(0, cellsToProcess).map((c) =>
              (c === null || c === undefined) ? '' : String(c)
            );
            texts.push(cells.join('\t'));
            totalCellsProcessed += cellsToProcess;
          }

          logger.warn("XLSX total cell limit reached", {
            maxTotalCells,
            totalCellsProcessed,
            remainingCells
          });
          break;
        }

        // Limit columns per row
        const cells = (row || []).slice(0, maxColumnsPerRow).map((c) =>
          (c === null || c === undefined) ? '' : String(c)
        );

        texts.push(cells.join('\t'));
        totalCellsProcessed += cells.length;

        // Check if we've hit the total cell limit
        if (totalCellsProcessed >= maxTotalCells) {
          break;
        }
      }

      texts.push('');

      // Check if we've hit the total cell limit
      if (totalCellsProcessed >= maxTotalCells) {
        logger.warn("Stopping XLSX processing due to cell limit", {
          maxTotalCells,
          totalCellsProcessed
        });
        break;
      }
    }

    const result = texts.join('\n');

    logger.info("XLSX extraction completed", {
      totalSheets: workbook.SheetNames.length,
      sheetsProcessed: sheetsToProcess.length,
      totalCellsProcessed,
      truncatedSheets,
      truncatedRows,
      resultLength: result.length,
      limitsApplied: {
        maxRowsPerSheet,
        maxColumnsPerRow,
        maxSheets,
        maxTotalCells
      }
    });

    // Add truncation warning to the result if applicable
    if (truncatedSheets > 0 || truncatedRows > 0 || totalCellsProcessed >= maxTotalCells) {
      const warning = `\n\n--- WARNING: XLSX file was truncated ---\n` +
        `Original sheets: ${workbook.SheetNames.length}, Processed: ${sheetsToProcess.length}\n` +
        `Truncated sheets: ${truncatedSheets}, Truncated rows: ${truncatedRows}\n` +
        `Total cells processed: ${totalCellsProcessed}/${maxTotalCells}`;

      return result + warning;
    }

    return result;

  } catch (error) {
    logger.error("Error extracting text from XLSX file:", error);
    throw new Error(`Failed to read XLSX file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extracts text from PPTX files with memory protection and slide limits.
 */
export async function extractTextFromPptx(buffer: Buffer): Promise<string> {
  const maxSlides = parseInt(process.env.MAX_PPTX_SLIDES || '100');
  const maxSlideTextLength = parseInt(process.env.MAX_PPTX_SLIDE_TEXT_LENGTH || '10000');
  const maxZipEntries = parseInt(process.env.MAX_PPTX_ZIP_ENTRIES || '1000');

  try {
    logger.info("Starting PPTX extraction", {
      bufferSize: buffer.length,
      maxSlides,
      maxSlideTextLength,
      maxZipEntries
    });

    const zip = await JSZip.loadAsync(buffer);

    // Check zip bomb protection
    const zipEntries = Object.keys(zip.files);
    if (zipEntries.length > maxZipEntries) {
      logger.warn("PPTX zip bomb protection triggered", {
        totalEntries: zipEntries.length,
        maxEntries: maxZipEntries
      });
      throw new Error(`PPTX file contains too many entries (${zipEntries.length} > ${maxZipEntries}). Possible zip bomb.`);
    }

    const slideFiles = zipEntries
      .filter((name) => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'))
      .sort()
      .slice(0, maxSlides); // Limit slides processed

    const texts: string[] = [];
    let totalTextLength = 0;
    let slidesProcessed = 0;
    let slidesTruncated = 0;

    if (zipEntries.filter((name) => name.startsWith('ppt/slides/slide') && name.endsWith('.xml')).length > maxSlides) {
      slidesTruncated = zipEntries.filter((name) => name.startsWith('ppt/slides/slide') && name.endsWith('.xml')).length - maxSlides;
      logger.warn("PPTX slides truncated", {
        totalSlides: zipEntries.filter((name) => name.startsWith('ppt/slides/slide') && name.endsWith('.xml')).length,
        slidesProcessed: maxSlides,
        slidesTruncated
      });
    }

    for (const slideName of slideFiles) {
      try {
        const xml = await zip.file(slideName)!.async('string');

        // Extract text nodes inside <a:t>...</a:t>
        const matches = Array.from(xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g));
        const slideText = matches.map((m) => m[1]).join(' ').trim();

        // Limit text length per slide
        const truncatedText = slideText.length > maxSlideTextLength
          ? slideText.substring(0, maxSlideTextLength) + '...[truncated]'
          : slideText;

        texts.push(`Slide ${slidesProcessed + 1}: ${truncatedText}`);
        totalTextLength += truncatedText.length;
        slidesProcessed++;

        // Check if we've hit total text limit
        if (totalTextLength >= maxSlideTextLength * maxSlides) {
          logger.warn("PPTX total text limit reached", {
            totalTextLength,
            maxTotalText: maxSlideTextLength * maxSlides
          });
          break;
        }

      } catch (slideError) {
        logger.warn("Failed to extract text from PPTX slide", {
          slideName,
          error: String(slideError)
        });
        // Continue with other slides
      }
    }

    const result = texts.join('\n\n');

    logger.info("PPTX extraction completed", {
      totalZipEntries: zipEntries.length,
      slideFilesFound: zipEntries.filter((name) => name.startsWith('ppt/slides/slide') && name.endsWith('.xml')).length,
      slidesProcessed,
      slidesTruncated,
      totalTextLength,
      resultLength: result.length,
      limitsApplied: {
        maxSlides,
        maxSlideTextLength,
        maxZipEntries
      }
    });

    // Add truncation warning if applicable
    if (slidesTruncated > 0) {
      const warning = `\n\n--- WARNING: PPTX file was truncated ---\n` +
        `Total slides: ${zipEntries.filter((name) => name.startsWith('ppt/slides/slide') && name.endsWith('.xml')).length}, ` +
        `Processed: ${slidesProcessed}, Truncated: ${slidesTruncated}`;

      return result + warning;
    }

    return result;

  } catch (error) {
    logger.error("Error extracting text from PPTX file:", error);
    throw new Error(`Failed to read PPTX file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extracts text from CSV files with streaming and size limits.
 */
export async function extractTextFromCsv(buffer: Buffer): Promise<string> {
  const maxLines = parseInt(process.env.MAX_CSV_LINES || '100000');
  const maxLineLength = parseInt(process.env.MAX_CSV_LINE_LENGTH || '10000');
  const maxTotalCharacters = parseInt(process.env.MAX_CSV_TOTAL_CHARS || '10000000'); // 10MB

  try {
    logger.info("Starting CSV extraction", {
      bufferSize: buffer.length,
      maxLines,
      maxLineLength,
      maxTotalCharacters
    });

    // Convert buffer to string incrementally to avoid large allocations
    const text = buffer.toString('utf-8');
    const lines = text.split(/\r\n|\r|\n/);

    const processedLines: string[] = [];
    let totalCharacters = 0;
    let linesProcessed = 0;
    let linesTruncated = 0;
    let charactersTruncated = 0;

    for (const line of lines) {
      if (linesProcessed >= maxLines) {
        linesTruncated = lines.length - maxLines;
        logger.warn("CSV line limit reached", {
          maxLines,
          totalLines: lines.length,
          linesProcessed,
          linesTruncated
        });
        break;
      }

      // Limit line length
      let processedLine = line;
      if (line.length > maxLineLength) {
        processedLine = line.substring(0, maxLineLength) + '...[truncated]';
        charactersTruncated += line.length - maxLineLength;
      }

      // Check total character limit
      if (totalCharacters + processedLine.length > maxTotalCharacters) {
        const remainingChars = maxTotalCharacters - totalCharacters;
        if (remainingChars > 0) {
          processedLine = processedLine.substring(0, remainingChars) + '...[truncated]';
          charactersTruncated += processedLine.length - remainingChars;
        } else {
          break;
        }
      }

      processedLines.push(processedLine);
      totalCharacters += processedLine.length;
      linesProcessed++;

      // Final check for total character limit
      if (totalCharacters >= maxTotalCharacters) {
        logger.warn("CSV total character limit reached", {
          maxTotalCharacters,
          totalCharacters,
          linesProcessed
        });
        break;
      }
    }

    const result = processedLines.join('\n');

    logger.info("CSV extraction completed", {
      totalLines: lines.length,
      linesProcessed,
      linesTruncated,
      totalCharacters,
      charactersTruncated,
      resultLength: result.length,
      limitsApplied: {
        maxLines,
        maxLineLength,
        maxTotalCharacters
      }
    });

    // Add truncation warning if applicable
    if (linesTruncated > 0 || charactersTruncated > 0) {
      const warning = `\n\n--- WARNING: CSV file was truncated ---\n` +
        `Total lines: ${lines.length}, Processed: ${linesProcessed}, Truncated: ${linesTruncated}\n` +
        `Characters truncated: ${charactersTruncated}`;

      return result + warning;
    }

    return result;

  } catch (error) {
    logger.error("Error extracting text from CSV file:", error);
    throw new Error(`Failed to read CSV file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extracts text from audio files through transcription.
 */
export async function extractTextFromAudio(buffer: Buffer, mimeType?: string): Promise<string> {
  try {
    if (!isDeepgramAvailable()) {
      throw new Error("Deepgram API key not configured for audio transcription");
    }

    // Validate the media file
    const validation = validateMediaFile(buffer, mimeType || 'audio/mpeg', buffer.length);

    if (!validation.isValid) {
      throw new Error(validation.errorMessage || 'Invalid audio file');
    }

    logger.info("Starting audio transcription", {
      bufferSize: buffer.length,
      mimeType: validation.mimeType,
      format: validation.format,
      recommendedAction: validation.recommendedAction
    });

    const result = await transcribeAudio(buffer, {
      model: 'nova-2',
      punctuate: true,
      smart_format: true
    });

    logger.info("Audio transcription completed", {
      transcriptLength: result.transcript.length,
      confidence: result.confidence,
      duration: result.duration
    });

    return result.transcript;

  } catch (error) {
    logger.error("Error extracting text from audio file:", error);
    throw new Error(`Failed to transcribe audio file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extracts text from video files through audio transcription.
 */
export async function extractTextFromVideo(buffer: Buffer, mimeType?: string): Promise<string> {
  try {
    if (!isDeepgramAvailable()) {
      throw new Error("Deepgram API key not configured for video transcription");
    }

    // Validate the media file
    const validation = validateMediaFile(buffer, mimeType || 'video/mp4', buffer.length);

    if (!validation.isValid) {
      throw new Error(validation.errorMessage || 'Invalid video file');
    }

    logger.info("Starting video transcription", {
      bufferSize: buffer.length,
      mimeType: validation.mimeType,
      format: validation.format,
      recommendedAction: validation.recommendedAction
    });

    // Deepgram can handle video files directly - it extracts audio automatically
    const result = await transcribeAudio(buffer, {
      model: 'nova-2',
      punctuate: true,
      smart_format: true
    });

    logger.info("Video transcription completed", {
      transcriptLength: result.transcript.length,
      confidence: result.confidence,
      duration: result.duration
    });

    return result.transcript;

  } catch (error) {
    logger.error("Error extracting text from video file:", error);
    throw new Error(`Failed to transcribe video file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
