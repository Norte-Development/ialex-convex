# HTTP Action Document Processing Implementation

This document outlines the implementation of HTTP action-based document text extraction to resolve Node.js runtime compatibility issues in the Convex environment.

## Problem Statement

The original implementation attempted to use the `mammoth` library directly in Convex functions, which caused runtime errors:

```
Failed to analyze functions/documentProcessing.js: Uncaught EvalError: Code generation from strings disallowed for this context
```

This error occurred because:
1. The `mammoth` library uses Node.js-specific features like `new Function()`
2. Convex functions run in a V8 runtime that doesn't support these Node.js features
3. The library requires access to Node.js APIs that aren't available in the Convex environment

## Solution: HTTP Action Runtime Separation

The solution involves separating the text extraction logic into an HTTP action that runs in the Node.js runtime, while keeping the document processing logic in the Convex V8 runtime.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Convex V8 Runtime                        │
├─────────────────────────────────────────────────────────────┤
│  Document Processing Functions                              │
│  ├── processDocument()                                      │
│  ├── chunkDocument()                                        │
│  └── extractDocumentTextViaHttp()                          │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP Request
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   Node.js Runtime                           │
├─────────────────────────────────────────────────────────────┤
│  HTTP Action: /extract-document-text                        │
│  ├── extractTextFromTxt()                                   │
│  ├── extractTextFromDocx() (uses mammoth)                   │
│  └── Error handling & response formatting                   │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Details

### 1. HTTP Action (`convex/http.ts`)

The HTTP action handles all text extraction logic in the Node.js runtime:

```typescript
http.route({
  path: "/extract-document-text",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const mimeType = formData.get("mimeType") as string;
    
    // Route to appropriate extraction method based on MIME type
    let extractedText: string;
    
    if (mimeType === 'text/plain') {
      extractedText = await extractTextFromTxt(file);
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      extractedText = await extractTextFromDocx(file);
    }
    // ... other MIME type handlers
    
    return new Response(JSON.stringify({ text: extractedText }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});
```

### 2. Document Processing Integration (`convex/functions/documentProcessing.ts`)

The document processing functions call the HTTP action to extract text:

```typescript
async function extractDocumentTextViaHttp(file: Blob): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("mimeType", file.type);
  
  const response = await fetch(`${process.env.CONVEX_SITE_URL}/extract-document-text`, {
    method: "POST",
    body: formData,
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
  }
  
  const result = await response.json();
  return result.text;
}
```

### 3. RAG Integration

The extracted text is then passed to the RAG system for chunking and embedding:

```typescript
export const chunkDocument = rag.defineChunkerAction(async (ctx, args) => {
  // ... metadata extraction ...
  
  const file = await ctx.storage.get(fileId as Id<"_storage">);
  const documentContent = await extractDocumentTextViaHttp(file);
  const chunks = await chunkDocumentContent(documentContent);
  
  // Return chunks in RAG format
  return { chunks: ragChunks };
});
```

## Supported File Types

### Currently Implemented

1. **TXT Files** (`text/plain`)
   - Direct text extraction using `file.text()`
   - Line ending normalization
   - Whitespace cleanup

2. **DOCX Files** (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`)
   - Uses `mammoth` library for text extraction
   - Handles complex Word document formatting
   - Extracts raw text content

### Placeholder Implementations

3. **PDF Files** (`application/pdf`)
   - Error message: "PDF text extraction not yet implemented"
   - Requires PDF parsing library (e.g., pdf-parse, pdf2pic)

4. **Legacy DOC Files** (`application/msword`)
   - Error message: "Legacy .doc files are not supported"
   - Requires conversion to DOCX format

5. **Video Files** (`video/*`)
   - Error message: "Video transcription not yet implemented"
   - Requires transcription service (e.g., OpenAI Whisper)

6. **Audio Files** (`audio/*`)
   - Error message: "Audio transcription not yet implemented"
   - Requires transcription service (e.g., OpenAI Whisper)

## Error Handling

### HTTP Action Errors

The HTTP action provides structured error responses:

```typescript
catch (error) {
  return new Response(
    JSON.stringify({ 
      error: `Failed to extract text from document: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }), 
    {
      status: 500,
      headers: { "Content-Type": "application/json" },
    }
  );
}
```

### Document Processing Errors

Errors in the HTTP call are propagated to the document processing:

```typescript
if (!response.ok) {
  const errorData = await response.json();
  throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
}
```

## Environment Configuration

### Required Environment Variables

- `CONVEX_SITE_URL`: The base URL of the Convex deployment
  - Used to construct the HTTP action endpoint URL
  - Example: `https://careful-shark-342.convex.cloud`

### Deployment Considerations

1. **HTTP Action Registration**: The HTTP action must be registered in the Convex deployment
2. **Environment Variables**: Ensure `CONVEX_SITE_URL` is set correctly
3. **CORS**: HTTP actions may need CORS configuration for cross-origin requests
4. **File Size Limits**: HTTP actions have different file size limits than regular Convex functions

## Performance Considerations

### Advantages

1. **Runtime Compatibility**: Node.js libraries work correctly
2. **Separation of Concerns**: Text extraction is isolated from document processing
3. **Scalability**: HTTP actions can handle larger files
4. **Error Isolation**: Text extraction errors don't affect document processing

### Potential Optimizations

1. **Caching**: Cache extracted text to avoid re-processing
2. **Streaming**: Implement streaming for large files
3. **Parallel Processing**: Process multiple documents concurrently
4. **Compression**: Compress file data in HTTP requests

## Testing

### HTTP Action Testing

Test the HTTP endpoint directly:

```bash
curl -X POST https://your-convex-url/extract-document-text \
  -F "file=@document.docx" \
  -F "mimeType=application/vnd.openxmlformats-officedocument.wordprocessingml.document"
```

### Integration Testing

Test the complete document processing pipeline:

1. Upload a document
2. Verify processing status updates
3. Check that text extraction works
4. Verify chunks are created and stored

## Future Enhancements

### Planned Features

1. **PDF Support**: Integrate PDF parsing library
2. **Video/Audio Transcription**: Add OpenAI Whisper integration
3. **Batch Processing**: Process multiple documents in a single request
4. **Progress Tracking**: Real-time progress updates during processing

### Technical Improvements

1. **Error Recovery**: Automatic retry mechanisms
2. **Validation**: Enhanced file type and content validation
3. **Monitoring**: Detailed logging and metrics
4. **Security**: File content validation and sanitization

## Conclusion

The HTTP action-based approach successfully resolves the Node.js runtime compatibility issues while maintaining a clean separation between text extraction and document processing. This architecture provides a solid foundation for future enhancements and ensures reliable document processing across different file types. 