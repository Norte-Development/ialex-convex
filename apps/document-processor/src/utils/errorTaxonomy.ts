import { logger } from '../middleware/logging.js';

// Standardized error codes and categories
export enum ErrorCode {
  // File validation errors
  FILE_ACCESS_ERROR = 'FILE_ACCESS_ERROR',
  MISSING_CONTENT_TYPE = 'MISSING_CONTENT_TYPE',
  UNSUPPORTED_MIME_TYPE = 'UNSUPPORTED_MIME_TYPE',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  // Processing errors
  EXTRACTION_FAILED = 'EXTRACTION_FAILED',
  OCR_FAILED = 'OCR_FAILED',
  TRANSCRIPTION_FAILED = 'TRANSCRIPTION_FAILED',
  CHUNKING_FAILED = 'CHUNKING_FAILED',
  EMBEDDING_FAILED = 'EMBEDDING_FAILED',
  STORAGE_FAILED = 'STORAGE_FAILED',

  // Timeout errors
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  FILE_DOWNLOAD_TIMEOUT = 'FILE_DOWNLOAD_TIMEOUT',
  OCR_TIMEOUT = 'OCR_TIMEOUT',
  TRANSCRIPTION_TIMEOUT = 'TRANSCRIPTION_TIMEOUT',
  PROCESSING_TIMEOUT = 'PROCESSING_TIMEOUT',

  // External service errors
  API_RATE_LIMITED = 'API_RATE_LIMITED',
  API_SERVICE_UNAVAILABLE = 'API_SERVICE_UNAVAILABLE',
  API_AUTHENTICATION_FAILED = 'API_AUTHENTICATION_FAILED',

  // Resource limits
  MEMORY_LIMIT_EXCEEDED = 'MEMORY_LIMIT_EXCEEDED',
  DISK_SPACE_EXCEEDED = 'DISK_SPACE_EXCEEDED',
  CONCURRENCY_LIMIT_EXCEEDED = 'CONCURRENCY_LIMIT_EXCEEDED',

  // Configuration errors
  CONFIG_MISSING = 'CONFIG_MISSING',
  CONFIG_INVALID = 'CONFIG_INVALID',

