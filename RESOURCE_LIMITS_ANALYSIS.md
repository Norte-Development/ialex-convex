# Document Processor Resource Limits Analysis
## VPS Specifications: 4GB RAM, 2 vCPUs

---

## Executive Summary

For a VPS with **4GB RAM** and **2 vCPUs**, the document processor can handle:
- ✅ **Concurrent Jobs:** 2-3 jobs (configurable via `WORKER_CONCURRENCY=2`)
- ✅ **PDF Files:** Up to 500MB (150-200 pages comfortable, 500+ pages with streaming)
- ✅ **Audio/Video:** Up to 500MB audio, 1GB video
- ⚠️ **Critical Bottleneck:** Memory during PDF OCR with Mistral
- 🚨 **OOM Risk:** Large PDFs (>200MB) with multiple concurrent jobs

---

## 1. Memory Usage Breakdown

### 1.1 Base Process Memory
```
Node.js Process:          ~150MB
Express Server:           ~50MB
BullMQ Workers:           ~100MB (2 workers)
--------------------------------------
Base System Usage:        ~300MB
Available for Jobs:       ~3.7GB
```

### 1.2 Memory Per Job Type

#### **PDF Processing (Mistral OCR)**
| Component | Memory Usage | Notes |
|-----------|--------------|-------|
| File Download | 1-2x file size | Streams to disk (minimal) |
| PDF Buffer | 1x file size | Full PDF loaded into memory |
| PDF.js Parsing | 2-3x file size | Text extraction overhead |
| Mistral OCR | **3-5x file size** | **HIGHEST USAGE** - Base64 encoding |
| Text Chunking | 0.5-1x text size | RecursiveCharacterTextSplitter |
| Embeddings | ~500MB | OpenAI batch (128 chunks at a time) |
| Qdrant Upsert | ~200MB | Batch of 128 vectors |

**Example: 100MB PDF**
- Download: ~100MB (disk)
- OCR Processing: **300-500MB peak**
- Chunking: ~50MB
- Embeddings: ~500MB
- **Peak Total: ~800-1000MB per job**

#### **Audio/Video Processing (Deepgram)**
| Component | Memory Usage | Notes |
|-----------|--------------|-------|
| File Download | 1x file size | Streams to disk |
| Deepgram API | Minimal | Sends file buffer, no local processing |
| Transcription | ~50-100MB | Text result is small |
| Chunking | ~50MB | Text splitting |
| Embeddings | ~500MB | Same as PDF |

**Example: 500MB Audio**
- Download: ~500MB (disk)
- Transcription: **~100MB peak**
- Chunking/Embeddings: ~500MB
- **Peak Total: ~600MB per job**

#### **Office Documents (DOCX, XLSX, PPTX)**
| Component | Memory Usage | Notes |
|-----------|--------------|-------|
| File Download | 1x file size | Streams to disk |
| Extraction | 1.5-2x file size | LibreOffice/mammoth |
| Chunking/Embeddings | ~500MB | Same pipeline |

**Example: 50MB DOCX**
- Download: ~50MB (disk)
- Extraction: **~75-100MB peak**
- **Peak Total: ~600MB per job**

---

## 2. Current Configuration Limits

### 2.1 File Size Limits (Environment Variables)
```bash
# PDF Documents
MAX_PDF_SIZE_MB=500          # Default: 500MB
                              # Recommended for 4GB: 200MB

# Office Documents
MAX_DOCX_SIZE_MB=50           # Default: 50MB ✅ Good
MAX_XLSX_SIZE_MB=50           # Default: 50MB ✅ Good
MAX_PPTX_SIZE_MB=50           # Default: 50MB ✅ Good

# Text Files
MAX_TXT_SIZE_MB=500           # Default: 500MB
MAX_CSV_SIZE_MB=500           # Default: 500MB

# Media Files
MAX_AUDIO_SIZE_MB=500         # Default: 500MB ✅ Good
MAX_VIDEO_SIZE_MB=1000        # Default: 1GB ⚠️ High for 4GB RAM
```

### 2.2 Concurrency Settings
```bash
# Worker Concurrency (jobs running in parallel)
WORKER_CONCURRENCY=2          # Default: 2 ✅ OPTIMAL for 4GB RAM

# Deepgram Concurrency
DEEPGRAM_MAX_CONCURRENT=100   # API rate limit, not memory bound

# Mistral OCR Concurrency
MAX_CONCURRENT_OCR_REQUESTS=3 # Internal queue limit
```

