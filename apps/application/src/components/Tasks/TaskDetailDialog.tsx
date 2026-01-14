import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { CommentList } from "./Comments";
import { CheckCircle2, Circle, Clock, Pencil, X } from "lucide-react";

interface TaskDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: {
    _id: Id<"todoItems">;
    title: string;
    description?: string;
    status: "pending" | "in_progress" | "completed";
    assignedTo?: Id<"users">;
    dueDate?: number;
  };
  caseId: Id<"cases">;
}

const statusConfig = {
  pending: {
    label: "Pendiente",
    icon: Circle,
    color: "text-gray-500",
    bg: "bg-gray-100",
  },
  in_progress: {
    label: "En Progreso",
    icon: Clock,
    color: "text-blue-500",
    bg: "bg-blue-100",
  },
  completed: {
    label: "Completado",
    icon: CheckCircle2,
    color: "text-green-500",
    bg: "bg-green-100",
  },
};

export function TaskDetailDialog({
  open,
  onOpenChange,
  task,
  caseId,
}: TaskDetailDialogProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedTitle, setEditedTitle] = useState(task.title);
  const [editedDescription, setEditedDescription] = useState(
    task.description || "",
  );

  const updateTodoItem = useMutation(api.functions.todos.updateTodoItem);

  // Get assignee info if assigned
  const caseMembers = useQuery(
    api.functions.permissions.getCaseMembersSuggestions,
    {
      caseId,
    },
  );
  const assignee = caseMembers?.find(
    (m: { id: string; name: string }) => m.id === task.assignedTo,
  );

  const handleStatusChange = async (
    newStatus: "pending" | "in_progress" | "completed",
  ) => {
    await updateTodoItem({
      itemId: task._id,
      status: newStatus,
    });
  };

  const handleSaveTitle = async () => {
    if (editedTitle.trim() && editedTitle !== task.title) {
      await updateTodoItem({
        itemId: task._id,
        title: editedTitle.trim(),
      });
    }
    setIsEditingTitle(false);
  };

  const handleSaveDescription = async () => {
    if (editedDescription !== task.description) {
      await updateTodoItem({
        itemId: task._id,
        description: editedDescription || undefined,
      });
    }
    setIsEditingDescription(false);
  };

  const StatusIcon = statusConfig[task.status].icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4 border-b">
          {/* Title */}
          <div className="flex items-start gap-3">
            <StatusIcon
              className={`h-5 w-5 mt-1 ${statusConfig[task.status].color}`}
            />
            {isEditingTitle ? (
              <div className="flex-1 flex items-center gap-2">
                <Input
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="flex-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveTitle();
                    if (e.key === "Escape") {
                      setEditedTitle(task.title);
                      setIsEditingTitle(false);
                    }
                  }}
                />
                <Button size="sm" onClick={handleSaveTitle}>
                  Guardar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditedTitle(task.title);
                    setIsEditingTitle(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <DialogTitle
                className="flex-1 text-lg font-medium cursor-pointer hover:text-tertiary group flex items-center gap-2"
                onClick={() => setIsEditingTitle(true)}
              >
                {task.title}
                <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50" />
              </DialogTitle>
            )}
          </div>
        </DialogHeader>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          {/* Status & Assignee Row */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Estado:</span>
              <Select value={task.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-[140px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">
                    <div className="flex items-center gap-2">
                      <Circle className="h-3 w-3 text-gray-500" />
                      Pendiente
                    </div>
                  </SelectItem>
                  <SelectItem value="in_progress">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3 text-blue-500" />
                      En Progreso
                    </div>
                  </SelectItem>
                  <SelectItem value="completed">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      Completado
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {assignee && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Asignado a:</span>
                <Badge variant="secondary" className="font-normal">
                  {assignee.name}
                </Badge>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                Descripción
              </span>
              {!isEditingDescription && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingDescription(true)}
                  className="h-6 text-xs text-gray-500"
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Editar
                </Button>
              )}
            </div>
            {isEditingDescription ? (
              <div className="space-y-2">
                <Textarea
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  placeholder="Agrega una descripción..."
                  rows={3}
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveDescription}>
                    Guardar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditedDescription(task.description || "");
                      setIsEditingDescription(false);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-600 whitespace-pre-wrap">
                {task.description || (
                  <span className="text-gray-400 italic">Sin descripción</span>
                )}
              </p>
            )}
          </div>

          {/* Divider */}
          <hr className="border-gray-100" />

          {/* Comments Section */}
          <CommentList taskId={task._id} caseId={caseId} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
