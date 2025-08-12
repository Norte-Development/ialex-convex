import { Component } from "react";
import { PermissionError } from "@/types/errors";
import { AccessDeniedPage } from "./AccessDeniedPage";

interface State {
  hasError: boolean;
  error?: PermissionError;
}

export class PermissionErrorBoundary extends Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State | null {
    if (error instanceof PermissionError) {
      return { hasError: true, error };
    }
    
    // Fallback for string-based error detection
    if (error.message.includes("Unauthorized") || error.message.includes("No access")) {
      return { hasError: true, error: new PermissionError("FORBIDDEN", error.message) };
    }
    
    return null;
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error for analytics
    console.error("Permission error caught:", error, errorInfo);
    
    // Send to analytics service
    if (error instanceof PermissionError) {
      // analytics.track('permission_error', { code: error.code, status: error.status });
    }
  }

  render() {
    if (this.state.hasError) {
      return <AccessDeniedPage error={this.state.error} />;
    }

    return this.props.children;
  }
} 