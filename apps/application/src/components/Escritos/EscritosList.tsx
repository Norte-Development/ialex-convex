import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Calendar, Building, Hash, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import EscritosLoadingState from "./EscritosLoadingState";
import EscritosEmptyState from "./EscritosEmptyState";
import { usePermissions } from "@/context/CasePermissionsContext";
import type { Id } from "../../../convex/_generated/dataModel";

export default function EscritosList({
  all_escritos,
  caseId,
}: {
  all_escritos: any[] | undefined | null;
  caseId?: Id<"cases">;
  templateId?: Id<"modelos">;
}) {
  const { can } = usePermissions();
  const navigate = useNavigate();

  if (all_escritos === undefined) return <EscritosLoadingState />;
  if (all_escritos?.length === 0) return <EscritosEmptyState />;

  if (!can.escritos.read)
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">
          No tienes permisos para ver los escritos de este caso.
        </p>
      </div>
    );

  return (
    <div className="space-y-6 p-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Escritos del Caso</h1>
        <p className="text-gray-600 text-lg">
          Selecciona un escrito para editar o revisar
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {all_escritos?.map((escrito) => (
          <Card
            key={escrito._id}
            className="hover:shadow-lg transition-all cursor-pointer group"
            onClick={() =>
              navigate(`/caso/${caseId}/escritos/${escrito._id}`)
            }
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg group-hover:text-blue-600">
                    {escrito.title}
                  </CardTitle>
                  <Badge variant="outline" className="mt-2 text-xs">
                    {escrito.status === "borrador" ? "Borrador" : "Terminado"}
                  </Badge>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {escrito.presentationDate && (
                <div className="flex items-center text-sm text-gray-600 gap-2">
                  <Calendar className="h-4 w-4" /> {escrito.presentationDate}
                </div>
              )}
              {escrito.courtName && (
                <div className="flex items-center text-sm text-gray-600 gap-2">
                  <Building className="h-4 w-4" /> {escrito.courtName}
                </div>
              )}
              {escrito.expedientNumber && (
                <div className="flex items-center text-sm text-gray-600 gap-2">
                  <Hash className="h-4 w-4" /> Exp. {escrito.expedientNumber}
                </div>
              )}

              <Button className="w-full mt-2" disabled={!can.escritos.read}>
                <FileText className="h-4 w-4 mr-2" />
                Abrir escrito
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}