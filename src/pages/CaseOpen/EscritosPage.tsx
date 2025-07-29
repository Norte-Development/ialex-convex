"use client"

import CaseLayout from "@/components/Cases/CaseLayout"
import { Tiptap } from "@/components/Editor/tiptap-editor"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { useQuery } from "convex/react"
import { useParams } from "react-router-dom"

export default function EscritoPage() {
  const { escritoId } = useParams()
  const escrito = useQuery(api.functions.documents.getEscrito, {
    escritoId: escritoId as Id<"escritos">,
  })

  if (!escritoId) {
    return <div>Escrito not found</div>
  }

  return (
    <CaseLayout>
      {/* Document Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="w-full">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">{escrito?.title || "Untitled Document"}</h1>
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
      </div>

      {/* Editor Container */}
      <div className="flex-1 p-6">
        <Tiptap documentId={escrito?.prosemirrorId} />
      </div>
    </CaseLayout>
  )
}
