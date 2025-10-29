/**
 * Tutorial Steps Configuration
 *
 * This file defines all tutorial steps organized by page.
 * Each step contains:
 * - id: Unique identifier for the step
 * - title: Title shown in the tutorial card
 * - content: Description/explanation text
 * - target: CSS selector for the element to highlight (optional)
 * - position: Where to position the tutorial card relative to target
 * - action: Optional action to perform (e.g., navigate, open modal)
 * - placement: Fine-tuned positioning (top, bottom, left, right, center)
 */

export interface TutorialStep {
  id: string;
  title: string;
  content: string;
  target?: string; // CSS selector
  position?: {
    top?: string;
    left?: string;
    right?: string;
    bottom?: string;
    transform?: string;
  };
  placement?:
    | "top"
    | "bottom"
    | "left"
    | "right"
    | "center"
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right";
  action?: {
    type: "navigate" | "click" | "highlight" | "custom";
    value?: string;
    handler?: () => void;
  };
  highlightPadding?: number; // Extra padding around the highlighted element
  allowClickThrough?: boolean; // Allow clicking the highlighted element
  autoAdvanceOn?: {
    event: "click" | "open" | "custom";
    selector?: string; // CSS selector to watch
    customEvent?: string; // Custom event name
  };
}

export interface TutorialPage {
  page: string;
  title: string;
  description?: string;
  steps: TutorialStep[];
  prerequisite?: string; // Page that must be completed before this one
}

/**
 * Complete tutorial configuration
 * Organized by page/route
 */
