import { TaskItemFile } from "../ai-elements/task";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  WrenchIcon,
  SearchIcon,
  FileTextIcon,
  DatabaseIcon,
} from "lucide-react";
import type { ToolCallDisplayProps } from "./types/tool-types";

export function ToolCallDisplay({
  state,
  part,
}: ToolCallDisplayProps) {
  console.log("ToolCallDisplay render", { state, part });

  // Get input (either from input field or legacy args field)
  const input = part.input || part.args;

  // Get tool name from part type or default
  const toolName = (part as any).type?.replace("tool-", "") || "Tool";

  // Get appropriate icon based on tool name
  const getToolIcon = () => {
    const name = toolName.toLowerCase();
    if (name.includes("search") || name.includes("find")) {
      return <SearchIcon className="size-4 text-blue-500" />;
    }
    if (name.includes("read") || name.includes("file")) {
      return <FileTextIcon className="size-4 text-green-500" />;
    }
    if (name.includes("database") || name.includes("query")) {
      return <DatabaseIcon className="size-4 text-purple-500" />;
    }
    return <WrenchIcon className="size-4 text-gray-500" />;
  };

  // Get descriptive text based on tool and state
  const getDescriptiveText = () => {
    const name = toolName.toLowerCase();

    if (state === "call") {
      if (name.includes("search")) return "Buscando información";
      if (name.includes("read")) return "Leyendo archivo";
      if (name.includes("database")) return "Consultando base de datos";
      return `Ejecutando ${toolName}`;
    }

    if (state === "result") {
      if (name.includes("search")) return "Búsqueda completada";
      if (name.includes("read")) return "Archivo leído";
      if (name.includes("database")) return "Consulta completada";
      return `${toolName} completado`;
    }

    if (state === "error") {
      return `Error en ${toolName}`;
    }

    return toolName;
  };

  // Get file or parameter badge if available
  const getParameterBadge = () => {
    if (input && typeof input === "object") {
      const inputObj = input as any;

      // Check for file-related parameters
      if (inputObj.file || inputObj.filename || inputObj.path) {
        const fileName = inputObj.file || inputObj.filename || inputObj.path;
        return (
          <TaskItemFile>
            <FileTextIcon className="size-3" />
            <span>{fileName}</span>
          </TaskItemFile>
        );
      }

      // Check for query or search terms
      if (inputObj.query || inputObj.search || inputObj.term) {
        const searchTerm = inputObj.query || inputObj.search || inputObj.term;
        return (
          <TaskItemFile>
            <SearchIcon className="size-3" />
            <span>"{searchTerm}"</span>
          </TaskItemFile>
        );
      }

      // Generic parameter display
      const keys = Object.keys(inputObj);
      if (keys.length > 0) {
        const firstKey = keys[0];
        const value = inputObj[firstKey];
        if (typeof value === "string" && value.length < 30) {
          return (
            <TaskItemFile>
              <span>{value}</span>
            </TaskItemFile>
          );
        }
      }
    }

    return null;
  };

  // Get status indicator
  const getStatusIndicator = () => {
    switch (state) {
      case "call":
        return <ClockIcon className="size-3 animate-pulse text-blue-500" />;
      case "result":
        return <CheckCircleIcon className="size-3 text-green-600" />;
      case "error":
        return <XCircleIcon className="size-3 text-red-600" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex items-center gap-2  text-[11px] text-muted-foreground">
      {getToolIcon()}
      <span>{getDescriptiveText()}</span>
      {getParameterBadge()}
      {getStatusIndicator()}
    </div>
  );
}
