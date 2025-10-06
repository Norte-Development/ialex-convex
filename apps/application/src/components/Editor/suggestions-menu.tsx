"use client"

import { useCallback, useEffect, useState } from "react"
import type { Editor } from "@tiptap/core"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle, ChevronUp, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

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
 */
interface SuggestionsMenuProps {
  editor: Editor
  className?: string
}

interface ChangeStats {
  totalChanges: number
  addedChanges: number
  deletedChanges: number
  uniqueChangeIds: string[]
}

export function SuggestionsMenu({ editor, className }: SuggestionsMenuProps) {
  const [currentChangeIndex, setCurrentChangeIndex] = useState(0)

  // Function to count all change nodes in the document
  const countChanges = useCallback((): ChangeStats => {
    if (!editor || !editor.state || !editor.state.doc) {
      return { totalChanges: 0, addedChanges: 0, deletedChanges: 0, uniqueChangeIds: [] }
    }

    let totalChanges = 0
    let addedChanges = 0
    let deletedChanges = 0
    const uniqueChangeIds = new Set<string>()

    editor.state.doc.descendants((node, pos) => {
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
  const isVisible = changeStats.totalChanges > 0

  // Function to get all change positions
  const getAllChangePositions = useCallback((): number[] => {
    if (!editor || !editor.state || !editor.state.doc) {
      return []
    }

    const positions: number[] = []
    editor.state.doc.descendants((node, pos) => {
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
    editor.state.doc.descendants((node, pos) => {
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

    editor.view.dispatch(tr)
  }, [editor])

  // Function to reject all changes
  const rejectAllChanges = useCallback(() => {
    if (!editor || !editor.state || !editor.view) return

    const tr = editor.state.tr
    const nodesToProcess: Array<{ node: any; pos: number }> = []

    // Collect all change nodes
    editor.state.doc.descendants((node, pos) => {
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
        tr.replaceWith(pos, pos + node.nodeSize, node.content)
      }
    })

    editor.view.dispatch(tr)
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

  // Don't render if no changes
  if (!isVisible || changeStats.totalChanges === 0) {
    return null
  }

  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 bg-white rounded-md shadow-lg border border-gray-200 p-1.5 flex items-center gap-1",
        className,
      )}
    >
      {/* Navigation buttons */}
      <Button
        onClick={goToPreviousChange}
        size="sm"
        variant="ghost"
        className="h-7 w-7 p-0 hover:bg-gray-100"
        title="Cambio anterior"
      >
        <ChevronUp className="h-4 w-4" />
      </Button>
      <Button
        onClick={goToNextChange}
        size="sm"
        variant="ghost"
        className="h-7 w-7 p-0 hover:bg-gray-100"
        title="Siguiente cambio"
      >
        <ChevronDown className="h-4 w-4" />
      </Button>
      
      {/* Change counter */}
      <div className="px-2 text-xs font-medium text-gray-600">
        {currentChangeIndex + 1}/{changeStats.totalChanges}
      </div>
      
      <div className="h-4 w-px bg-gray-200" />
      
      {/* Accept/Reject all buttons */}
      <Button
        onClick={acceptAllChanges}
        size="sm"
        variant="ghost"
        className="h-7 w-7 p-0 hover:bg-green-50 hover:text-green-700"
        title={`Aceptar todo (${changeStats.totalChanges})`}
      >
        <CheckCircle className="h-4 w-4" />
      </Button>
      <div className="h-4 w-px bg-gray-200" />
      <Button
        onClick={rejectAllChanges}
        size="sm"
        variant="ghost"
        className="h-7 w-7 p-0 hover:bg-red-50 hover:text-red-700"
        title={`Rechazar todo (${changeStats.totalChanges})`}
      >
        <XCircle className="h-4 w-4" />
      </Button>
    </div>
  )
}
