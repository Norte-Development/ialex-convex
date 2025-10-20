"use client"
import { cn } from "@/lib/utils"
import type { ToolUIPart } from "ai"
import { CheckCircleIcon, CircleIcon, ClockIcon, XCircleIcon } from "lucide-react"
import type { ComponentProps, ReactNode } from "react"
import { CreateEscritoPreview } from "./CreateEscritoPreview"

export type ToolProps = ComponentProps<"div"> & {
  type: string
  state: ToolUIPart["state"]
  output?: ToolUIPart["output"]
  input?: Record<string, any>
}

const getActionLabel = (toolName: string): ReactNode => {
  if (!toolName) return "Procesando"

  const action = toolName.split(/(?=[A-Z])/)[0].toLowerCase()

  const actionLabels: Record<string, ReactNode> = {
    search: "Investigando",
    read: "Leyendo",
    list: "Listando",
    query: "Consultando",
    edit: "Editando",
    get: "Obteniendo",
    manage: "Preparando",
    insert: "Insertando",
    mark: "Marcando",
    create: "Creando",
    update: "Actualizando",
    delete: "Eliminando",
    fetch: "Obteniendo",
    save: "Guardando",
    load: "Cargando",
    process: "Procesando",
    analyze: "Analizando",
    generate: "Generando",
    validate: "Validando",
    check: "Verificando",
    find: "Buscando",
    add: "Agregando",
    remove: "Removiendo",
  }

  return actionLabels[action] || action
}

const getStatusDisplay = (status: ToolUIPart["state"]) => {
  const config = {
    "input-streaming": {
      icon: <CircleIcon className="size-3 text-muted-foreground" />,
      textColor: "text-muted-foreground",
    },
    "input-available": {
      icon: <ClockIcon className="size-3 animate-pulse text-muted-foreground" />,
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
  } as const

  return config[status]
}

export const Tool = ({ className, type, state, input, output, ...props }: ToolProps) => {
  const actionLabel = getActionLabel(type)
  const statusDisplay = getStatusDisplay(state)
  
  // Check if this is a createEscrito action
  const outputData = output as Record<string, unknown> | undefined
  const isCreateEscrito = 
    state === "output-available" && 
    outputData?.action === "createEscrito"

  if (isCreateEscrito) {
    return <CreateEscritoPreview output={output} />
  }

  // Show parameters when tool is processing (input-available state)
  const showParams = state === "input-available" && input
  const paramCount = showParams ? Object.keys(input).length : 0

  return (
    <div 
      className={cn(
        "ml-4 pl-2 py-1.5 text-[11px] border-l-2 border-gray-200 bg-gray-50/50 rounded-r-md",
        statusDisplay.textColor, 
        className
      )} 
      {...props}
    >
      <div className="flex items-center gap-2">
        {statusDisplay.icon}
        <span className="font-medium">
          {actionLabel}
        </span>
        {showParams && paramCount > 0 && (
          <span className="text-[10px] text-muted-foreground">
            ({paramCount} parámetro{paramCount > 1 ? 's' : ''})
          </span>
        )}
      </div>
      
      {/* Show parameter details when processing */}
      {showParams && paramCount > 0 && input && (
        <div className="mt-1.5 pl-5 space-y-0.5">
          {Object.entries(input).slice(0, 3).map(([key, value]) => {
            // Format the value for display
            let displayValue = String(value)
            if (typeof value === 'object' && value !== null) {
              displayValue = JSON.stringify(value)
            }
            // Truncate long values
            if (displayValue.length > 50) {
              displayValue = displayValue.substring(0, 47) + '...'
            }
            
            return (
              <div key={key} className="text-[10px] text-muted-foreground/80">
                <span className="font-medium">{key}:</span>{' '}
                <span className="italic">{displayValue}</span>
              </div>
            )
          })}
          {paramCount > 3 && (
            <div className="text-[10px] text-muted-foreground/60 italic">
              +{paramCount - 3} más...
            </div>
          )}
        </div>
      )}
    </div>
  )
}
