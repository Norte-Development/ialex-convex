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

