"use client"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { NormativeDetails } from "@/components/DataBase/NormativeDetails"
import { useAction, useQuery } from "convex/react"
import { useQuery as useReactQuery } from "@tanstack/react-query"
import { api } from "../../../convex/_generated/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Download, FileText, Loader2, Eye, EyeOff, ExternalLink } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import type { Id } from "convex/_generated/dataModel"
import DocumentViewer from "@/components/Documents/DocumentViewer"
import type { FalloDoc } from "../../../types/fallos"

interface CitationModalProps {
  open: boolean
  setOpen: (open: boolean) => void
  citationId: string
  citationType: string
}

/**
 * Modal unificado para mostrar detalles de citas
 * Soporta:
 * - 'leg': Legislación/Normativas
 * - 'doc': Documentos de la biblioteca (libraryDocuments)
 * - 'case-doc': Documentos de casos (documents)
 * - 'fallo': Fallos judiciales (futuro)
 */
export function CitationModal({ open, setOpen, citationId, citationType }: CitationModalProps) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [documentUrl, setDocumentUrl] = useState<string | null>(null)

  // Normalize incoming citation types (tools may emit newer aliases)
  // - "document" => case document ("case-doc")
  // - keep existing: "doc" (library), "case-doc" (case)
  const normalizedCitationType =
    citationType === "document" ? "case-doc" : citationType

  // Actions y queries
  const getNormativeAction = useAction(api.functions.legislation.getNormativeById)
  const getLibraryDocumentUrl = useAction(api.functions.libraryDocument.getLibraryDocumentUrl)
  const getCaseDocumentUrl = useAction(api.functions.documents.getDocumentUrl)

  // Query para documentos de biblioteca
  const libraryDocument = useQuery(
    api.functions.libraryDocument.getLibraryDocument,
    normalizedCitationType === "doc" && citationId ? { documentId: citationId as Id<"libraryDocuments"> } : "skip",
  )

  // Query para documentos de casos
  const caseDocument = useQuery(
    api.functions.documents.getDocument,
    normalizedCitationType === "case-doc" && citationId ? { documentId: citationId as Id<"documents"> } : "skip",
  )

  // Action para fallos judiciales
  const getFalloAction = useAction(api.functions.fallos.getFallo)

  // Use React Query for fallo data fetching with proper caching
  const {
    data: fallo,
    isLoading: loadingFallo,
    error: falloError
  } = useReactQuery<FalloDoc | null>({
    queryKey: ["fallo", citationId],
    queryFn: async (): Promise<FalloDoc | null> => {
      if (normalizedCitationType !== "fallo" || !citationId) {
        return null
      }
      try {
        return await getFalloAction({ documentId: citationId })
      } catch (error) {
        console.error("Error fetching fallo:", error)
        toast.error("Error al cargar el fallo")
        throw error
      }
    },
    enabled: normalizedCitationType === "fallo" && !!citationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2
  })

  const getDocumentUrlForPreview = async () => {
    if (!citationId || documentUrl) return documentUrl

    try {
      let url: string | null = null

      if (normalizedCitationType === "doc") {
        url = await getLibraryDocumentUrl({
          documentId: citationId as Id<"libraryDocuments">,
        })
      } else if (normalizedCitationType === "case-doc") {
        url = await getCaseDocumentUrl({
          documentId: citationId as Id<"documents">,
        })
      }

      if (url) {
        setDocumentUrl(url)
        return url
      }
      return null
    } catch (error: any) {
      toast.error(error.message || "No se pudo obtener la URL del documento")
      return null
    }
  }

  const handleTogglePreview = async () => {
    if (!showPreview) {
      const url = await getDocumentUrlForPreview()
      if (url) {
        setShowPreview(true)
      }
    } else {
      setShowPreview(false)
    }
  }

  const handleDownloadDocument = async () => {
    if (!citationId) return

    setIsDownloading(true)
    try {
      const url = await getDocumentUrlForPreview()

      if (url) {
        window.open(url, "_blank")
        toast.success("Documento descargado")
      } else {
        toast.error("No se pudo obtener la URL del documento")
      }
    } catch (error: any) {
      toast.error(error.message || "No se pudo descargar el documento")
    } finally {
      setIsDownloading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  // Renderizar contenido según el tipo
  const renderContent = () => {
    switch (normalizedCitationType) {
      case "leg":
        // Legislación/Normativa
        return <NormativeDetails jurisdiction="py" id={citationId} getNormativeAction={getNormativeAction} />

      case "doc":
        // Documento de biblioteca
        if (!libraryDocument) {
          return (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )
        }

        return (
          <div className="space-y-6">
            {/* Header con ícono */}
            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <FileText className="h-6 w-6 text-green-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold">{libraryDocument.title}</h2>
                {libraryDocument.description && (
                  <p className="text-sm text-muted-foreground mt-1">{libraryDocument.description}</p>
                )}
              </div>
            </div>

            {/* Tags */}
            {libraryDocument.tags && libraryDocument.tags.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2">Etiquetas</h3>
                <div className="flex flex-wrap gap-2">
                  {libraryDocument.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Información del archivo */}
            <div>
              <h3 className="text-sm font-medium mb-2">Información del archivo</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Tipo:</dt>
                  <dd className="font-medium">{libraryDocument.mimeType}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Tamaño:</dt>
                  <dd className="font-medium">{formatFileSize(libraryDocument.fileSize)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subido:</dt>
                  <dd className="font-medium">{formatDate(libraryDocument._creationTime)}</dd>
                </div>
              </dl>
            </div>

            {/* Botones de acción */}
            <div className="flex gap-2">
              <Button onClick={handleTogglePreview} variant="outline" className="flex-1 bg-transparent">
                {showPreview ? (
                  <>
                    <EyeOff className="h-4 w-4 mr-2" />
                    Ocultar vista previa
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Ver documento
                  </>
                )}
              </Button>
              <Button onClick={handleDownloadDocument} disabled={isDownloading} className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                {isDownloading ? "Descargando..." : "Descargar"}
              </Button>
            </div>

            {/* Vista previa del documento */}
            {showPreview && documentUrl && (
              <div className="mt-4">
                <DocumentViewer
                  url={documentUrl}
                  mimeType={libraryDocument.mimeType}
                  title={libraryDocument.title}
                  fileSize={libraryDocument.fileSize}
                  heightClassName="h-[500px]"
                />
              </div>
            )}
          </div>
        )

      case "case-doc":
        // Documento de caso
        if (!caseDocument) {
          return (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )
        }

        return (
          <div className="space-y-6">
            {/* Header con ícono */}
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold">{caseDocument.title}</h2>
                {caseDocument.description && (
                  <p className="text-sm text-muted-foreground mt-1">{caseDocument.description}</p>
                )}
              </div>
            </div>

            {/* Información del archivo */}
            <div>
              <h3 className="text-sm font-medium mb-2">Información del archivo</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Tipo:</dt>
                  <dd className="font-medium">{caseDocument.mimeType}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Tamaño:</dt>
                  <dd className="font-medium">{formatFileSize(caseDocument.fileSize)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subido:</dt>
                  <dd className="font-medium">{formatDate(caseDocument._creationTime)}</dd>
                </div>
              </dl>
            </div>

            {/* Botones de acción */}
            <div className="flex gap-2">
              <Button onClick={handleTogglePreview} variant="outline" className="flex-1 bg-transparent">
                {showPreview ? (
                  <>
                    <EyeOff className="h-4 w-4 mr-2" />
                    Ocultar vista previa
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Ver documento
                  </>
                )}
              </Button>
              <Button onClick={handleDownloadDocument} disabled={isDownloading} className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                {isDownloading ? "Descargando..." : "Descargar"}
              </Button>
            </div>

            {/* Vista previa del documento */}
            {showPreview && documentUrl && (
              <div className="mt-4">
                <DocumentViewer
                  url={documentUrl}
                  mimeType={caseDocument.mimeType}
                  title={caseDocument.title}
                  fileSize={caseDocument.fileSize}
                  heightClassName="h-[500px]"
                />
              </div>
            )}
          </div>
        )

      case "fallo":
        // Fallos judiciales
        if (loadingFallo) {
          return (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )
        }

        if (falloError) {
          return (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <p className="text-red-600 mb-2">Error al cargar el fallo</p>
                <p className="text-sm text-muted-foreground">
                  {falloError instanceof Error ? falloError.message : "Error desconocido"}
                </p>
              </div>
            </div>
          )
        }

        if (!fallo) {
          return (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <p className="text-muted-foreground">No se encontró el fallo</p>
              </div>
            </div>
          )
        }

        return (
          <div className="space-y-6 w-full min-w-0">
            {/* Header con ícono - Improved spacing */}
            <div className="flex items-start gap-4 pb-4 border-b">
              <div className="p-3 bg-purple-100 rounded-lg shrink-0">
                <FileText className="h-7 w-7 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold text-balance leading-tight mb-2">
                  {fallo.title || "Fallo Judicial"}
                </h2>
                {fallo.sumario && (
                  <p className="text-base text-muted-foreground leading-relaxed text-pretty">{fallo.sumario}</p>
                )}
              </div>
            </div>

            {/* Información básica del fallo - Improved cards and responsive grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Información del Caso Card */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-purple-600"></span>
                  Información del Caso
                </h3>
                <dl className="space-y-3">
                  {fallo.actor && (
                    <div className="space-y-1">
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Actor</dt>
                      <dd className="text-sm font-medium leading-relaxed break-words">{fallo.actor}</dd>
                    </div>
                  )}
                  {fallo.demandado && (
                    <div className="space-y-1">
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Demandado</dt>
                      <dd className="text-sm font-medium leading-relaxed break-words">{fallo.demandado}</dd>
                    </div>
                  )}
                  {fallo.materia && (
                    <div className="space-y-1">
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Materia</dt>
                      <dd className="text-sm font-medium leading-relaxed break-words">{fallo.materia}</dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Información Judicial Card */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-purple-600"></span>
                  Información Judicial
                </h3>
                <dl className="space-y-3">
                  {fallo.jurisdiccion && (
                    <div className="space-y-1">
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Jurisdicción
                      </dt>
                      <dd className="text-sm font-medium leading-relaxed break-words">{fallo.jurisdiccion}</dd>
                    </div>
                  )}
                  {fallo.tribunal && (
                    <div className="space-y-1">
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tribunal</dt>
                      <dd className="text-sm font-medium leading-relaxed break-words">{fallo.tribunal}</dd>
                    </div>
                  )}
                  {fallo.sala && (
                    <div className="space-y-1">
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sala</dt>
                      <dd className="text-sm font-medium leading-relaxed break-words">{fallo.sala}</dd>
                    </div>
                  )}
                  {fallo.magistrados && (
                    <div className="space-y-1">
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Magistrados</dt>
                      <dd className="text-sm font-medium leading-relaxed break-words">{fallo.magistrados}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>

            {/* Fechas importantes - Improved responsive grid */}
            {(fallo.date || fallo.sanction_date || fallo.publication_date) && (
              <div className="bg-muted/50 rounded-lg p-4">
                <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-purple-600"></span>
                  Fechas Importantes
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {fallo.date && (
                    <div className="space-y-1">
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Fecha del fallo
                      </dt>
                      <dd className="text-sm font-medium">{formatDate(new Date(fallo.date).getTime())}</dd>
                    </div>
                  )}
                  {fallo.sanction_date && (
                    <div className="space-y-1">
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Fecha de sanción
                      </dt>
                      <dd className="text-sm font-medium">{formatDate(new Date(fallo.sanction_date).getTime())}</dd>
                    </div>
                  )}
                  {fallo.publication_date && (
                    <div className="space-y-1">
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Fecha de publicación
                      </dt>
                      <dd className="text-sm font-medium">{formatDate(new Date(fallo.publication_date).getTime())}</dd>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tags - Improved styling */}
            {fallo.tags && fallo.tags.length > 0 && (
              <div>
                <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-purple-600"></span>
                  Etiquetas
                </h3>
                <div className="flex flex-wrap gap-2">
                  {fallo.tags.map((tag: string) => (
                    <Badge key={tag} variant="secondary" className="text-sm">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Referencias normativas - Improved list styling */}
            {fallo.referencias_normativas && fallo.referencias_normativas.length > 0 && (
              <div className="bg-muted/50 rounded-lg p-4">
                <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-purple-600"></span>
                  Referencias Normativas
                </h3>
                <ul className="space-y-2">
                  {fallo.referencias_normativas.map((ref: string, index: number) => (
                    <li key={index} className="text-sm leading-relaxed flex gap-2">
                      <span className="text-purple-600 shrink-0">•</span>
                      <span className="break-words">{ref}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Referencias jurisprudenciales - Improved list styling */}
            {fallo.referencias_jurisprudenciales && fallo.referencias_jurisprudenciales.length > 0 && (
              <div className="bg-muted/50 rounded-lg p-4">
                <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-purple-600"></span>
                  Referencias Jurisprudenciales
                </h3>
                <ul className="space-y-2">
                  {fallo.referencias_jurisprudenciales.map((ref: string, index: number) => (
                    <li key={index} className="text-sm leading-relaxed flex gap-2">
                      <span className="text-purple-600 shrink-0">•</span>
                      <span className="break-words">{ref}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Contenido del fallo - Improved readability */}
            {fallo.content && (
              <div>
                <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-purple-600"></span>
                  Contenido del Fallo
                </h3>
                <div className="bg-muted/50 rounded-lg p-5 max-h-[500px] overflow-y-auto">
                  <div className="prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans break-words">
                      {fallo.content}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* Información adicional - Improved grid and styling */}
            <div className="bg-muted/50 rounded-lg p-4">
              <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-purple-600"></span>
                Información Adicional
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    ID del Documento
                  </dt>
                  <dd className="font-mono text-xs break-all bg-background px-2 py-1 rounded">{fallo.document_id}</dd>
                </div>
                {fallo.fuente && (
                  <div className="space-y-1">
                    <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fuente</dt>
                    <dd className="text-sm font-medium break-words">{fallo.fuente}</dd>
                  </div>
                )}
                {fallo.estado && (
                  <div className="space-y-1">
                    <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Estado</dt>
                    <dd className="text-sm font-medium">
                      <Badge variant="outline">{fallo.estado}</Badge>
                    </dd>
                  </div>
                )}
              </div>
            </div>

            {/* View Original Source Button */}
            {fallo.url && (
              <div className="flex justify-center pt-4">
                <Button
                  onClick={() => window.open(fallo.url, '_blank', 'noopener,noreferrer')}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Ver Fuente Original
                </Button>
              </div>
            )}
          </div>
        )

      default:
        return (
          <div className="text-center py-8 text-muted-foreground">
            <p>Tipo de cita no reconocido: {citationType}</p>
          </div>
        )
    }
  }

  const getTitle = () => {
    switch (normalizedCitationType) {
      case "leg":
        return "Normativa"
      case "doc":
        return "Documento de Biblioteca"
      case "case-doc":
        return "Documento del Caso"
      case "fallo":
        return "Fallo Judicial"
      default:
        return "Cita"
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTitle className="hidden">{getTitle()}</DialogTitle>
      <DialogContent className="w-[95vw] max-w-none sm:max-w-2xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[85vh] overflow-y-auto overflow-x-hidden">
        <div className="w-full min-w-0">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  )
}