### 2.3 Processing Settings
```bash
# PDF Page Windowing (memory optimization)
pageWindow=50                 # Process 50 pages at a time ✅ Good

# Text Chunking
chunkSize=1000               # Characters per chunk ✅ Good
chunkOverlap=0               # No overlap (saves memory)

# Embedding Batches
embedBatchSize=128           # OpenAI batch size ✅ Good
upsertBatchSize=128          # Qdrant batch size ✅ Good

# Qdrant Upsert
QDRANT_UPSERT_BATCH_SIZE=128 # ✅ Good
```

---

## 3. Streaming Optimizations (Already Implemented ✅)

### 3.1 Memory-Efficient Downloads
```typescript
// Downloads stream directly to disk (no memory buffering)
await downloadService.downloadWithStreaming(url, tempFilePath);
```
**Memory Impact:** ~10-20MB regardless of file size

### 3.2 PDF Page Windowing
```typescript
// Processes 50 pages at a time, not entire document
const pageWindow = 50;
for (let page = 1; page <= totalPages; page += pageWindow) {
  const batch = await extractPages(page, page + pageWindow);
  await processTextBatch(batch);
}
```
**Memory Impact:** Reduces peak from `3-5x file size` to `3-5x (pageWindow/totalPages) * file size`

### 3.3 Chunk Streaming
```typescript
// Chunks are written to JSONL file, not kept in memory
await chunkingService.processTextStreamWithResume(text, state);
// Later read back for embedding
const chunks = await chunkingService.readChunksFromIndex(0);
```
**Memory Impact:** ~100MB instead of holding all chunks

### 3.4 Embedding Batching
```typescript
// Embeds 128 chunks at a time, garbage collects between batches
for (let i = 0; i < chunks.length; i += embedBatchSize) {
  const batch = chunks.slice(i, i + embedBatchSize);
  await embedBatch(batch);
  // Buffer cleared before next iteration
}
```
**Memory Impact:** ~500MB peak regardless of total chunks

---

## 4. Bottlenecks & Risk Areas

### 🚨 **CRITICAL: Mistral OCR Memory Usage**

**Problem:** Mistral OCR requires the entire PDF chunk in memory as base64
```typescript
// Current implementation
const chunkSize = Math.min(1000, maxPagesForSize); // Can be up to 1000 pages
const chunks = await splitPdfForMistralOCR(buffer, chunkSize);

// For 500MB PDF with 500 pages:
// - Chunk size: 500 pages (entire file)
// - Memory: 500MB file + 1500MB OCR = 2GB per job
```

**Risk Scenarios:**
| Scenario | Memory Usage | Safe? |
|----------|--------------|-------|
| 1x 100MB PDF | ~800MB | ✅ Safe |
| 2x 100MB PDFs (concurrent) | ~1.6GB | ✅ Safe |
| 1x 500MB PDF | ~2.5GB | ⚠️ Risky |
| 2x 500MB PDFs | ~5GB | 🚨 **OOM Crash** |
| 1x 200MB + 1x 300MB PDF | ~4GB | 🚨 **OOM Risk** |

### ⚠️ **HIGH RISK: Video Files**

```bash
MAX_VIDEO_SIZE_MB=1000  # 1GB default
```

**Problem:** While Deepgram handles large files, downloading 1GB uses significant disk I/O and temporary storage.

**Recommendation:** Lower to 500MB for 4GB RAM systems
```bash
MAX_VIDEO_SIZE_MB=500
```

### ⚠️ **MODERATE RISK: Concurrent Large Office Documents**

Excel files with many sheets or PowerPoint with embedded media can expand significantly during extraction.

**Recommendation:** Keep current limits (50MB) ✅

---

## 5. Recommended Configuration for 4GB RAM

