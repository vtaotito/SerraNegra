"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorState } from "@/components/cockpit/DataState";

interface Props {
  children: ReactNode;
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
    console.error("BIErrorBoundary", err, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-cockpit-border bg-white p-6">
          <ErrorState
            message={this.state.message}
            onRetry={() => this.setState({ hasError: false, message: "" })}
          />
        </div>
      );
    }
    return this.props.children;
  }
}
