# Document Text Extraction Implementation

This document outlines the implementation of document text extraction functionality for the legal case management system, specifically for TXT and DOCX file formats.

## Overview

The document text extraction system processes uploaded files to extract readable text content for further processing, chunking, and embedding. This is a critical component of the RAG (Retrieval-Augmented Generation) system that enables AI-powered document search and analysis.

## Supported File Formats

### Currently Supported
- **TXT files** (`text/plain`) - Direct text extraction with normalization
- **DOCX files** (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`) - Requires mammoth.js library

### Planned Support
- **PDF files** (`application/pdf`) - Requires pdf-parse or similar library
- **Video files** (`video/*`) - Requires transcription service (OpenAI Whisper, etc.)
- **Audio files** (`audio/*`) - Requires transcription service (OpenAI Whisper, etc.)
- **Legacy DOC files** (`application/msword`) - Not supported, users should convert to DOCX

## Implementation Details

### Core Function: `extractDocumentText`

The main function that handles text extraction from various document formats:

```typescript
export const extractDocumentText = async (file: Blob): Promise<string>
```

**Features:**
- MIME type detection and routing
- Comprehensive error handling
- Text normalization and cleanup
- Detailed logging for debugging

### TXT File Processing

**Function:** `extractTextFromTxt(file: Blob): Promise<string>`

**Process:**
1. Reads file content using `file.text()`
2. Normalizes line endings (Windows, Mac, Unix)
3. Removes excessive blank lines
4. Trims whitespace
5. Validates content is not empty

**Text Normalization:**
- Converts `\r\n` (Windows) to `\n`
- Converts `\r` (Mac) to `\n`
- Reduces multiple consecutive newlines to maximum of 2
- Trims leading/trailing whitespace

### DOCX File Processing

**Function:** `extractTextFromDocx(file: Blob): Promise<string>`

**Dependencies:**
- `mammoth` library for DOCX parsing

**Process:**
1. Converts blob to ArrayBuffer, then to Buffer
2. Extracts raw text using mammoth
3. Normalizes extracted text
4. Handles mammoth warnings and errors

**Installation:**
```bash
npm install mammoth
```

**Import:**
```typescript
import mammoth from 'mammoth';
```

### Video File Processing

**Function:** `extractTextFromVideo(file: Blob): Promise<string>`

**Dependencies:**
- OpenAI Whisper API or similar transcription service
- Audio extraction library (ffmpeg.js or similar)

**Process:**
1. Extracts audio from video file
2. Sends audio to transcription service
3. Processes transcription results
4. Handles timestamps and speaker diarization (optional)

**Planned Implementation:**
- Support for common video formats (MP4, AVI, MOV, etc.)
- Integration with OpenAI Whisper API
- Speaker diarization for multi-speaker content
- Timestamp alignment for legal proceedings

### Audio File Processing

**Function:** `extractTextFromAudio(file: Blob): Promise<string>`

**Dependencies:**
- OpenAI Whisper API or similar transcription service

**Process:**
1. Validates audio file format
2. Sends audio to transcription service
3. Processes transcription results
4. Handles timestamps and speaker diarization (optional)

**Planned Implementation:**
- Support for common audio formats (MP3, WAV, M4A, etc.)
- Integration with OpenAI Whisper API
- Speaker diarization for multi-speaker content
- Timestamp alignment for legal proceedings

## Error Handling

### Common Error Scenarios

1. **Unsupported File Format**
   - Legacy .doc files
   - PDF files (when not implemented)
   - Unknown MIME types

2. **Empty or Corrupted Files**
   - Files with no readable text
   - Corrupted DOCX files
   - Encoding issues

3. **Library Dependencies**
   - Missing mammoth library for DOCX processing
   - Import failures

### Error Messages

- Clear, user-friendly error messages
- Detailed logging for debugging
- Graceful fallbacks where possible

## Integration with Document Processing Pipeline

### Usage in Document Processing

The text extraction is used in the document processing pipeline:

```typescript
// In documentProcessing.ts
const documentContent = await extractDocumentText(file);
const chunks = await chunkDocumentContent(documentContent, config);
```

### RAG Integration

Extracted text is processed into chunks and embedded for vector search:

```typescript
// In rag/utils.ts
export const chunkDocument = rag.defineChunkerAction(async (ctx, args) => {
  const documentContent = await extractDocumentText(file);
  // Process into chunks...
});
```

## Usage Examples

### Basic Text Extraction

```typescript
import { extractDocumentText } from '../rag/utils';

// Example: Extract text from a TXT file
const txtFile = new Blob(['Hello World\n\nThis is a test document.'], {
  type: 'text/plain'
});

const txtContent = await extractDocumentText(txtFile);
console.log(txtContent);
// Output: "Hello World\n\nThis is a test document."

// Example: Extract text from a DOCX file
const docxFile = new Blob([/* DOCX file content */], {
  type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
});

