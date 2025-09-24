"use client"
import { cn } from "@/lib/utils"
import type { ToolUIPart } from "ai"
import { CheckCircleIcon, CircleIcon, ClockIcon, XCircleIcon } from "lucide-react"
import type { ComponentProps } from "react"

export type ToolProps = ComponentProps<"div"> & {
  type: string
  state: ToolUIPart["state"]
}

const getActionLabel = (toolName: string) => {
  if (!toolName) return "Procesando"

  const action = toolName.split(/(?=[A-Z])/)[0].toLowerCase()

  const actionLabels: Record<string, string> = {
    search: "Investigando",
    read: "Leyendo",
    list: "Listando",
    query: "Consultando",
    edit: "Editando",
    get: "Obteniendo",
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

export const Tool = ({ className, type, state, ...props }: ToolProps) => {
  const actionLabel = getActionLabel(type)
  const statusDisplay = getStatusDisplay(state)

  return (
    <div 
      className={cn(
        "flex items-center gap-2 ml-4 pl-2 py-1.5 text-[11px] border-l-2 border-gray-200 bg-gray-50/50 rounded-r-md",
        statusDisplay.textColor, 
        className
      )} 
      {...props}
    >
      {statusDisplay.icon}
      <span className="font-medium">
        {actionLabel}
      </span>
    </div>
  )
}
