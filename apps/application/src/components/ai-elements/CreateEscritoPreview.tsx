import { useState } from "react"
import { useMutation } from "convex/react"
import { useNavigate } from "react-router-dom"
import { FileText } from "lucide-react"
import { toast } from "sonner"
import type { ToolUIPart } from "ai"
import { Button } from "../ui/button"
import { api } from "../../../convex/_generated/api"
import { useCase } from "@/context/CaseContext"
import type { Id } from "../../../convex/_generated/dataModel"

interface CreateEscritoPreviewProps {
  output: ToolUIPart["output"]
}

export function CreateEscritoPreview({ output }: CreateEscritoPreviewProps) {
  const navigate = useNavigate()
  const { currentCase } = useCase()
  const createEscrito = useMutation(api.functions.documents.createEscrito)
  const [isCreating, setIsCreating] = useState(false)

  const outputData = output as Record<string, unknown>
  const parameters = outputData?.parameters as Record<string, unknown> | undefined
  const title = parameters?.title as string
  const caseId = parameters?.caseId as Id<"cases">
  const prosemirrorId = parameters?.prosemirrorId as string
  const templateId = parameters?.templateId as Id<"modelos">
  
  const handleCreate = async () => {
    if (!title || !caseId || !prosemirrorId) {
      toast.error("Faltan parámetros para crear el escrito")
      return
    }

    setIsCreating(true)
    try {
      const result = await createEscrito({
        title,
        caseId,
        prosemirrorId,
      })

      // Show different message based on whether it was created or already existed
      if (result.alreadyExists) {
        toast.info("Abriendo escrito existente")
      } else {
        toast.success("Escrito creado exitosamente")
      }
      
      navigate(`/caso/${currentCase?._id}/escritos/${result.escritoId}?templateId=${templateId}`)
    } catch (error) {
      console.error("Error creating escrito:", error)
      toast.error("Error al crear el escrito")
    } finally {
      setIsCreating(false)
    }
  }
  

  return (
    <div className="ml-4 border-l-2 border-blue-200 bg-blue-50/50 rounded-r-md p-3 space-y-2">
      <div className="flex items-center gap-2 text-blue-700">
        <FileText className="size-4" />
        <span className="font-semibold text-sm">Nuevo Escrito Listo</span>
      </div>
      
      <div className="text-xs text-gray-700">
        <p><span className="font-medium">Título:</span> {title}</p>
      </div>

      <Button
        size="sm"
        onClick={handleCreate}
        disabled={isCreating}
        className="w-full"
      >
        {isCreating ? "Creando..." : "Crear Escrito"}
      </Button>
    </div>
  )
}

