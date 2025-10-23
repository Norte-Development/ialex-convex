import { useCase } from "@/context/CaseContext";
import CaseLayout from "@/components/Cases/CaseLayout";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  FileText,
  Users,
  FolderOpen,
  FileArchive,
  ArrowRight,
  Folder,
  FileType2,
  Settings,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { useState } from "react";

export default function CaseDetailPage() {
  const { currentCase } = useCase();
  const [isDocumentsDialogOpen, setIsDocumentsDialogOpen] = useState(false);
  const [isEscritosDialogOpen, setIsEscritosDialogOpen] = useState(false);
  const navigate = useNavigate();

  // Queries para métricas
  const documents = useQuery(
    api.functions.documents.getDocuments,
    currentCase ? { caseId: currentCase._id } : "skip",
  );
  const escritos = useQuery(
    api.functions.documents.getEscritos,
    currentCase ? { caseId: currentCase._id } : "skip",
  );
  const clients = useQuery(
    api.functions.cases.getClientsForCase,
    currentCase ? { caseId: currentCase._id } : "skip",
  );

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<
      string,
      { variant: "default" | "secondary" | "outline"; label: string }
    > = {
      pendiente: { variant: "secondary", label: "Pendiente" },
      "en progreso": { variant: "default", label: "En Progreso" },
      completado: { variant: "outline", label: "Completado" },
      archivado: { variant: "outline", label: "Archivado" },
      cancelado: { variant: "outline", label: "Cancelado" },
    };
    return variants[status] || { variant: "secondary", label: status };
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, { className: string; label: string }> = {
      high: { className: "bg-red-100 text-red-700", label: "Alta" },
      medium: { className: "bg-yellow-100 text-yellow-700", label: "Media" },
      low: { className: "bg-green-100 text-green-700", label: "Baja" },
    };
    return variants[priority] || { className: "", label: priority };
  };

  if (!currentCase) {
    return (
      <CaseLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-sm text-muted-foreground">Cargando caso...</div>
        </div>
      </CaseLayout>
    );
  }

  const statusBadge = getStatusBadge(currentCase.status);
  const priorityBadge = getPriorityBadge(currentCase.priority);

  return (
    <CaseLayout>
      <div className="max-w-7xl px-5 mx-auto bg-white space-y-12 pb-16">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-3 flex-1">
              <h1 className="text-4xl font-light tracking-tight text-gray-900">
                {currentCase.title}
              </h1>
              {currentCase.description && (
                <p className="text-base text-gray-600 max-w-3xl">
                  {currentCase.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <Badge variant={statusBadge.variant} className="font-normal">
              {statusBadge.label}
            </Badge>
            <Badge variant="outline" className={priorityBadge.className}>
              {priorityBadge.label}
            </Badge>
            {currentCase.expedientNumber && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <FileArchive className="h-3.5 w-3.5" />
                <span>{currentCase.expedientNumber}</span>
              </div>
            )}
            {currentCase.category && (
              <span className="text-muted-foreground">
                {currentCase.category}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div
            onClick={() =>
              currentCase && navigate(`/caso/${currentCase._id}/documentos`)
            }
            className="space-y-2 p-6 rounded-lg border border-tertiary hover:border-tertiary/80 transition-colors cursor-pointer group min-h-[140px]"
          >
            <div className="flex items-center justify-between">
              <FolderOpen className="h-5 w-5 text-tertiary group-hover:text-tertiary/80 transition-colors" />
              <ArrowRight className="h-4 w-4 text-tertiary group-hover:text-tertiary/80 transition-colors" />
            </div>
            <div>
              <div className="text-3xl font-light text-gray-900">
                {documents?.length || 0}
              </div>
              <div className="text-sm font-medium text-gray-900">
                Documentos
              </div>
              <div className="text-xs text-gray-500">Archivos del caso</div>
            </div>
          </div>

          <div
            onClick={() =>
              currentCase && navigate(`/caso/${currentCase._id}/escritos`)
            }
            className="space-y-2 p-6 rounded-lg border border-tertiary hover:border-tertiary/80 transition-colors cursor-pointer group min-h-[140px]"
          >
            <div className="flex items-center justify-between">
              <FileText className="h-5 w-5 text-tertiary group-hover:text-tertiary/80 transition-colors" />
              <ArrowRight className="h-4 w-4 text-tertiary group-hover:text-tertiary/80 transition-colors" />
            </div>
            <div>
              <div className="text-3xl font-light text-gray-900">
                {escritos?.length || 0}
              </div>
              <div className="text-sm font-medium text-gray-900">Escritos</div>
              <div className="text-xs text-gray-500">Documentos legales</div>
            </div>
          </div>

          <Link
            to={`/caso/${currentCase._id}/clientes`}
            className="group cursor-pointer"
          >
            <div className="space-y-2 p-6 rounded-lg border border-tertiary hover:border-tertiary/80 transition-colors min-h-[140px]">
              <div className="flex items-center justify-between">
                <Users className="h-5 w-5 text-tertiary group-hover:text-tertiary/80 transition-colors" />
                <ArrowRight className="h-4 w-4 text-tertiary group-hover:text-tertiary/80 transition-colors" />
              </div>
              <div>
                <div className="text-3xl font-light text-gray-900">
                  {clients?.length || 0}
                </div>
                <div className="text-sm font-medium text-gray-900">
                  Clientes
                </div>
                <div className="text-xs text-gray-500">Partes involucradas</div>
              </div>
            </div>
          </Link>
          <Link
            to={`/caso/${currentCase._id}/configuracion/reglas`}
            className="group cursor-pointer"
          >
            <div className="space-y-2 p-6 rounded-lg border border-tertiary hover:border-tertiary/80 transition-colors min-h-[140px] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <Settings className="h-5 w-5 text-tertiary group-hover:text-tertiary/80 transition-colors" />
                <ArrowRight className="h-4 w-4 text-tertiary group-hover:text-tertiary/80 transition-colors" />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">
                  Reglas del Agente
                </div>
                <div className="text-xs text-gray-500">
                  Configura el comportamiento de iAlex
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Información del Caso */}
        <div className="space-y-6">
          <h2 className="text-lg font-medium text-gray-900">
            Información del Caso
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-6">
            <div className="space-y-1">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Creado
              </div>
              <div className="text-sm text-gray-900">
                {formatDate(currentCase._creationTime)}
              </div>
            </div>
            {currentCase.startDate && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Inicio
                </div>
                <div className="text-sm text-gray-900">
                  {formatDate(currentCase.startDate)}
                </div>
              </div>
            )}
            {currentCase.endDate && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fin
                </div>
                <div className="text-sm text-gray-900">
                  {formatDate(currentCase.endDate)}
                </div>
              </div>
            )}
            {currentCase.estimatedHours && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Horas Estimadas
                </div>
                <div className="text-sm text-gray-900">
                  {currentCase.estimatedHours}h
                </div>
              </div>
            )}
          </div>

          {currentCase.tags && currentCase.tags.length > 0 && (
            <div className="pt-4 border-t">
              <div className="flex flex-wrap gap-2">
                {currentCase.tags.map((tag: string, index: number) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="font-normal"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Acciones Rápidas */}
        <div className="space-y-6">
          <h2 className="text-lg font-medium text-gray-900">Acciones</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Link to={`/caso/${currentCase._id}/clientes`}>
              <Button className="w-full justify-between h-auto py-4 px-6 bg-tertiary text-white hover:bg-tertiary/80">
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4" />
                  <span className="font-normal">Gestionar Clientes</span>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </Button>
            </Link>
            <Link to={`/caso/${currentCase._id}/equipos`}>
              <Button className="w-full  justify-between h-auto py-4 px-6 bg-tertiary text-white hover:bg-tertiary/80">
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4" />
                  <span className="font-normal">Gestionar Equipos</span>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </Button>
            </Link>
            <Link to={`/caso/${currentCase._id}/modelos`}>
              <Button className="w-full justify-between h-auto py-4 px-6 bg-tertiary text-white hover:bg-tertiary/80">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4" />
                  <span className="font-normal">Usar Modelos</span>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </Button>
            </Link>
            <Link to={`/caso/${currentCase._id}/base-de-datos`}>
              <Button className="w-full justify-between h-auto py-4 px-6 bg-tertiary text-white hover:bg-tertiary/80">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4" />
                  <span className="font-normal">Base de Datos Legal</span>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Dialog de Documentos */}
      <Dialog
        open={isDocumentsDialogOpen}
        onOpenChange={setIsDocumentsDialogOpen}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-tertiary" />
              Documentos del Caso
            </DialogTitle>
            <DialogDescription>
              {documents && documents.length > 0
                ? "Haz clic en un documento para abrirlo"
                : "Aún no hay documentos en este caso"}
            </DialogDescription>
          </DialogHeader>

          {documents && documents.length > 0 ? (
            <div className="space-y-2">
              {documents.map((doc) => (
                <Link
                  key={doc._id}
                  to={`/caso/${currentCase._id}/documentos/${doc._id}`}
                  onClick={() => setIsDocumentsDialogOpen(false)}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <Folder className="h-4 w-4 text-tertiary group-hover:text-tertiary/80" />
                    <div className="flex-1">
                      <p className="text-sm font-medium group-hover:text-tertiary">
                        {doc.title}
                      </p>
                      {doc.description && (
                        <p className="text-xs text-gray-500">
                          {doc.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {doc.documentType || "Documento"}
                    </Badge>
                    <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-tertiary" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
              <div className="rounded-full bg-gray-100 p-4">
                <FolderOpen className="h-8 w-8 text-gray-400" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-900">
                  No hay documentos todavía
                </p>
                <p className="text-sm text-gray-500 max-w-sm">
                  Puedes agregar nuevos documentos desde el menú lateral
                  izquierdo. Haz clic en el ícono <strong>Documentos</strong> y
                  luego en el botón <strong>+</strong> para crear carpetas.
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Escritos */}
      <Dialog
        open={isEscritosDialogOpen}
        onOpenChange={setIsEscritosDialogOpen}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-tertiary" />
              Escritos del Caso
            </DialogTitle>
            <DialogDescription>
              {escritos && escritos.length > 0
                ? "Haz clic en un escrito para abrirlo"
                : "Aún no hay escritos en este caso"}
            </DialogDescription>
          </DialogHeader>

          {escritos && escritos.length > 0 ? (
            <div className="space-y-2">
              {escritos.map((escrito) => (
                <Link
                  key={escrito._id}
                  to={`/caso/${currentCase._id}/escritos/${escrito._id}`}
                  onClick={() => setIsEscritosDialogOpen(false)}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <FileType2 className="h-4 w-4 text-tertiary group-hover:text-tertiary/80" />
                    <div className="flex-1">
                      <p className="text-sm font-medium group-hover:text-tertiary">
                        {escrito.title}
                      </p>
                      <p className="text-xs text-gray-500">
                        Última edición:{" "}
                        {new Date(escrito.lastEditedAt).toLocaleDateString(
                          "es-ES",
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={`text-xs ${
                        escrito.status === "terminado"
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {escrito.status === "terminado"
                        ? "Terminado"
                        : "Borrador"}
                    </Badge>
                    <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-tertiary" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
              <div className="rounded-full bg-gray-100 p-4">
                <FileText className="h-8 w-8 text-gray-400" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-900">
                  No hay escritos todavía
                </p>
                <p className="text-sm text-gray-500 max-w-sm">
                  Puedes crear nuevos escritos desde el menú lateral izquierdo.
                  Haz clic en el ícono <strong>Escritos</strong> y luego en el
                  botón <strong>+</strong> para comenzar.
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </CaseLayout>
  );
}
