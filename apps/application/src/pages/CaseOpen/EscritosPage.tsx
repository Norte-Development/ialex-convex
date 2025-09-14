"use client";

import CaseLayout from "@/components/Cases/CaseLayout";
import { Tiptap } from "@/components/Editor/tiptap-editor";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { useCase } from "@/context/CaseContext";
import { useEscrito } from "@/context/EscritoContext";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Calendar, Building, Hash, ArrowRight } from "lucide-react";
import { usePermissions } from "@/context/CasePermissionsContext";
import { useEffect, useState } from "react";
import { EscritoToolsTester } from "@/components/Editor/EscritoToolsTester";
import { CreateEscritoDialog } from "@/components/CreateEscritoDialog";

export default function EscritoPage() {
  const { escritoId } = useParams();
  const navigate = useNavigate();
  const { currentCase } = useCase();
  const { setEscritoId } = useEscrito();
  const [showToolsTester, setShowToolsTester] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Permisos usando el nuevo sistema
  const { can } = usePermissions();

  useEffect(() => {
    console.log("Setting escritoId in context:", escritoId);
    setEscritoId(escritoId || undefined);
  }, [escritoId, setEscritoId]);

  const isValidEscritoId =
    escritoId && escritoId !== "undefined" && escritoId.length > 0;

  // Always call both hooks, but conditionally pass parameters
  const all_escritos = useQuery(
    api.functions.documents.getEscritos,
    !isValidEscritoId && currentCase?._id
      ? { caseId: currentCase._id as Id<"cases"> }
      : "skip",
  );

  const escrito = useQuery(
    api.functions.documents.getEscrito,
    isValidEscritoId ? { escritoId: escritoId as Id<"escritos"> } : "skip",
  );

  // If we have a valid escritoId but the escrito is null, redirect back to the list
  useEffect(() => {
    if (isValidEscritoId && escrito === null) {
      console.log("Escrito not found, redirecting to list");
      navigate(`/caso/${currentCase?._id}/escritos`);
    }
  }, [escrito, isValidEscritoId, navigate, currentCase?._id]);

  // Show loading state while fetching a specific escrito
  if (isValidEscritoId && escrito === undefined) {
    return (
      <CaseLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Cargando escrito...</p>
          </div>
        </div>
      </CaseLayout>
    );
  }

  if (!isValidEscritoId) {
    return (
      <CaseLayout>
        <div className="space-y-6 p-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">
              Escritos del Caso
            </h1>
            <p className="text-gray-600 text-lg">
              Selecciona un escrito para editar o revisar
            </p>
          </div>

          {/* Loading State */}
          {all_escritos === undefined && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-200 rounded w-full"></div>
                      <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Empty State */}
          {all_escritos && all_escritos.length === 0 && (
            <Card className="max-w-md mx-auto">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-16 w-16 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No hay escritos disponibles
                </h3>
                <p className="text-gray-500 text-center mb-4">
                  Aún no se han creado escritos para este caso.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(true)}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Crear primer escrito
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Escritos Grid */}
          {can.escritos.read ? (
            all_escritos &&
            all_escritos.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {all_escritos.map((escrito) => (
                  <Card
                    key={escrito._id}
                    className="hover:shadow-lg transition-all duration-200 cursor-pointer group"
                    onClick={() =>
                      navigate(
                        `/caso/${currentCase?._id}/escritos/${escrito._id}`,
                      )
                    }
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg group-hover:text-blue-600 transition-colors">
                            {escrito.title}
                          </CardTitle>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {escrito.status === "borrador"
                                ? "Borrador"
                                : "Terminado"}
                            </Badge>
                          </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {escrito.presentationDate && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="h-4 w-4" />
                          <span>Presentación: {escrito.presentationDate}</span>
                        </div>
                      )}
                      {escrito.courtName && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Building className="h-4 w-4" />
                          <span>{escrito.courtName}</span>
                        </div>
                      )}
                      {escrito.expedientNumber && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Hash className="h-4 w-4" />
                          <span>Exp. {escrito.expedientNumber}</span>
                        </div>
                      )}
                      <div className="pt-2">
                        <Button
                          className="w-full group-hover:bg-blue-50 group-hover:border-blue-200 transition-colors"
                          disabled={!can.escritos.read}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Abrir escrito
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">
                No tienes permisos para ver los escritos de este caso.
              </p>
            </div>
          )}
        </div>
      </CaseLayout>
    );
  }

  // Render the specific escrito editor

  return (
    <CaseLayout>
      {/* Document Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="w-full flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">
              {escrito?.title || "Untitled Document"}
            </h1>
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              {escrito?.presentationDate && (
                <div className="flex items-center gap-2">
                  <span className="font-medium">Fecha de presentación:</span>
                  <span>{escrito.presentationDate}</span>
                </div>
              )}
              {escrito?.courtName && (
                <div className="flex items-center gap-2">
                  <span className="font-medium">Tribunal:</span>
                  <span>{escrito.courtName}</span>
                </div>
              )}
              {escrito?.expedientNumber && (
                <div className="flex items-center gap-2">
                  <span className="font-medium">Expediente:</span>
                  <span>{escrito.expedientNumber}</span>
                </div>
              )}
            </div>
          </div>

          {/* Tools Tester Toggle - Only show if user can write */}
          {can.escritos.write && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowToolsTester(!showToolsTester)}
              className="flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              {showToolsTester ? "Hide" : "Show"} Tools Tester
            </Button>
          )}
        </div>
      </div>

      {/* Editor Container */}
      <div className="flex-1 p-6">
        <div className="flex gap-6 h-full">
          {/* Main Editor */}
          <div className="flex-1">
            <Tiptap
              documentId={escrito?.prosemirrorId}
              readOnly={!can.escritos.write}
            />
          </div>

          {/* Tools Tester Sidebar - Only show if user can write and it's enabled */}
          {showToolsTester && can.escritos.write && (
            <div className="w-80 flex-shrink-0">
              <EscritoToolsTester />
            </div>
          )}
        </div>
      </div>

      <CreateEscritoDialog
        open={isCreateDialogOpen}
        setOpen={setIsCreateDialogOpen}
      />
    </CaseLayout>
  );
}
