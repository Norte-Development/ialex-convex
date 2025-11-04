"use client"

import { useQuery } from "@tanstack/react-query"
import { useAction } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { Badge } from "../ui/badge"
import { Separator } from "../ui/separator"
import { Calendar, FileText, Globe, Users, Scale } from "lucide-react"
import type { FalloDoc } from "../../../types/fallos"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { getJurisdictionName } from "./utils/jurisdictionUtils"

interface FalloDetailsProps {
  jurisdiction: string
  id: string
  getFalloAction: ReturnType<typeof useAction<typeof api.functions.fallos.getFallo>>
}

export function FalloDetails({ jurisdiction, id, getFalloAction }: FalloDetailsProps) {

  const {
    data: fallo,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["fallo", jurisdiction, id],
    queryFn: async (): Promise<FalloDoc | null> => {
      return await getFalloAction({ documentId: id })
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
          <div className="text-lg font-medium text-gray-900">Cargando información del fallo</div>
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

  if (!fallo) {
    return (
      <div className="text-center py-16 space-y-4">
        <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
          <FileText className="w-8 h-8 text-gray-400" />
        </div>
        <div className="space-y-2">
          <div className="text-lg font-medium text-gray-900">Documento no encontrado</div>
          <div className="text-sm text-gray-600">No se encontró información para este fallo</div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-h-[calc(100vh-8rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
      <div className="space-y-6 p-1">
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-100 pb-4 -mx-1 px-1">
          <h2 className="text-2xl font-bold text-gray-900 leading-tight mb-4 text-pretty line-clamp-3" title={fallo.title}>
            {fallo.title}
          </h2>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <Scale className="w-3 h-3" />
              {fallo.tipo_general}
            </Badge>

            <Badge variant="outline" className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              {fallo.tipo_contenido}
            </Badge>

            <Badge variant="outline" className="flex items-center gap-1">
              <Globe className="w-3 h-3" />
              {getJurisdictionName(fallo.jurisdiccion)}
            </Badge>

            {fallo.tribunal && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Scale className="w-3 h-3" />
                {fallo.tribunal}
              </Badge>
            )}

            {fallo.sala && (
              <Badge variant="outline" className="flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {fallo.sala}
              </Badge>
            )}
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Date */}
          {fallo.date && (
            <div className="space-y-3 bg-gray-50/50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Fecha
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">Fecha del fallo:</span>
                  <span className="text-gray-900">
                    {new Date(fallo.date).toLocaleDateString("es-ES")}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Court Information */}
          <div className="space-y-3 bg-gray-50/50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Scale className="w-4 h-4" />
              Información del tribunal
            </h3>
            <div className="space-y-2 text-sm">
              {fallo.tribunal && (
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">Tribunal:</span>
                  <span className="text-gray-900">{fallo.tribunal}</span>
                </div>
              )}
              {fallo.sala && (
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">Sala:</span>
                  <span className="text-gray-900">{fallo.sala}</span>
                </div>
              )}
              {fallo.materia && (
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">Materia:</span>
                  <span className="text-gray-900">{fallo.materia}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Parties */}
        {(fallo.actor || fallo.demandado) && (
          <div className="space-y-3 bg-gray-50/50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Partes
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {fallo.actor && (
                <div>
                  <span className="font-medium text-gray-600 block mb-1">Actor:</span>
                  <span className="text-gray-900">{fallo.actor}</span>
                </div>
              )}
              {fallo.demandado && (
                <div>
                  <span className="font-medium text-gray-600 block mb-1">Demandado:</span>
                  <span className="text-gray-900">{fallo.demandado}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Magistrados */}
        {fallo.magistrados && (
          <div className="space-y-3 bg-gray-50/50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Magistrados
            </h3>
            <div className="text-sm text-gray-700">
              {fallo.magistrados}
            </div>
          </div>
        )}

        {/* Summary */}
        {fallo.sumario && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">Sumario</h3>
              <div className="bg-gray-50/50 rounded-lg border border-gray-200 p-4">
                <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{fallo.sumario}</ReactMarkdown>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Tags */}
        {fallo.tags && fallo.tags.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">Etiquetas</h3>
              <div className="flex flex-wrap gap-2">
                {fallo.tags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="hover:bg-gray-200 transition-colors">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Referencias Normativas */}
        {fallo.referencias_normativas && fallo.referencias_normativas.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">Referencias normativas</h3>
              <div className="space-y-2">
                {fallo.referencias_normativas.map((ref, index) => (
                  <div key={index} className="bg-gray-50/50 rounded-lg border border-gray-200 p-3">
                    <span className="text-sm text-gray-700">{ref}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Citas */}
        {fallo.citas && fallo.citas.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">Citas</h3>
              <div className="space-y-2">
                {fallo.citas.map((cita, index) => (
                  <div key={index} className="bg-gray-50/50 rounded-lg border border-gray-200 p-3">
                    <span className="text-sm text-gray-700">{cita}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Content - Always visible */}
        {fallo.content && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">Contenido completo</h3>
              <div className="bg-gray-50/50 rounded-lg border border-gray-200 p-4">
                <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-blue-600 prose-strong:text-gray-900 prose-ul:text-gray-700 prose-ol:text-gray-700 prose-blockquote:text-gray-600 prose-code:text-gray-800 prose-pre:bg-gray-100">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{fallo.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="h-4"></div>
      </div>
    </div>
  )
}