  // Generic errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

export enum ErrorCategory {
  VALIDATION = 'VALIDATION',
  PROCESSING = 'PROCESSING',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  RESOURCE_LIMIT = 'RESOURCE_LIMIT',
  CONFIGURATION = 'CONFIGURATION',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN'
}

export interface StandardizedError {
  code: ErrorCode;
  category: ErrorCategory;
  message: string;
  details?: Record<string, any>;
  originalError?: Error;
  retryable: boolean;
  userMessage?: string;
}

// Error code to category mapping
const ERROR_CODE_CATEGORIES: Record<ErrorCode, ErrorCategory> = {
  [ErrorCode.FILE_ACCESS_ERROR]: ErrorCategory.VALIDATION,
  [ErrorCode.MISSING_CONTENT_TYPE]: ErrorCategory.VALIDATION,
  [ErrorCode.UNSUPPORTED_MIME_TYPE]: ErrorCategory.VALIDATION,
  [ErrorCode.FILE_TOO_LARGE]: ErrorCategory.RESOURCE_LIMIT,
  [ErrorCode.VALIDATION_ERROR]: ErrorCategory.VALIDATION,

  [ErrorCode.EXTRACTION_FAILED]: ErrorCategory.PROCESSING,
  [ErrorCode.OCR_FAILED]: ErrorCategory.PROCESSING,
  [ErrorCode.TRANSCRIPTION_FAILED]: ErrorCategory.PROCESSING,
  [ErrorCode.CHUNKING_FAILED]: ErrorCategory.PROCESSING,
  [ErrorCode.EMBEDDING_FAILED]: ErrorCategory.PROCESSING,
  [ErrorCode.STORAGE_FAILED]: ErrorCategory.PROCESSING,

  [ErrorCode.TIMEOUT_ERROR]: ErrorCategory.TIMEOUT,
  [ErrorCode.FILE_DOWNLOAD_TIMEOUT]: ErrorCategory.TIMEOUT,
  [ErrorCode.OCR_TIMEOUT]: ErrorCategory.TIMEOUT,
  [ErrorCode.TRANSCRIPTION_TIMEOUT]: ErrorCategory.TIMEOUT,
  [ErrorCode.PROCESSING_TIMEOUT]: ErrorCategory.TIMEOUT,

  [ErrorCode.API_RATE_LIMITED]: ErrorCategory.EXTERNAL_SERVICE,
  [ErrorCode.API_SERVICE_UNAVAILABLE]: ErrorCategory.EXTERNAL_SERVICE,
  [ErrorCode.API_AUTHENTICATION_FAILED]: ErrorCategory.EXTERNAL_SERVICE,

  [ErrorCode.MEMORY_LIMIT_EXCEEDED]: ErrorCategory.RESOURCE_LIMIT,
  [ErrorCode.DISK_SPACE_EXCEEDED]: ErrorCategory.RESOURCE_LIMIT,
  [ErrorCode.CONCURRENCY_LIMIT_EXCEEDED]: ErrorCategory.RESOURCE_LIMIT,

  [ErrorCode.CONFIG_MISSING]: ErrorCategory.CONFIGURATION,
  [ErrorCode.CONFIG_INVALID]: ErrorCategory.CONFIGURATION,

  [ErrorCode.UNKNOWN_ERROR]: ErrorCategory.UNKNOWN,
  [ErrorCode.INTERNAL_ERROR]: ErrorCategory.UNKNOWN
};

// Retryable error codes
const RETRYABLE_ERRORS = new Set([
  ErrorCode.API_RATE_LIMITED,
  ErrorCode.API_SERVICE_UNAVAILABLE,
  ErrorCode.TIMEOUT_ERROR,
  ErrorCode.FILE_DOWNLOAD_TIMEOUT,
  ErrorCode.OCR_TIMEOUT,
  ErrorCode.TRANSCRIPTION_TIMEOUT,
  ErrorCode.PROCESSING_TIMEOUT,
  ErrorCode.CONCURRENCY_LIMIT_EXCEEDED
]);

// User-friendly error messages
const USER_MESSAGES: Partial<Record<ErrorCode, string>> = {
  [ErrorCode.FILE_TOO_LARGE]: 'The file is too large to process. Please try a smaller file.',
  [ErrorCode.UNSUPPORTED_MIME_TYPE]: 'This file type is not supported. Please try a different format.',
  [ErrorCode.FILE_ACCESS_ERROR]: 'Unable to access the file. Please check the file URL and permissions.',
  [ErrorCode.API_RATE_LIMITED]: 'Service is temporarily busy. Please try again later.',
  [ErrorCode.API_SERVICE_UNAVAILABLE]: 'External service is temporarily unavailable. Please try again later.',
  [ErrorCode.TIMEOUT_ERROR]: 'The operation took too long. Please try again.',
  [ErrorCode.MEMORY_LIMIT_EXCEEDED]: 'File processing exceeded memory limits. Please try a smaller file.',
  [ErrorCode.OCR_FAILED]: 'Text extraction from the document failed. Please try a different file.',
  [ErrorCode.TRANSCRIPTION_FAILED]: 'Audio/video transcription failed. Please check the file quality.',
};

/**
 * Standardizes an error into our taxonomy
 */
export function standardizeError(
  error: Error | any,
  context?: Record<string, any>
): StandardizedError {
  let code: ErrorCode;
  let message: string;
  let details = context || {};

  // Handle known error types
  if (error?.name === 'TimeoutError') {
    code = ErrorCode.TIMEOUT_ERROR;
    message = error.message;
  } else if (error?.message?.includes('rate limit')) {
    code = ErrorCode.API_RATE_LIMITED;
    message = 'API rate limit exceeded';
  } else if (error?.message?.includes('too large')) {
    code = ErrorCode.FILE_TOO_LARGE;
    message = error.message;
  } else if (error?.message?.includes('unsupported')) {
    code = ErrorCode.UNSUPPORTED_MIME_TYPE;
    message = error.message;
  } else if (error?.message?.includes('OCR')) {
    code = ErrorCode.OCR_FAILED;
    message = error.message;
  } else if (error?.message?.includes('transcription') || error?.message?.includes('transcribe')) {
    code = ErrorCode.TRANSCRIPTION_FAILED;
    message = error.message;
  } else if (error?.message?.includes('memory') || error?.message?.includes('OOM')) {
    code = ErrorCode.MEMORY_LIMIT_EXCEEDED;
    message = error.message;
  } else {
    code = ErrorCode.UNKNOWN_ERROR;
    message = error?.message || 'An unknown error occurred';
  }

  const category = ERROR_CODE_CATEGORIES[code];
  const retryable = RETRYABLE_ERRORS.has(code);
  const userMessage = USER_MESSAGES[code] || 'An error occurred while processing your file. Please try again.';

  const standardizedError: StandardizedError = {
    code,
    category,
    message,
    details,
    originalError: error instanceof Error ? error : undefined,
    retryable,
    userMessage
  };

  // Log standardized error
  logger.error('Standardized error', {
    code,
    category,
    message,
    retryable,
    details,
    stack: error?.stack
  });

  return standardizedError;
}

/**
 * Creates a standardized error response for API responses
 */
export function createErrorResponse(standardizedError: StandardizedError) {
  return {
    success: false,
    error: {
      code: standardizedError.code,
      category: standardizedError.category,
      message: standardizedError.userMessage || standardizedError.message,
      retryable: standardizedError.retryable,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Gets error statistics for monitoring
 */
export function getErrorStats(): Record<string, any> {
  return {
    categories: Object.values(ErrorCategory).map(category => ({
      name: category,
      codes: Object.entries(ERROR_CODE_CATEGORIES)
        .filter(([_, cat]) => cat === category)
        .map(([code]) => code)
    })),
    retryableErrors: Array.from(RETRYABLE_ERRORS),
    totalErrorCodes: Object.keys(ErrorCode).length
  };
}
