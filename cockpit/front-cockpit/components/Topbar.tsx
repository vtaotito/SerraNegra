"use client";

import { Calendar, RefreshCw, Search, Menu } from "lucide-react";

interface TopbarProps {
  onMenuClick?: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  return (
    <header className="h-14 border-b border-cockpit-border bg-cockpit-surface/80 backdrop-blur flex items-center justify-between px-4 md:px-6 shrink-0">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="p-2 rounded-lg text-cockpit-muted hover:bg-white/5 hover:text-gray-300 transition-colors lg:hidden"
          title="Menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cockpit-bg border border-cockpit-border">
          <Calendar className="w-4 h-4 text-cockpit-muted" />
          <span className="text-sm text-gray-300">
            Mar 2023 — Ago 2025
          </span>
        </div>
        <button
          type="button"
          className="p-2 rounded-lg text-cockpit-muted hover:bg-white/5 hover:text-gray-300 transition-colors"
          title="Atualizar dados"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-muted" />
          <input
            type="search"
            placeholder="Cliente, produto, documento..."
            className="w-64 pl-9 pr-4 py-2 rounded-lg bg-cockpit-bg border border-cockpit-border text-sm text-gray-200 placeholder:text-cockpit-muted focus:outline-none focus:ring-2 focus:ring-cockpit-accent/50 focus:border-cockpit-accent"
          />
        </div>
        <span className="text-xs text-cockpit-muted hidden lg:inline">
          Atualizado em 10/12/2025
        </span>
      </div>
    </header>
  );
}
