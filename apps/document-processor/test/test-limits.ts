#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import FormData from 'form-data';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_FILES_DIR = path.join(__dirname, '..', 'test_files');
const API_BASE_URL = process.env.DOCUMENT_PROCESSOR_URL || 'http://localhost:4001';

// Test configuration
const TEST_CONFIG = {
  callbackUrl: 'http://localhost:3000/test-callback',
  hmacSecret: 'test-secret-key',
  timeout: 60000, // 60 seconds per test
};

// Test results
interface TestResult {
  testName: string;
  fileName: string;
  expected: string;
  actual: string;
  success: boolean;
  error?: string;
  responseTime?: number;
  details?: any;
}

const results: TestResult[] = [];

/**
 * Upload a file to the document processor
 */
async function uploadFile(filePath: string, fileName: string): Promise<any> {
  const startTime = Date.now();

  try {
    // Read the file
    const fileBuffer = fs.readFileSync(filePath);

    // Create form data
    const form = new FormData();
    form.append('file', fileBuffer, {
      filename: fileName,
      contentType: getContentType(fileName)
    });
    form.append('tenantId', 'test-tenant');
    form.append('createdBy', 'test-user');
    form.append('caseId', 'test-case-123');
    form.append('documentId', `test-doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    form.append('originalFileName', fileName);
    form.append('callbackUrl', TEST_CONFIG.callbackUrl);
    form.append('hmacSecret', TEST_CONFIG.hmacSecret);

    const response = await fetch(`${API_BASE_URL}/test-process-document`, {
      method: 'POST',
      body: form,
      timeout: TEST_CONFIG.timeout,
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    return { ...result, responseTime };

  } catch (error) {
    const responseTime = Date.now() - startTime;
    throw { error: error instanceof Error ? error.message : String(error), responseTime };
  }
}

/**
 * Get MIME type for a filename
 */
function getContentType(filename: string): string {
  // Special case for our test file
  if (filename === 'really-too-large.xlsx') {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }

  const ext = path.extname(filename).toLowerCase();

  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.xyz': 'application/octet-stream',
  };

  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Test a single file
 */
async function testFile(fileName: string, expectedResult: string, description: string): Promise<void> {
  const filePath = path.join(TEST_FILES_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    results.push({
      testName: description,
      fileName,
      expected: expectedResult,
      actual: 'FILE_NOT_FOUND',
      success: false,
      error: `Test file ${fileName} not found`,
    });
    return;
  }

  try {
    console.log(`🧪 Testing: ${description} (${fileName})`);

    const result = await uploadFile(filePath, fileName);

    // For successful uploads, we expect a job ID
    if (result.jobId) {
      results.push({
        testName: description,
        fileName,
        expected: expectedResult,
        actual: 'SUCCESS',
        success: expectedResult === 'SUCCESS',
        responseTime: result.responseTime,
        details: { jobId: result.jobId },
      });

      console.log(`  ✅ Job queued: ${result.jobId} (${result.responseTime}ms)`);
    } else {
      results.push({
        testName: description,
        fileName,
        expected: expectedResult,
        actual: 'UNEXPECTED_RESPONSE',
        success: false,
        responseTime: result.responseTime,
        error: 'Unexpected response format',
        details: result,
      });

      console.log(`  ❌ Unexpected response: ${JSON.stringify(result)}`);
    }

  } catch (error: any) {
    const isExpectedError = expectedResult.startsWith('ERROR:');

    results.push({
      testName: description,
      fileName,
      expected: expectedResult,
      actual: error.error || 'UNKNOWN_ERROR',
      success: isExpectedError && error.error?.includes(expectedResult.replace('ERROR:', '')),
      responseTime: error.responseTime,
      error: error.error,
    });

    if (isExpectedError) {
      console.log(`  ✅ Expected error: ${error.error} (${error.responseTime}ms)`);
    } else {
      console.log(`  ❌ Unexpected error: ${error.error} (${error.responseTime}ms)`);
    }
  }
}

/**
 * Test the health endpoint
 */
async function testHealth(): Promise<void> {
  try {
    console.log('🏥 Testing health endpoint...');

    const response = await fetch(`${API_BASE_URL}/health`, {
      timeout: 5000,
    });

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }

    const health = await response.json();
    console.log('  ✅ Health check passed');
    console.log(`  📊 Deepgram queue: ${health.services?.deepgram?.activeRequests || 0} active, ${health.services?.deepgram?.queuedRequests || 0} queued`);

  } catch (error) {
    console.error('  ❌ Health check failed:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * Test the metrics endpoint
 */
async function testMetrics(): Promise<void> {
  try {
    console.log('📊 Testing metrics endpoint...');

    const response = await fetch(`${API_BASE_URL}/metrics`, {
      timeout: 5000,
    });

    if (!response.ok) {
      throw new Error(`Metrics check failed: ${response.status}`);
    }

    const metrics = await response.json();
    console.log('  ✅ Metrics check passed');
    console.log(`  📏 File limits configured: ${Object.keys(metrics.limits?.fileSizes || {}).length} types`);
    console.log(`  ⏱️  Timeout config: ${Object.keys(metrics.limits?.timeouts || {}).length} operations`);
    console.log(`  🎯 Error taxonomy: ${metrics.errorTaxonomy?.totalErrorCodes || 0} error codes`);

  } catch (error) {
    console.error('  ❌ Metrics check failed:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * Run all tests
 */
async function runAllTests(): Promise<void> {
  console.log('🚀 Starting Document Processor Limit Tests\n');
  console.log(`📁 Test files directory: ${TEST_FILES_DIR}`);
  console.log(`🌐 API endpoint: ${API_BASE_URL}\n`);

  // Test health and metrics endpoints
  await testHealth();
  console.log('');
  await testMetrics();
  console.log('');

  // Test valid files (should succeed)
  console.log('✅ Testing VALID files (should succeed):\n');

  await testFile('valid-small.pdf', 'SUCCESS', 'Small PDF file');
  await testFile('valid-medium.txt', 'SUCCESS', 'Medium TXT file (5MB)');
  await testFile('valid-medium.csv', 'SUCCESS', 'Medium CSV file (50K rows)');

  console.log('\n❌ Testing files that should be REJECTED:\n');

  // Test oversized files (should be rejected)
  await testFile('too-large.txt', 'ERROR:FILE_TOO_LARGE', 'Oversized TXT file (120MB)');
  await testFile('too-large.csv', 'SUCCESS', 'Large CSV file (83MB - under 100MB limit)');
  await testFile('really-too-large.xlsx', 'ERROR:FILE_TOO_LARGE', 'Really oversized XLSX file (55MB - exceeds 50MB limit)');
  await testFile('too-large-audio.mp3', 'ERROR:FILE_TOO_LARGE', 'Oversized audio file (600MB)');

  // Test unsupported file types
  await testFile('unsupported.xyz', 'ERROR:UNSUPPORTED_MIME_TYPE', 'Unsupported file type (.xyz)');

  console.log('\n⚠️  Testing files that should be PROCESSED but TRUNCATED:\n');

  // Test files that should be processed but truncated
  await testFile('large-spreadsheet.xlsx', 'SUCCESS', 'Large XLSX (should be truncated)');
  await testFile('large-presentation.pptx', 'SUCCESS', 'Large PPTX (should be truncated)');

  console.log('\n📋 Test Results Summary:\n');

  // Generate summary
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const total = results.length;

  console.log(`📊 Overall Results: ${passed}/${total} tests passed (${failed} failed)`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.success).forEach(result => {
      console.log(`  • ${result.testName}: Expected "${result.expected}", got "${result.actual}"`);
      if (result.error) {
        console.log(`    Error: ${result.error}`);
      }
    });
  }

  console.log('\n✅ Successful Tests:');
  results.filter(r => r.success).forEach(result => {
    console.log(`  • ${result.testName}: ${result.actual}${result.responseTime ? ` (${result.responseTime}ms)` : ''}`);
  });

  // Performance summary
  const avgResponseTime = results
    .filter(r => r.responseTime)
    .reduce((sum, r) => sum + (r.responseTime || 0), 0) / results.filter(r => r.responseTime).length;

  console.log(`\n⚡ Performance: Average response time: ${avgResponseTime.toFixed(0)}ms`);

  // Save detailed results to file
  const resultsPath = path.join(TEST_FILES_DIR, 'test-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: { passed, failed, total, avgResponseTime },
    results
  }, null, 2));

  console.log(`\n💾 Detailed results saved to: ${resultsPath}`);

  if (passed === total) {
    console.log('\n🎉 All tests passed! 🎉');
  } else {
    console.log(`\n⚠️  ${failed} test(s) failed. Check the detailed results for more information.`);
    process.exit(1);
  }
}

/**
 * Wait for the server to be ready
 */
async function waitForServer(maxRetries: number = 10): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${API_BASE_URL}/health`, { timeout: 2000 });
      if (response.ok) {
        console.log('✅ Document processor server is ready');
        return;
      }
    } catch (error) {
      // Server not ready yet
    }

    console.log(`⏳ Waiting for server... (${i + 1}/${maxRetries})`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error('Server did not become ready within the timeout period');
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  waitForServer()
    .then(() => runAllTests())
    .catch(error => {
      console.error('❌ Test setup failed:', error);
      process.exit(1);
    });
}

export { runAllTests };
