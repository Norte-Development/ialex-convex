import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Id } from "@/../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Link2, ChevronRight, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface PjnVinculadosSummaryProps {
  caseId: Id<"cases">;
  onViewDetail: () => void;
}

export function PjnVinculadosSummary({ caseId, onViewDetail }: PjnVinculadosSummaryProps) {
  const vinculados = useQuery(api.pjn.vinculados.listForCase, { caseId });

  if (vinculados === undefined) {
    return (
      <div className="p-5 bg-white rounded-xl border border-gray-100 shadow-sm space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const linked = vinculados.filter((v) => v.status === "linked" && v.linkedCase && v.linkedCase.caseId !== caseId);
  const pending = vinculados.filter((v) => v.status === "pending");

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      <div className="p-4 flex items-center justify-between border-b border-gray-50 bg-white">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-purple-50 rounded-lg">
            <Link2 className="h-4 w-4 text-purple-600" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Expedientes Vinculados</h3>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {linked.length === 0 && pending.length === 0 ? (
          <div className="py-2">
            <p className="text-xs text-gray-500 italic flex items-center gap-2">
              <Info className="h-3 w-3" />
              No se detectaron expedientes vinculados.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {linked.length > 0 && (
              <div className="space-y-1.5">
                {linked.slice(0, 2).map((v) => (
                  <Link
                    key={v._id}
                    to={`/caso/${v.linkedCase?.caseId}`}
                    className="flex items-center justify-between group p-1.5 hover:bg-gray-50 rounded-md transition-colors border border-transparent hover:border-gray-100"
                  >
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-gray-900 truncate max-w-[150px]">
                        {v.linkedCase?.title}
                      </span>
                      <span className="text-[10px] font-mono text-gray-400">
                        {v.vinculadoMeta.rawExpediente || v.vinculadoMeta.expedienteKey}
                      </span>
                    </div>
                    <ChevronRight className="h-3 w-3 text-gray-300 group-hover:text-gray-500" />
                  </Link>
                ))}
              </div>
            )}
            
            {pending.length > 0 && (
              <div className="p-2 bg-purple-50/50 rounded-lg border border-purple-100/50">
                <p className="text-[10px] font-medium text-purple-700 flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                  </span>
                  {pending.length} posible{pending.length > 1 ? "s" : ""} vínculo{pending.length > 1 ? "s" : ""} por revisar
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-4 py-2.5 bg-gray-50/50 border-t border-gray-50 mt-auto">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between h-7 px-2 text-xs font-medium text-gray-500 hover:text-gray-900"
          onClick={onViewDetail}
        >
          {pending.length > 0 ? "Revisar posibles vínculos" : "Ver todos"}
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