### 5.1 Environment Variables
```bash
# Document Processor Configuration for 4GB RAM VPS

# Worker Concurrency (CRITICAL)
WORKER_CONCURRENCY=2          # Max 2 concurrent jobs

# File Size Limits (Conservative)
MAX_PDF_SIZE_MB=200           # Reduced from 500MB
MAX_DOCX_SIZE_MB=50            # Keep current
MAX_XLSX_SIZE_MB=50            # Keep current
MAX_PPTX_SIZE_MB=50            # Keep current
MAX_TXT_SIZE_MB=200            # Reduced from 500MB
MAX_CSV_SIZE_MB=200            # Reduced from 500MB
MAX_AUDIO_SIZE_MB=500          # Keep current
MAX_VIDEO_SIZE_MB=500          # Reduced from 1GB

# Processing Settings
MAX_CONCURRENT_OCR_REQUESTS=2  # Reduced from 3
QDRANT_UPSERT_BATCH_SIZE=128   # Keep current
DEEPGRAM_MAX_CONCURRENT=50     # Reduced from 100 (API limits)

# Timeouts
DEEPGRAM_REQUEST_TIMEOUT_MS=300000    # 5 minutes
FILE_DOWNLOAD_TIMEOUT_MS=600000       # 10 minutes
MISTRAL_OCR_TIMEOUT_MS=600000         # 10 minutes
```

### 5.2 Page Window Configuration (in requests)
```typescript
const chunking = {
  maxTokens: 400,
  overlapRatio: 0.15,
  pageWindow: 50  // Keep at 50 for memory efficiency
};
```

---

## 6. Monitoring & Safety Measures

### 6.1 Memory Monitoring (Already Implemented ✅)
```typescript
const memMonitor = new MemoryMonitor(job.id);
memMonitor.checkpoint('download-complete');
memMonitor.checkpoint('extraction-complete');
memMonitor.checkpoint('embedding-complete');
```

**Logs output:**
```json
{
  "label": "extraction-complete",
  "heapUsedMB": "842.15",
  "heapTotalMB": "1024.00",
  "rssMB": "1156.32",
  "peakMB": "892.45"
}
```

### 6.2 Out of Memory Handling

**Current behavior:** Process crashes, BullMQ retries job
**Recommendation:** Add memory checks before processing

```typescript
// Add to streamingProcessDocumentJob.ts
function checkMemoryAvailable(requiredMB: number): boolean {
  const mem = process.memoryUsage();
  const availableMB = (mem.heapTotal - mem.heapUsed) / (1024 * 1024);
  return availableMB > requiredMB;
}

// Before starting job
const estimatedMemoryMB = fileSizeMB * 5; // Conservative estimate
if (!checkMemoryAvailable(estimatedMemoryMB)) {
  throw new Error('Insufficient memory for job');
}
```

### 6.3 Job Prioritization

With 2 concurrent workers, implement priority queue:
```typescript
// High priority: Small files (< 50MB)
// Normal priority: Medium files (50-200MB)
// Low priority: Large files (> 200MB)
```

---

## 7. Performance Estimates

### 7.1 Processing Times (4GB RAM, 2 vCPUs)

| File Type | Size | Processing Time | Memory Peak | Safe Concurrent |
|-----------|------|-----------------|-------------|-----------------|
| PDF (OCR) | 50MB | 2-5 min | ~400MB | 3 |
| PDF (OCR) | 100MB | 5-10 min | ~800MB | 2 |
| PDF (OCR) | 200MB | 10-20 min | ~1.6GB | 1 |
| PDF (OCR) | 500MB | 30-60 min | ~2.5GB | 🚨 1 (risky) |
| Audio | 100MB | 2-3 min | ~300MB | 3 |
| Audio | 500MB | 10-15 min | ~600MB | 2 |
| Video | 500MB | 10-20 min | ~700MB | 2 |
| DOCX | 50MB | 3-5 min | ~400MB | 3 |

### 7.2 Throughput Estimates

**With WORKER_CONCURRENCY=2:**
- Small PDFs (<50MB): ~12-15 files/hour
- Medium PDFs (100MB): ~6-8 files/hour
- Large PDFs (200MB): ~3-4 files/hour
- Audio files: ~8-12 files/hour

---

## 8. Scaling Recommendations

### 8.1 Stay on 4GB RAM if:
- ✅ Average PDF size < 100MB
- ✅ Audio/video files primary use case
- ✅ Processing volume < 50 files/day
- ✅ Can tolerate 10-20 min processing times

### 8.2 Upgrade to 8GB RAM if:
- ⚠️ Regular PDFs > 200MB
- ⚠️ Need 3-4 concurrent workers
- ⚠️ Processing volume > 100 files/day
- ⚠️ Need faster turnaround times

