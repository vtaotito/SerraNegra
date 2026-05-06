"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorState } from "@/components/cockpit/DataState";

interface Props {
  children: ReactNode;
  /** Rótulo em pt-BR da área protegida (ex.: "Gráfico de vendas"). Usado para enriquecer o log e a mensagem. */
  area?: string;
  /** Fallback custom; se fornecido, substitui o ErrorState padrão. */
  fallback?: (info: { message: string; reset: () => void }) => ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class BIErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    const tag = this.props.area ? `BIErrorBoundary[${this.props.area}]` : "BIErrorBoundary";
    console.error(tag, err, info.componentStack);
  }

  private reset = () => this.setState({ hasError: false, message: "" });

  render() {
    if (this.state.hasError) {
      const message = this.props.area
        ? `${this.props.area}: ${this.state.message}`
        : this.state.message;
      if (this.props.fallback) {
        return this.props.fallback({ message, reset: this.reset });
      }
      return (
        <div className="rounded-xl border border-cockpit-border bg-white p-6">
          <ErrorState message={message} onRetry={this.reset} />
        </div>
      );
    }
    return this.props.children;
  }
}
