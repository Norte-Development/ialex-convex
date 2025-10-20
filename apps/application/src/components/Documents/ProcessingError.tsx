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

