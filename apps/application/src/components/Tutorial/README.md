# Sistema de Tutorial Interactivo - iAlex

## 📚 Descripción General

El sistema de tutorial interactivo de iAlex proporciona una experiencia guiada paso a paso para nuevos usuarios. El tutorial es:

- **Escalable**: Fácil agregar o quitar pasos
- **Por Páginas**: Organizado por secciones de la aplicación
- **Persistente**: El progreso se guarda en la base de datos
- **Visual**: Overlay con highlights y tooltips
- **Flexible**: Permite saltar páginas o pausar

## 🏗️ Arquitectura

### 1. Base de Datos (Convex)

**Schema**: `tutorialProgress`

- Almacena el progreso de cada usuario
- Campos: pasos completados, página actual, estado activo, etc.

**Funciones** (`convex/functions/tutorial.ts`):

- `getTutorialProgress`: Obtiene el progreso del usuario
- `initializeTutorial`: Inicia el tutorial
- `updateCurrentStep`: Actualiza el paso actual
- `completeStep`: Marca un paso como completado
- `skipPage`: Salta una página completa
- `completeTutorial`: Finaliza el tutorial
- `dismissTutorial`: Oculta el tutorial temporalmente
- `reactivateTutorial`: Reactiva el tutorial

### 2. Configuración (`src/config/tutorialConfig.ts`)

Define todos los pasos del tutorial organizados por página:

```typescript
{
  page: 'home',
  title: 'Bienvenido a iAlex',
  steps: [
    {
      id: 'home-welcome',
      title: '¡Bienvenido!',
      content: 'Descripción del paso...',
      target: '[data-tutorial="elemento"]', // Selector CSS
      placement: 'bottom', // Posición del card
      highlightPadding: 8,
      allowClickThrough: false,
    },
    // ... más pasos
  ],
}
```

**Tipos de placement**:

- `top`, `bottom`, `left`, `right`
- `top-left`, `top-right`, `bottom-left`, `bottom-right`
- `center` (sin target)

### 3. Contexto (`src/context/TutorialContext.tsx`)

Proporciona el estado global del tutorial y métodos para controlarlo:

```typescript
const {
  isActive, // ¿Está el tutorial activo?
  isCompleted, // ¿Está completado?
  currentStep, // Paso actual
  currentPage, // Página actual
  completedSteps, // Array de IDs de pasos completados
  currentStepNumber, // Número del paso (1-indexed)
  totalSteps, // Total de pasos
  progress, // Porcentaje de progreso

  // Métodos
  startTutorial,
  nextStep,
  previousStep,
  goToStep,
  skipPage,
  completeTutorial,
  dismissTutorial,
  reactivateTutorial,
  isStepCompleted,
  canGoNext,
  canGoPrevious,
} = useTutorial();
```

### 4. Componentes UI

#### `TutorialOverlay`

- Renderiza el overlay completo con backdrop
- Destaca elementos específicos con SVG mask
- Muestra el card del tutorial
- Controles de navegación

#### `TutorialControls`

- `TutorialTrigger`: Botón para iniciar/reiniciar tutorial
- `TutorialProgress`: Indicador de progreso
- `TutorialWelcomeDialog`: Dialog de bienvenida

## 📖 Guía de Uso

### Iniciar el Tutorial

```tsx
import { useTutorial } from "@/context/TutorialContext";
import { TutorialTrigger } from "@/components/Tutorial/TutorialControls";

function MyComponent() {
  const { startTutorial } = useTutorial();

  return (
    <div>
      {/* Opción 1: Usar el componente de trigger */}
      <TutorialTrigger />

      {/* Opción 2: Iniciar manualmente */}
      <button onClick={() => startTutorial("home")}>Comenzar Tutorial</button>
    </div>
  );
}
```

### Marcar Elementos para el Tutorial

Usa el atributo `data-tutorial` para identificar elementos:

```tsx
<button data-tutorial="create-case">
  Crear Caso
</button>

<div data-tutorial="main-sidebar">
  {/* Sidebar content */}
</div>
```

### Agregar Nuevos Pasos

1. Edita `src/config/tutorialConfig.ts`
2. Agrega el paso a la página correspondiente:

```typescript
{
  page: 'cases',
  steps: [
    // ... pasos existentes
    {
      id: 'cases-export',
      title: 'Exportar Casos',
      content: 'Puedes exportar tus casos a PDF o Excel.',
      target: '[data-tutorial="export-cases"]',
      placement: 'bottom',
      highlightPadding: 8,
    },
  ],
}
```

### Agregar Nueva Página al Tutorial

```typescript
export const tutorialConfig: TutorialPage[] = [
  // ... páginas existentes
  {
    page: "new-page",
    title: "Nueva Funcionalidad",
    description: "Aprende sobre esta nueva función",
    steps: [
      {
        id: "new-page-intro",
        title: "Introducción",
        content: "Bienvenido a la nueva funcionalidad...",
        placement: "center",
      },
      // ... más pasos
    ],
  },
];
```

### Actualizar Mapeo de Rutas

En `TutorialContext.tsx`, actualiza `getRouteForPage`:

