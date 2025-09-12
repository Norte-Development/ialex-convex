import fetch from 'node-fetch';
import { logger } from '../middleware/logging.js';
import { timeoutWrappers } from './timeoutUtils.js';

// File size limits in bytes (configurable via env vars)
export const FILE_SIZE_LIMITS: Record<string, number> = {
  'application/pdf': parseInt(process.env.MAX_PDF_SIZE_MB || '100') * 1024 * 1024, // 100MB default
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': parseInt(process.env.MAX_DOCX_SIZE_MB || '50') * 1024 * 1024, // 50MB default
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': parseInt(process.env.MAX_XLSX_SIZE_MB || '50') * 1024 * 1024, // 50MB default
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': parseInt(process.env.MAX_PPTX_SIZE_MB || '50') * 1024 * 1024, // 50MB default
  'text/csv': parseInt(process.env.MAX_CSV_SIZE_MB || '100') * 1024 * 1024, // 100MB default
  'text/plain': parseInt(process.env.MAX_TXT_SIZE_MB || '100') * 1024 * 1024, // 100MB default
  // Audio/Video limits - these are more permissive since Deepgram has no size/duration limits
  'audio/mpeg': parseInt(process.env.MAX_AUDIO_SIZE_MB || '500') * 1024 * 1024, // 500MB default
  'audio/wav': parseInt(process.env.MAX_AUDIO_SIZE_MB || '500') * 1024 * 1024,
  'audio/mp4': parseInt(process.env.MAX_AUDIO_SIZE_MB || '500') * 1024 * 1024,
  'video/mp4': parseInt(process.env.MAX_VIDEO_SIZE_MB || '1000') * 1024 * 1024, // 1GB default
  'video/quicktime': parseInt(process.env.MAX_VIDEO_SIZE_MB || '1000') * 1024 * 1024,
};

// Supported MIME types
export const SUPPORTED_MIME_TYPES = new Set(Object.keys(FILE_SIZE_LIMITS));

// MIME type patterns for wildcard matching
export const MIME_TYPE_PATTERNS: Record<string, RegExp> = {
  'audio/': /^audio\//,
  'video/': /^video\//,
};

