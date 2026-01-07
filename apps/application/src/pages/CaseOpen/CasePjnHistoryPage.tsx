import { useCase } from "@/context/CaseContext"
import CaseLayout from "@/components/Cases/CaseLayout"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  RefreshCw,
  Users,
  FileText,
  Scale,
  Link2,
  AlertCircle,
  CheckCircle,
  Loader2,
  ExternalLink,
} from "lucide-react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { CaseHistorySyncProgress } from "@/components/Cases/CaseHistorySyncProgress"

export default function CasePjnHistoryPage() {
  const { currentCase } = useCase()
  const [isSyncing, setIsSyncing] = useState(false)

  const retrySync = useMutation(api.functions.pjnCaseHistory.retryCaseHistorySync)
  
  // Fetch the current sync job status
  const syncJob = useQuery(
    api.functions.pjnCaseHistory.getCaseHistorySyncStatus,
    currentCase ? { caseId: currentCase._id } : "skip"
  )

  const actuaciones = useQuery(
    api.functions.pjnHistory.getCaseActuaciones,
    currentCase ? { caseId: currentCase._id } : "skip"
  )

  const activityLog = useQuery(
    api.functions.pjnHistory.getPjnActivityLog,
    currentCase ? { caseId: currentCase._id } : "skip"
  )

  const participants = useQuery(
    api.functions.pjnHistory.getCaseParticipants,
    currentCase ? { caseId: currentCase._id } : "skip"
  )

  const appeals = useQuery(
    api.functions.pjnHistory.getCaseAppeals,
    currentCase ? { caseId: currentCase._id } : "skip"
  )

  const relatedCases = useQuery(
    api.functions.pjnHistory.getRelatedCases,
    currentCase ? { caseId: currentCase._id } : "skip"
  )

  const handleSync = async () => {
    if (!currentCase) return

    setIsSyncing(true)
    try {
      const result = await retrySync({ caseId: currentCase._id })

      if (result.success) {
        toast.success("Sincronización iniciada en segundo plano")
      } else {
        toast.error(`Error: ${"error" in result ? result.error : "Error desconocido"}`)
      }
    } catch (error) {
      toast.error(
        `Error al sincronizar: ${error instanceof Error ? error.message : "Error desconocido"}`
      )
    } finally {
      setIsSyncing(false)
    }
  }

  // Check if there's an active sync job (queued or running)
  const hasActiveSync = syncJob && (syncJob.status === "queued" || syncJob.status === "running")
  
  // Show completed job briefly (for 10 seconds after completion)
  const showCompletedJob = syncJob && 
    syncJob.status === "completed" && 
    syncJob.finishedAt && 
    Date.now() - syncJob.finishedAt < 10000

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const movements = actuaciones || []
  const documents = activityLog?.filter(
    (log) => log.action === "pjn_historical_document"
  )

  if (!currentCase) {
    return (
      <CaseLayout>
        <div className="p-6">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
      </CaseLayout>
    )
  }

  return (
    <CaseLayout>
      <div className="max-w-7xl mx-auto px-5 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Historial PJN
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {currentCase.fre ? (
                <span>FRE: {currentCase.fre}</span>
              ) : (
                <span className="text-amber-600 flex items-center gap-1">
                  <AlertCircle size={14} />
                  Sin FRE configurado - Configura el FRE en los datos del caso
                </span>
              )}
            </p>
            {currentCase.lastPjnHistorySyncAt && (
              <p className="text-xs text-gray-400 mt-1">
                Última sincronización:{" "}
                {formatDate(currentCase.lastPjnHistorySyncAt)}
              </p>
            )}
          </div>
          <Button
            onClick={handleSync}
            disabled={isSyncing || !currentCase.fre || hasActiveSync}
            className="gap-2"
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {isSyncing ? "Iniciando..." : hasActiveSync ? "Sincronizando..." : "Sincronizar desde PJN"}
          </Button>
        </div>

        {/* Sync Progress */}
        {(hasActiveSync || showCompletedJob || (syncJob && (syncJob.status === "failed" || syncJob.status === "auth_required"))) && (
          <CaseHistorySyncProgress
            status={syncJob.status}
            phase={syncJob.phase}
            progress={syncJob.progressPercent}
            errorMessage={syncJob.errorMessage}
            movimientosProcessed={syncJob.movimientosProcessed}
            documentsProcessed={syncJob.documentsProcessed}
            participantsProcessed={syncJob.participantsProcessed}
            appealsProcessed={syncJob.appealsProcessed}
            relatedCasesProcessed={syncJob.relatedCasesProcessed}
            onRetry={handleSync}
            retrying={isSyncing}
          />
        )}

        {/* Tabs */}
        <Tabs defaultValue="movimientos" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="movimientos" className="gap-2">
              <FileText size={14} />
              Actuaciones
              {actuaciones && (
                <Badge variant="secondary" className="ml-1">
                  {actuaciones.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="documentos" className="gap-2">
              <FileText size={14} />
              Documentos
              {documents && (
                <Badge variant="secondary" className="ml-1">
                  {documents.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="intervinientes" className="gap-2">
              <Users size={14} />
              Intervinientes
              {participants && (
                <Badge variant="secondary" className="ml-1">
                  {participants.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="recursos" className="gap-2">
              <Scale size={14} />
              Recursos
              {appeals && (
                <Badge variant="secondary" className="ml-1">
                  {appeals.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="vinculados" className="gap-2">
              <Link2 size={14} />
              Vinculados
              {relatedCases && (
                <Badge variant="secondary" className="ml-1">
                  {relatedCases.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Actuaciones Tab */}
          <TabsContent value="movimientos" className="mt-4">
            {actuaciones === undefined ? (
              <TableSkeleton />
            ) : actuaciones.length === 0 ? (
              <EmptyState message="No hay actuaciones sincronizadas" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Documento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((actuacion) => (
                    <TableRow key={actuacion._id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(actuacion.movementDate)}
                      </TableCell>
                      <TableCell>{actuacion.description}</TableCell>
                      <TableCell>
                        {actuacion.documentId ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              // Link to document detail or preview
                              window.open(`/caso/${currentCase._id}/documentos/${actuacion.documentId}`, "_blank")
                            }}
                          >
                            <FileText size={16} className="text-blue-500" />
                          </Button>
                        ) : actuacion.hasDocument ? (
                          <div title="Documento disponible en PJN (pendiente de descarga)">
                            <CheckCircle size={16} className="text-green-500" />
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          {/* Documentos Tab */}
          <TabsContent value="documentos" className="mt-4">
            {documents === undefined ? (
              <TableSkeleton />
            ) : documents.length === 0 ? (
              <EmptyState message="No hay documentos sincronizados" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Fuente</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((log) => {
                    const metadata = log.metadata as Record<string, any>;
                    return (
                      <TableRow key={log._id}>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(log.timestamp)}
                        </TableCell>
                        <TableCell>
                          {String(metadata?.description ?? "-")}
                        </TableCell>
                        <TableCell className="flex items-center gap-2">
                          <Badge variant="outline">
                            {String(metadata?.source ?? "PJN")}
                          </Badge>
                          {metadata?.documentId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                window.open(`/caso/${currentCase._id}/documentos/${metadata.documentId}`, "_blank")
                              }}
                            >
                              <FileText size={16} className="text-blue-500" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          {/* Intervinientes Tab */}
          <TabsContent value="intervinientes" className="mt-4">
            {participants === undefined ? (
              <TableSkeleton />
            ) : participants.length === 0 ? (
              <EmptyState message="No hay intervinientes sincronizados" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rol</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Detalles</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participants.map((p) => (
                    <TableRow key={p._id}>
                      <TableCell>
                        <Badge>{p.role}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-gray-500">
                        {p.details || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          {/* Recursos Tab */}
          <TabsContent value="recursos" className="mt-4">
            {appeals === undefined ? (
              <TableSkeleton />
            ) : appeals.length === 0 ? (
              <EmptyState message="No hay recursos sincronizados" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Tribunal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appeals.map((a) => (
                    <TableRow key={a._id}>
                      <TableCell className="font-medium">
                        {a.appealType}
                      </TableCell>
                      <TableCell>{a.filedDate || "-"}</TableCell>
                      <TableCell>
                        {a.status ? (
                          <Badge variant="outline">{a.status}</Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{a.court || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          {/* Vinculados Tab */}
          <TabsContent value="vinculados" className="mt-4">
            {relatedCases === undefined ? (
              <TableSkeleton />
            ) : relatedCases.length === 0 ? (
              <EmptyState message="No hay casos vinculados sincronizados" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>FRE</TableHead>
                    <TableHead>Relación</TableHead>
                    <TableHead>Carátula</TableHead>
                    <TableHead>Tribunal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {relatedCases.map((r) => (
                    <TableRow key={r._id}>
                      <TableCell className="font-mono font-medium">
                        {r.relatedFre}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{r.relationshipType}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {r.relatedCaratula || "-"}
                      </TableCell>
                      <TableCell>{r.relatedCourt || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </CaseLayout>
  )
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
      <FileText size={48} className="mb-4 opacity-20" />
      <p>{message}</p>
      <p className="text-sm mt-1">Usa el botón "Sincronizar desde PJN" para obtener datos</p>
    </div>
  )
}
