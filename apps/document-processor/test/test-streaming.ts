import "dotenv/config";
import { TempFileManager } from "../src/utils/tempFileManager";
import { JobStateManager } from "../src/services/stateManager";
import { MemoryMonitor } from "../src/utils/memoryMonitor";
import { StreamingChunkingService } from "../src/services/streaming/streamingChunkingService";
import { StreamingJobState } from "../src/types/jobState";

const TEST_JOB_ID = `test-streaming-${Date.now()}`;

async function isRedisAvailable(): Promise<boolean> {
  const IORedis = (await import('ioredis')).default;
  const testRedis = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
    lazyConnect: true,
    enableOfflineQueue: false
  });
  
  try {
    await testRedis.connect();
    await testRedis.ping();
    await testRedis.quit();
    return true;
  } catch (error) {
    try {
      await testRedis.quit();
    } catch {}
    return false;
  }
}

async function testTempFileManager() {
  console.log("\n=== Testing Temp File Manager ===");
  const manager = new TempFileManager(TEST_JOB_ID);
  
  try {
    await manager.init();
    console.log("✓ Temp directory initialized");
    
    // Test writing
    await manager.appendFile("test.txt", "Hello World\n");
    console.log("✓ File write successful");
    
    // Test reading
    const content = await manager.readFile("test.txt");
    if (content === "Hello World\n") {
      console.log("✓ File read successful");
    } else {
      throw new Error("File content mismatch");
    }
    
    // Test exists
    const exists = await manager.exists("test.txt");
    if (exists) {
      console.log("✓ File exists check successful");
    } else {
      throw new Error("File should exist");
    }
    
    // Cleanup
    await manager.cleanup();
    console.log("✓ Cleanup successful");
    
    return true;
  } catch (error) {
    console.error("✗ Temp File Manager test failed:", error);
    return false;
  }
}

async function testJobStateManager() {
  console.log("\n=== Testing Job State Manager ===");
  
  // Check if Redis is available
  if (!(await isRedisAvailable())) {
    console.log("⚠ Redis not available, skipping state manager tests (this is OK for CI)");
    return true; // Skip but don't fail
  }
  
  const stateManager = new JobStateManager(TEST_JOB_ID);
  
  try {
    // Initialize state
    const state = await stateManager.initialize("test-doc-id", 1);
    console.log("✓ State initialized");
    
    if (state.currentPhase !== 'initialized') {
      throw new Error("Initial phase should be 'initialized'");
    }
    
    // Update progress
    await stateManager.updateProgress(state, {
      bytesDownloaded: 1000,
      bytesTotal: 10000
    });
    console.log("✓ Progress updated");
    
    // Complete a phase
    await stateManager.completePhase(state, 'download_complete', {
      filePath: '/tmp/test.pdf'
    });
    console.log("✓ Phase completed");
    
    if (!stateManager.hasCompletedPhase(state, 'download_complete')) {
      throw new Error("Phase should be marked as completed");
    }
    
    // Load state
    const loadedState = await stateManager.load();
    if (!loadedState) {
      throw new Error("State should be loadable");
    }
    console.log("✓ State loaded successfully");
    
    // Cleanup
    await stateManager.cleanup();
    console.log("✓ State cleanup successful");
    
    return true;
  } catch (error) {
    console.error("✗ Job State Manager test failed:", error);
    try {
      await stateManager.cleanup();
    } catch {}
    return false;
  }
}

async function testMemoryMonitor() {
  console.log("\n=== Testing Memory Monitor ===");
  
  try {
    const monitor = new MemoryMonitor(TEST_JOB_ID);
    
    monitor.checkpoint('start');
    console.log("✓ Memory checkpoint created");
    
    // Allocate some memory
    const largeArray = new Array(1000000).fill('test');
    
    monitor.checkpoint('after-allocation');
    console.log("✓ Memory checkpoint after allocation");
    
    const summary = monitor.summary();
    if (summary.peakMB > 0) {
      console.log(`✓ Memory tracking working (peak: ${summary.peakMB.toFixed(2)} MB)`);
    } else {
      throw new Error("Memory tracking not working");
    }
    
    // Cleanup
    largeArray.length = 0;
    
    return true;
  } catch (error) {
    console.error("✗ Memory Monitor test failed:", error);
    return false;
  }
}

