"use client";

import { useState, useCallback } from "react";
import {
  RefreshCw,
  Wifi,
  WifiOff,
  Loader2,
  BarChart3,
} from "lucide-react";
import { fmtDate } from "@/lib/format";
import { DateRangePicker } from "@/components/cockpit/DateRangePicker";

export function BITopbar() {
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
    <header className="pb-4 border-b border-cockpit-border space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 sm:p-2 rounded-xl bg-cockpit-accent/10 shrink-0">
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-cockpit-accent" />
          </div>
          <div className="min-w-0">
            <p className="text-base sm:text-xl font-bold text-gray-900 truncate">
              Business Intelligence
            </p>
            <p className="text-[10px] sm:text-xs text-cockpit-muted hidden sm:block">
              Cockpit BI — Serra Negra
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={syncing}
            className="p-2 rounded-lg text-cockpit-muted hover:bg-black/5 hover:text-gray-700 motion-safe:transition-colors disabled:opacity-50 min-w-[40px] min-h-[40px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cockpit-accent focus-visible:ring-offset-2"
            aria-label="Verificar conexão SAP"
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </button>

          {sapOk !== null && (
            <span className="flex items-center gap-1.5 text-xs">
              {sapOk ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-cockpit-accent" />
                  <span className="text-cockpit-accent hidden sm:inline">
                    SAP conectado
                  </span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-cockpit-danger" />
                  <span className="text-cockpit-danger hidden sm:inline">
                    SAP offline
                  </span>
                </>
              )}
            </span>
          )}

          {lastSync && (
            <span className="text-xs text-cockpit-muted hidden lg:inline">
              Atualizado: {lastSync}
            </span>
          )}
        </div>
      </div>

      <DateRangePicker idPrefix="bi-date-picker" />
    </header>
  );
}