export const tutorialConfig: TutorialPage[] = [
  // HOME PAGE
  {
    page: "home",
    title: "Bienvenido a iAlex",
    description: "Comencemos con un recorrido por la página principal",
    steps: [
      {
        id: "home-welcome",
        title: "¡Bienvenido a iAlex!",
        content:
          "iAlex es tu asistente legal potenciado por IA. Te ayudaremos a gestionar casos, documentos y mucho más.",
        placement: "center",
      },
      {
        id: "home-chat",
        title: "Chat con tu Asistente Legal",
        content:
          "Aquí puedes hacer preguntas legales, obtener ayuda con documentos y mucho más. El chat aprende del contexto de tus casos.",
        target: '[data-tutorial="home-chat"]',
        placement: "right",
        highlightPadding: 4,
      },
      {
        id: "home-menu",
        title: "Navegación Principal",
        content:
          "Desde aquí puedes acceder a todas las secciones: Casos, Clientes, Documentos, Escritos y más.",
        target: '[data-tutorial="home-menu"]',
        placement: "right",
        highlightPadding: 10,
        action: {
          type: "custom",
          handler: () => {
            // Abrir el menú automáticamente si está cerrado
            const menuButton = document.querySelector(
              '[data-tutorial="home-menu"]',
            );
            if (menuButton) {
              const isMenuOpen =
                menuButton.getAttribute("data-state") === "open";
              if (!isMenuOpen) {
                (menuButton as HTMLElement).click();
              }
            }
          },
        },
      },
      {
        id: "home-cases-nav",
        title: "Gestión de Casos",
        content:
          "Los casos son el corazón de iAlex. Haz clic en siguiente para ir a la sección de casos.",
        target: '[data-tutorial="nav-cases"]',
        placement: "right",
        highlightPadding: 4,
        allowClickThrough: true,
      },
    ],
  },

  // CASES PAGE
  {
    page: "casos",
    title: "Gestión de Casos",
    description: "Crea tu primer caso legal",
    steps: [
      {
        id: "cases-welcome",
        title: "Tus Casos Legales",
        content:
          "Aquí encontrarás todos tus casos organizados. Cada caso puede contener documentos, escritos, clientes y más.",
        placement: "center",
        action: {
          type: "navigate",
          value: "/casos",
        },
      },
      {
        id: "cases-create-button",
        title: "Crear tu Primer Caso",
        content:
          "Haz clic en este botón para abrir el formulario de creación de caso.",
        target: '[data-tutorial="create-case"]',
        placement: "bottom",
        highlightPadding: 8,
        allowClickThrough: true,
        autoAdvanceOn: {
          event: "click",
          selector: '[data-tutorial="create-case"]',
        },
      },
      {
        id: "cases-form-title",
        title: "Título del Caso",
        content:
          'Ingresa un título para tu caso, por ejemplo "Mi Primer Caso de Prueba".',
        target: '[data-tutorial="case-form-title"]',
        placement: "bottom",
        highlightPadding: 8,
        allowClickThrough: true,
      },
      {
        id: "cases-form-submit",
        title: "Crear el Caso",
        content:
          "Haz clic en el botón de crear para guardar tu caso. Una vez creado, iremos automáticamente a la vista detallada.",
        target: '[data-tutorial="case-form-submit"]',
        placement: "bottom",
        highlightPadding: 8,
        allowClickThrough: true,
        autoAdvanceOn: {
          event: "custom",
          customEvent: "tutorial:caseCreated",
        },
      },
    ],
  },

  // CASE DETAIL PAGE
  {
    page: "caso/:id", // Matches any case detail route like casos/abc123
    title: "Vista de Caso",
    description: "Explora todas las herramientas disponibles en un caso",
    prerequisite: "casos",
    steps: [
      {
        id: "case-detail-welcome",
        title: "¡Caso Creado!",
        content:
          "Perfecto, ahora estás en la vista detallada de tu caso. Aquí encontrarás todas las herramientas: documentos, escritos, clientes, chat con IA y más.",
        placement: "center",
      },
      {
        id: "case-detail-info",
        title: "Información del Caso",
        content:
          "Detalles principales del caso: estado, prioridad, fechas y descripción.",
        target: '[data-tutorial="case-info"]',
        placement: "bottom",
        highlightPadding: 2,
      },
      {
        id: "case-detail-tabs",
        title: "Secciones del Caso",
        content:
          "Navega entre las diferentes secciones: Documentos, Escritos, Clientes, Base de Datos Legal, y más.",
        target: '[data-tutorial="case-tabs"]',
        placement: "bottom",
        highlightPadding: 8,
      },
      {
        id: "case-detail-documents",
        title: "Documentos del Caso",
        content:
          "Todos los documentos relacionados con este caso. Puedes subirlos, organizarlos en carpetas y editarlos.",
        target: '[data-tutorial="case-documents"]',
        placement: "bottom",
        highlightPadding: 8,
        action: {
          type: "navigate",
          value: "./documentos",
        },
      },
      {
        id: "case-detail-escritos",
        title: "Escritos Legales",
        content:
          "Crea y edita escritos legales con ayuda de IA. El editor es potente y fácil de usar.",
        target: '[data-tutorial="case-escritos"]',
        placement: "bottom",
        highlightPadding: 8,
        action: {
          type: "navigate",
          value: "escritos",
        },
      },
      {
        id: "case-sidebar",
        title: "Barra Lateral del Caso",
        content:
          "Desde aca tambien podes acceder a los documentos, escritos y datos de este caso.",
        target: '[data-tutorial="case-sidebar"]',
        placement: "right",
        highlightPadding: 8,
      },
      {
        id: "case-detail-chat",
        title: "Chat Contextual del Caso",
        content:
          "Este chat tiene acceso a todos los documentos y datos de este caso específico. Pregunta lo que necesites.",
        target: '[data-tutorial="case-chat"]',
        placement: "left",
        highlightPadding: 8,
      },
    ],
  },

  // CLIENTS PAGE
  {
    page: "clientes",
    title: "Gestión de Clientes",
    description: "Aprende a gestionar tus clientes",
    steps: [
      {
        id: "clients-welcome",
        title: "Gestión de Clientes",
        content:
          "Aquí administras tu cartera de clientes: personas físicas, empresas y sus datos de contacto.",
        placement: "center",
        action: {
          type: "navigate",
          value: "/clientes",
        },
      },
      {
        id: "clients-search",
        title: "Buscar Clientes",
        content:
          "Usa este buscador para encontrar rápidamente clientes por nombre, DNI, CUIT o email.",
        target: '[data-tutorial="clients-search"]',
        placement: "bottom",
        highlightPadding: 8,
      },
      {
        id: "clients-create",
        title: "Agregar Nuevo Cliente",
        content:
          "Haz clic aquí para crear un nuevo cliente con toda su información: datos personales, contacto y documentos.",
        target: '[data-tutorial="create-client"]',
        placement: "bottom",
        highlightPadding: 8,
      },
    ],
  },

  // BIBLIOTECA PAGE
  {
    page: "biblioteca",
    title: "Biblioteca de Documentos",
    description: "Tu repositorio de plantillas y documentos",
    steps: [
      {
        id: "library-welcome",
        title: "Biblioteca de Documentos",
        content:
          "Aquí guardas plantillas, documentos modelo y recursos legales que puedes reutilizar en múltiples casos.",
        placement: "center",
        action: {
          type: "navigate",
          value: "/biblioteca",
        },
      },
      {
        id: "library-scopes",
        title: "Niveles de Alcance",
        content:
          "Organiza documentos en tres niveles: Personal (solo tú), Equipo (tu firma), o compartidos con todos.",
        target: '[data-tutorial="library-scopes"]',
        placement: "bottom",
        highlightPadding: 8,
      },
      {
        id: "library-upload",
        title: "Subir Documentos",
        content:
          "Haz clic aquí para subir plantillas, modelos de escritos o cualquier documento que quieras reutilizar.",
        target: '[data-tutorial="library-upload"]',
        placement: "bottom",
        highlightPadding: 8,
      },
      {
        id: "library-folders",
        title: "Organizar en Carpetas",
        content:
          "Crea carpetas y subcarpetas para mantener tu biblioteca organizada por tema o tipo de documento.",
        target: '[data-tutorial="library-folders"]',
        placement: "bottom",
        highlightPadding: 8,
      },
    ],
  },

  // DATABASE PAGE
  {
    page: "base-de-datos",
    title: "Base de Datos Legal",
    description: "Accede a jurisprudencia y legislación",
    steps: [
      {
        id: "database-welcome",
        title: "Base de Datos Legal",
        content:
          "Accede a una amplia base de jurisprudencia y legislación argentina. Busca fallos judiciales, leyes, decretos y más.",
        placement: "center",
        action: {
          type: "navigate",
          value: "/base-de-datos",
        },
      },
      {
        id: "database-search",
        title: "Búsqueda Semántica",
        content:
          "Busca documentos legales usando lenguaje natural. La IA encuentra resultados relevantes aunque no uses las palabras exactas.",
        target: '[data-tutorial="database-search"]',
        placement: "bottom",
        highlightPadding: 8,
      },
      {
        id: "database-filters",
        title: "Filtros Avanzados",
        content:
          "Refina tu búsqueda por jurisdicción, fecha, tribunal, estado y más. Combina múltiples filtros para resultados precisos.",
        target: '[data-tutorial="database-filters"]',
        placement: "top",
        highlightPadding: 8,
      },
      {
        id: "database-results",
        title: "Resultados y Exportación",
        content:
          "Haz clic en cualquier documento para verlo completo. Puedes agregarlo directamente a tus casos o exportarlo.",
        target: '[data-tutorial="database-results"]',
        placement: "top",
        highlightPadding: 8,
      },
      {
        id: "database-complete",
        title: "¡Tutorial Completado!",
        content:
          "Has completado el recorrido por iAlex. Ahora estás listo para gestionar tus casos legales con todas las herramientas disponibles. ¡Éxito!",
        placement: "center",
        action: {
          type: "navigate",
          value: "/",
        },
      },
    ],
  },
];

