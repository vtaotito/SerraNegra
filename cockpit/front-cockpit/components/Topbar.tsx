"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Calendar, RefreshCw, Search, Menu, Wifi, WifiOff,
  Loader2, ChevronDown, Check, ArrowRight, X,
} from "lucide-react";
import { format, differenceInDays, startOfMonth, subMonths } from "date-fns";
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

const PRESETS: { key: Exclude<PresetKey, "custom">; label: string; hint: string }[] = [
  { key: "current_month", label: "Mês atual", hint: "Desde dia 1" },
  { key: "last_3m", label: "Últimos 3 meses", hint: "90 dias" },
  { key: "last_6m", label: "Últimos 6 meses", hint: "180 dias" },
  { key: "last_12m", label: "Últimos 12 meses", hint: "1 ano" },
  { key: "ytd", label: "Ano corrente", hint: "Desde 01/Jan" },
  { key: "all", label: "Todo período", hint: "Histórico completo" },
];

function fmtShort(d: Date): string {
  return format(d, "dd MMM yyyy", { locale: ptBR });
}

function fmtInputVal(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function fmtReadable(d: Date): string {
  return format(d, "dd/MM/yyyy");
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [sapOk, setSapOk] = useState<boolean | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const { preset, range, setPreset, setCustomRange } = useDateRange();

  const [draftFrom, setDraftFrom] = useState(fmtInputVal(range.from));
  const [draftTo, setDraftTo] = useState(fmtInputVal(range.to));
  const [validationErr, setValidationErr] = useState<string | null>(null);

  useEffect(() => {
    setDraftFrom(fmtInputVal(range.from));
    setDraftTo(fmtInputVal(range.to));
    setValidationErr(null);
  }, [range]);

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
    (key: Exclude<PresetKey, "custom">) => {
      setPreset(key);
      setValidationErr(null);
      setPickerOpen(false);
    },
    [setPreset]
  );

  const validateAndApply = useCallback(() => {
    const from = new Date(draftFrom + "T00:00:00");
    const to = new Date(draftTo + "T23:59:59");

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      setValidationErr("Datas inválidas. Verifique o formato.");
      return;
    }
    if (from > to) {
      setValidationErr("A data inicial deve ser anterior à data final.");
      return;
    }
    const daysDiff = differenceInDays(to, from);
    if (daysDiff > 3650) {
      setValidationErr("O período máximo é 10 anos.");
      return;
    }

    setValidationErr(null);
    setCustomRange(from, to);
    setPickerOpen(false);
  }, [draftFrom, draftTo, setCustomRange]);

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
  const dayCount = differenceInDays(range.to, range.from) + 1;

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
        <div className="relative" ref={pickerRef}>
          <button
            type="button"
            onClick={() => setPickerOpen(!pickerOpen)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
              pickerOpen
                ? "bg-cockpit-accent/10 border-cockpit-accent/40 ring-1 ring-cockpit-accent/20"
                : "bg-cockpit-bg border-cockpit-border hover:border-cockpit-accent/40"
            }`}
            aria-label="Selecionar período"
            aria-expanded={pickerOpen}
          >
            <Calendar className="w-4 h-4 text-cockpit-accent" />
            <span className="text-sm text-gray-300 capitalize hidden sm:inline">{rangeLabel}</span>
            <span className="text-sm text-gray-300 sm:hidden">
              {preset === "custom" ? "Período" : PRESETS.find((p) => p.key === preset)?.label ?? "Período"}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-cockpit-muted transition-transform duration-200 ${
                pickerOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {pickerOpen && (
            <div className="absolute top-full left-0 sm:left-0 mt-2 w-[calc(100vw-2rem)] sm:w-[420px] rounded-xl border border-cockpit-border bg-cockpit-surface shadow-2xl shadow-black/40 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-cockpit-border bg-cockpit-bg/50">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-cockpit-accent" />
                  <span className="text-sm font-semibold text-white">Período de análise</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPickerOpen(false)}
                  className="p-1 rounded-md text-cockpit-muted hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Fechar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Active range summary */}
              <div className="px-4 py-2.5 bg-cockpit-accent/[0.06] border-b border-cockpit-border/50">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-cockpit-muted">Ativo:</span>
                  <span className="font-medium text-white">{fmtReadable(range.from)}</span>
                  <ArrowRight className="w-3 h-3 text-cockpit-muted" />
                  <span className="font-medium text-white">{fmtReadable(range.to)}</span>
                  <span className="text-cockpit-muted ml-auto">({dayCount} dias)</span>
                </div>
              </div>

              {/* Presets grid */}
              <div className="p-3">
                <p className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider mb-2 px-1">
                  Períodos rápidos
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {PRESETS.map((p) => {
                    const isActive = preset === p.key;
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => handlePreset(p.key)}
                        className={`group flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-all ${
                          isActive
                            ? "bg-cockpit-accent/15 border border-cockpit-accent/30 text-cockpit-accent"
                            : "border border-transparent text-gray-300 hover:bg-white/5 hover:border-cockpit-border"
                        }`}
                      >
                        <div>
                          <span className={`block text-sm font-medium ${isActive ? "text-cockpit-accent" : ""}`}>
                            {p.label}
                          </span>
                          <span className={`block text-[10px] mt-0.5 ${isActive ? "text-cockpit-accent/70" : "text-cockpit-muted"}`}>
                            {p.hint}
                          </span>
                        </div>
                        {isActive && <Check className="w-4 h-4 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom range */}
              <div className="px-4 pb-4 pt-1 border-t border-cockpit-border">
                <p className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider mb-3 pt-3">
                  Período personalizado
                </p>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-cockpit-muted mb-1.5 font-medium">Data inicial</label>
                    <input
                      type="date"
                      value={draftFrom}
                      onChange={(e) => {
                        setDraftFrom(e.target.value);
                        setValidationErr(null);
                      }}
                      max={draftTo}
                      className="w-full px-3 py-2 rounded-lg bg-cockpit-bg border border-cockpit-border text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-cockpit-accent/50 focus:border-cockpit-accent/40 transition-all [color-scheme:dark]"
                      aria-label="Data inicial"
                    />
                  </div>
                  <div className="pb-2">
                    <ArrowRight className="w-4 h-4 text-cockpit-muted" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-cockpit-muted mb-1.5 font-medium">Data final</label>
                    <input
                      type="date"
                      value={draftTo}
                      onChange={(e) => {
                        setDraftTo(e.target.value);
                        setValidationErr(null);
                      }}
                      min={draftFrom}
                      className="w-full px-3 py-2 rounded-lg bg-cockpit-bg border border-cockpit-border text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-cockpit-accent/50 focus:border-cockpit-accent/40 transition-all [color-scheme:dark]"
                      aria-label="Data final"
                    />
                  </div>
                </div>

                {validationErr && (
                  <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                    <X className="w-3 h-3" /> {validationErr}
                  </p>
                )}

                <button
                  type="button"
                  onClick={validateAndApply}
                  className="w-full mt-3 py-2.5 rounded-lg bg-cockpit-accent text-white text-sm font-semibold hover:bg-cockpit-accent/90 active:scale-[0.98] transition-all shadow-lg shadow-cockpit-accent/20"
                >
                  Aplicar período personalizado
                </button>

                {preset === "custom" && (
                  <p className="text-[10px] text-cockpit-accent/60 text-center mt-2">
                    Período personalizado ativo
                  </p>
                )}
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
