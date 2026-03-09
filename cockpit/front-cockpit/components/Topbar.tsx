"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Calendar, RefreshCw, Search, Menu, Wifi, WifiOff,
  Loader2, ChevronDown, Check,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { fmtDate } from "@/lib/format";
import {
  useDateRange,
  formatRangeShort,
  type PresetKey,
} from "@/contexts/DateRangeContext";

interface TopbarProps {
  onMenuClick?: () => void;
}

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "current_month", label: "Mês atual" },
  { key: "last_3m", label: "Últimos 3 meses" },
  { key: "last_6m", label: "Últimos 6 meses" },
  { key: "last_12m", label: "Últimos 12 meses" },
  { key: "ytd", label: "Ano corrente" },
  { key: "all", label: "Todo período" },
  { key: "custom", label: "Personalizado" },
];

export function Topbar({ onMenuClick }: TopbarProps) {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [sapOk, setSapOk] = useState<boolean | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const { preset, range, setPreset, setCustomRange } = useDateRange();

  const [customFromStr, setCustomFromStr] = useState(
    format(range.from, "yyyy-MM-dd")
  );
  const [customToStr, setCustomToStr] = useState(
    format(range.to, "yyyy-MM-dd")
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePreset = useCallback(
    (key: PresetKey) => {
      if (key === "custom") return;
      setPreset(key);
      setPickerOpen(false);
    },
    [setPreset]
  );

  const handleApplyCustom = useCallback(() => {
    const from = new Date(customFromStr + "T00:00:00");
    const to = new Date(customToStr + "T23:59:59");
    if (!isNaN(from.getTime()) && !isNaN(to.getTime()) && from <= to) {
      setCustomRange(from, to);
      setPickerOpen(false);
    }
  }, [customFromStr, customToStr, setCustomRange]);

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

  const rangeLabel = formatRangeShort(range);

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

        {/* Period picker */}
        <div className="relative hidden sm:block" ref={pickerRef}>
          <button
            type="button"
            onClick={() => setPickerOpen(!pickerOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cockpit-bg border border-cockpit-border hover:border-cockpit-accent/40 transition-colors"
            aria-label="Selecionar período"
            aria-expanded={pickerOpen}
          >
            <Calendar className="w-4 h-4 text-cockpit-accent" />
            <span className="text-sm text-gray-300 capitalize">{rangeLabel}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-cockpit-muted transition-transform ${
                pickerOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {pickerOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-72 rounded-xl border border-cockpit-border bg-cockpit-surface shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="p-1.5 border-b border-cockpit-border">
                <p className="px-2.5 py-1.5 text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider">
                  Período de análise
                </p>
                {PRESETS.filter((p) => p.key !== "custom").map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => handlePreset(p.key)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-sm transition-colors ${
                      preset === p.key
                        ? "bg-cockpit-accent/15 text-cockpit-accent"
                        : "text-gray-300 hover:bg-white/5"
                    }`}
                  >
                    {p.label}
                    {preset === p.key && <Check className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>

              <div className="p-3 space-y-3">
                <p className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider">
                  Personalizado
                </p>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-[10px] text-cockpit-muted mb-1">De</label>
                    <input
                      type="date"
                      value={customFromStr}
                      onChange={(e) => setCustomFromStr(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-cockpit-bg border border-cockpit-border text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-cockpit-accent/50"
                      aria-label="Data inicial"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] text-cockpit-muted mb-1">Até</label>
                    <input
                      type="date"
                      value={customToStr}
                      onChange={(e) => setCustomToStr(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-cockpit-bg border border-cockpit-border text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-cockpit-accent/50"
                      aria-label="Data final"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleApplyCustom}
                  className="w-full py-2 rounded-lg bg-cockpit-accent/20 text-cockpit-accent text-sm font-medium hover:bg-cockpit-accent/30 transition-colors"
                >
                  Aplicar período
                </button>
              </div>
            </div>
          )}
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
