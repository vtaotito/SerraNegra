"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Calendar, RefreshCw, Wifi, WifiOff,
  Loader2, ChevronDown, Check, ArrowRight, X,
  BarChart3,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { fmtDate } from "@/lib/format";
import {
  useDateRange,
  formatRangeShort,
  PRESETS,
  getHint,
  type PresetKey,
} from "@/contexts/DateRangeContext";

const PRESET_ORDER: Exclude<PresetKey, "custom">[] = [
  "today", "current_week", "last_7d", "current_month",
  "last_month", "two_months_ago", "last_3m",
];

function fmtInputVal(d: Date): string {
  return format(d, "dd/MM/yyyy");
}

function parseDDMMYYYY(str: string): Date | null {
  const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const d = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  if (isNaN(d.getTime())) return null;
  return d;
}

function applyDateMask(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function BITopbar() {
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
    const from = parseDDMMYYYY(draftFrom);
    const to = parseDDMMYYYY(draftTo);

    if (!from || !to) {
      setValidationErr("Datas inválidas. Use o formato DD/MM/AAAA.");
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
    <header className="pb-4 border-b border-cockpit-border space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 sm:p-2 rounded-xl bg-cockpit-accent/10 shrink-0">
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-cockpit-accent" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold text-gray-900 truncate">Business Intelligence</h1>
            <p className="text-[10px] sm:text-xs text-cockpit-muted hidden sm:block">
              Cockpit BI — Serra Negra
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <button type="button" onClick={handleRefresh} disabled={syncing}
            className="p-2 rounded-lg text-cockpit-muted hover:bg-black/5 hover:text-gray-700 transition-colors disabled:opacity-50 min-w-[40px] min-h-[40px] flex items-center justify-center"
            aria-label="Verificar conexão SAP">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </button>

          {sapOk !== null && (
            <span className="flex items-center gap-1.5 text-xs">
              {sapOk ? (
                <><Wifi className="w-3.5 h-3.5 text-cockpit-accent" /><span className="text-cockpit-accent hidden sm:inline">SAP conectado</span></>
              ) : (
                <><WifiOff className="w-3.5 h-3.5 text-cockpit-danger" /><span className="text-cockpit-danger hidden sm:inline">SAP offline</span></>
              )}
            </span>
          )}

          {lastSync && (
            <span className="text-xs text-cockpit-muted hidden lg:inline">Atualizado: {lastSync}</span>
          )}
        </div>
      </div>

      {/* Date range picker - full width on mobile */}
      <div className="relative z-[60]" ref={pickerRef}>
        <button
          type="button"
          onClick={() => setPickerOpen(!pickerOpen)}
          className={`w-full sm:w-auto flex items-center gap-2 px-3 py-2.5 sm:py-1.5 rounded-lg border transition-all text-sm min-h-[44px] sm:min-h-0 ${
            pickerOpen
              ? "bg-cockpit-accent/10 border-cockpit-accent/40 ring-1 ring-cockpit-accent/20"
              : "bg-white border-cockpit-border hover:border-cockpit-accent/40"
          }`}
          aria-label="Selecionar período"
          aria-expanded={pickerOpen}
        >
          <Calendar className="w-4 h-4 text-cockpit-accent shrink-0" />
          <span className="text-gray-600 flex-1 text-left truncate">{rangeLabel}</span>
          <span className="text-[10px] text-cockpit-muted tabular-nums shrink-0 hidden sm:inline">{dayCount}d</span>
          <ChevronDown className={`w-3.5 h-3.5 text-cockpit-muted transition-transform duration-200 shrink-0 ${pickerOpen ? "rotate-180" : ""}`} />
        </button>

        {pickerOpen && (
          <>
            <div className="sm:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-40" onClick={() => setPickerOpen(false)} />
            <div className="fixed inset-x-0 bottom-0 sm:absolute sm:inset-auto sm:top-full sm:right-0 sm:mt-2 w-full sm:w-[440px] rounded-t-2xl sm:rounded-xl border border-cockpit-border bg-white shadow-2xl shadow-black/10 z-50 overflow-hidden max-h-[85vh] sm:max-h-[80vh] overflow-y-auto safe-bottom">
              <div className="flex items-center justify-between px-4 py-3 border-b border-cockpit-border bg-gray-50/50 sticky top-0 z-10">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-cockpit-accent" />
                  <span className="text-sm font-semibold text-gray-900">Período de análise</span>
                </div>
                <button type="button" onClick={() => setPickerOpen(false)} className="p-2 -mr-1 rounded-lg text-cockpit-muted hover:text-gray-900 hover:bg-black/5 transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center" aria-label="Fechar">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="sm:hidden w-12 h-1 bg-gray-300 rounded-full mx-auto -mt-8 mb-5" />

              <div className="px-4 py-2.5 bg-cockpit-accent/[0.05] border-b border-cockpit-border/50">
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  <span className="text-cockpit-muted">Ativo:</span>
                  <span className="font-medium text-gray-900">{fmtInputVal(range.from)}</span>
                  <ArrowRight className="w-3 h-3 text-cockpit-muted" />
                  <span className="font-medium text-gray-900">{fmtInputVal(range.to)}</span>
                  <span className="text-cockpit-muted ml-auto">({dayCount} dia{dayCount !== 1 ? "s" : ""})</span>
                </div>
              </div>

              <div className="p-3 sm:p-3">
                <p className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider mb-2 px-1">Períodos rápidos</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {PRESET_ORDER.map((key) => {
                    const isActive = preset === key;
                    return (
                      <button key={key} type="button" onClick={() => handlePreset(key)}
                        className={`group flex items-center justify-between px-3 py-3 sm:py-2.5 rounded-lg text-left transition-all min-h-[48px] sm:min-h-0 ${
                          isActive ? "bg-cockpit-accent/15 border border-cockpit-accent/30 text-cockpit-accent" : "border border-transparent text-gray-600 hover:bg-black/5 hover:border-cockpit-border active:bg-black/10"
                        }`}>
                        <div>
                          <span className={`block text-sm font-medium ${isActive ? "text-cockpit-accent" : ""}`}>{PRESETS[key].label}</span>
                          <span className={`block text-[10px] mt-0.5 ${isActive ? "text-cockpit-accent/70" : "text-cockpit-muted"}`}>{getHint(key)}</span>
                        </div>
                        {isActive && <Check className="w-4 h-4 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="px-4 pb-5 sm:pb-4 pt-1 border-t border-cockpit-border">
                <p className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider mb-3 pt-3">Período personalizado</p>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-cockpit-muted mb-1.5 font-medium">Data inicial</label>
                    <input type="text" inputMode="numeric" value={draftFrom} onChange={(e) => { setDraftFrom(applyDateMask(e.target.value)); setValidationErr(null); }}
                      placeholder="DD/MM/AAAA" maxLength={10}
                      className="w-full px-3 py-2.5 sm:py-2 rounded-lg bg-gray-50 border border-cockpit-border text-sm text-gray-700 tabular-nums focus:outline-none focus:ring-2 focus:ring-cockpit-accent/50 focus:border-cockpit-accent/40 transition-all"
                      aria-label="Data inicial" />
                  </div>
                  <div className="pb-3 sm:pb-2"><ArrowRight className="w-4 h-4 text-cockpit-muted" /></div>
                  <div className="flex-1">
                    <label className="block text-xs text-cockpit-muted mb-1.5 font-medium">Data final</label>
                    <input type="text" inputMode="numeric" value={draftTo} onChange={(e) => { setDraftTo(applyDateMask(e.target.value)); setValidationErr(null); }}
                      placeholder="DD/MM/AAAA" maxLength={10}
                      className="w-full px-3 py-2.5 sm:py-2 rounded-lg bg-gray-50 border border-cockpit-border text-sm text-gray-700 tabular-nums focus:outline-none focus:ring-2 focus:ring-cockpit-accent/50 focus:border-cockpit-accent/40 transition-all"
                      aria-label="Data final" />
                  </div>
                </div>
                {validationErr && (
                  <p className="text-xs text-red-500 mt-2 flex items-center gap-1"><X className="w-3 h-3" /> {validationErr}</p>
                )}
                <button type="button" onClick={validateAndApply}
                  className="w-full mt-3 py-3 sm:py-2.5 rounded-lg bg-cockpit-accent text-white text-sm font-semibold hover:bg-cockpit-accentHover active:scale-[0.98] transition-all shadow-sm min-h-[48px] sm:min-h-0">
                  Aplicar período personalizado
                </button>
                {preset === "custom" && (
                  <p className="text-[10px] text-cockpit-accent text-center mt-2">Período personalizado ativo</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