```typescript
const getRouteForPage = (page: string): string | null => {
  switch (page) {
    case "home":
      return "/";
    case "cases":
      return "/cases";
    case "new-page":
      return "/new-page"; // ← Agregar aquí
    default:
      return null;
  }
};
```

### Mostrar Progreso del Tutorial

```tsx
import { TutorialProgress } from "@/components/Tutorial/TutorialControls";

function Sidebar() {
  return (
    <div>
      <TutorialProgress />
      {/* Resto del contenido */}
    </div>
  );
}
```

### Dialog de Bienvenida para Nuevos Usuarios

```tsx
import { TutorialWelcomeDialog } from "@/components/Tutorial/TutorialControls";
import { useTutorial } from "@/context/TutorialContext";
import { useState, useEffect } from "react";

function WelcomeScreen() {
  const [showWelcome, setShowWelcome] = useState(false);
  const { startTutorial } = useTutorial();

  useEffect(() => {
    // Mostrar a usuarios nuevos que completaron onboarding
    const hasSeenTutorial = localStorage.getItem("has-seen-tutorial");
    if (!hasSeenTutorial) {
      setShowWelcome(true);
    }
  }, []);

  const handleStart = () => {
    localStorage.setItem("has-seen-tutorial", "true");
    setShowWelcome(false);
    startTutorial("home");
  };

  const handleClose = () => {
    localStorage.setItem("has-seen-tutorial", "true");
    setShowWelcome(false);
  };

  return (
    <TutorialWelcomeDialog
      open={showWelcome}
      onStart={handleStart}
      onClose={handleClose}
    />
  );
}
```

## 🎨 Personalización

### Estilos del Overlay

El overlay usa clases de Tailwind. Para personalizar:

```tsx
// En TutorialOverlay.tsx
<div className="bg-white rounded-lg shadow-2xl ...">
  {/* Cambiar colores, bordes, etc. */}
</div>
```

### Colores del Highlight

```tsx
// En TutorialBackdrop
<rect
  stroke="#4F46E5" // ← Cambiar color aquí
  strokeWidth="2"
  className="animate-pulse"
/>
```

### Animaciones

El card usa animaciones de Tailwind:

- `animate-in`
- `fade-in-50`
- `slide-in-from-bottom-5`

## 🔧 Utilidades Disponibles

```typescript
import {
  getPageSteps, // Obtener pasos de una página
  getStepById, // Obtener un paso por ID
  getPageForStep, // Obtener la página de un paso
  getNextStep, // Obtener siguiente paso
  getPreviousStep, // Obtener paso anterior
  getTotalSteps, // Total de pasos
  getStepNumber, // Número de un paso
  getAllPages, // Todas las páginas
  hasPageTutorial, // ¿Tiene tutorial esta página?
} from "@/config/tutorialConfig";
```

## 📊 Seguimiento de Progreso

El progreso se guarda automáticamente en la base de datos. Puedes consultarlo:

```tsx
const { completedSteps, progress, currentStepNumber } = useTutorial();

console.log(`Pasos completados: ${completedSteps.length}`);
console.log(`Progreso: ${progress}%`);
console.log(`Paso actual: ${currentStepNumber}`);
```

## 🐛 Debugging

### Ver estado del tutorial:

```tsx
const tutorial = useTutorial();
console.log("Tutorial state:", tutorial);
```

### Verificar que un elemento es visible:

```tsx
const element = document.querySelector('[data-tutorial="my-element"]');
console.log("Element:", element);
console.log("Rect:", element?.getBoundingClientRect());
```

### Reiniciar tutorial para testing:

```tsx
const { startTutorial } = useTutorial();

// Reiniciar desde el principio
startTutorial("home");
```

## ✅ Checklist de Implementación

- [x] Schema en base de datos
- [x] Funciones de Convex
- [x] Configuración de pasos
- [x] Contexto de React
- [x] Componente de overlay
- [x] Componentes de controles
- [x] Integración en App.tsx
- [ ] Agregar atributos `data-tutorial` en elementos
- [ ] Personalizar pasos para tu aplicación
- [ ] Agregar dialog de bienvenida
- [ ] Testing completo

## 🚀 Próximos Pasos

1. **Agregar atributos `data-tutorial`** en los elementos de tu UI
2. **Personalizar los pasos** en `tutorialConfig.ts` según tus necesidades
3. **Agregar el dialog de bienvenida** para nuevos usuarios
4. **Testear el flujo completo** navegando por todas las páginas

## 💡 Tips

- Mantén los pasos cortos y concisos (máx. 2-3 líneas)
- Usa `placement: 'center'` para pasos introductorios
- Agrupa pasos relacionados en la misma página
- Permite `allowClickThrough: true` si el usuario debe interactuar
- Usa `highlightPadding` para dar más espacio visual
- Considera el flujo natural de navegación del usuario

## 📝 Ejemplo Completo

Ver `src/config/tutorialConfig.ts` para ejemplos de configuración de páginas:

- Home
- Cases
- Case Detail
- Clients
- Library
- Database

¡El sistema está listo para usar! Solo necesitas personalizar los pasos y agregar los atributos `data-tutorial` en tu UI.