export interface FileValidationResult {
  isValid: boolean;
  mimeType?: string;
  contentLength?: number;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Validates a file by making a HEAD request to check Content-Type and Content-Length
 */
export async function validateFile(
  signedUrl: string,
  expectedFileName?: string
): Promise<FileValidationResult> {
  try {
    logger.info('Validating file', { signedUrl, expectedFileName });

    // Make HEAD request to check file metadata with timeout
    const headResponse = await timeoutWrappers.fileValidation(
      () => fetch(signedUrl, { 
        method: 'HEAD',
        headers: {
          'User-Agent': 'document-processor/1.0'
        }
      }),
      'file HEAD request'
    );

    if (!headResponse.ok) {
      return {
        isValid: false,
        errorCode: 'FILE_ACCESS_ERROR',
        errorMessage: `Cannot access file: ${headResponse.status} ${headResponse.statusText}`,
      };
    }

    // Get MIME type from response headers
    const contentType = headResponse.headers.get('content-type')?.split(';')[0]?.toLowerCase();
    const contentLength = parseInt(headResponse.headers.get('content-length') || '0');

    if (!contentType) {
      return {
        isValid: false,
        errorCode: 'MISSING_CONTENT_TYPE',
        errorMessage: 'File does not have a Content-Type header',
      };
    }

    // Check if MIME type is supported
    const isSupported = SUPPORTED_MIME_TYPES.has(contentType) ||
      Object.values(MIME_TYPE_PATTERNS).some(pattern => pattern.test(contentType));

    if (!isSupported) {
      return {
        isValid: false,
        mimeType: contentType,
        errorCode: 'UNSUPPORTED_MIME_TYPE',
        errorMessage: `Unsupported file type: ${contentType}`,
      };
    }

    // Check file size limits
    const sizeLimit = FILE_SIZE_LIMITS[contentType] ||
      Object.entries(MIME_TYPE_PATTERNS).find(([pattern, regex]) => regex.test(contentType))?.[0] &&
      FILE_SIZE_LIMITS[Object.keys(MIME_TYPE_PATTERNS).find(pattern => MIME_TYPE_PATTERNS[pattern].test(contentType))!];

    if (sizeLimit && contentLength > sizeLimit) {
      const limitMB = Math.round(sizeLimit / (1024 * 1024));
      const actualMB = Math.round(contentLength / (1024 * 1024));
      return {
        isValid: false,
        mimeType: contentType,
        contentLength,
        errorCode: 'FILE_TOO_LARGE',
        errorMessage: `File too large: ${actualMB}MB exceeds limit of ${limitMB}MB`,
      };
    }

    logger.info('File validation successful', {
      mimeType: contentType,
      contentLength,
      sizeMB: Math.round(contentLength / (1024 * 1024))
    });

    return {
      isValid: true,
      mimeType: contentType,
      contentLength,
    };

  } catch (error) {
    logger.error('File validation failed', { error: String(error), signedUrl });
    return {
      isValid: false,
      errorCode: 'VALIDATION_ERROR',
      errorMessage: `File validation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Gets the file size limit for a given MIME type
 */
export function getFileSizeLimit(mimeType: string): number | null {
  return FILE_SIZE_LIMITS[mimeType] ||
    Object.entries(MIME_TYPE_PATTERNS).find(([_, regex]) => regex.test(mimeType))?.[0] &&
    FILE_SIZE_LIMITS[Object.keys(MIME_TYPE_PATTERNS).find(pattern => MIME_TYPE_PATTERNS[pattern].test(mimeType))!] ||
    null;
}

/**
 * Validates a file buffer (for test uploads) instead of making HTTP requests
 */
export function validateFileBuffer(
  buffer: Buffer | Uint8Array,
  mimeType: string,
  fileName?: string
): FileValidationResult {
  try {
    logger.info('Validating file buffer', { fileName, mimeType, bufferSize: buffer.length });

    if (!mimeType) {
      return {
        isValid: false,
        errorCode: 'MISSING_CONTENT_TYPE',
        errorMessage: 'File does not have a Content-Type',
      };
    }

    // Check if MIME type is supported
    const isSupported = SUPPORTED_MIME_TYPES.has(mimeType) ||
      Object.values(MIME_TYPE_PATTERNS).some(pattern => pattern.test(mimeType));

    if (!isSupported) {
      return {
        isValid: false,
        mimeType,
        errorCode: 'UNSUPPORTED_MIME_TYPE',
        errorMessage: `Unsupported file type: ${mimeType}`,
      };
    }

    // Check file size limits
    const sizeLimit = FILE_SIZE_LIMITS[mimeType] ||
      Object.entries(MIME_TYPE_PATTERNS).find(([pattern, regex]) => regex.test(mimeType))?.[0] &&
      FILE_SIZE_LIMITS[Object.keys(MIME_TYPE_PATTERNS).find(pattern => MIME_TYPE_PATTERNS[pattern].test(mimeType))!];

    if (sizeLimit && buffer.length > sizeLimit) {
      const limitMB = Math.round(sizeLimit / (1024 * 1024));
      const actualMB = Math.round(buffer.length / (1024 * 1024));
      return {
        isValid: false,
        mimeType,
        contentLength: buffer.length,
        errorCode: 'FILE_TOO_LARGE',
        errorMessage: `File too large: ${actualMB}MB exceeds limit of ${limitMB}MB`,
      };
    }

    logger.info('File buffer validation successful', {
      mimeType,
      bufferSize: buffer.length,
      sizeMB: Math.round(buffer.length / (1024 * 1024))
    });

    return {
      isValid: true,
      mimeType,
      contentLength: buffer.length,
    };

  } catch (error) {
    logger.error('File buffer validation failed', { error: String(error), fileName, mimeType });
    return {
      isValid: false,
      errorCode: 'VALIDATION_ERROR',
      errorMessage: `File validation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
