import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RuleForm, type RuleFormValues } from "@/components/UserSettings/AgentRules/RuleForm";
import { RuleCard } from "@/components/UserSettings/AgentRules/RuleCard";

export function CaseAgentRules() {
  const { id } = useParams();
  const caseId = id as string;

  const caseRules = useQuery(api.functions.agentRules.getCaseRules as any, caseId ? { caseId, activeOnly: false } : "skip");
  const createRule = useMutation(api.functions.agentRules.createRule as any);
  const updateRule = useMutation(api.functions.agentRules.updateRule as any);
  const deleteRule = useMutation(api.functions.agentRules.deleteRule as any);
  const toggleRule = useMutation(api.functions.agentRules.toggleRuleActive as any);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const orderedRules = useMemo(() => {
    if (!caseRules) return [];
    return [...caseRules].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
  }, [caseRules]);

  const handleCreate = async (values: RuleFormValues) => {
    await createRule({
      name: values.name,
      content: values.content,
      scope: "case",
      caseId,
      isActive: values.isActive,
      order: values.order ?? undefined,
    } as any);
    setOpen(false);
  };

  const handleUpdate = async (values: RuleFormValues) => {
    if (!editing) return;
    await updateRule({
      ruleId: editing._id,
      name: values.name,
      content: values.content,
      isActive: values.isActive,
      order: values.order ?? undefined,
    } as any);
    setEditing(null);
    setOpen(false);
  };

  const handleDelete = async (ruleId: string) => {
    await deleteRule({ ruleId } as any);
  };

  const handleToggle = async (ruleId: string, active: boolean) => {
    await toggleRule({ ruleId, isActive: active } as any);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Reglas del Agente (Caso)</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditing(null); }}>Nueva regla</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Regla" : "Crear Regla"}</DialogTitle>
            </DialogHeader>
            <RuleForm
              initial={editing ? {
                name: editing.name,
                content: editing.content,
                isActive: editing.isActive,
                order: editing.order ?? null,
              } : undefined}
              onSubmit={editing ? handleUpdate : handleCreate}
              onCancel={() => setOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {orderedRules && orderedRules.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {orderedRules.map((rule: any) => (
            <RuleCard
              key={rule._id}
              rule={rule}
              onEdit={() => { setEditing(rule); setOpen(true); }}
              onDelete={() => handleDelete(rule._id)}
              onToggle={(active) => handleToggle(rule._id, active)}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No hay reglas de caso aún</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Cree reglas específicas para este caso.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
