# Document Processing UX Improvements

## Status: Backend Complete ✅ | Frontend Pending

This document outlines the UX improvements for document processing, leveraging the streaming pipeline infrastructure.

---

## ✅ Completed: Backend Implementation

### 1. Manual Retry System
**Files Modified:**
- `apps/application/convex/schema.ts` - Added retry tracking fields
- `apps/application/convex/functions/documentProcessing.ts` - Added `retryDocumentProcessing` mutation
- `apps/application/convex/functions/libraryDocumentProcessing.ts` - Added `retryLibraryDocumentProcessing` mutation

**Schema Fields Added:**
- `retryCount`: Number - Tracks retry attempts
- `lastRetryAt`: Number - Timestamp of last retry

**Public API:**
```typescript
// Retry failed case document
await convex.mutation(api.functions.documentProcessing.retryDocumentProcessing, {
  documentId: "doc_id"
});

// Retry failed library document
await convex.mutation(api.functions.libraryDocumentProcessing.retryLibraryDocumentProcessing, {
  libraryDocumentId: "lib_doc_id"
});
```

### 2. Real-Time Progress Tracking
**Files Modified:**
- `apps/application/convex/schema.ts` - Added progress fields
- `apps/application/convex/functions/documentProcessing.ts` - Added `updateProcessingProgress` mutation
- `apps/application/convex/functions/libraryDocumentProcessing.ts` - Added `updateLibraryProcessingProgress` mutation
- `apps/application/convex/http.ts` - Added progress webhooks

**Schema Fields Added:**
- `processingPhase`: "downloading" | "extracting" | "chunking" | "embedding" | "upserting"
- `processingProgress`: Number (0-100)

**Webhook Endpoints:**
- `/webhooks/document-progress` - For case documents
- `/webhooks/library-document-progress` - For library documents

### 3. Enhanced Error Handling
**Files Modified:**
- `apps/application/convex/schema.ts` - Added error categorization fields
- `apps/application/convex/http.ts` - Added error categorization logic to webhooks

**Schema Fields Added:**
- `processingErrorType`: String - Categorized error type
- `processingErrorRecoverable`: Boolean - Can retry?
- `processingMethod`: String - "mistral-ocr" | "pdfjs" | "transcription"
- `wasResumed`: Boolean - Job resumed after failure?
- `processingDurationMs`: Number - Actual processing time

**Error Categories:**
- `file_too_large` (non-recoverable)
- `unsupported_format` (non-recoverable)
- `ocr_failed` (recoverable)
- `timeout` (recoverable)
- `network_error` (recoverable)
- `quota_exceeded` (recoverable)
- `unknown_error` (recoverable)

---

## 🚧 Pending: Frontend UI Implementation

### 4. Retry Button Component

**Files to Modify:**
- `apps/application/src/pages/CaseOpen/CaseDocumentPage.tsx`
- `apps/application/src/pages/LibraryDocumentPage.tsx`

**Implementation:**

```tsx
import { RefreshCw } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

// For case documents
const retryProcessing = useMutation(api.functions.documentProcessing.retryDocumentProcessing);

// For library documents  
const retryProcessing = useMutation(api.functions.libraryDocumentProcessing.retryLibraryDocumentProcessing);

// UI Component
{document.processingStatus === "failed" && (
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>Error de Procesamiento</AlertTitle>
    <AlertDescription>
      <p className="mb-2">{document.processingError}</p>
      {document.processingErrorRecoverable && (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={async () => {
            try {
              await retryProcessing({ documentId: document._id });
              toast.success("Reintentando indexación del documento");
            } catch (error) {
              toast.error("Error al reintentar: " + error.message);
            }
          }}
          disabled={retryProcessing.isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${retryProcessing.isLoading ? 'animate-spin' : ''}`} />
          Reintentar Indexación
        </Button>
      )}
      {document.retryCount > 0 && (
        <p className="text-xs text-muted-foreground mt-2">
          Intentos: {document.retryCount}
        </p>
      )}
    </AlertDescription>
  </Alert>
)}
```

---

### 5. Progress Bar Component

**File to Create:**
- `apps/application/src/components/Documents/ProcessingProgress.tsx`

**Implementation:**

```tsx
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";

interface ProcessingProgressProps {
  phase?: "downloading" | "extracting" | "chunking" | "embedding" | "upserting";
  progress?: number;
}

