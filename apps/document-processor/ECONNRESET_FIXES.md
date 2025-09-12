# ECONNRESET Error Fixes

## Overview
This document summarizes the fixes implemented to resolve ECONNRESET errors in the document processor service.

## Root Causes Identified
1. **Network Connection Issues**: Unstable connections to external APIs (Mistral, Deepgram, OpenAI, Qdrant)
2. **Redis Connection Problems**: Poor Redis connection handling with BullMQ
3. **Insufficient Timeout Configuration**: Too aggressive timeout settings
4. **Lack of Retry Logic**: Insufficient retry mechanisms for network errors
5. **Missing Connection Error Handling**: No specific handling for ECONNRESET, ETIMEDOUT, etc.

## Fixes Implemented

### 1. Redis Connection Improvements (`src/services/queueService.ts`)
- ✅ Added comprehensive connection event handlers (connect, ready, error, close, reconnecting, end)
- ✅ Configured proper Redis connection options (connectTimeout, commandTimeout, keepAlive)
- ✅ Added reconnection logic for Redis failures
- ✅ Enhanced job queue configuration with better retry settings

### 2. OpenAI API Connection Improvements (`src/services/embeddingService.ts`)
- ✅ Added timeout configuration (60 seconds)
- ✅ Increased maxRetries to 3
- ✅ Added specific handling for ECONNRESET, ENOTFOUND, ETIMEDOUT, ECONNREFUSED errors
- ✅ Enhanced logging for embedding failures and retries
- ✅ Improved error categorization and retry logic

### 3. Qdrant Database Connection Improvements (`src/services/qdrantService.ts`)
- ✅ Added 60-second timeout configuration
- ✅ Extended retry logic to handle connection errors (502, 504, ECONNRESET, etc.)
- ✅ Enhanced error logging with detailed status codes and error information
- ✅ Improved retry backoff strategy

### 4. Deepgram API Improvements (`src/services/deepgramService.ts`)
- ✅ Removed invalid timeout configuration (API doesn't support it)
- ✅ Enhanced error logging for API failures
- ✅ Maintained existing queue-based concurrency control

### 5. Mistral OCR API Improvements (`src/services/mistralOcrService.ts`)
- ✅ Fixed timeout configuration (changed from `timeout` to `timeoutMs`)
- ✅ Set 10-minute timeout for OCR operations

### 6. Enhanced Timeout Configuration (`src/utils/timeoutUtils.ts`)
- ✅ Increased all timeout values for better stability:
  - File validation: 10s → 30s
  - File download: 5min → 10min
  - OCR requests: 10min → 15min
  - Transcription: 15min → 20min
  - Extraction: 5min → 10min
  - Chunking: 1min → 2min
  - Embeddings: 2min → 5min
  - Qdrant upsert: 30s → 1min
- ✅ Enhanced retry logic for all operations:
  - File validation: 1 → 2 retries
  - File download: 1 → 3 retries
  - OCR: 2 → 3 retries
  - Transcription: 1 → 2 retries
  - Extraction: 1 → 2 retries
  - Chunking: 1 → 2 retries
  - Embeddings: 2 → 3 retries
  - Qdrant upsert: 3 → 5 retries

### 7. File Validation Improvements (`src/utils/fileValidation.ts`)
- ✅ Added User-Agent header to HTTP requests
- ✅ Better error handling for file access issues

### 8. Worker Process Improvements (`src/jobs/processDocumentJob.ts`)
- ✅ Improved Redis connection configuration
- ✅ Enhanced job processing reliability

### 9. Environment Configuration (`env.example`)
- ✅ Added comprehensive timeout configuration variables
- ✅ Added Deepgram concurrency settings
- ✅ Added error handling configuration options

## Configuration Variables Added

```bash
# Timeout Configuration (in milliseconds)
FILE_VALIDATION_TIMEOUT_MS=30000
FILE_DOWNLOAD_TIMEOUT_MS=600000
OCR_REQUEST_TIMEOUT_MS=900000
TRANSCRIPTION_REQUEST_TIMEOUT_MS=1200000
EXTRACTION_PROCESSING_TIMEOUT_MS=600000
CHUNKING_PROCESSING_TIMEOUT_MS=120000
EMBEDDING_REQUEST_TIMEOUT_MS=300000
QDRANT_UPSERT_TIMEOUT_MS=60000

# Deepgram Configuration
DEEPGRAM_MAX_CONCURRENT=10
DEEPGRAM_REQUEST_TIMEOUT_MS=300000

# Error Handling
MAX_CONCURRENT_OCR_REQUESTS=3
```

## Expected Improvements

1. **Reduced ECONNRESET Errors**: Better connection handling and retry logic
2. **Improved Reliability**: Enhanced timeout settings prevent premature failures
3. **Better Error Recovery**: Comprehensive retry mechanisms for all external services
4. **Enhanced Monitoring**: Detailed logging for debugging connection issues
5. **Stable Redis Operations**: Proper connection lifecycle management

## Testing

- ✅ Code compilation successful
- ✅ All linter errors resolved
- ✅ Build process passes without warnings

## Next Steps

1. Deploy these changes to your environment
2. Monitor logs for connection error patterns
3. Adjust timeout values if needed based on your network conditions
4. Consider implementing health checks for external services

## Additional Recommendations

1. **Monitoring**: Set up alerts for ECONNRESET errors to track improvement
2. **Health Checks**: Implement periodic health checks for Redis, Qdrant, and external APIs
3. **Circuit Breaker**: Consider implementing circuit breaker pattern for external API calls
4. **Connection Pooling**: Consider implementing connection pooling for high-volume scenarios
