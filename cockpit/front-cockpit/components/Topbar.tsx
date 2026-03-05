"use client";

import { useState } from "react";
import { Calendar, RefreshCw, Search, Bookmark, MessageSquare } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";

const defaultRange = {
  start: startOfMonth(subMonths(new Date(), 1)),
  end: endOfMonth(subMonths(new Date(), 1)),
};

export function Topbar() {
  const [period] = useState(defaultRange);

  return (
    <header className="h-14 border-b border-cockpit-border bg-cockpit-surface/80 backdrop-blur flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cockpit-bg border border-cockpit-border">
          <Calendar className="w-4 h-4 text-cockpit-muted" />
          <span className="text-sm text-gray-300">
            {format(period.start, "MMM yyyy")} — {format(period.end, "MMM yyyy")}
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
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-muted" />
          <input
            type="search"
            placeholder="Cliente, produto, documento..."
            className="w-64 pl-9 pr-4 py-2 rounded-lg bg-cockpit-bg border border-cockpit-border text-sm text-gray-200 placeholder:text-cockpit-muted focus:outline-none focus:ring-2 focus:ring-cockpit-accent/50 focus:border-cockpit-accent"
          />
        </div>
        <button
          type="button"
          className="p-2 rounded-lg text-cockpit-muted hover:bg-white/5 hover:text-gray-300 transition-colors"
          title="Bookmarks"
        >
          <Bookmark className="w-4 h-4" />
        </button>
        <button
          type="button"
          className="p-2 rounded-lg text-cockpit-muted hover:bg-white/5 hover:text-gray-300 transition-colors"
          title="Chat / IA"
        >
          <MessageSquare className="w-4 h-4" />
        </button>
      </div>
      <div className="text-xs text-cockpit-muted">
        Dados atualizados em 10/12/2025
      </div>
    </header>
  );
}
