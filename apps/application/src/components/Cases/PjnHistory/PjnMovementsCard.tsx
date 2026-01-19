import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Id } from "@/../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { FileText, ChevronRight, ExternalLink, Calendar, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface PjnMovementsCardProps {
  caseId: Id<"cases">;
}

export function PjnMovementsCard({ caseId }: PjnMovementsCardProps) {
  const [showAll, setShowAll] = useState(false);
  const actuaciones = useQuery(api.functions.pjnHistory.getCaseActuaciones, { caseId });

  if (actuaciones === undefined) {
    return (
      <div className="space-y-4 p-6 bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const movements = actuaciones || [];
  const displayedMovements = showAll ? movements : movements.slice(0, 5);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="p-5 border-b border-gray-50 flex items-center justify-between bg-white sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Calendar className="h-4 w-4 text-blue-600" />
          </div>
          <h3 className="font-semibold text-gray-900">Movimientos (PJN)</h3>
          <Badge variant="secondary" className="ml-1.5 bg-gray-50 text-gray-600 border-gray-100 font-medium">
            {movements.length}
          </Badge>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[600px] scrollbar-thin scrollbar-thumb-gray-200">
        {movements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
              <Info className="h-6 w-6 text-gray-300" />
            </div>
            <p className="text-sm text-gray-500">No hay movimientos sincronizados todavía.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {displayedMovements.map((act) => (
              <div 
                key={act._id} 
                className="group p-4 hover:bg-gray-50/50 transition-colors relative"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                        {formatDate(act.movementDate)}
                      </span>
                      {act.hasDocument && (
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wider py-0 px-1.5 border-green-200 text-green-700 bg-green-50/50">
                          Documento
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-900 font-medium leading-relaxed line-clamp-2">
                      {act.description}
                    </p>
                  </div>
                  
                  {act.documentId && (
                    <Link
                      to={`/caso/${caseId}/documentos/${act.documentId}`}
                      className="shrink-0 p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      title="Ver documento"
                    >
                      <FileText className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {movements.length > 5 && (
        <div className="p-3 bg-gray-50/50 border-t border-gray-50">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs font-medium text-gray-500 hover:text-gray-900 gap-1"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? "Ver menos" : `Ver los ${movements.length} movimientos`}
            <ChevronRight className={cn("h-3 w-3 transition-transform", showAll && "rotate-90")} />
          </Button>
        </div>
      )}
    </div>
  );
}
