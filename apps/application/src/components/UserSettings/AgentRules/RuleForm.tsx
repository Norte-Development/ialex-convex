import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export type RuleFormValues = {
  name: string;
  content: string;
  isActive: boolean;
  order?: number | null;
};

export function RuleForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: RuleFormValues;
  onSubmit: (values: RuleFormValues) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [order, setOrder] = useState<string>(
    initial?.order !== undefined && initial?.order !== null ? String(initial.order) : ""
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(initial?.name ?? "");
    setContent(initial?.content ?? "");
    setIsActive(initial?.isActive ?? true);
    setOrder(
      initial?.order !== undefined && initial?.order !== null
        ? String(initial.order)
        : ""
    );
  }, [initial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        content: content.trim(),
        isActive,
        order: order.trim() === "" ? null : Number(order),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Nombre</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label>Contenido de la regla</Label>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Orden</Label>
          <Input
            type="number"
            inputMode="numeric"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            placeholder="Opcional"
          />
        </div>
        <div className="space-y-2">
          <Label>Activo</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={isActive ? "default" : "outline"}
              onClick={() => setIsActive(true)}
              size="sm"
            >
              Sí
            </Button>
            <Button
              type="button"
              variant={!isActive ? "default" : "outline"}
              onClick={() => setIsActive(false)}
              size="sm"
            >
              No
            </Button>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
