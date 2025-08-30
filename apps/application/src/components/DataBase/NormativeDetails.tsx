import { useQuery } from "@tanstack/react-query"
import { useAction } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"
import { Card, CardContent } from "../ui/card"
import { Separator } from "../ui/separator"
import { Search } from "lucide-react"
import type { NormativeDoc } from "../../../types/legislation"

interface NormativeDetailsProps {
  jurisdiction: string
  id: string
  getNormativeAction: ReturnType<typeof useAction<typeof api.functions.legislation.getNormative>>
  queryNormativesAction: ReturnType<typeof useAction<typeof api.functions.legislation.queryNormatives>>
  showChunks: boolean
  onToggleChunks: () => void
  searchQuery: string
}

export function NormativeDetails({
  jurisdiction,
  id,
  getNormativeAction,
  queryNormativesAction,
  showChunks,
  onToggleChunks,
  searchQuery,
}: NormativeDetailsProps) {
  const { data: full } = useQuery<NormativeDoc | null>({
    queryKey: ["normative", jurisdiction, id],
    queryFn: () => getNormativeAction({ jurisdiction, id }),
    staleTime: 5 * 60 * 1000,
  })

  const { data: chunks = [], isLoading } = useQuery({
    queryKey: ["normative-chunks", jurisdiction, id, searchQuery, showChunks],
    queryFn: () =>
      queryNormativesAction({
        jurisdiction,
        query: searchQuery,
        normative_ids: [id],
        limit: 5,
      }),
    enabled: showChunks && !!searchQuery,
    staleTime: 60 * 1000,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-900 leading-tight">{full?.titulo || id}</h2>
          <div className="flex flex-wrap gap-2 mt-3">
            <Badge variant="outline">{full?.tipo}</Badge>
            {full?.numero && <Badge variant="outline">N° {full.numero}</Badge>}
            {full?.provincia && <Badge variant="outline">{full.provincia}</Badge>}
            {full?.estado && (
              <Badge
                className={
                  full.estado === "vigente"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-gray-50 text-gray-700 border-gray-200"
                }
              >
                {full.estado}
              </Badge>
            )}
          </div>
        </div>
        <Button variant="outline" onClick={onToggleChunks} disabled={!searchQuery} className="gap-2 bg-transparent">
          <Search className="w-4 h-4" />
          {showChunks ? "Ocultar secciones" : "Ver secciones relevantes"}
        </Button>
      </div>

      <Separator />

      {showChunks ? (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900">Secciones relevantes</h3>
          {isLoading ? (
            <div className="flex items-center gap-2 text-gray-500 py-8">
              <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              Buscando secciones relevantes...
            </div>
          ) : chunks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No se encontraron secciones relevantes para "{searchQuery}"</p>
            </div>
          ) : (
            chunks.map((c: any, idx: number) => (
              <Card key={idx} className="border-l-4 border-l-blue-500">
                <CardContent className="p-4">
                  <div className="text-xs text-blue-600 font-medium mb-2">Sección #{c.chunk_index}</div>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{c.text}</div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ) : (
        <div className="prose prose-sm max-w-none">
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700 bg-gray-50 p-6 rounded-lg">
            {full?.texto?.trim() || "Sin texto disponible."}
          </div>
        </div>
      )}
    </div>
  )
}
