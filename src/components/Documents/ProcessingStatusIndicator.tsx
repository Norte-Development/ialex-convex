import { Badge } from "../ui/badge";
import { Clock, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

interface ProcessingStatusIndicatorProps {
  status: string | undefined;
  size?: "sm" | "md" | "lg";
  showTooltip?: boolean;
  className?: string;
}

export function ProcessingStatusIndicator({ 
  status, 
  size = "md", 
  showTooltip = true,
  className = ""
}: ProcessingStatusIndicatorProps) {
  const getStatusConfig = (status: string | undefined) => {
    switch (status) {
      case "pending":
        return {
          icon: Clock,
          color: "bg-yellow-100 text-yellow-800",
          text: "Pendiente",
          description: "Esperando indexación"
        };
      case "processing":
        return {
          icon: Loader2,
          color: "bg-blue-100 text-blue-800",
          text: "Indexando",
          description: "Analizando documento para búsqueda",
          animate: true
        };
      case "completed":
        return {
          icon: CheckCircle,
          color: "bg-green-100 text-green-800",
          text: "Indexado",
          description: "Listo para búsqueda"
        };
      case "failed":
        return {
          icon: AlertCircle,
          color: "bg-red-100 text-red-800",
          text: "Error",
          description: "Error en indexación"
        };
      default:
        return {
          icon: Clock,
          color: "bg-gray-100 text-gray-800",
          text: "Desconocido",
          description: "Estado no disponible"
        };
    }
  };

  const statusConfig = getStatusConfig(status);
  const StatusIcon = statusConfig.icon;

  const sizeClasses = {
    sm: "text-xs px-2 py-1",
    md: "text-sm px-3 py-1",
    lg: "text-base px-4 py-2"
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16
  };

  const badge = (
    <Badge 
      variant="secondary" 
      className={`${statusConfig.color} flex items-center gap-1 ${sizeClasses[size]} ${className} ${
        statusConfig.animate ? "animate-pulse" : ""
      }`}
    >
      <StatusIcon 
        size={iconSizes[size]} 
        className={statusConfig.animate ? "animate-spin" : ""} 
      />
      {statusConfig.text}
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent>
          <p>{statusConfig.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
} 