async function testStreamingChunkingService() {
  console.log("\n=== Testing Streaming Chunking Service ===");
  const manager = new TempFileManager(TEST_JOB_ID + "-chunking");
  
  try {
    await manager.init();
    
    const chunkingService = new StreamingChunkingService(manager, 100, 0);
    
    // Create mock state
    const state: StreamingJobState = {
      documentId: "test-doc",
      jobId: TEST_JOB_ID,
      currentPhase: 'chunking',
      checkpoints: [],
      progress: {
        bytesDownloaded: 0,
        bytesTotal: null,
        pagesExtracted: 0,
        pagesTotal: null,
        lastExtractedPage: 0,
        chunksGenerated: 0,
        lastChunkIndex: 0,
        chunksEmbedded: 0,
        lastEmbeddedIndex: 0,
        chunksUpserted: 0,
        lastUpsertedIndex: 0
      },
      metadata: {},
      startedAt: Date.now(),
      lastProgressAt: Date.now(),
      errorCount: 0,
      attemptNumber: 1,
      canResume: true
    };
    
    // Process some text
    const testText = "This is a test document. ".repeat(20);
    const chunks = await chunkingService.processTextStreamWithResume(testText, state, {});
    
    if (chunks.length > 0) {
      console.log(`✓ Chunking successful (${chunks.length} chunks created)`);
    } else {
      throw new Error("No chunks created");
    }
    
    // Read chunks back
    const readChunks = await chunkingService.readChunksFromIndex(0);
    if (readChunks.length === chunks.length) {
      console.log("✓ Chunks persisted and read successfully");
    } else {
      throw new Error("Chunk count mismatch");
    }
    
    // Test resume functionality
    const moreText = "Additional text to process. ".repeat(10);
    const moreChunks = await chunkingService.processTextStreamWithResume(moreText, state, {});
    
    const totalChunks = await chunkingService.getChunkCount();
    if (totalChunks === chunks.length + moreChunks.length) {
      console.log("✓ Resume functionality working");
    } else {
      throw new Error("Resume chunk count mismatch");
    }
    
    // Cleanup
    await manager.cleanup();
    console.log("✓ Chunking test cleanup successful");
    
    return true;
  } catch (error) {
    console.error("✗ Streaming Chunking Service test failed:", error);
    try {
      await manager.cleanup();
    } catch {}
    return false;
  }
}

async function testIntegration() {
  console.log("\n=== Testing Integration ===");
  
  // Check if Redis is available
  if (!(await isRedisAvailable())) {
    console.log("⚠ Redis not available, skipping integration tests (this is OK for CI)");
    return true; // Skip but don't fail
  }
  
  const manager = new TempFileManager(TEST_JOB_ID + "-integration");
  const stateManager = new JobStateManager(TEST_JOB_ID + "-integration");
  const memMonitor = new MemoryMonitor(TEST_JOB_ID + "-integration");
  
  try {
    await manager.init();
    memMonitor.checkpoint('start');
    
    // Initialize state
    const state = await stateManager.initialize("test-doc-integration", 1);
    console.log("✓ Integration test initialized");
    
    // Simulate download phase
    state.currentPhase = 'downloading';
    await stateManager.updateProgress(state, {
      bytesDownloaded: 1000,
      bytesTotal: 1000
    });
    await stateManager.completePhase(state, 'download_complete', {
      filePath: '/tmp/test.pdf',
      fileSize: 1000
    });
    memMonitor.checkpoint('download-complete');
    console.log("✓ Download phase simulated");
    
    // Simulate extraction phase
    state.currentPhase = 'extracting';
    await stateManager.updateProgress(state, {
      pagesExtracted: 10,
      pagesTotal: 10,
      lastExtractedPage: 10
    });
    await stateManager.completePhase(state, 'extraction_complete', {
      totalPages: 10
    });
    memMonitor.checkpoint('extraction-complete');
    console.log("✓ Extraction phase simulated");
    
    // Simulate chunking
    const chunkingService = new StreamingChunkingService(manager, 100, 0);
    const testText = "Integration test document content. ".repeat(50);
    await chunkingService.processTextStreamWithResume(testText, state, {});
    await stateManager.completePhase(state, 'chunking_complete', {
      totalChunks: state.progress.chunksGenerated
    });
    memMonitor.checkpoint('chunking-complete');
    console.log("✓ Chunking phase simulated");
    
    // Mark as completed
    await stateManager.markCompleted(state);
    console.log("✓ Job marked as completed");
    
    // Verify final state
    const finalState = await stateManager.load();
    if (finalState?.currentPhase === 'completed') {
      console.log("✓ Final state verified");
    } else {
      throw new Error("Final state not correct");
    }
    
    const memorySummary = memMonitor.summary();
    console.log(`✓ Memory usage: ${memorySummary.peakMB.toFixed(2)} MB peak`);
    
    // Cleanup
    await manager.cleanup();
    await stateManager.cleanup();
    console.log("✓ Integration test cleanup successful");
    
    return true;
  } catch (error) {
    console.error("✗ Integration test failed:", error);
    try {
      await manager.cleanup();
      await stateManager.cleanup();
    } catch {}
    return false;
  }
}

async function runAllTests() {
  console.log("\n======================================");
  console.log("   Streaming Enhancement Tests");
  console.log("======================================");
  
  const results: Record<string, boolean> = {};
  
  results['TempFileManager'] = await testTempFileManager();
  results['JobStateManager'] = await testJobStateManager();
  results['MemoryMonitor'] = await testMemoryMonitor();
  results['StreamingChunkingService'] = await testStreamingChunkingService();
  results['Integration'] = await testIntegration();
  
  console.log("\n======================================");
  console.log("   Test Results Summary");
  console.log("======================================");
  
  let passed = 0;
  let failed = 0;
  
  for (const [name, result] of Object.entries(results)) {
    const status = result ? '✓ PASS' : '✗ FAIL';
    console.log(`${status}: ${name}`);
    if (result) passed++;
    else failed++;
  }
  
  console.log(`\nTotal: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch(error => {
  console.error("Fatal error running tests:", error);
  process.exit(1);
});
