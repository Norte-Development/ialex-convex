"use client"

import { useCallback, useEffect, useState } from "react"
// @ts-ignore - TypeScript cache issue with @tiptap/core types
import type { Editor } from "@tiptap/core"
import { useNavigate } from "react-router-dom"
import { useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { Button } from "@/components/ui/button"
import { CheckCircle, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Id } from "../../../convex/_generated/dataModel"

/**
 * Menú flotante minimalista para aceptar o rechazar todas las sugerencias de diferencias en el editor.
 *
 * Características:
 * - Diseño compacto, similar a un cursor
 * - Aparece automáticamente cuando hay sugerencias de diferencias en el documento
 * - Navegar entre cambios con botones anterior/siguiente
 * - Muestra la posición actual del cambio (ej., "1/5")
 * - Proporciona botones para aceptar o rechazar todos los cambios de una vez
 * - Incluye atajos de teclado: ⌘⇧Y (Aceptar Todo), ⌘⇧N (Rechazar Todo)
 * - Soporte multi-documento: permite cambiar entre documentos editados por el agente
 */
interface SuggestionsMenuProps {
  editor: Editor
  className?: string
  escritoId?: Id<"escritos"> // Convex ID for navigation (if escrito)
  caseId?: Id<"cases"> // Case ID for navigation
}

interface ChangeStats {
  totalChanges: number
  addedChanges: number
  deletedChanges: number
  uniqueChangeIds: string[]
}

export function SuggestionsMenu({
  editor,
  className,
  escritoId,
  caseId,
}: SuggestionsMenuProps) {
  const [currentChangeIndex, setCurrentChangeIndex] = useState(0)
  const [currentDocumentIndex, setCurrentDocumentIndex] = useState(0)
  const navigate = useNavigate()

  // Query all escritos with pending changes in the case
  const escritosWithChanges = useQuery(
    api.functions.documents.getEscritosWithPendingChanges,
    caseId ? { caseId } : "skip",
  )

  // Find current document index in the list
  useEffect(() => {
    if (escritoId && escritosWithChanges && escritosWithChanges.length > 0) {
      const index = escritosWithChanges.findIndex((doc) => doc.escritoId === escritoId)
      if (index >= 0) {
        setCurrentDocumentIndex(index)
      }
    }
  }, [escritoId, escritosWithChanges])

  // Navigate to previous document
  const goToPreviousDocument = useCallback(() => {
    if (!escritosWithChanges || escritosWithChanges.length === 0) return
    const prevIndex =
      currentDocumentIndex === 0
        ? escritosWithChanges.length - 1
        : currentDocumentIndex - 1
    const prevDoc = escritosWithChanges[prevIndex]
    if (prevDoc && caseId) {
      navigate(`/caso/${caseId}/escritos/${prevDoc.escritoId}`)
    }
  }, [escritosWithChanges, currentDocumentIndex, navigate, caseId])

  // Navigate to next document
  const goToNextDocument = useCallback(() => {
    if (!escritosWithChanges || escritosWithChanges.length === 0) return
    const nextIndex = (currentDocumentIndex + 1) % escritosWithChanges.length
    const nextDoc = escritosWithChanges[nextIndex]
    if (nextDoc && caseId) {
      navigate(`/caso/${caseId}/escritos/${nextDoc.escritoId}`)
    }
  }, [escritosWithChanges, currentDocumentIndex, navigate, caseId])

  // Function to count all change nodes in the document
  const countChanges = useCallback((): ChangeStats => {
    if (!editor || !editor.state || !editor.state.doc) {
      return { totalChanges: 0, addedChanges: 0, deletedChanges: 0, uniqueChangeIds: [] }
    }

    let totalChanges = 0
    let addedChanges = 0
    let deletedChanges = 0
    const uniqueChangeIds = new Set<string>()

    editor.state.doc.descendants((node: any, pos: number) => {
      if (
        node.type.name === "inlineChange" ||
        node.type.name === "blockChange" ||
        node.type.name === "lineBreakChange"
      ) {
        totalChanges++
        uniqueChangeIds.add(node.attrs.changeId || `individual-${pos}`)

        if (node.attrs.changeType === "added") {
          addedChanges++
        } else if (node.attrs.changeType === "deleted") {
          deletedChanges++
        }
      }
    })

    return {
      totalChanges,
      addedChanges,
      deletedChanges,
      uniqueChangeIds: Array.from(uniqueChangeIds),
    }
  }, [editor])


  // Get current change stats directly
  const changeStats = countChanges()
  
  // Determine if we should show multi-document UI
  const showMultiDocument = escritosWithChanges && escritosWithChanges.length > 1
  
  // Show menu if there are changes OR if there are multiple documents with changes
  const isVisible = changeStats.totalChanges > 0 || showMultiDocument


  // Function to get all change positions
  const getAllChangePositions = useCallback((): number[] => {
    if (!editor || !editor.state || !editor.state.doc) {
      return []
    }

    const positions: number[] = []
    editor.state.doc.descendants((node: any, pos: number) => {
      if (
        node.type.name === "inlineChange" ||
        node.type.name === "blockChange" ||
        node.type.name === "lineBreakChange"
      ) {
        positions.push(pos)
      }
    })

    return positions.sort((a, b) => a - b)
  }, [editor])

  // Navigate to next change
  const goToNextChange = useCallback(() => {
    const positions = getAllChangePositions()
    if (positions.length === 0) return

    const nextIndex = (currentChangeIndex + 1) % positions.length
    setCurrentChangeIndex(nextIndex)

    const targetPos = positions[nextIndex]
    editor.commands.focus()
    editor.commands.setTextSelection(targetPos)

    // Scroll the change into view
    const { view } = editor
    const coords = view.coordsAtPos(targetPos)
    const editorRect = view.dom.getBoundingClientRect()
    const scrollTop = coords.top - editorRect.top - editorRect.height / 2

    view.dom.scrollBy({ top: scrollTop, behavior: "smooth" })
  }, [editor, currentChangeIndex, getAllChangePositions])

  // Navigate to previous change
  const goToPreviousChange = useCallback(() => {
    const positions = getAllChangePositions()
    if (positions.length === 0) return

    const prevIndex = currentChangeIndex === 0 ? positions.length - 1 : currentChangeIndex - 1
    setCurrentChangeIndex(prevIndex)

    const targetPos = positions[prevIndex]
    editor.commands.focus()
    editor.commands.setTextSelection(targetPos)

    // Scroll the change into view
    const { view } = editor
    const coords = view.coordsAtPos(targetPos)
    const editorRect = view.dom.getBoundingClientRect()
    const scrollTop = coords.top - editorRect.top - editorRect.height / 2

    view.dom.scrollBy({ top: scrollTop, behavior: "smooth" })
  }, [editor, currentChangeIndex, getAllChangePositions])

  // Reset current index when total changes count changes
  useEffect(() => {
    if (changeStats.totalChanges === 0) {
      setCurrentChangeIndex(0)
    } else if (currentChangeIndex >= changeStats.totalChanges) {
      setCurrentChangeIndex(0)
    }
  }, [changeStats.totalChanges, currentChangeIndex])

  // Function to accept all changes
  const acceptAllChanges = useCallback(() => {
    if (!editor || !editor.state || !editor.view) return

    const tr = editor.state.tr
    const nodesToProcess: Array<{ node: any; pos: number }> = []

    // Collect all change nodes
    editor.state.doc.descendants((node: any, pos: number) => {
      if (
        node.type.name === "inlineChange" ||
        node.type.name === "blockChange" ||
        node.type.name === "lineBreakChange"
      ) {
        nodesToProcess.push({ node, pos })
      }
    })

    // Process nodes in reverse order to maintain correct positions
    nodesToProcess.reverse().forEach(({ node, pos }) => {
      if (node.attrs.changeType === "added") {
        // Replace with content (accept the addition)
        tr.replaceWith(pos, pos + node.nodeSize, node.content)
      } else if (node.attrs.changeType === "deleted") {
        // Remove the deleted node (accept the deletion)
        tr.delete(pos, pos + node.nodeSize)
      }
    })

    if (tr.steps.length > 0) {
      editor.view.dispatch(tr)
      // Reset change index after accepting
      setCurrentChangeIndex(0)
    }
  }, [editor])

  // Function to reject all changes
  const rejectAllChanges = useCallback(() => {
    if (!editor || !editor.state || !editor.view) return

    const tr = editor.state.tr
    const nodesToProcess: Array<{ node: any; pos: number }> = []

    // Collect all change nodes
    editor.state.doc.descendants((node: any, pos: number) => {
      if (
        node.type.name === "inlineChange" ||
        node.type.name === "blockChange" ||
        node.type.name === "lineBreakChange"
      ) {
        nodesToProcess.push({ node, pos })
      }
    })

    // Process nodes in reverse order to maintain correct positions
    nodesToProcess.reverse().forEach(({ node, pos }) => {
      if (node.attrs.changeType === "added") {
        // Remove the addition (reject it)
        tr.delete(pos, pos + node.nodeSize)
      } else if (node.attrs.changeType === "deleted") {
        // Restore the deleted content (reject the deletion)
        // For deleted changes, we need to restore the original content
        if (node.content && node.content.size > 0) {
          tr.replaceWith(pos, pos + node.nodeSize, node.content)
        } else {
          // If no content, just remove the change marker
          tr.delete(pos, pos + node.nodeSize)
        }
      }
    })

    if (tr.steps.length > 0) {
      editor.view.dispatch(tr)
      // Reset change index after rejecting
      setCurrentChangeIndex(0)
    }
  }, [editor])

  // Handle keyboard shortcuts with a single useEffect
  useEffect(() => {
    // Guard against unmounted or uninitialized editor
    if (!editor) return
    if (editor.isDestroyed) return

    // Check if view exists and is mounted
    const view = editor.view
    if (!view) return

    // Safely access the DOM element
    let editorElement: HTMLElement | null = null
    try {
      editorElement = view.dom as HTMLElement
    } catch (error) {
      // Editor view not fully initialized yet
      console.warn("Editor view not ready:", error)
      return
    }

    if (!editorElement) return

    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Cmd/Ctrl + Shift + Y (Accept All)
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === "Y") {
        event.preventDefault()
        acceptAllChanges()
        return
      }

      // Check for Cmd/Ctrl + Shift + N (Reject All)
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === "N") {
        event.preventDefault()
        rejectAllChanges()
        return
      }
    }

    // Add event listener to the editor's DOM element
    editorElement.addEventListener("keydown", handleKeyDown)

    return () => {
      if (editorElement) {
        editorElement.removeEventListener("keydown", handleKeyDown)
      }
    }
  }, [editor, acceptAllChanges, rejectAllChanges])

  // Always show if we're in multi-document mode or if there are changes
  if (!isVisible) {
    return null
  }

  return (
    <div
      className={cn(
        "fixed bottom-8 left-1/2 transform -translate-x-1/2 z-[9999] flex items-center gap-2 bg-white shadow-2xl border-2 border-gray-300 rounded-lg px-3 py-2",
        className,
      )}
      style={{
        position: "fixed",
      }}
    >
      {/* Left Section: Change Navigation (1/17) */}
      {changeStats.totalChanges > 0 && (
        <div className="bg-gray-100 rounded-md px-2 py-1 flex items-center gap-1">
          <Button
            onClick={goToPreviousChange}
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 hover:bg-gray-200"
            title="Cambio anterior"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <div className="px-2 text-xs font-medium text-gray-700 min-w-12 text-center">
            {currentChangeIndex + 1}/{changeStats.totalChanges}
          </div>
          <Button
            onClick={goToNextChange}
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 hover:bg-gray-200"
            title="Siguiente cambio"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Middle Section: Action Buttons */}
      {changeStats.totalChanges > 0 && (
        <div className="flex items-center gap-1">
          <Button
            onClick={rejectAllChanges}
            size="sm"
            variant="ghost"
            className="h-8 px-3 text-xs text-gray-600 hover:bg-gray-100"
            title="Rechazar todos los cambios"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Deshacer
          </Button>
          <Button
            onClick={acceptAllChanges}
            size="sm"
            className="h-8 px-3 text-xs bg-blue-600 text-white hover:bg-blue-700"
            title="Aceptar todos los cambios"
          >
            <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
            Mantener
          </Button>
        </div>
      )}

      {/* Right Section: Document Navigation (5/5) */}
      {showMultiDocument && escritosWithChanges && (
        <div className="bg-gray-100 rounded-md px-2 py-1 flex items-center gap-1">
          <Button
            onClick={goToPreviousDocument}
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 hover:bg-gray-200"
            title="Documento anterior"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <div className="px-2 text-xs font-medium text-gray-700 min-w-12 text-center">
            {currentDocumentIndex + 1}/{escritosWithChanges.length}
          </div>
          <Button
            onClick={goToNextDocument}
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 hover:bg-gray-200"
            title="Siguiente documento"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}
