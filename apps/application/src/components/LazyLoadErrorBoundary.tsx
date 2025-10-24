import { Component, ReactNode, ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary specifically for lazy-loaded routes.
 * Catches chunk loading errors and reloads the page.
 */
export class LazyLoadErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorMessage = error.message || String(error);
    
    // Check if it's a chunk loading error
    if (
      errorMessage.includes('Failed to fetch dynamically imported module') ||
      errorMessage.includes('Loading chunk') ||
      errorMessage.includes('ChunkLoadError') ||
      errorMessage.includes('Importing a module script failed')
    ) {
      console.warn('[LazyLoadErrorBoundary] Chunk load error detected, reloading...', {
        error: errorMessage,
        componentStack: errorInfo.componentStack,
      });
      
      // Reload the page to get fresh chunks
      window.location.reload();
    } else {
      console.error('[LazyLoadErrorBoundary] Unexpected error:', {
        error: errorMessage,
        componentStack: errorInfo.componentStack,
      });
    }
  }

  render() {
    if (this.state.hasError) {
      // For chunk errors, the page is reloading, so this won't be shown long
      // For other errors, show a fallback
      return (
        this.props.fallback || (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Cargando...</p>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
