# Document Processor Test Suite

This test suite validates the limits and safeguards implemented in the document processor microservice.

## Overview

The test suite creates various test files and validates that:

1. **File size limits** are properly enforced
2. **MIME type validation** works correctly
3. **Large files are handled gracefully** (truncated rather than causing OOM)
4. **Unsupported file types are rejected**
5. **API endpoints** respond correctly
6. **Error handling** provides meaningful messages

## Test Files

The test suite creates files in the `test_files/` directory:

### ✅ Valid Files (Should Process Successfully)
- `valid-small.pdf` - Small PDF file
- `valid-medium.txt` - 5MB text file
- `valid-medium.csv` - 50K row CSV file

### ❌ Files That Should Be Rejected
- `too-large.txt` - 120MB text file (over 100MB limit)
- `too-large.csv` - 200K row CSV (over 100K row limit)
- `too-large.xlsx` - 20K row XLSX (over 10K row limit)
- `too-large-audio.mp3` - 600MB audio (over 500MB limit)
- `unsupported.xyz` - Unsupported file type

### ⚠️ Files That Should Be Processed But Truncated
- `large-spreadsheet.xlsx` - 15K rows (should be truncated to 10K)
- `large-presentation.pptx` - 150 slides (should be truncated to 100)

## Running Tests

### Prerequisites

1. **Start the document processor:**
   ```bash
   cd apps/document-processor
   npm run dev
   ```

2. **Set environment variables** (optional, defaults provided):
   ```bash
   export DOCUMENT_PROCESSOR_URL=http://localhost:4001
   ```

### Step 1: Create Test Files

```bash
cd apps/document-processor
npm run test:create-files
```

This will create all test files in the `test_files/` directory.

### Step 2: Run Tests

```bash
npm run test
```

The test suite will:
1. Wait for the server to be ready
2. Test health and metrics endpoints
3. Upload each test file and validate responses
4. Generate a detailed report

## Test Results

After running tests, you'll see:

### Console Output
```
🚀 Starting Document Processor Limit Tests

📁 Test files directory: /path/to/test_files
🌐 API endpoint: http://localhost:4001

🏥 Testing health endpoint...
  ✅ Health check passed
  📊 Deepgram queue: 0 active, 0 queued

📊 Testing metrics endpoint...
  ✅ Metrics check passed
  📏 File limits configured: 9 types
  ⏱️  Timeout config: 8 operations
  🎯 Error taxonomy: 25 error codes

✅ Testing VALID files (should succeed):

🧪 Testing: Small PDF file (valid-small.pdf)
  ✅ Job queued: 1234567890 (45ms)

❌ Testing files that should be REJECTED:

🧪 Testing: Oversized TXT file (too-large.txt)
  ✅ Expected error: FILE_TOO_LARGE: File too large: 120MB exceeds limit of 100MB (23ms)

📊 Overall Results: 8/8 tests passed (0 failed)
⚡ Performance: Average response time: 34ms

💾 Detailed results saved to: /path/to/test_files/test-results.json
```

### Detailed Results File

The `test-results.json` file contains:
- Test summary (passed/failed/total)
- Individual test results with response times
- Error details for failed tests
- Performance metrics

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DOCUMENT_PROCESSOR_URL` | `http://localhost:4001` | API endpoint URL |
| `MAX_PDF_SIZE_MB` | `100` | PDF size limit |
| `MAX_DOCX_SIZE_MB` | `50` | DOCX size limit |
| `MAX_XLSX_SIZE_MB` | `50` | XLSX size limit |
| `MAX_TXT_SIZE_MB` | `100` | TXT size limit |
| `MAX_CSV_SIZE_MB` | `100` | CSV size limit |
| `MAX_AUDIO_SIZE_MB` | `500` | Audio size limit |
| `MAX_VIDEO_SIZE_MB` | `1000` | Video size limit |
| `MAX_XLSX_ROWS_PER_SHEET` | `10000` | XLSX row limit |
| `MAX_CSV_LINES` | `100000` | CSV line limit |
| `DEEPGRAM_MAX_CONCURRENT` | `100` | Deepgram concurrent requests |

### File Size Limits Tested

The test suite validates these limits:

| File Type | Size Limit | Test File |
|-----------|------------|-----------|
| PDF | 100MB | 120MB (should fail) |
| TXT | 100MB | 120MB (should fail) |
| CSV | 100MB | 200K rows (should fail) |
| XLSX | 50MB | 20K rows (should fail) |
| Audio | 500MB | 600MB (should fail) |

## Expected Test Behavior

### ✅ Successful Tests
- Small, valid files should be accepted and queued for processing
- Large files within limits should be processed (may be truncated)
- Health and metrics endpoints should respond

### ❌ Expected Failures
- Files exceeding size limits should be rejected with `FILE_TOO_LARGE`
- Unsupported MIME types should be rejected with `UNSUPPORTED_MIME_TYPE`
- Invalid file URLs should be rejected with `FILE_ACCESS_ERROR`

### ⚠️ Truncation Tests
- XLSX files with >10K rows should be truncated
- PPTX files with >100 slides should be truncated
- CSV files with >100K lines should be truncated

## Troubleshooting

### Common Issues

1. **Server not ready:**
   ```
   Error: Server did not become ready within the timeout period
   ```
   **Solution:** Ensure the document processor is running with `npm run dev`

2. **Test files not found:**
   ```
   Test file valid-small.pdf not found
   ```
   **Solution:** Run `npm run test:create-files` first

3. **Connection refused:**
   ```
   Error: connect ECONNREFUSED 127.0.0.1:4001
   ```
   **Solution:** Check that the server is running on the correct port

### Debug Mode

For more detailed logging, set:
```bash
export DEBUG=document-processor:*
```

## Extending Tests

To add new test cases:

1. **Add test file creation** in `create-test-files.ts`
2. **Add test case** in `test-limits.ts` using `testFile()`
3. **Update expected results** based on your limits configuration

Example:
```typescript
await testFile('new-test-file.pdf', 'SUCCESS', 'New test case description');
```

## Integration with CI/CD

The test suite can be integrated into CI/CD pipelines:

```yaml
# GitHub Actions example
- name: Run document processor tests
  run: |
    cd apps/document-processor
    npm run test:create-files
    npm run test
```

## Performance Considerations

- Test files are created in memory-efficient streams
- Large files (>10MB) use chunked writing to avoid OOM
- Tests run sequentially to avoid overwhelming the server
- Results are saved to JSON for further analysis

## Monitoring Test Results

The test suite provides insights into:

- **API Performance:** Response times for different operations
- **Limit Effectiveness:** Which safeguards are working
- **Error Handling:** Quality of error messages and codes
- **System Health:** Server responsiveness and resource usage
