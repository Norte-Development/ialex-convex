import { Component, ReactNode, ErrorInfo } from "react";

type LocalErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onError?: (error: Error, info: ErrorInfo) => void;
  onReset?: () => void;
  resetKeys?: unknown[];
};

type LocalErrorBoundaryState = {
  error: Error | null;
};

/**
 * Local error boundary component for isolating errors in specific parts of the app.
 * When an error occurs, only the wrapped component tree is remounted, preserving
 * state in the rest of the application.
 * 
 * Useful for protecting against browser extension DOM modifications that cause React errors.
 */
export class LocalErrorBoundary extends Component<
  LocalErrorBoundaryProps,
  LocalErrorBoundaryState
> {
  constructor(props: LocalErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): LocalErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  componentDidUpdate(prevProps: LocalErrorBoundaryProps) {
    const { resetKeys } = this.props;
    if (this.state.error && resetKeys && prevProps.resetKeys) {
      const changed =
        resetKeys.length !== prevProps.resetKeys.length ||
        resetKeys.some((v, i) => !Object.is(v, prevProps.resetKeys![i]));
      if (changed) {
        this.reset();
      }
    }
  }

  reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    const { error } = this.state;
    if (error) {
      const { fallback } = this.props;
      if (typeof fallback === "function") {
        return fallback(error, this.reset);
      }
      return (
        fallback ?? (
          <div
            role="alert"
            className="bg-red-50 border border-red-200 rounded-md p-4"
          >
            <p className="text-sm text-red-800 mb-2">
              Ocurrió un error inesperado en esta sección.
            </p>
            <button
              type="button"
              onClick={this.reset}
              className="text-sm text-red-600 hover:text-red-800 underline"
            >
              Reintentar
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

