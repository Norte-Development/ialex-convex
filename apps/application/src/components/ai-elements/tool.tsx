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
import { CreateEscritoPreview } from "./CreateEscritoPreview";

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
  };

  return actionLabels[action] || action;
};

const getStatusDisplay = (status: ToolUIPart["state"]) => {
  const config = {
    "input-streaming": {
      icon: <CircleIcon className="size-3 text-muted-foreground" />,
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

export const Tool = ({ className, type, state, input, ...props }: ToolProps) => {
  const actionLabel = getActionLabel(type);
  const statusDisplay = getStatusDisplay(state);

  // Check if this is a createEscrito action
  const output = props.output as Record<string, unknown> | undefined;
  const isCreateEscrito =
    state === "output-available" && output?.action === "createEscrito";

  if (isCreateEscrito) {
    return <CreateEscritoPreview output={props.output} />;
  }

  // Show parameters when tool is processing (input-available state)
  const showParams = state === "input-available" && input
  const paramCount = showParams ? Object.keys(input).length : 0

  return (
    <div
      className={cn(
        "flex items-center gap-2 ml-4 pl-2 py-1.5 text-[11px] border-l-2 border-gray-200 bg-gray-50/50 rounded-r-md",
        statusDisplay.textColor,
        className,
      )}
      {...props}
    >
      {statusDisplay.icon}
      <span className="font-medium">{actionLabel}</span>
    </div>
  );
};