/**
 * Get all steps for a specific page
 */
export function getPageSteps(page: string): TutorialStep[] | undefined {
  const pageConfig = tutorialConfig.find((p) => p.page === page);
  return pageConfig?.steps;
}

/**
 * Get a specific step by ID
 */
export function getStepById(stepId: string): TutorialStep | undefined {
  for (const page of tutorialConfig) {
    const step = page.steps.find((s) => s.id === stepId);
    if (step) return step;
  }
  return undefined;
}

/**
 * Get the page that contains a specific step
 */
export function getPageForStep(stepId: string): TutorialPage | undefined {
  return tutorialConfig.find((page) =>
    page.steps.some((step) => step.id === stepId),
  );
}

/**
 * Get the next step in the tutorial flow
 */
export function getNextStep(
  currentStepId: string,
): { step: TutorialStep; page: TutorialPage } | undefined {
  // Find the page containing the current step
  const currentPageIndex = tutorialConfig.findIndex((page) =>
    page.steps.some((step) => step.id === currentStepId),
  );

  if (currentPageIndex === -1) return undefined;

  const currentPage = tutorialConfig[currentPageIndex];
  const currentStepIndex = currentPage.steps.findIndex(
    (step) => step.id === currentStepId,
  );

  // Try to get the next step in the same page
  if (currentStepIndex < currentPage.steps.length - 1) {
    return {
      step: currentPage.steps[currentStepIndex + 1],
      page: currentPage,
    };
  }

  // Try to get the first step of the next page
  if (currentPageIndex < tutorialConfig.length - 1) {
    const nextPage = tutorialConfig[currentPageIndex + 1];
    return {
      step: nextPage.steps[0],
      page: nextPage,
    };
  }

  // No more steps
  return undefined;
}

/**
 * Get the previous step in the tutorial flow
 */
export function getPreviousStep(
  currentStepId: string,
): { step: TutorialStep; page: TutorialPage } | undefined {
  // Find the page containing the current step
  const currentPageIndex = tutorialConfig.findIndex((page) =>
    page.steps.some((step) => step.id === currentStepId),
  );

  if (currentPageIndex === -1) return undefined;

  const currentPage = tutorialConfig[currentPageIndex];
  const currentStepIndex = currentPage.steps.findIndex(
    (step) => step.id === currentStepId,
  );

  // Try to get the previous step in the same page
  if (currentStepIndex > 0) {
    return {
      step: currentPage.steps[currentStepIndex - 1],
      page: currentPage,
    };
  }

  // Try to get the last step of the previous page
  if (currentPageIndex > 0) {
    const prevPage = tutorialConfig[currentPageIndex - 1];
    return {
      step: prevPage.steps[prevPage.steps.length - 1],
      page: prevPage,
    };
  }

  // No previous steps
  return undefined;
}

/**
 * Get total number of steps
 */
export function getTotalSteps(): number {
  return tutorialConfig.reduce((total, page) => total + page.steps.length, 0);
}

/**
 * Get the step number (1-indexed) in the entire tutorial flow
 */
export function getStepNumber(stepId: string): number | undefined {
  let count = 0;
  for (const page of tutorialConfig) {
    for (const step of page.steps) {
      count++;
      if (step.id === stepId) return count;
    }
  }
  return undefined;
}

/**
 * Get all page names in order
 */
export function getAllPages(): string[] {
  return tutorialConfig.map((page) => page.page);
}

/**
 * Check if a page has tutorial steps
 */
export function hasPageTutorial(page: string): boolean {
  return tutorialConfig.some((p) => p.page === page);
}
