"use client";

import { useState, useCallback } from "react";
import { Calendar, RefreshCw, Search, Menu, Wifi, WifiOff, Loader2 } from "lucide-react";
import { fmtDate } from "@/lib/format";

interface TopbarProps {
  onMenuClick?: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [sapOk, setSapOk] = useState<boolean | null>(null);

  const handleRefresh = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/sap/health");
      const data = await res.json();
      setSapOk(data.sap_connected === true);
      setLastSync(fmtDate(new Date()));
    } catch {
      setSapOk(false);
    } finally {
      setSyncing(false);
    }
  }, []);

  return (
    <header
      className="h-14 border-b border-cockpit-border bg-cockpit-surface/80 backdrop-blur flex items-center justify-between px-4 md:px-6 shrink-0"
      role="banner"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="p-2 rounded-lg text-cockpit-muted hover:bg-white/5 hover:text-gray-300 transition-colors lg:hidden"
          aria-label="Abrir menu lateral"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cockpit-bg border border-cockpit-border">
          <Calendar className="w-4 h-4 text-cockpit-muted" />
          <span className="text-sm text-gray-300">Mar 2023 — Mar 2026</span>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={syncing}
          className="p-2 rounded-lg text-cockpit-muted hover:bg-white/5 hover:text-gray-300 transition-colors disabled:opacity-50"
          aria-label="Verificar conexão SAP"
        >
          {syncing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
        </button>
        {sapOk !== null && (
          <span className="flex items-center gap-1.5 text-xs">
            {sapOk ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-cockpit-accent" />
                <span className="text-cockpit-accent hidden sm:inline">SAP conectado</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-cockpit-danger" />
                <span className="text-cockpit-danger hidden sm:inline">SAP offline</span>
              </>
            )}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-muted" />
          <input
            type="search"
            placeholder="Cliente, produto, documento..."
            aria-label="Busca global"
            className="w-64 pl-9 pr-4 py-2 rounded-lg bg-cockpit-bg border border-cockpit-border text-sm text-gray-200 placeholder:text-cockpit-muted focus:outline-none focus:ring-2 focus:ring-cockpit-accent/50 focus:border-cockpit-accent"
          />
        </div>
        <span className="text-xs text-cockpit-muted hidden lg:inline">
          {lastSync ? `Atualizado: ${lastSync}` : fmtDate(new Date())}
        </span>
      </div>
    </header>
  );
}
