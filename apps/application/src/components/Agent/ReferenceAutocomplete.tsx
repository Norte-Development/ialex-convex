import { useState, useEffect, useRef, useMemo } from "react"
import { useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { useCase } from "@/context/CaseContext"
import { Badge } from "@/components/ui/badge"
import type { Id } from "../../../convex/_generated/dataModel"
import type {
  ReferenceAutocompleteProps,
  ParsedAtReference,
  ReferenceType
} from "./types/reference-types"

/**
 * Parses the current @ reference being typed
 */
function parseCurrentAtReference(input: string, cursorPos: number): ParsedAtReference | null {
  // Find the nearest @ before the cursor
  let atPos = -1
  for (let i = cursorPos - 1; i >= 0; i--) {
    if (input[i] === "@") {
      atPos = i
      break
    }
    // Stop if we hit whitespace or another special character
    if (/\s|[@#]/.test(input[i])) {
      break
    }
  }

  if (atPos === -1) return null

  // Extract the text after @
  const textAfterAt = input.slice(atPos + 1, cursorPos)

  // Check if it matches @type: pattern
  const typeMatch = textAfterAt.match(/^(client|document|escrito|case):(.*)$/)
  if (typeMatch) {
    return {
      type: typeMatch[1] as ReferenceType,
      query: typeMatch[2],
      startPos: atPos,
      endPos: cursorPos,
      isComplete: true,
    }
  }

  // Check if it's just @type without colon yet
  const partialTypeMatch = textAfterAt.match(/^(client|document|escrito|case)$/)
  if (partialTypeMatch) {
    return {
      type: partialTypeMatch[1] as ReferenceType,
      query: "",
      startPos: atPos,
      endPos: cursorPos,
      isComplete: false,
    }
  }

  // Check if it's a partial type
  const incompleteTypes = ["client", "document", "escrito", "case"]
  const matchingType = incompleteTypes.find((type) => type.startsWith(textAfterAt))
  if (matchingType && textAfterAt.length > 0) {
    return {
      type: null,
      query: textAfterAt,
      startPos: atPos,
      endPos: cursorPos,
      isComplete: false,
    }
  }

  // Just @ with some text that might become a type
  if (textAfterAt.length === 0 || textAfterAt.length < 10) {
    // reasonable limit
    return {
      type: null,
      query: textAfterAt,
      startPos: atPos,
      endPos: cursorPos,
      isComplete: false,
    }
  }

  return null
}

export function ReferenceAutocomplete({
  input,
  cursorPosition,
  onSelectReference,
  isVisible,
  onClose,
}: ReferenceAutocompleteProps) {
  const { caseId } = useCase()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Parse the current @ reference
  const currentRef = useMemo(() => parseCurrentAtReference(input, cursorPosition), [input, cursorPosition])

  // Get suggestions from backend
  const suggestions = useQuery(
    api.context.context.getReferencesSuggestions,
    currentRef && currentRef.isComplete
      ? {
          caseId: caseId as Id<"cases"> | undefined,
          query: currentRef.query || undefined,
          type: currentRef.type || undefined,
        }
      : "skip",
  )

  // Generate type suggestions when no specific type is provided
  const typeSuggestions = useMemo(() => {
    if (!currentRef || currentRef.isComplete) return []

         const types = [
       { type: "client", name: "Cliente", preview: "Referenciar información del cliente" },
       { type: "document", name: "Documento", preview: "Referenciar documentos del caso" },
       { type: "escrito", name: "Escrito", preview: "Referenciar escritos legales" },
       { type: "case", name: "Caso", preview: "Referenciar casos relacionados" },
     ]

    if (!currentRef.query) return types

    return types.filter((t) => t.type.toLowerCase().startsWith(currentRef.query.toLowerCase()))
  }, [currentRef])

  // Combined suggestions: either type suggestions or entity suggestions
  const allSuggestions = useMemo(() => {
    if (currentRef?.isComplete) {
      return suggestions || []
    }
    return typeSuggestions
  }, [currentRef, suggestions, typeSuggestions])

  // Reset selected index when suggestions change
  useEffect(() => {
    setSelectedIndex(0)
  }, [allSuggestions])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isVisible || !currentRef) return

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          setSelectedIndex((prev) => (prev < allSuggestions.length - 1 ? prev + 1 : 0))
          break
        case "ArrowUp":
          e.preventDefault()
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : allSuggestions.length - 1))
          break
        case "Enter":
        case "Tab":
          e.preventDefault()
          if (allSuggestions[selectedIndex]) {
            handleSelectSuggestion(allSuggestions[selectedIndex])
          }
          break
        case "Escape":
          e.preventDefault()
          onClose()
          break
        // Number keys for quick selection (1-9)
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9":
          const numIndex = parseInt(e.key) - 1
          if (numIndex < allSuggestions.length) {
            e.preventDefault()
            handleSelectSuggestion(allSuggestions[numIndex])
          }
          break
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isVisible, currentRef, allSuggestions, selectedIndex, onClose])

  const handleSelectSuggestion = (suggestion: any) => {
    if (!currentRef) return

    if (currentRef.isComplete) {
      // Entity selection - replace the query part
      const colonPos = input.lastIndexOf(":", cursorPosition)
      onSelectReference(suggestion, colonPos + 1, currentRef.endPos)
    } else {
      // Type selection - complete the type and add colon
      onSelectReference({ ...suggestion, name: `${suggestion.type}:` }, currentRef.startPos + 1, currentRef.endPos)
    }
  }

  // Don't render if no current reference or no suggestions
  if (!isVisible || !currentRef || allSuggestions.length === 0) {
    return null
  }

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 right-0 mb-1 bg-white/95 backdrop-blur-sm border border-gray-200/50 rounded-lg shadow-xl shadow-black/5 z-50 max-h-64 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100/80">
        <div className="flex items-center gap-2">
          <div className="text-xs font-medium text-gray-700">
            {currentRef.isComplete ? `@${currentRef.type}` : "Referencias"}
          </div>
          {!currentRef.isComplete && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 h-auto border-blue-200 text-blue-700 bg-blue-50">
              Tipo
            </Badge>
          )}
          {currentRef.isComplete && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 h-auto border-green-200 text-green-700 bg-green-50">
              {currentRef.type}
            </Badge>
          )}
        </div>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 h-auto bg-gray-100 text-gray-600">
          {allSuggestions.length}
        </Badge>
      </div>

      {/* Suggestions */}
      <div className="max-h-56 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300/50 scrollbar-track-transparent hover:scrollbar-thumb-gray-400/50">
        {allSuggestions.map((suggestion, index) => (
          <div
            key={currentRef.isComplete ? `${suggestion.type}-${(suggestion as any).id || index}` : suggestion.type}
            className={`
              group relative px-3 py-2.5 cursor-pointer text-sm transition-all duration-100 ease-out
              animate-in fade-in-0 slide-in-from-top-1
              ${
                index === selectedIndex
                  ? currentRef.isComplete
                    ? "bg-green-500/8 text-green-900 border-r-2 border-r-green-500 shadow-sm shadow-green-500/10"
                    : "bg-blue-500/8 text-blue-900 border-r-2 border-r-blue-500 shadow-sm shadow-blue-500/10"
                  : currentRef.isComplete
                  ? "hover:bg-green-50/80 text-gray-800 border-r-2 border-r-transparent hover:shadow-sm hover:shadow-gray-100/50"
                  : "hover:bg-blue-50/80 text-gray-800 border-r-2 border-r-transparent hover:shadow-sm hover:shadow-gray-100/50"
              }
            `}
            style={{ animationDelay: `${index * 20}ms` }}
            onClick={() => handleSelectSuggestion(suggestion)}
          >
            {/* Selection indicator */}
            {index === selectedIndex && (
              <div className={`absolute left-0 top-0 bottom-0 w-0.5 animate-pulse ${
                currentRef.isComplete ? "bg-green-500" : "bg-blue-500"
              }`} />
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Type icon - different styling for each mode */}
                {!currentRef.isComplete ? (
                  // Type selection mode - menu-like icons
                  <div className="flex-shrink-0 w-5 h-5 rounded-md bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center border border-blue-200/50">
                    <div className="text-xs font-bold text-blue-700">
                      {suggestion.type?.[0]?.toUpperCase()}
                    </div>
                  </div>
                ) : (
                  // Entity selection mode - entity-like icons
                  <div className="flex-shrink-0 w-5 h-5 rounded-md bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center border border-green-200/50">
                    <div className="text-xs font-bold text-green-700">
                      {suggestion.type?.[0]?.toUpperCase() || "E"}
                    </div>
                  </div>
                )}

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-900 truncate leading-tight">
                    {suggestion.name}
                  </div>
                  {suggestion.preview && (
                    <div className="text-xs text-gray-500 truncate leading-tight mt-0.5">
                      {suggestion.preview}
                    </div>
                  )}
                </div>
              </div>

              {/* Keyboard shortcut hint */}
              <div className="flex-shrink-0 ml-2 text-[10px] text-gray-400 font-mono">
                {index < 9 ? `${index + 1}` : index === selectedIndex ? "↵" : ""}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer with keyboard hints */}
      <div className="px-3 py-1.5 border-t border-gray-100/80 bg-gray-50/50">
        <div className="flex items-center justify-between text-[10px] text-gray-500">
          <div className="flex items-center gap-2">
            <span>↑↓ navegar</span>
            <span>1-9 seleccionar</span>
            <span>↵ {currentRef.isComplete ? "insertar" : "seleccionar tipo"}</span>
            <span>⎋ cerrar</span>
          </div>
          <div className="flex items-center gap-2">
            {!currentRef.isComplete && (
              <span className="text-blue-600 font-medium">Paso 1/2</span>
            )}
            {currentRef.isComplete && (
              <span className="text-green-600 font-medium">Paso 2/2</span>
            )}
            <span className="font-mono">
              {selectedIndex + 1}/{allSuggestions.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReferenceAutocomplete
