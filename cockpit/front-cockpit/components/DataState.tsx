"use client";

import { Loader2, AlertTriangle, RefreshCw } from "lucide-react";

export function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-cockpit-border bg-cockpit-surface p-5 h-20">
            <div className="h-2.5 w-20 bg-cockpit-border rounded mb-3" />
            <div className="h-5 w-28 bg-cockpit-border rounded" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-cockpit-border bg-cockpit-surface p-6">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4 py-3">
            <div className="h-3 w-24 bg-cockpit-border rounded" />
            <div className="h-3 flex-1 bg-cockpit-border rounded" />
            <div className="h-3 w-20 bg-cockpit-border rounded" />
            <div className="h-3 w-16 bg-cockpit-border rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function LoadingOverlay() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-cockpit-accent animate-spin" />
        <p className="text-sm text-cockpit-muted">Carregando dados do SAP B1...</p>
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="flex flex-col items-center gap-4 text-center max-w-md">
        <AlertTriangle className="w-10 h-10 text-cockpit-gold" />
        <div>
          <p className="text-gray-900 font-medium mb-1">Erro ao carregar dados</p>
          <p className="text-sm text-cockpit-muted">{message}</p>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cockpit-accent/20 text-cockpit-accent text-sm font-medium hover:bg-cockpit-accent/30 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Tentar novamente
          </button>
        )}
      </div>
    </div>
  );
}
