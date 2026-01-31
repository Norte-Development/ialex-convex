import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, FileText, MessageSquare, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface GenerateChecklistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: Id<"cases">;
  userId?: Id<"users">;
  hasExistingPlan: boolean;
}

export function GenerateChecklistDialog({
  open,
  onOpenChange,
  caseId,
  userId,
  hasExistingPlan,
}: GenerateChecklistDialogProps) {
  const [sourceType, setSourceType] = useState<
    "case_description" | "thread_conversation"
  >("case_description");
  const [selectedThreadId, setSelectedThreadId] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Cargar threads del caso
  const threads = useQuery(api.agents.threads.listThreads, {
    caseId: caseId as unknown as string,
    paginationOpts: { numItems: 20, cursor: null as any },
  });

  const generateChecklist = useAction(
    api.functions.checklistGeneration.generateCaseChecklist,
  );

  const handleGenerate = async () => {
    if (!userId) {
      toast.error("Error de autenticacion");
      return;
    }

    if (sourceType === "thread_conversation" && !selectedThreadId) {
      toast.error("Selecciona una conversacion");
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateChecklist({
        caseId,
        userId,
        sourceType,
        threadId:
          sourceType === "thread_conversation" ? selectedThreadId : undefined,
      });

      toast.success(`Plan generado: ${result.taskCount} tareas creadas`);
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Error al generar el plan");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generar Plan de Trabajo</DialogTitle>
          <DialogDescription>
            iAlex analizara la informacion y generara un plan de tareas
            personalizado para este caso.
          </DialogDescription>
        </DialogHeader>

        {hasExistingPlan && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-yellow-50 border border-yellow-200">
            <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              Ya existe un plan de trabajo. Generar uno nuevo reemplazara todas
              las tareas actuales.
            </div>
          </div>
        )}

        <div className="space-y-4 py-4">
          <RadioGroup
            value={sourceType}
            onValueChange={(v) => setSourceType(v as any)}
            className="space-y-3"
          >
            <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-gray-50 cursor-pointer">
              <RadioGroupItem
                value="case_description"
                id="case_description"
                className="mt-1"
              />
              <Label
                htmlFor="case_description"
                className="cursor-pointer flex-1"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    Desde descripcion del caso
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Genera el plan basandose en el titulo, categoria, descripcion
                  y clientes del caso.
                </p>
              </Label>
            </div>

            <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-gray-50 cursor-pointer">
              <RadioGroupItem
                value="thread_conversation"
                id="thread_conversation"
                className="mt-1"
              />
              <Label
                htmlFor="thread_conversation"
                className="cursor-pointer flex-1"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">Desde conversacion</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Analiza una conversacion con iAlex para extraer tareas
                  discutidas.
                </p>
              </Label>
            </div>
          </RadioGroup>

          {sourceType === "thread_conversation" && (
            <div className="pl-6">
              <Label className="text-sm text-gray-600 mb-2 block">
                Selecciona la conversacion
              </Label>
              <Select
                value={selectedThreadId}
                onValueChange={setSelectedThreadId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una conversacion..." />
                </SelectTrigger>
                <SelectContent>
                  {threads?.page?.map((thread) => (
                    <SelectItem key={thread._id} value={thread._id}>
                      {thread.title || "Conversacion sin titulo"}
                    </SelectItem>
                  ))}
                  {(!threads?.page || threads.page.length === 0) && (
                    <SelectItem value="no-threads" disabled>
                      No hay conversaciones en este caso
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isGenerating}
          >
            Cancelar
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generando...
              </>
            ) : (
              "Generar Plan"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
