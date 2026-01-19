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
              <h2 className="text-sm font-semibold text-gray-900">
                Casos vinculados en iAlex
              </h2>
              <p className="text-xs text-muted-foreground">
                Expedientes que ya tienen un caso asociado en iAlex.
              </p>
            </div>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100">
              {linked.length}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {linked.map((v) => (
              <div
                key={v._id}
                className="flex flex-col p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-emerald-100 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Expediente
                    </span>
                    <span className="font-mono text-sm font-semibold text-gray-700">
                      {formatExpediente(v.vinculadoMeta)}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 rounded-full hover:bg-emerald-50 hover:text-emerald-600"
                    onClick={() => handleOpenCase(v.linkedCase!.caseId)}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-2 mb-4 flex-1">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Carátula PJN
                    </span>
                    <p className="text-sm text-gray-900 font-medium line-clamp-2">
                      {v.vinculadoMeta.caratula || "Sin carátula"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Tribunal
                    </span>
                    <p className="text-xs text-gray-600 truncate">
                      {v.vinculadoMeta.court || "-"}
                    </p>
                  </div>
                </div>

                <div className="mt-auto pt-3 border-t border-gray-50 bg-emerald-50/30 -mx-4 -mb-4 p-4 rounded-b-xl">
                  {v.linkedCase ? (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {v.linkedCase.title}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-gray-500">
                            {v.linkedCase.fre && (
                              <span className="font-mono">FRE: {v.linkedCase.fre}</span>
                            )}
                            <span className="capitalize px-1.5 py-0.5 rounded-full bg-white border border-gray-100">
                              {v.linkedCase.status}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="bg-white hover:bg-white/80 text-xs h-7 shadow-sm border-gray-100"
                        onClick={() => handleOpenCase(v.linkedCase!.caseId)}
                      >
                        Abrir
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      El caso vinculado ya no existe en iAlex.
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {pending.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Pendientes de crear en iAlex
              </h2>
              <p className="text-xs text-muted-foreground">
                Expedientes vinculados por PJN sin caso en iAlex.
              </p>
            </div>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100">
              {pending.length}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pending.map((v) => (
              <div
                key={v._id}
                className="flex flex-col p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-blue-100 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Expediente
                    </span>
                    <span className="font-mono text-sm font-semibold text-gray-700">
                      {formatExpediente(v.vinculadoMeta)}
                    </span>
                  </div>
                  {v.vinculadoMeta.relationshipType ? (
                    <Badge variant="secondary" className="text-[10px] py-0 px-2 font-medium bg-blue-50 text-blue-700 border-blue-100">
                      {v.vinculadoMeta.relationshipType}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] py-0 px-2 font-medium text-gray-400 border-gray-100">
                      Sin relación
                    </Badge>
                  )}
                </div>

                <div className="space-y-2 mb-4 flex-1">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Carátula PJN
                    </span>
                    <p className="text-sm text-gray-900 font-medium line-clamp-2">
                      {v.vinculadoMeta.caratula || "Sin carátula"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Tribunal
                    </span>
                    <p className="text-xs text-gray-600 truncate">
                      {v.vinculadoMeta.court || "-"}
                    </p>
                  </div>
                </div>

                <div className="mt-auto pt-3 border-t border-gray-50 flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 gap-1.5 h-9 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                    onClick={() => handleCreateCase(v._id)}
                    disabled={creatingId === v._id}
                  >
                    <PlusCircle className="h-4 w-4" />
                    {creatingId === v._id ? "Creando..." : "Crear caso"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-9 border-gray-200 hover:bg-gray-50 text-gray-600"
                    onClick={() => handleIgnore(v._id)}
                    disabled={ignoringId === v._id}
                  >
                    <Slash className="h-4 w-4" />
                    {ignoringId === v._id ? "..." : "Ignorar"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
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

