"use client";
import { cn } from "@/lib/utils";
import type { ToolUIPart } from "ai";
import {
  CheckCircleIcon,
  CircleIcon,
  ClockIcon,
  XCircleIcon,
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Link } from "react-router-dom";
import { useCase } from "@/context/CaseContext";
import type { Id } from "../../../convex/_generated/dataModel";

export type ToolProps = ComponentProps<"div"> & {
  type: string;
  state: ToolUIPart["state"];
  output?: ToolUIPart["output"];
  input?: unknown;
};

const getActionLabel = (toolName: string): ReactNode => {
  if (!toolName) return "Procesando";

  const action = toolName.split(/(?=[A-Z])/)[0].toLowerCase();

  const actionLabels: Record<string, ReactNode> = {
    search: "Investigando",
    read: "Leyendo",
    list: "Listando",
    query: "Consultando",
    edit: "Editando",
    get: "Obteniendo",
    manage: "Preparando",
    insert: "Insertando",
  };

  return actionLabels[action] || action;
};

const getStatusDisplay = (status: ToolUIPart["state"]) => {
  const config = {
    "input-streaming": {
      icon: <CircleIcon className="size-3 text-muted-foreground animate-pulse" />,
      textColor: "text-muted-foreground",
    },
    "input-available": {
      icon: (
        <ClockIcon className="size-3 animate-pulse text-muted-foreground" />
      ),
      textColor: "text-muted-foreground",
    },
    "output-available": {
      icon: <CheckCircleIcon className="size-3 text-muted-foreground" />,
      textColor: "text-muted-foreground",
    },
    "output-error": {
      icon: <XCircleIcon className="size-3 text-red-600" />,
      textColor: "text-red-600",
    },
  } as const;

  return config[status];
};

// Helper to safely get string value from unknown type
const safeString = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
};

// Helper to check if input has any meaningful data
const hasData = (input: any): boolean => {
  if (!input || typeof input !== "object") return false;
  return Object.keys(input).length > 0;
};

// Helper to validate if a string looks like a valid Convex ID
// Convex IDs are typically lowercase alphanumeric strings with a specific format
const isValidConvexId = (id: string): boolean => {
  if (!id || id.length < 10) return false;
  // Convex IDs are lowercase alphanumeric (base32-like encoding)
  // They don't contain uppercase letters or special characters except possibly underscores
  return /^[a-z0-9_]{10,}$/.test(id);
};

// Component to render tool inputs with escrito name fetching
function ToolInputDisplay({ type, input }: { type: string; input: any }): ReactNode {
  // Early return if no meaningful data
  if (!hasData(input)) {
    return (
      <div className="flex items-center gap-1.5 text-[10px] mt-1 text-muted-foreground/50">
        <span className="animate-pulse">Preparando parámetros...</span>
      </div>
    );
  }

  // Safely extract escritoId
  const escritoIdRaw = input?.escritoId;
  const escritoId = safeString(escritoIdRaw);
  const isValidId = isValidConvexId(escritoId);

  if (type === "insertContent") {
    const placement = input?.placement;
    const htmlRaw = input?.html;
    const htmlStr = safeString(htmlRaw);
    
    return (
      <div className="flex flex-col gap-1 text-[10px] mt-1">
        {/* Escrito ID */}
        {escritoId && (
          <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-left-1 duration-200">
            <span className="font-mono text-muted-foreground/60">escrito:</span>
            <span className="text-blue-600 font-medium text-[10px]">
              {isValidId ? (
                escritoId.substring(0, 15)
              ) : (
                <span className="animate-pulse">{escritoId}...</span>
              )}
            </span>
          </div>
        )}
        
        {/* HTML content preview */}
        {htmlStr && htmlStr.length > 0 && (
          <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-left-1 duration-200">
            <span className="font-mono text-muted-foreground/60">contenido:</span>
            <span className="text-muted-foreground/80 truncate max-w-[200px]">
              { `${htmlStr}`}
            </span>
          </div>
        )}
        
        {/* Placement information */}
        {placement && placement.type && (
          <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-left-1 duration-200">
            <span className="font-mono text-muted-foreground/60">ubicación:</span>
            <span className="text-purple-600 font-medium text-[9px]">
              {placement.type === 'documentStart' && '📄 inicio del documento'}
              {placement.type === 'documentEnd' && '📄 final del documento'}
              {placement.type === 'range' && (
                <>
                  📍 rango: {placement.textStart ? `"${safeString(placement.textStart).substring(0, 20)}..."` : '...'}
                </>
              )}
              {placement.type === 'position' && `📍 posición ${placement.position ?? '...'}`}
              {!['documentStart', 'documentEnd', 'range', 'position'].includes(placement.type) && (
                <span className="animate-pulse">{placement.type || '...'}</span>
              )}
            </span>
          </div>
        )}
      </div>
    );
  }
  
  if (type === "editEscrito") {
    const editsRaw = input?.edits;
    const edits = Array.isArray(editsRaw) ? editsRaw : [];
    
    return (
      <div className="flex flex-col gap-1 text-[10px] mt-1">
        {/* Escrito ID */}
        {escritoId && (
          <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-left-1 duration-200">
            <span className="font-mono text-muted-foreground/60">escrito:</span>
            <span className="text-blue-600 font-medium text-[10px]">
              {isValidId ? (
                escritoId.substring(0, 15)
              ) : (
                <span className="animate-pulse">{escritoId}...</span>
              )}
            </span>
          </div>
        )}
        
        {/* Edits list */}
        {edits.length > 0 && (
          <div className="flex flex-col gap-0.5 ml-2 border-l-2 border-orange-200 pl-2 animate-in fade-in slide-in-from-left-1 duration-200">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="font-mono text-muted-foreground/60">
                {edits.length} edición{edits.length !== 1 ? 'es' : ''}:
              </span>
            </div>
            {edits.slice(0, 3).map((edit, i) => {
              const editType = safeString(edit?.type);
              const findText = safeString(edit?.findText);
              const editText = safeString(edit?.text);
              
              return (
                <div key={i} className="flex items-center gap-1.5 animate-in fade-in duration-200">
                  <span className="text-orange-600 font-medium text-[9px]">
                    {editType === 'replace' && '🔄 reemplazar'}
                    {editType === 'add_mark' && '✨ formato'}
                    {editType === 'add_paragraph' && '➕ párrafo'}
                    {editType === 'remove_mark' && '🗑️ quitar formato'}
                    {editType === 'replace_mark' && '🔀 cambiar formato'}
                    {!editType && <span className="animate-pulse">⏳</span>}
                  </span>
                  {findText && findText.length > 0 && (
                    <span className="text-muted-foreground/70 truncate max-w-[150px]">
                      "{findText.length > 30 ? `${findText.substring(0, 30)}...` : findText}"
                    </span>
                  )}
                  {!findText && editText && editText.length > 0 && (
                    <span className="text-muted-foreground/70 truncate max-w-[150px]">
                      "{editText.length > 30 ? `${editText.substring(0, 30)}...` : editText}"
                    </span>
                  )}
                </div>
              );
            })}
            {edits.length > 3 && (
              <span className="text-muted-foreground/50 text-[9px] ml-4">
                +{edits.length - 3} más...
              </span>
            )}
          </div>
        )}
      </div>
    );
  }
  
  // Fallback: show raw input for unsupported tools during development
  return (
    <div className="flex items-center gap-1.5 text-[10px] mt-1 text-muted-foreground/50">
      <span>Herramienta: {type}</span>
    </div>
  );
}

