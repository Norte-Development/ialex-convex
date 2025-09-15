"use client"

import { useQuery } from "@tanstack/react-query"
import { useAction } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { Badge } from "../ui/badge"
import { Separator } from "../ui/separator"
import { Calendar, FileText, Tag, Globe, ExternalLink, ChevronDown, ChevronUp } from "lucide-react"
import { useState } from "react"
import type { NormativeDoc } from "../../../types/legislation"

interface NormativeDetailsProps {
  jurisdiction: string
  id: string
  getNormativeAction: ReturnType<typeof useAction<typeof api.functions.legislation.getNormativeById>>
}

export function NormativeDetails({ jurisdiction, id, getNormativeAction }: NormativeDetailsProps) {
  const [isContentExpanded, setIsContentExpanded] = useState(false)
  const [isResumenExpanded, setIsResumenExpanded] = useState(true)

  const {
    data: normative,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["normative", jurisdiction, id],
    queryFn: async (): Promise<NormativeDoc | null> => {
      return await getNormativeAction({ jurisdiction, id })
    },
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <div className="relative">
          <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          <div className="absolute inset-0 animate-pulse w-10 h-10 border-4 border-blue-200 rounded-full"></div>
        </div>
        <div className="text-center space-y-2">
          <div className="text-lg font-medium text-gray-900">Cargando información normativa</div>
          <div className="text-sm text-gray-500">Obteniendo detalles del documento...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-16 space-y-4">
        <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
          <FileText className="w-8 h-8 text-red-500" />
        </div>
        <div className="space-y-2">
          <div className="text-lg font-medium text-red-600">Error al cargar la información</div>
          <div className="text-sm text-gray-600 max-w-md mx-auto">{(error as Error).message}</div>
        </div>
      </div>
    )
  }

  if (!normative) {
    return (
      <div className="text-center py-16 space-y-4">
        <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
          <FileText className="w-8 h-8 text-gray-400" />
        </div>
        <div className="space-y-2">
          <div className="text-lg font-medium text-gray-900">Documento no encontrado</div>
          <div className="text-sm text-gray-600">No se encontró información para esta norma</div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-h-[calc(100vh-8rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
      <div className="space-y-6 p-1">
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-100 pb-4 -mx-1 px-1">
          <h2 className="text-2xl font-bold text-gray-900 leading-tight mb-4 text-pretty">{normative.title}</h2>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <Tag className="w-3 h-3" />
              {normative.type}
            </Badge>

            {normative.numero && (
              <Badge variant="outline" className="flex items-center gap-1">
                <FileText className="w-3 h-3" />
                N° {normative.numero}
              </Badge>
            )}

            <Badge variant="outline" className="flex items-center gap-1">
              <Globe className="w-3 h-3" />
              {normative.jurisdiccion}
            </Badge>

            <Badge
              className={
                normative.estado === "vigente"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-gray-50 text-gray-700 border-gray-200"
              }
            >
              {normative.estado}
            </Badge>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Dates */}
          {normative.dates && (
            <div className="space-y-3 bg-gray-50/50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Fechas
              </h3>
              <div className="space-y-2 text-sm">
                {normative.dates.publication_date && (
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600">Publicación:</span>
                    <span className="text-gray-900">
                      {new Date(normative.dates.publication_date).toLocaleDateString("es-ES")}
                    </span>
                  </div>
                )}
                {normative.dates.sanction_date && (
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600">Sanción:</span>
                    <span className="text-gray-900">
                      {new Date(normative.dates.sanction_date).toLocaleDateString("es-ES")}
                    </span>
                  </div>
                )}
                {normative.dates.indexed_at && (
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600">Indexado:</span>
                    <span className="text-gray-900">
                      {new Date(normative.dates.indexed_at).toLocaleDateString("es-ES")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Additional Info */}
          <div className="space-y-3 bg-gray-50/50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Información adicional
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="font-medium text-gray-600">País:</span>
                <span className="text-gray-900">{normative.country_code?.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-600">Fuente:</span>
                <span className="text-gray-900">{normative.fuente}</span>
              </div>
              {normative.materia && (
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">Materia:</span>
                  <span className="text-gray-900">{normative.materia}</span>
                </div>
              )}
              {normative.subestado && (
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">Subestado:</span>
                  <span className="text-gray-900">{normative.subestado}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tags */}
        {normative.tags && normative.tags.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">Etiquetas</h3>
              <div className="flex flex-wrap gap-2">
                {normative.tags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="hover:bg-gray-200 transition-colors">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Summary */}
        {normative.resumen && (
          <>
            <Separator />
            <div className="space-y-3">
              <button
                onClick={() => setIsResumenExpanded(!isResumenExpanded)}
                className="flex items-center gap-2 font-semibold text-gray-900 hover:text-gray-700 transition-colors"
              >
                <span>Resumen</span>
                {isResumenExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {isResumenExpanded && (
                <div className="text-sm leading-relaxed text-gray-700 bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                  <div className="prose prose-sm max-w-none">{normative.resumen}</div>
                </div>
              )}
            </div>
          </>
        )}

        {/* External Link */}
        {normative.url && (
          <>
            <Separator />
            <div className="flex items-center gap-2">
              <a
                href={normative.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 transition-colors rounded-lg border border-blue-200"
              >
                <ExternalLink className="w-4 h-4" />
                Ver fuente original
              </a>
            </div>
          </>
        )}

        {/* Content */}
        {normative.content && (
          <>
            <Separator />
            <div className="space-y-3">
              <button
                onClick={() => setIsContentExpanded(!isContentExpanded)}
                className="flex items-center gap-2 font-semibold text-gray-900 hover:text-gray-700 transition-colors"
              >
                <span>Contenido completo</span>
                {isContentExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {isContentExpanded && (
                <div className="bg-gray-50/50 rounded-lg border border-gray-200">
                  <div className="max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200 p-4">
                    <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {normative.content}
                    </div>
                  </div>
                  <div className="px-4 py-2 bg-gray-100 border-t border-gray-200 rounded-b-lg">
                    <div className="text-xs text-gray-500 text-center">Desplázate para ver todo el contenido</div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        <div className="h-4"></div>
      </div>
    </div>
  )
}