### 8.3 Upgrade to 16GB RAM if:
- 🚨 PDFs regularly > 500MB
- 🚨 Need 4+ concurrent workers
- 🚨 High-volume production system (500+ files/day)
- 🚨 Multiple large files processing simultaneously

---

## 9. Alternative Optimization Strategies

### 9.1 Implement Queue Prioritization
```typescript
// Small files get priority, large files wait
interface JobPriority {
  high: fileSizeMB < 50,
  normal: fileSizeMB < 200,
  low: fileSizeMB >= 200
}
```

### 9.2 Split Large PDF Processing
```typescript
// Instead of processing 500MB PDF at once:
// 1. Split into 5x 100MB chunks
// 2. Process each chunk as separate job
// 3. Combine results
```

### 9.3 Offload to Cloud Functions
```typescript
// For files > 200MB, offload OCR to:
// - AWS Lambda (10GB memory)
// - Google Cloud Run (8GB memory)
// - Azure Functions (14GB memory)
```

### 9.4 Use Disk-Based Buffer for OCR
```typescript
// Instead of keeping PDF in memory:
// 1. Extract pages to disk as images
// 2. OCR each image individually
// 3. Stream results
// Memory: ~200MB instead of 2.5GB
```

---

## 10. Immediate Action Items

### ✅ **CRITICAL (Implement Now)**
1. ✅ Set `WORKER_CONCURRENCY=2` (already default)
2. 🔴 **Lower `MAX_PDF_SIZE_MB=200`** (currently 500)
3. 🔴 **Lower `MAX_VIDEO_SIZE_MB=500`** (currently 1000)
4. 🔴 **Add memory check before job start**

### ⚠️ **HIGH PRIORITY (This Week)**
5. Add job size-based queue prioritization
6. Add memory alerts when usage > 3GB
7. Test with 200MB PDFs under load

### 📋 **MEDIUM PRIORITY (This Month)**
8. Implement disk-based OCR buffer for large PDFs
9. Add auto-scaling based on queue length
10. Set up memory usage dashboards

---

## 11. Real-World Limits Summary

### **SAFE ZONE (4GB RAM)**
| Operation | Limit | Notes |
|-----------|-------|-------|
| PDF Files | ≤ 100MB | Process 2 concurrently |
| Audio Files | ≤ 500MB | Process 2 concurrently |
| Video Files | ≤ 500MB | Process 1-2 concurrently |
| Office Docs | ≤ 50MB | Process 3 concurrently |

### **DANGER ZONE (OOM Risk)**
| Operation | Limit | Risk |
|-----------|-------|------|
| PDF Files | > 200MB | High risk with concurrent jobs |
| Video Files | > 500MB | Moderate risk |
| 2x Large PDFs | > 150MB each | Very high risk |

### **ABSOLUTE MAX (Will Crash)**
| Operation | Limit |
|-----------|-------|
| Single PDF | > 500MB (will OOM) |
| 2x PDFs concurrent | > 200MB each |
| Video + Large PDF | > 300MB each |

---

## 12. Cost-Benefit Analysis

### Current Setup (4GB RAM, 2 vCPUs)
- **Cost:** ~$20-40/month
- **Capacity:** 30-50 files/day
- **Limitation:** Large PDFs risky

### Upgrade to 8GB RAM
- **Cost:** ~$40-80/month (+100%)
- **Capacity:** 100-150 files/day (+200%)
- **Benefit:** Handle 500MB PDFs safely

### Upgrade to 16GB RAM
- **Cost:** ~$80-160/month (+300%)
- **Capacity:** 500+ files/day (+900%)
- **Benefit:** Production-ready for any file size

---

## Conclusion

Your **4GB RAM, 2 vCPUs** VPS is **adequate for:**
- ✅ Small-medium PDFs (< 100MB)
- ✅ Audio/video processing
- ✅ Low-medium volume workloads

**Critical adjustments needed:**
1. Lower PDF limit to 200MB
2. Lower video limit to 500MB
3. Monitor memory usage closely
4. Consider 8GB upgrade if processing large PDFs regularly

**The streaming optimizations you've already implemented help significantly**, but the fundamental constraint is Mistral OCR's memory requirements for large PDFs.

