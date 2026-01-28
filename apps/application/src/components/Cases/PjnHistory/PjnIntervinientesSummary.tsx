import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Id } from "@/../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Users, AlertCircle, CheckCircle2, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

interface PjnIntervinientesSummaryProps {
  caseId: Id<"cases">;
  onViewDetail: () => void;
}

export function PjnIntervinientesSummary({ caseId, onViewDetail }: PjnIntervinientesSummaryProps) {
  const data = useQuery(api.intervinientes.queries.getIntervinientesForCase, { caseId });

  if (data === undefined) {
    return (
      <div className="p-5 bg-white rounded-xl border border-gray-100 shadow-sm space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const { summary, participants } = data;
  const pendingConfirmation = summary.suggested;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      <div className="p-4 flex items-center justify-between border-b border-gray-50 bg-white">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-orange-50 rounded-lg">
            <Users className="h-4 w-4 text-orange-600" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Intervinientes (PJN)</h3>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 space-y-1">
            <p className="text-2xl font-light text-gray-900 leading-none">
              {summary.total}
            </p>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">
              Total importados
            </p>
          </div>
          
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 rounded-md border border-green-100">
              <CheckCircle2 className="h-3 w-3 text-green-600" />
              <span className="text-xs font-medium text-green-700">{summary.linked} vinculados</span>
            </div>
            
            {pendingConfirmation > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 rounded-md border border-amber-100">
                <AlertCircle className="h-3 w-3 text-amber-600" />
                <span className="text-xs font-medium text-amber-700">{pendingConfirmation} por confirmar</span>
              </div>
            )}
          </div>
        </div>

        {participants.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {participants.slice(0, 3).map((p) => (
              <Badge 
                key={p._id} 
                variant="outline" 
                className="text-[10px] font-medium bg-gray-50/50 text-gray-600 border-gray-200"
              >
                {p.name.split(',')[0]}
              </Badge>
            ))}
            {participants.length > 3 && (
              <span className="text-[10px] text-gray-400 font-medium self-center">
                +{participants.length - 3} más
              </span>
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
          {pendingConfirmation > 0 ? "Revisar intervinientes" : "Ver todos"}
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
