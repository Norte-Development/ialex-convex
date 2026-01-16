import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  ExternalLink,
  Link2,
  PlusCircle,
  Slash,
} from "lucide-react";

type VinculadoStatus = "pending" | "linked" | "ignored";

type VinculadoMeta = {
  expedienteKey: string;
  rawExpediente: string;
  rawNumber: string;
  courtCode: string;
  fuero: string;
  year: number;
  relationshipType?: string;
  caratula?: string;
  court?: string;
};

type LinkedCaseSummary = {
  caseId: Id<"cases">;
  title: string;
  status: string;
  fre?: string;
};

export type EnrichedVinculado = {
  _id: Id<"pjnVinculados">;
  caseId: Id<"cases">;
  vinculadoKey: string;
  vinculadoMeta: VinculadoMeta;
  status: VinculadoStatus;
  source: "pjn" | "manual";
  linkedCaseId?: Id<"cases">;
  linkedCase: LinkedCaseSummary | null;
};

interface CaseVinculadosPanelProps {
  caseId: Id<"cases">;
  vinculados: EnrichedVinculado[] | undefined;
}

export function CaseVinculadosPanel({
  caseId,
  vinculados,
}: CaseVinculadosPanelProps) {
  const navigate = useNavigate();

  const [creatingId, setCreatingId] = useState<Id<"pjnVinculados"> | null>(
    null,
  );
  const [ignoringId, setIgnoringId] = useState<Id<"pjnVinculados"> | null>(
    null,
  );

  const createCaseFromVinculado = useMutation(
    api.pjn.vinculados.createCaseFromVinculado,
  );
  const ignoreVinculado = useMutation(api.pjn.vinculados.ignoreVinculado);

  if (!caseId) {
    return null;
  }

  if (vinculados === undefined) {
    return <PanelSkeleton />;
  }

  if (vinculados.length === 0) {
    return (
      <EmptyState
        title="No hay expedientes vinculados desde el PJN"
        description="Cuando el PJN reporte expedientes vinculados a este caso, los vas a ver acá."
      />
    );
  }

  const linked = vinculados.filter(
    (v) =>
      v.status === "linked" &&
      v.linkedCase &&
      // If the "linked" case is actually the current case, don't show it.
      v.linkedCase.caseId !== caseId,
  );
  const pending = vinculados.filter((v) => v.status === "pending");

  const formatExpediente = (meta: VinculadoMeta) => {
    if (meta.rawExpediente) return meta.rawExpediente;
    if (meta.rawNumber) return meta.rawNumber;
    return meta.expedienteKey;
  };

  const handleOpenCase = (targetCaseId: Id<"cases">) => {
    navigate(`/caso/${targetCaseId}`);
  };

  const handleCreateCase = async (vinculadoId: Id<"pjnVinculados">) => {
    try {
      setCreatingId(vinculadoId);
      const result = await createCaseFromVinculado({ vinculadoId });
      toast.success("Se creó un nuevo caso en iAlex desde este vinculado.");
      navigate(`/caso/${result.caseId}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error al crear el caso";
      toast.error(message);
    } finally {
      setCreatingId(null);
    }
  };

  const handleIgnore = async (vinculadoId: Id<"pjnVinculados">) => {
    try {
      setIgnoringId(vinculadoId);
      await ignoreVinculado({ vinculadoId });
      toast.success("Vinculado ignorado para este caso.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error al ignorar el vinculado";
      toast.error(message);
    } finally {
      setIgnoringId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p>
          Estos expedientes están vinculados según el PJN. Podés abrir los que
          ya existen en iAlex o crear nuevos casos para los que todavía no están
          en tu base.
        </p>
      </div>

      {linked.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-gray-900">
                Casos vinculados en iAlex
              </h2>
              <p className="text-xs text-muted-foreground">
                Expedientes que ya tienen un caso asociado en iAlex.
              </p>
            </div>
            <Badge variant="outline">{linked.length}</Badge>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Expediente</TableHead>
                <TableHead>Carátula PJN</TableHead>
                <TableHead>Tribunal</TableHead>
                <TableHead>Caso en iAlex</TableHead>
                <TableHead className="w-[120px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linked.map((v) => (
                <TableRow key={v._id}>
                  <TableCell className="font-mono text-xs font-medium">
                    {formatExpediente(v.vinculadoMeta)}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm">
                    {v.vinculadoMeta.caratula || "Sin carátula"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {v.vinculadoMeta.court || "-"}
                  </TableCell>
                  <TableCell>
                    {v.linkedCase ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          <span className="text-sm font-medium">
                            {v.linkedCase.title}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {v.linkedCase.fre && (
                            <span className="font-mono">
                              FRE: {v.linkedCase.fre}
                            </span>
                          )}
                          <Badge variant="outline">{v.linkedCase.status}</Badge>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        El caso vinculado ya no existe en iAlex.
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {v.linkedCase && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => handleOpenCase(v.linkedCase!.caseId)}
                      >
                        <ExternalLink className="h-3 w-3" />
                        Abrir
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      {pending.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-gray-900">
                Pendientes de crear en iAlex
              </h2>
              <p className="text-xs text-muted-foreground">
                Expedientes que el PJN marca como vinculados pero todavía no
                tienen un caso en iAlex.
              </p>
            </div>
            <Badge variant="outline">{pending.length}</Badge>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Expediente</TableHead>
                <TableHead>Relación</TableHead>
                <TableHead>Carátula PJN</TableHead>
                <TableHead>Tribunal</TableHead>
                <TableHead className="w-[220px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.map((v) => (
                <TableRow key={v._id}>
                  <TableCell className="font-mono text-xs font-medium">
                    {formatExpediente(v.vinculadoMeta)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {v.vinculadoMeta.relationshipType ? (
                      <Badge variant="outline">
                        {v.vinculadoMeta.relationshipType}
                      </Badge>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Slash className="h-3 w-3" />
                        Sin relación especificada
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm">
                    {v.vinculadoMeta.caratula || "Sin carátula"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {v.vinculadoMeta.court || "-"}
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button
                      size="sm"
                      className="gap-1"
                      onClick={() => handleCreateCase(v._id)}
                      disabled={creatingId === v._id}
                    >
                      <PlusCircle className="h-3 w-3" />
                      {creatingId === v._id
                        ? "Creando..."
                        : "Crear caso en iAlex"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => handleIgnore(v._id)}
                      disabled={ignoringId === v._id}
                    >
                      <Slash className="h-3 w-3" />
                      {ignoringId === v._id ? "Ignorando..." : "Ignorar"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-16 w-full" />
      <div className="space-y-2">
        {[...Array(4)].map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
}

function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 px-6 py-10 text-center">
      <Link2 className="mb-3 h-8 w-8 text-muted-foreground/40" />
      <h2 className="text-sm font-medium text-gray-900">{title}</h2>
      <p className="mt-1 max-w-md text-xs text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

