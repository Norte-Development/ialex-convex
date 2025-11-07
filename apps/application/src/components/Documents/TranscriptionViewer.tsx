import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Copy,
  Download,
  FileText,
  Clock,
  CheckCircle,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

interface TranscriptionViewerProps {
  extractedText: string;
  extractedTextLength: number;
  transcriptionConfidence?: number;
  transcriptionDuration?: number;
  transcriptionModel?: string;
  title: string;
}

export default function TranscriptionViewer({
  extractedText,
  extractedTextLength,
  transcriptionConfidence,
  transcriptionDuration,
  transcriptionModel,
  title,
}: TranscriptionViewerProps) {
  const [isCopying, setIsCopying] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(extractedText);
      setIsCopying(true);
      toast.success("Transcripción copiada al portapapeles");
      setTimeout(() => setIsCopying(false), 2000);
    } catch (error) {
      toast.error("Error al copiar transcripción");
    }
  };

  const handleDownload = () => {
    const blob = new Blob([extractedText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}-transcripcion.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Descargando transcripción...");
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const formatConfidence = (confidence: number) => {
    return `${(confidence * 100).toFixed(1)}%`;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return "text-green-600";
    if (confidence >= 0.7) return "text-yellow-600";
    return "text-orange-600";
  };

  const wordCount = extractedText
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
  const estimatedReadingTime = Math.ceil(wordCount / 200); // 200 words per minute

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Transcripción
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Audio transcrito automáticamente con IA
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="gap-2"
            >
              {isCopying ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {isCopying ? "Copiado" : "Copiar"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Descargar
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Metadata badges */}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {transcriptionDuration && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{formatDuration(transcriptionDuration)}</span>
            </div>
          )}

          {transcriptionConfidence !== undefined && (
            <div
              className={`flex items-center gap-1.5 ${getConfidenceColor(transcriptionConfidence)}`}
            >
              <BarChart3 className="h-4 w-4" />
              <span className="font-medium">
                Confianza: {formatConfidence(transcriptionConfidence)}
              </span>
            </div>
          )}

          {transcriptionModel && (
            <Badge variant="secondary">{transcriptionModel}</Badge>
          )}

          <div className="flex items-center gap-1.5 text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>{wordCount.toLocaleString()} palabras</span>
          </div>

          {estimatedReadingTime > 0 && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>~{estimatedReadingTime} min de lectura</span>
            </div>
          )}
        </div>

        <Separator />

        {/* Transcription text */}
        <div className="relative">
          <div
            className="prose prose-sm max-w-none rounded-lg border bg-muted/30 p-4 max-h-[600px] overflow-y-auto"
            style={{ whiteSpace: "pre-wrap" }}
          >
            {extractedText}
          </div>
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
          <span>{extractedTextLength.toLocaleString()} caracteres</span>
          <span>Transcrito automáticamente • Puede contener errores</span>
        </div>
      </CardContent>
    </Card>
  );
}