export function ProcessingProgress({ phase, progress }: ProcessingProgressProps) {
  const getPhaseLabel = (phase?: string) => {
    switch (phase) {
      case "downloading":
        return "Descargando documento";
      case "extracting":
        return "Extrayendo texto";
      case "chunking":
        return "Fragmentando contenido";
      case "embedding":
        return "Generando embeddings";
      case "upserting":
        return "Guardando en base de datos";
      default:
        return "Procesando";
    }
  };

  const getPhaseDescription = (phase?: string) => {
    switch (phase) {
      case "downloading":
        return "Obteniendo el archivo del almacenamiento";
      case "extracting":
        return "Usando OCR y análisis de contenido";
      case "chunking":
        return "Dividiendo en fragmentos para búsqueda";
      case "embedding":
        return "Creando representaciones vectoriales";
      case "upserting":
        return "Indexando para búsqueda semántica";
      default:
        return "Preparando documento para indexación";
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <div className="flex items-center justify-between flex-1 text-sm">
          <span className="font-medium">{getPhaseLabel(phase)}</span>
          {progress !== undefined && (
            <span className="text-muted-foreground">{Math.round(progress)}%</span>
          )}
        </div>
      </div>
      {progress !== undefined && <Progress value={progress} />}
      <p className="text-xs text-muted-foreground">{getPhaseDescription(phase)}</p>
    </div>
  );
}
```

**Integration in Document Pages:**

```tsx
{document.processingStatus === "processing" && (
  <ProcessingProgress 
    phase={document.processingPhase}
    progress={document.processingProgress}
  />
)}
```

---

### 6. Enhanced Error Display

**File to Create:**
- `apps/application/src/components/Documents/ProcessingError.tsx`

**Implementation:**

```tsx
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, AlertTriangle, FileX, WifiOff, Clock, Zap } from "lucide-react";
import { RefreshCw } from "lucide-react";

interface ProcessingErrorProps {
  error: string;
  errorType?: string;
  recoverable?: boolean;
  onRetry?: () => void;
  retrying?: boolean;
}

