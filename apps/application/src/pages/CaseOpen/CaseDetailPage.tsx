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
  Settings,
  Calendar,
  Link2,
  CheckSquare,
  Plus,
  Upload,
  CalendarPlus,
  UserPlus,
  Check,
  Clock,
  Circle,
  RefreshCw,
  MapPin,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";

import { useMemo, useState } from "react";
import CaseStatusSelector from "@/components/Cases/CaseStatusSelector";
import { IntervinientesPanel } from "@/components/Cases/IntervinientesPanel";
import { CaseVinculadosPanel } from "@/components/Cases/CaseVinculadosPanel";
import { toast } from "sonner";
import { parseSummaryContent } from "@/components/Cases/CaseSummary/helpers";
import {
  PjnMovementsCard,
  PjnSyncStatus,
  PjnIntervinientesSummary,
  PjnVinculadosSummary,
} from "@/components/Cases/PjnHistory";

export default function CaseDetailPage() {
  const { currentCase } = useCase();
  const [isIntervinientesDialogOpen, setIsIntervinientesDialogOpen] = useState(false);
  const [isVinculadosDialogOpen, setIsVinculadosDialogOpen] = useState(false);
  const navigate = useNavigate();
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  // Queries para datos
  const documents = useQuery(
    api.functions.documents.getDocuments,
    currentCase ? { caseId: currentCase._id } : "skip",
  );
  const escritos = useQuery(
    api.functions.documents.getEscritos,
    currentCase
      ? {
          caseId: currentCase._id,
          paginationOpts: { numItems: 100, cursor: null },
        }
      : "skip",
  );
  const clients = useQuery(
    api.functions.cases.getClientsForCase,
    currentCase ? { caseId: currentCase._id } : "skip",
  );
  const caseRules = useQuery(
    api.functions.agentRules.getCaseRules as any,
    currentCase ? { caseId: currentCase._id, activeOnly: false } : "skip",
  );
  const caseEvents = useQuery(
    api.functions.events.getCaseEvents,
    currentCase ? { caseId: currentCase._id } : "skip",
  );
  const vinculados = useQuery(
    api.pjn.vinculados.listForCase,
    currentCase ? { caseId: currentCase._id } : "skip",
  );

  // Query para tareas del caso
  const todoLists = useQuery(
    api.functions.todos.listTodoListsByCase,
    currentCase ? { caseId: currentCase._id } : "skip",
  );
  const primaryTodoList = todoLists?.[0];
  const tasks = useQuery(
    api.functions.todos.listTodoItemsByList,
    primaryTodoList ? { listId: primaryTodoList._id } : "skip",
  );

  // Action para generar resumen
  const generateSummary = useAction(
    api.functions.caseSummary.generateCaseSummary,
  );

  // Calcular próximo evento
  const upcomingEvent = useMemo(() => {
    if (!caseEvents || caseEvents.length === 0) return null;
    const now = Date.now();
    const futureEvents = caseEvents
      .filter((e) => e.startDate >= now && e.status === "programado")
      .sort((a, b) => a.startDate - b.startDate);
    return futureEvents[0] || null;
  }, [caseEvents]);

  // Calcular tareas pendientes
  const pendingTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks
      .filter((t) => t.status === "pending" || t.status === "in_progress")
      .sort((a, b) => {
        if (a.status === "in_progress" && b.status !== "in_progress") return -1;
        if (a.status !== "in_progress" && b.status === "in_progress") return 1;
        return a.order - b.order;
      })
      .slice(0, 4);
  }, [tasks]);

  // Parsear resumen
  const parsedSummary = useMemo(() => {
    if (!currentCase?.caseSummary) return null;
    return parseSummaryContent(currentCase.caseSummary);
  }, [currentCase?.caseSummary]);

  // Query para actuaciones del PJN (línea de tiempo)
  const actuaciones = useQuery(
    api.functions.pjnHistory.getCaseActuaciones,
    currentCase ? { caseId: currentCase._id } : "skip",
  );

  // Query para actuaciones del PJN (línea de tiempo)
  const actuaciones = useQuery(
    api.functions.pjnHistory.getCaseActuaciones,
    currentCase ? { caseId: currentCase._id } : "skip",
  );

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatEventDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return {
      day: date.getDate().toString().padStart(2, "0"),
      month: date.toLocaleDateString("es-ES", { month: "short" }).toUpperCase(),
    };
  };

  const formatEventTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getDaysUntil = (timestamp: number) => {
    const now = Date.now();
    const diff = timestamp - now;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Hoy";
    if (days === 1) return "Mañana";
    return `Faltan ${days} días`;
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, { className: string; label: string }> = {
      high: { className: "bg-red-100 text-red-700", label: "Alta" },
      medium: { className: "bg-yellow-100 text-yellow-700", label: "Media" },
      low: { className: "bg-green-100 text-green-700", label: "Baja" },
    };
    return variants[priority] || { className: "", label: priority };
  };

  const handleGenerateSummary = async () => {
    if (!currentCase) return;
    setIsGeneratingSummary(true);
    try {
      const result = await generateSummary({ caseId: currentCase._id });
      if (result.success) {
        toast.success("Resumen generado exitosamente");
      } else {
        toast.error(result.message || "Error al generar resumen");
      }
    } catch (error) {
      console.error("Error generating summary:", error);
      toast.error("Error al generar resumen");
    } finally {
      setIsGeneratingSummary(false);
    }
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

  const priorityBadge = getPriorityBadge(currentCase.priority);

  // Accesos directos config
  const quickAccessItems = [
    {
      icon: FolderOpen,
      label: "Documentos",
      count: documents?.length || 0,
      href: `/caso/${currentCase._id}/documentos`,
    },
    {
      icon: FileText,
      label: "Escritos",
      count: escritos?.page?.length || 0,
      href: `/caso/${currentCase._id}/escritos`,
    },
    {
      icon: Calendar,
      label: "Eventos",
      count: caseEvents?.length || 0,
      href: `/caso/${currentCase._id}/eventos`,
    },
    {
      icon: CheckSquare,
      label: "Tareas",
      count: tasks?.length || 0,
      href: `/caso/${currentCase._id}/tareas`,
    },
    {
      icon: Users,
      label: "Clientes",
      count: clients?.length || 0,
      href: `/caso/${currentCase._id}/clientes`,
    },
    {
      icon: Settings,
      label: "Reglas",
      count: caseRules?.length || 0,
      href: `/caso/${currentCase._id}/configuracion/reglas`,
    },
  ];

  return (
    <CaseLayout>
      <div className="max-w-7xl px-5 mx-auto bg-white space-y-8 pb-16">
        {/* Header del caso */}
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
            <CaseStatusSelector
              caseId={currentCase._id}
              currentStatus={currentCase.status}
            />
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

        {/* Barra de navegación rápida */}
        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border">
          <Button
            variant="ghost"
            size="sm"
            className="text-sm font-normal text-gray-700 hover:text-tertiary"
            onClick={() => navigate(`/caso/${currentCase._id}/escritos/nuevo`)}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Nuevo Escrito
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-sm font-normal text-gray-700 hover:text-tertiary"
            onClick={() => navigate(`/caso/${currentCase._id}/documentos`)}
          >
            <Upload className="h-4 w-4 mr-1.5" />
            Subir Documento
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-sm font-normal text-gray-700 hover:text-tertiary"
            onClick={() => navigate(`/caso/${currentCase._id}/eventos`)}
          >
            <CalendarPlus className="h-4 w-4 mr-1.5" />
            Crear Evento
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-sm font-normal text-gray-700 hover:text-tertiary"
            onClick={() => navigate(`/caso/${currentCase._id}/clientes`)}
          >
            <UserPlus className="h-4 w-4 mr-1.5" />
            Agregar Cliente
          </Button>
        </div>

        {/* PJN History Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <PjnMovementsCard caseId={currentCase._id} />
          </div>
          <div className="space-y-6">
            <PjnSyncStatus 
              caseId={currentCase._id} 
              fre={currentCase.fre} 
              lastSyncAt={currentCase.lastPjnHistorySyncAt}
            />
            <PjnIntervinientesSummary 
              caseId={currentCase._id} 
              onViewDetail={() => setIsIntervinientesDialogOpen(true)}
            />
            <PjnVinculadosSummary 
              caseId={currentCase._id} 
              onViewDetail={() => setIsVinculadosDialogOpen(true)}
            />
          </div>
        </div>

        {/* Información del Caso */}
        <div className="space-y-6" data-tutorial="case-info">
          <h2 className="text-lg font-medium text-gray-900">
            Información del Caso
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-6">
            <div className="space-y-1">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Creado
              </div>

              {parsedSummary ? (
                // Formato estructurado (JSON)
                <div className="space-y-4">
                  {/* Mostrar estado actual del caso */}
                  {parsedSummary.currentStatus?.summary && (
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {parsedSummary.currentStatus.summary}
                    </p>
                  )}

                  {/* Mostrar acciones relevantes */}
                  {parsedSummary.relevantActions.length > 0 && (
                    <div className="space-y-2">
                      {parsedSummary.relevantActions
                        .slice(0, 3)
                        .map((action, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-2 text-sm"
                          >
                            {action.status === "completed" ? (
                              <Check className="h-4 w-4 text-tertiary mt-0.5 shrink-0" />
                            ) : action.status === "in_progress" ? (
                              <Clock className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                            ) : (
                              <Circle className="h-4 w-4 text-gray-300 mt-0.5 shrink-0" />
                            )}
                            <span
                              className={
                                action.status === "completed"
                                  ? "text-tertiary"
                                  : "text-gray-600"
                              }
                            >
                              {action.action}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Mostrar próximos pasos */}
                  {parsedSummary.nextSteps.length > 0 && (
                    <div className="pt-2 border-t border-sky-200/50 space-y-2">
                      <p className="text-xs font-medium text-tertiary/70">
                        Próximos pasos:
                      </p>
                      {parsedSummary.nextSteps.slice(0, 2).map((step, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <Circle className="h-3 w-3 text-tertiary/50 mt-1 shrink-0" />
                          <span className="text-gray-600">{step.step}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : currentCase.caseSummary ? (
                // Formato legacy (texto plano)
                <div className="text-sm text-gray-700 leading-relaxed line-clamp-6">
                  {(() => {
                    // Extraer contenido de tags <summary> si existen
                    const match = currentCase.caseSummary.match(
                      /<summary>([\s\S]*)<\/summary>/,
                    );
                    const content =
                      match && match[1]
                        ? match[1].trim()
                        : currentCase.caseSummary;
                    // Limpiar markdown headers y bullets para mostrar texto plano
                    return (
                      content
                        .replace(/^## .+$/gm, "")
                        .replace(/^• /gm, "- ")
                        .replace(/^\d+\. /gm, "")
                        .trim()
                        .slice(0, 300) + (content.length > 300 ? "..." : "")
                    );
                  })()}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  Genera un resumen para ver el estado del caso
                </p>
              )}

              <button
                onClick={handleGenerateSummary}
                disabled={isGeneratingSummary}
                className="flex items-center gap-2 mt-4 text-sm text-tertiary hover:text-tertiary/80 transition-colors disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isGeneratingSummary ? "animate-spin" : ""}`}
                />
                {isGeneratingSummary ? "Generando..." : "Regenerar resumen"}
              </button>
            </div>

            {/* Accesos directos */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-700">
                Accesos directos
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {quickAccessItems.map((item) => (
                  <Link
                    key={item.label}
                    to={item.href}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-tertiary/30 hover:bg-gray-50 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-sky-50 flex items-center justify-center group-hover:bg-sky-100 transition-colors">
                      <item.icon className="h-5 w-5 text-tertiary" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {item.label}
                      </div>
                      <div className="text-xs text-gray-500">{item.count}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Información del Caso */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700">
                Información del Caso
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-500">Creado</span>
                  <span className="text-sm text-gray-900">
                    {formatDate(currentCase._creationTime)}
                  </span>
                </div>
                {currentCase.startDate && (
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-500">Inicio</span>
                    <span className="text-sm text-gray-900">
                      {formatDate(currentCase.startDate)}
                    </span>
                  </div>
                )}
                {currentCase.endDate && (
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-500">Fin</span>
                    <span className="text-sm text-gray-900">
                      {formatDate(currentCase.endDate)}
                    </span>
                  </div>
                )}
                {currentCase.estimatedHours && (
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-500">
                      Horas Estimadas
                    </span>
                    <span className="text-sm text-gray-900">
                      {currentCase.estimatedHours}h
                    </span>
                  </div>
                )}
              </div>

              {currentCase.tags && currentCase.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {currentCase.tags.map((tag: string, index: number) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="font-normal text-xs"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Columna derecha - más ancha */}
          <div className="lg:col-span-7 space-y-6">
            {/* PJN Sync Status */}{" "}
            <PjnVinculadosSummary
              caseId={currentCase._id}
              onViewDetail={() => setIsVinculadosDialogOpen(true)}
            />
            <PjnSyncStatus
              caseId={currentCase._id}
              fre={currentCase.fre}
              lastSyncAt={currentCase.lastPjnHistorySyncAt}
            />
            {/* Intervinientes (PJN) */}
            <PjnIntervinientesSummary
              caseId={currentCase._id}
              onViewDetail={() => setIsIntervinientesDialogOpen(true)}
            />
            {/* Próximo evento destacado */}
            {upcomingEvent && (
              <Link
                to={`/caso/${currentCase._id}/eventos`}
                className="block rounded-lg border border-gray-100 hover:border-tertiary/30 p-5 transition-colors group"
              >
                <div className="flex items-start gap-5">
                  <div className="text-center">
                    <div className="text-3xl font-light text-gray-900">
                      {formatEventDate(upcomingEvent.startDate).day}
                    </div>
                    <div className="text-sm font-medium text-gray-500">
                      {formatEventDate(upcomingEvent.startDate).month}
                    </div>
                  </div>
                  <div className="h-full w-px bg-tertiary/30" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 group-hover:text-tertiary transition-colors">
                      {upcomingEvent.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{formatEventTime(upcomingEvent.startDate)}</span>
                      {upcomingEvent.location && (
                        <>
                          <span>-</span>
                          <MapPin className="h-3.5 w-3.5" />
                          <span>{upcomingEvent.location}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {getDaysUntil(upcomingEvent.startDate)}
                  </Badge>
                </div>
              </Link>
            )}
            {/* Próximas tareas */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-tertiary">
                  Próximas tareas
                </h3>
                <Link
                  to={`/caso/${currentCase._id}/tareas`}
                  className="text-xs text-gray-500 hover:text-tertiary flex items-center gap-1"
                >
                  Ver todas
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {pendingTasks.length > 0 ? (
                  pendingTasks.map((task) => (
                    <Link
                      key={task._id}
                      to={`/caso/${currentCase._id}/tareas`}
                      className="flex items-center gap-3 py-3 px-1 hover:bg-gray-50 rounded transition-colors group"
                    >
                      {task.status === "in_progress" ? (
                        <Clock className="h-4 w-4 text-blue-500 shrink-0" />
                      ) : (
                        <Circle className="h-4 w-4 text-gray-300 shrink-0" />
                      )}
                      <span className="text-sm text-gray-700 group-hover:text-gray-900 flex-1">
                        {task.title}
                      </span>
                      {tasks && (
                        <span className="text-xs text-gray-400">
                          {pendingTasks.indexOf(task) + 1} de{" "}
                          {
                            tasks.filter(
                              (t) =>
                                t.status === "pending" ||
                                t.status === "in_progress",
                            ).length
                          }
                        </span>
                      )}
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 py-4">
                    No hay tareas pendientes
                  </p>
                )}
              </div>
            </div>
            {/* Línea de Tiempo - Movimientos PJN */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-tertiary">
                  Línea de Tiempo
                </h3>
                {actuaciones && actuaciones.length > 5 && (
                  <span className="text-xs text-gray-500">
                    Últimos 5 de {actuaciones.length}
                  </span>
                )}
              </div>

              {actuaciones && actuaciones.length > 0 ? (
                <div className="space-y-1">
                  {actuaciones.slice(0, 5).map((mov, index) => (
                    <div key={mov._id} className="flex items-start gap-4">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            index === 0
                              ? "bg-sky-100"
                              : index === 1
                                ? "bg-sky-50"
                                : "bg-gray-50"
                          }`}
                        >
                          <Calendar
                            className={`h-4 w-4 ${
                              index === 0
                                ? "text-tertiary"
                                : index === 1
                                  ? "text-tertiary/70"
                                  : "text-gray-400"
                            }`}
                          />
                        </div>
                        {index < Math.min(actuaciones.length, 5) - 1 && (
                          <div className="w-px h-8 bg-gray-200 my-1" />
                        )}
                      </div>
                      <div className="flex-1 pt-2">
                        <p className="text-sm font-medium text-gray-900 line-clamp-2">
                          {mov.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-gray-500">
                            {formatDate(mov.movementDate)}
                          </p>
                          {mov.hasDocument && (
                            <Badge
                              variant="outline"
                              className="text-xs bg-blue-50 text-blue-600 border-blue-200"
                            >
                              Documento
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <Calendar className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No hay movimientos registrados</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Sincroniza el caso para obtener el historial del PJN
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dialog de Intervinientes */}
      <Dialog
        open={isIntervinientesDialogOpen}
        onOpenChange={setIsIntervinientesDialogOpen}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Users className="h-5 w-5 text-tertiary" />
              Intervinientes (PJN)
            </DialogTitle>
            <DialogDescription>
              Gestiona la vinculación de intervinientes del PJN con clientes en
              iAlex.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {currentCase && <IntervinientesPanel caseId={currentCase._id} />}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Vinculados */}
      <Dialog
        open={isVinculadosDialogOpen}
        onOpenChange={setIsVinculadosDialogOpen}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Link2 className="h-5 w-5 text-tertiary" />
              Expedientes Vinculados
            </DialogTitle>
            <DialogDescription>
              Expedientes relacionados reportados por el PJN.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {currentCase && (
              <CaseVinculadosPanel
                caseId={currentCase._id}
                vinculados={vinculados}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </CaseLayout>
  );
}