const docxContent = await extractDocumentText(docxFile);
console.log(docxContent);
// Output: Extracted text from DOCX document
```

### Integration with Document Processing

```typescript
// In your document processing pipeline
export const processDocument = internalAction({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const document = await ctx.runQuery(getDocument, { documentId: args.documentId });
    const file = await ctx.storage.get(document.fileId);
    
    // Extract text content
    const textContent = await extractDocumentText(file);
    
    // Process into chunks
    const chunks = await chunkDocumentContent(textContent, {
      chunkSize: 1000,
      overlap: 200,
      strategy: "semantic"
    });
    
    // Continue with embedding and storage...
  }
});
```

### Error Handling

```typescript
try {
  const content = await extractDocumentText(file);
  console.log('Extraction successful:', content.length, 'characters');
} catch (error) {
  if (error.message.includes('not supported')) {
    console.error('File format not supported');
  } else if (error.message.includes('empty')) {
    console.error('Document is empty');
  } else {
    console.error('Extraction failed:', error.message);
  }
}
```

## Performance Considerations

### File Size Limits
- Large files may impact processing time
- Consider implementing file size checks
- Monitor memory usage for large documents

### Caching
- Extracted text could be cached to avoid re-processing
- Consider implementing cache invalidation strategies

## Testing

### Test Cases

1. **TXT Files**
   - Basic text extraction
   - Line ending normalization
   - Empty file handling
   - Large file processing

2. **DOCX Files**
   - Basic text extraction
   - Complex formatting handling
   - Table and list extraction
   - Image handling (text only)

3. **Error Scenarios**
   - Unsupported formats
   - Corrupted files
   - Missing dependencies

### Test Files

Create test files with various content types:
- Simple text documents
- Complex formatted documents
- Documents with tables and lists
- Documents with images (for text extraction only)

## Future Enhancements

### Planned Features

1. **PDF Support**
   - Text extraction from PDF files
   - OCR for image-based PDFs
   - Table and form extraction

2. **Enhanced DOCX Processing**
   - Style and formatting preservation
   - Table structure extraction
   - Header/footer handling

3. **Video Transcription**
   - Integration with OpenAI Whisper API
   - Support for multiple video formats (MP4, AVI, MOV, etc.)
   - Audio extraction from video files
   - Speaker diarization for multi-speaker content
   - Timestamp alignment for legal proceedings
   - Batch processing for large video files

4. **Audio Transcription**
   - Integration with OpenAI Whisper API
   - Support for multiple audio formats (MP3, WAV, M4A, etc.)
   - Speaker diarization for multi-speaker content
   - Timestamp alignment for legal proceedings
   - Noise reduction and audio enhancement

5. **Performance Optimizations**
   - Streaming text extraction for large files
   - Parallel processing for multiple documents
   - Caching extracted content
   - Progressive transcription for long media files

### Dependencies to Add

```json
{
  "dependencies": {
    "mammoth": "^1.6.0",
    "pdf-parse": "^1.1.1",
    "openai": "^4.0.0",
    "ffmpeg.js": "^0.0.1"
  }
}
```

## Troubleshooting

### Common Issues

1. **Mammoth Import Errors**
   - Ensure mammoth is installed: `npm install mammoth`
   - Check for TypeScript type definitions
   - Verify the static import: `import mammoth from 'mammoth';`

2. **Text Encoding Issues**
   - Check file encoding (UTF-8 recommended)
   - Handle BOM (Byte Order Mark) in text files
   - Validate text content after extraction

3. **Memory Issues**
   - Monitor file sizes
   - Implement streaming for large files
   - Add memory usage monitoring

### Debug Logging

The implementation includes comprehensive logging:
- MIME type detection
- Extraction progress
- Warning messages from libraries
- Error details for troubleshooting

## Security Considerations

### File Validation
- Validate file types before processing
- Check file size limits
- Sanitize extracted text content
- Prevent path traversal attacks

### Content Safety
- Filter potentially malicious content
- Validate text encoding
- Handle special characters safely

## Conclusion

The document text extraction implementation provides a robust foundation for processing TXT and DOCX files in the legal case management system. The modular design allows for easy extension to support additional file formats, while comprehensive error handling ensures reliable operation in production environments.

The integration with the RAG system enables powerful document search and AI-assisted analysis capabilities, making it easier for legal professionals to work with large volumes of documents efficiently. 