export function ProcessingError({ 
  error, 
  errorType, 
  recoverable, 
  onRetry,
  retrying 
}: ProcessingErrorProps) {
  const getErrorConfig = (errorType?: string) => {
    switch (errorType) {
      case "file_too_large":
        return {
          title: "Archivo Demasiado Grande",
          suggestion: "Intenta comprimir el PDF o dividirlo en partes más pequeñas.",
          variant: "destructive" as const,
          icon: FileX,
          recoverable: false,
        };
      case "unsupported_format":
        return {
          title: "Formato No Soportado",
          suggestion: "Este tipo de archivo no puede ser procesado. Por favor, usa PDF, Word, o formatos de imagen.",
          variant: "destructive" as const,
          icon: AlertCircle,
          recoverable: false,
        };
      case "ocr_failed":
        return {
          title: "Error en OCR",
          suggestion: "El documento tiene problemas de escaneo. Intenta con un PDF con texto seleccionable o una imagen de mejor calidad.",
          variant: "warning" as const,
          icon: AlertTriangle,
          recoverable: true,
        };
      case "timeout":
        return {
          title: "Tiempo de Espera Agotado",
          suggestion: "El documento es muy grande o complejo. Puedes reintentar o dividirlo en partes más pequeñas.",
          variant: "warning" as const,
          icon: Clock,
          recoverable: true,
        };
      case "network_error":
        return {
          title: "Error de Conexión",
          suggestion: "Hubo un problema de red. Reintenta en unos momentos.",
          variant: "warning" as const,
          icon: WifiOff,
          recoverable: true,
        };
      case "quota_exceeded":
        return {
          title: "Límite de Procesamiento Alcanzado",
          suggestion: "Has alcanzado el límite de procesamiento. Intenta nuevamente más tarde.",
          variant: "warning" as const,
          icon: Zap,
          recoverable: true,
        };
      default:
        return {
          title: "Error de Procesamiento",
          suggestion: "Ocurrió un error inesperado. Puedes reintentar o contactar soporte.",
          variant: "destructive" as const,
          icon: AlertCircle,
          recoverable: true,
        };
    }
  };

  const config = getErrorConfig(errorType);
  const Icon = config.icon;
  const canRetry = recoverable ?? config.recoverable;

  return (
    <Alert variant={config.variant}>
      <Icon className="h-4 w-4" />
      <AlertTitle>{config.title}</AlertTitle>
      <AlertDescription>
        <p className="mb-2">{error}</p>
        <p className="text-sm text-muted-foreground mb-3">{config.suggestion}</p>
        {canRetry && onRetry && (
          <Button 
            onClick={onRetry} 
            variant="outline" 
            size="sm"
            disabled={retrying}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${retrying ? 'animate-spin' : ''}`} />
            {retrying ? "Reintentando..." : "Reintentar"}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
```

**Integration:**

```tsx
{document.processingStatus === "failed" && (
  <ProcessingError
    error={document.processingError}
    errorType={document.processingErrorType}
    recoverable={document.processingErrorRecoverable}
    onRetry={() => retryProcessing({ documentId: document._id })}
    retrying={retryProcessing.isLoading}
  />
)}
```

---

### 7. Processing Metadata Display

**Add to existing document info sections:**

```tsx
{document.processingStatus === "completed" && (
  <div className="space-y-2 text-sm">
    {document.processingMethod && (
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Método:</span>
        <Badge variant="outline">
          {document.processingMethod === "mistral-ocr" && "OCR Avanzado"}
          {document.processingMethod === "pdfjs" && "Extracción PDF"}
          {document.processingMethod === "transcription" && "Transcripción"}
        </Badge>
      </div>
    )}
    
    {document.wasResumed && (
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Estado:</span>
        <Badge variant="secondary">Recuperado automáticamente</Badge>
      </div>
    )}
    
    {document.processingDurationMs && (
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Tiempo:</span>
        <span>{Math.round(document.processingDurationMs / 1000)}s</span>
      </div>
    )}
    
    {document.totalChunks && (
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Fragmentos:</span>
        <span>{document.totalChunks}</span>
      </div>
    )}
  </div>
)}
```

---

## 📋 Implementation Checklist

### Phase 1: Core Components (1-2 hours)
- [ ] Create `ProcessingProgress.tsx` component
- [ ] Create `ProcessingError.tsx` component
- [ ] Test components in isolation

### Phase 2: Case Documents (1 hour)
- [ ] Add retry button to `CaseDocumentPage.tsx`
- [ ] Integrate progress bar in processing state
- [ ] Add enhanced error display
- [ ] Add processing metadata display

### Phase 3: Library Documents (1 hour)
- [ ] Add retry button to `LibraryDocumentPage.tsx`
- [ ] Integrate progress bar in processing state
- [ ] Add enhanced error display
- [ ] Add processing metadata display

### Phase 4: Secondary Locations (30 min)
- [ ] Update `ProcessingStatusIndicator.tsx` to use progress bar
- [ ] Update `DocumentDetailsSheet.tsx` with new error display
- [ ] Update `DocumentCard.tsx` to show processing metadata

### Phase 5: Testing (1 hour)
- [ ] Test retry functionality with failed documents
- [ ] Test progress updates (may require worker changes for real-time)
- [ ] Test error categorization with different error types
- [ ] Test all UI states: pending, processing, completed, failed

---

## 🔧 Worker Integration (Optional)

To enable real-time progress updates from the document processor:

### Update Streaming Jobs

In both `streamingProcessDocumentJob.ts` and `streamingProcessLibraryDocumentJob.ts`:

```typescript
// In the pipeline config
onProgress: async (update) => {
  job.updateProgress(update);
  
  // Send progress to Convex webhook
  try {
    const progressUrl = update.phase 
      ? `${process.env.CONVEX_SITE_URL}/webhooks/document-progress`
      : null;
      
    if (progressUrl) {
      await fetch(progressUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: payload.documentId,
          phase: update.phase,
          progress: update.percent
        })
      });
    }
  } catch (error) {
    // Ignore progress update errors
  }
}
```

---

## 📊 Expected Impact

### User Experience
- ✅ **Reduced anxiety**: Users see real-time progress instead of just "Processing..."
- ✅ **Self-service**: Users can retry failed documents without support
- ✅ **Better understanding**: Clear error messages with actionable guidance
- ✅ **Transparency**: Processing method and duration displayed

### Support Burden
- ✅ **Fewer tickets**: Users can resolve issues themselves
- ✅ **Better debugging**: Categorized errors make support easier
- ✅ **Resume visibility**: Users understand when jobs auto-recovered

### System Reliability
- ✅ **Leverages streaming**: Utilizes existing resume/retry infrastructure
- ✅ **Error categorization**: Helps identify systemic issues
- ✅ **Processing metrics**: Visibility into processing performance

---

## 🚀 Quick Start

To implement the minimum viable version (retry only):

1. Copy `ProcessingError.tsx` component
2. Add retry mutation to document pages
3. Replace existing error display with new component

**Time estimate: 30 minutes**

For full implementation with progress tracking:

**Time estimate: 4-5 hours**

