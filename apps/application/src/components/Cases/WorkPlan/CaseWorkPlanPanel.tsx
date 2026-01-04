import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Plus, Sparkles } from "lucide-react";
import { WorkPlanTaskItem } from "./WorkPlanTaskItem";
import { WorkPlanEmptyState } from "./WorkPlanEmptyState";
import { AddTaskDialog } from "../AddTaskDialog";

interface CaseWorkPlanPanelProps {
  caseId: Id<"cases">;
  className?: string;
}

export function CaseWorkPlanPanel({
  caseId,
  className,
}: CaseWorkPlanPanelProps) {
  const { user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isAddTaskDialogOpen, setIsAddTaskDialogOpen] = useState(false);

  // Queries
  const lists = useQuery(api.functions.todos.listTodoListsByCase, { caseId });
  const primaryList = useMemo(() => lists?.[0], [lists]);
  const items = useQuery(
    api.functions.todos.listTodoItemsByList,
    primaryList ? { listId: primaryList._id } : "skip",
  );

  // Calcular progreso
  const completedCount =
    items?.filter((i) => i.status === "completed").length || 0;
  const totalCount = items?.length || 0;
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const sortedItems = useMemo(() => {
    if (!items) return [];
    return [...items].sort((a, b) => a.order - b.order);
  }, [items]);

  return (
    <div
      className={cn(
        "rounded-lg border border-tertiary bg-white overflow-hidden",
        className,
      )}
    >
      {/* Header */}
      <button
        className="flex items-center justify-between p-4 w-full hover:bg-gray-50 transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-3">
          <div className="text-left">
            <h3 className="font-medium text-gray-900">
              {primaryList?.title || "Plan de Trabajo"}
            </h3>
            <p className="text-xs text-gray-500">
              {completedCount} de {totalCount} tareas completadas
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-tertiary">
            {progressPercent}%
          </span>
          {isCollapsed ? (
            <ChevronRight className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Progress Bar */}
      <div className="px-4 pb-2">
        <Progress value={progressPercent} className="h-2" />
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="px-4 pb-4 space-y-3">
          {/* Task List */}
          {sortedItems.length > 0 ? (
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {sortedItems.map((item) => (
                <WorkPlanTaskItem
                  key={item._id}
                  itemId={item._id}
                  title={item.title}
                  description={item.description}
                  status={item.status}
                />
              ))}
            </div>
          ) : (
            <WorkPlanEmptyState />
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              disabled
              title="Proximamente"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {primaryList ? "Regenerar Plan" : "Generar con iAlex"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddTaskDialogOpen(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <AddTaskDialog
        open={isAddTaskDialogOpen}
        onOpenChange={setIsAddTaskDialogOpen}
        caseId={caseId}
        listId={primaryList?._id}
        userId={user?._id as Id<"users"> | undefined}
      />
    </div>
  );
}