// Minimal component for createEscrito tool with hyperlink
function CreateEscritoTool({ className, state, output, ...props }: ToolProps) {
  const { caseId } = useCase();
  const statusDisplay = getStatusDisplay(state);

  // Extract escritoId from markdown output string
  // Handle different output structures: string, {type: "text", value: string}, or {value: string}
  let outputString = "";
  if (typeof output === "string") {
    outputString = output;
  } else if (output && typeof output === "object") {
    const outputObj = output as Record<string, unknown>;
    if (outputObj.type === "text" && typeof outputObj.value === "string") {
      outputString = outputObj.value;
    } else if (typeof outputObj.value === "string") {
      outputString = outputObj.value;
    } else if (typeof outputObj.result === "string") {
      outputString = outputObj.result;
    }
  }
  
  const idMatch = outputString.match(/- \*\*ID\*\*:\s+([a-z0-9_]{10,})/i);
  const escritoId = idMatch?.[1] as Id<"escritos"> | undefined;

  return (
    <div
      className={cn(
        "flex flex-col gap-1 ml-4 pl-2 py-1.5 text-[11px] border-l-2 border-gray-200 bg-gray-50/50 rounded-r-md",
        statusDisplay.textColor,
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        {statusDisplay.icon}
        <span className="font-medium">Creando</span>
      </div>
      {state === "output-available" && escritoId && caseId && (
        <div className="mt-1">
          <Link
            to={`/caso/${caseId}/escritos/${escritoId}`}
            className="text-blue-600 hover:text-blue-800 hover:underline text-[11px]"
          >
            Abrir escrito
          </Link>
        </div>
      )}
    </div>
  );
}

export const Tool = ({ className, type, state, input, ...props }: ToolProps) => {
  const actionLabel = getActionLabel(type);
  const statusDisplay = getStatusDisplay(state);

  // Check if this is a createEscrito tool
  if (type === "createEscrito") {
    return (
      <CreateEscritoTool
        className={className}
        type={type}
        state={state}
        input={input}
        output={props.output}
        {...props}
      />
    );
  }


  return (
    <div
      className={cn(
        "flex flex-col gap-1 ml-4 pl-2 py-1.5 text-[11px] border-l-2 border-gray-200 bg-gray-50/50 rounded-r-md",
        statusDisplay.textColor,
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        {statusDisplay.icon}
        <span className="font-medium">{actionLabel}</span>
      </div>
      
      {/* {showStreamingInputs ? (
        <ToolInputDisplay 
          type={type} 
          input={input as any} 
        />
      ) : (
        <></>)} */}
      
    </div>
  );
};