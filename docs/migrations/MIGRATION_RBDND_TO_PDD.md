# Migración de React Beautiful DnD a Pragmatic Drag and Drop

## Resumen
Se ha completado la migración de `LibraryPage.tsx` y sus componentes relacionados de **react-beautiful-dnd (RBDND)** a **Pragmatic Drag and Drop (PDD)** de Atlassian.

## Archivos Modificados

### 1. **DocumentCard.tsx**
**Cambios principales:**
- ✅ Eliminado: `import { Draggable } from "react-beautiful-dnd"`
- ✅ Agregado: `import { draggable } from "@atlaskit/pragmatic-drag-and-drop/element/adapter"`
- ✅ Reemplazado: Componente `<Draggable>` por hook `draggable()` con `useEffect`
- ✅ Agregado: Prop `currentFolderId` para pasar contexto de carpeta actual
- ✅ Implementado: Estado `isDragging` local para feedback visual

**Estructura nueva:**
```typescript
// Antes: <Draggable draggableId={...} index={...}>
// Después: useEffect(() => draggable({ element, getInitialData, dragHandle }))

const cardRef = useRef<HTMLDivElement>(null);
const dragHandleRef = useRef<HTMLElement>(null);
const [isDragging, setIsDragging] = useState(false);

useEffect(() => {
  return draggable({
    element: cardRef.current,
    onDragStart: () => setIsDragging(true),
    onDrop: () => setIsDragging(false),
    getInitialData: () => ({
      documentId: document._id,
      index,
      type: "LIBRARY_DOCUMENT",
      currentFolderId, // ← Nuevo: contexto de carpeta
    }),
    dragHandle: dragHandleRef.current ?? undefined,
  });
}, [document._id, index, isDragDisabled, currentFolderId]);
```

### 2. **LibraryGrid.tsx**
**Cambios principales:**
- ✅ Eliminado: `import { DragDropContext, Droppable, DropResult } from "react-beautiful-dnd"`
- ✅ Agregado: `import { dropTargetForElements, monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter"`
- ✅ Reemplazado: `DragDropContext` + `Droppable` por `monitorForElements` + `dropTargetForElements`
- ✅ Eliminado: Lógica de `isReady` (no necesaria en PDD)
- ✅ Implementado: Estado `isDraggingOver` para feedback visual

**Estructura nueva:**

#### Monitor Global (reemplaza DragDropContext):
```typescript
useEffect(() => {
  return monitorForElements({
    onDragStart: () => {
      document.body.classList.add("overflow-x-hidden");
    },
    onDrop: async (args) => {
      const { source, location } = args;
      if (source.data.type !== "LIBRARY_DOCUMENT") return;
      
      const dropTargetData = location.current.dropTargets[0]?.data;
      const sourceDocumentId = source.data.documentId;
      const targetFolderId = dropTargetData?.folderId;
      
      // Lógica de movimiento de documento
      await moveDocument({ documentId: sourceDocumentId, newFolderId: targetFolderId });
    },
  });
}, [moveDocument]);
```

#### Drop Target (reemplaza Droppable):
```typescript
useEffect(() => {
  if (!dropZoneRef.current) return;
  
  return dropTargetForElements({
    element: dropZoneRef.current,
    onDragEnter: () => setIsDraggingOver(true),
    onDragLeave: () => setIsDraggingOver(false),
    onDrop: () => setIsDraggingOver(false),
    getData: () => ({
      folderId: currentFolderId,
      type: "LIBRARY_DOCUMENT_DROP_ZONE",
    }),
  });
}, [currentFolderId]);
```

#### JSX (reemplaza render props):
```typescript
// Antes: <Droppable droppableId={...}>{(provided, snapshot) => (...)}</Droppable>
// Después: <div ref={dropZoneRef} className={isDraggingOver ? "..." : ""}>

<div
  ref={dropZoneRef}
  className={`space-y-2 rounded-lg transition-all duration-200 ${
    isDraggingOver
      ? "bg-blue-50/80 border-2 border-blue-400 border-dashed p-4 shadow-inner"
      : ""
  }`}
>
  {filteredDocuments.map((doc, index) => (
    <DocumentCard
      key={doc._id}
      document={doc}
      // ... props
      currentFolderId={currentFolderId}
    />
  ))}
</div>
```

## Mapeo de Conceptos

| RBDND | PDD | Ubicación |
|-------|-----|-----------|
| `DragDropContext` | `monitorForElements` | LibraryGrid.tsx (global) |
| `Droppable` | `dropTargetForElements` | LibraryGrid.tsx (por carpeta) |
| `Draggable` | `draggable()` | DocumentCard.tsx (por documento) |
| `onDragEnd(result)` | `onDrop(args)` | monitorForElements callback |
| `provided.innerRef` | `ref={dropZoneRef}` | JSX directo |
| `snapshot.isDragging` | `isDragging` state | useState local |
| `snapshot.isDraggingOver` | `isDraggingOver` state | useState local |
| `provided.placeholder` | No necesario | PDD maneja automáticamente |

## Flujo de Datos

### Antes (RBDND):
```
DragDropContext
  ├─ onDragStart() → manejo global
  ├─ onDragEnd(result) → lógica de movimiento
  └─ Droppable (render props)
      └─ Draggable (render props)
          └─ DocumentCard
```

### Después (PDD):
```
monitorForElements (global)
  ├─ onDragStart() → manejo global
  └─ onDrop(args) → lógica de movimiento
      ├─ source.data (del draggable)
      └─ location.current.dropTargets[0].data (del dropTargetForElements)

dropTargetForElements (por carpeta)
  ├─ onDragEnter/Leave/Drop → feedback visual
  └─ getData() → proporciona folderId

draggable (por documento)
  ├─ getInitialData() → proporciona documentId, currentFolderId
  └─ dragHandle → elemento para arrastrar
```

## Ventajas de PDD

✅ **Headless**: Mayor control sobre UI/UX
✅ **Modular**: APIs independientes sin contexto global
✅ **Performante**: Menos re-renders innecesarios
✅ **Flexible**: Fácil de personalizar comportamientos
✅ **Mantenido**: Soporte activo de Atlassian
✅ **TypeScript**: Tipado completo

## Próximos Pasos

1. ✅ Migración completada en LibraryPage
2. ⏳ Probar drag & drop en navegador (ambas vistas: list y grid)
3. ⏳ Verificar autoscroll (usar `@atlaskit/pragmatic-drag-and-drop-react-beautiful-dnd-autoscroll` si es necesario)
4. ⏳ Migrar otros componentes con drag & drop (FolderTree.tsx, etc.)
5. ⏳ Eliminar dependencia `react-beautiful-dnd` del package.json

## Testing

Para verificar que todo funciona correctamente:

1. Navegar a `/biblioteca`
2. Cambiar entre vista **list** y **grid**
3. Arrastrar documentos entre carpetas
4. Verificar que el feedback visual (color de fondo) aparece al arrastrar
5. Verificar que los documentos se mueven correctamente
6. Verificar que no hay errores en la consola

## Notas Técnicas

- **PDD es headless**: No proporciona placeholder automático, pero tampoco es necesario en este caso
- **Datos en getInitialData**: Se cargan al iniciar el drag, no en tiempo de render
- **Drop targets**: Pueden ser dinámicos (se actualizan con `currentFolderId`)
- **Cleanup**: Los hooks de PDD retornan funciones de cleanup automáticamente
- **Performance**: Sin `isReady` state, el componente es más simple y eficiente
