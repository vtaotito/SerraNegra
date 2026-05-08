"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Calendar,
  ChevronDown,
  Check,
  ArrowRight,
  X,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import {
  useDateRange,
  PRESETS,
  getHint,
  type PresetKey,
} from "@/contexts/DateRangeContext";

const PRESET_ORDER: Exclude<PresetKey, "custom">[] = [
  "today",
  "current_week",
  "last_7d",
  "current_month",
  "last_month",
  "two_months_ago",
  "last_3m",
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

interface DateRangePickerProps {
  /**
   * Visual variant.
   *  - "full": botão de largura total no mobile (default, usado no BITopbar).
   *  - "compact": botão sempre auto-width (ideal para headers de página).
   */
  variant?: "full" | "compact";
  /** Texto opcional acima do contador de dias (ex.: "Período"). */
  label?: string;
  /** ID base para acessibilidade (aria-controls). */
  idPrefix?: string;
  className?: string;
}

export function DateRangePicker({
  variant = "full",
  label,
  idPrefix = "date-picker",
  className = "",
}: DateRangePickerProps) {
  const { preset, range, setPreset, setCustomRange } = useDateRange();
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!pickerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPickerOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pickerOpen]);

  const handlePreset = useCallback(
    (key: Exclude<PresetKey, "custom">) => {
      setPreset(key);
      setValidationErr(null);
      setPickerOpen(false);
    },
    [setPreset],
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

  const dayCount = differenceInDays(range.to, range.from) + 1;
  const rangeLabel = `${fmtInputVal(range.from)} → ${fmtInputVal(range.to)}`;

  const triggerWidth = variant === "compact" ? "w-auto" : "w-full sm:w-auto";

  return (
    <div className={`relative z-[60] ${className}`} ref={pickerRef}>
      <button
        type="button"
        onClick={() => setPickerOpen(!pickerOpen)}
        className={`${triggerWidth} flex items-center gap-2 px-3 py-2.5 sm:py-1.5 rounded-lg border motion-safe:transition-all text-sm min-h-[44px] sm:min-h-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cockpit-accent focus-visible:ring-offset-2 ${
          pickerOpen
            ? "bg-cockpit-accent/10 border-cockpit-accent/40 ring-1 ring-cockpit-accent/20"
            : "bg-white border-cockpit-border hover:border-cockpit-accent/40"
        }`}
        aria-label={label ? `Selecionar ${label.toLowerCase()}` : "Selecionar período"}
        aria-expanded={pickerOpen}
        aria-controls={`${idPrefix}-panel`}
      >
        <Calendar className="w-4 h-4 text-cockpit-accent shrink-0" />
        <span className="text-gray-600 flex-1 text-left truncate tabular-nums">
          {rangeLabel}
        </span>
        <span className="text-[10px] text-cockpit-muted tabular-nums shrink-0 hidden sm:inline">
          {dayCount}d
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-cockpit-muted motion-safe:transition-transform motion-safe:duration-200 shrink-0 ${
            pickerOpen ? "motion-safe:rotate-180" : ""
          }`}
        />
      </button>

      {pickerOpen && (
        <>
          <div
            className="sm:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-[60]"
            onClick={() => setPickerOpen(false)}
          />
          <div
            id={`${idPrefix}-panel`}
            role="dialog"
            aria-modal="true"
            aria-label="Período de análise"
            className="fixed inset-x-0 bottom-0 sm:absolute sm:inset-auto sm:top-full sm:right-0 sm:mt-2 w-full sm:w-[440px] rounded-t-2xl sm:rounded-xl border border-cockpit-border bg-white shadow-2xl shadow-black/10 z-[65] overflow-hidden max-h-[85vh] sm:max-h-[80vh] overflow-y-auto safe-bottom"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-cockpit-border bg-gray-50/50 sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-cockpit-accent" />
                <span className="text-sm font-semibold text-gray-900">
                  Período de análise
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="p-2 -mr-1 rounded-lg text-cockpit-muted hover:text-gray-900 hover:bg-black/5 motion-safe:transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cockpit-accent focus-visible:ring-offset-2"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="sm:hidden w-12 h-1 bg-gray-300 rounded-full mx-auto -mt-8 mb-5" />

            <div className="px-4 py-2.5 bg-cockpit-accent/[0.05] border-b border-cockpit-border/50">
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <span className="text-cockpit-muted">Ativo:</span>
                <span className="font-medium text-gray-900 tabular-nums">
                  {fmtInputVal(range.from)}
                </span>
                <ArrowRight className="w-3 h-3 text-cockpit-muted" />
                <span className="font-medium text-gray-900 tabular-nums">
                  {fmtInputVal(range.to)}
                </span>
                <span className="text-cockpit-muted ml-auto">
                  ({dayCount} dia{dayCount !== 1 ? "s" : ""})
                </span>
              </div>
            </div>

            <div className="p-3 sm:p-3">
              <p className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider mb-2 px-1">
                Períodos rápidos
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {PRESET_ORDER.map((key) => {
                  const isActive = preset === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handlePreset(key)}
                      className={`group flex items-center justify-between px-3 py-3 sm:py-2.5 rounded-lg text-left motion-safe:transition-all min-h-[48px] sm:min-h-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cockpit-accent focus-visible:ring-offset-1 ${
                        isActive
                          ? "bg-cockpit-accent/15 border border-cockpit-accent/30 text-cockpit-accent"
                          : "border border-transparent text-gray-600 hover:bg-black/5 hover:border-cockpit-border active:bg-black/10"
                      }`}
                    >
                      <div>
                        <span
                          className={`block text-sm font-medium ${
                            isActive ? "text-cockpit-accent" : ""
                          }`}
                        >
                          {PRESETS[key].label}
                        </span>
                        <span
                          className={`block text-[10px] mt-0.5 ${
                            isActive
                              ? "text-cockpit-accent/70"
                              : "text-cockpit-muted"
                          }`}
                        >
                          {getHint(key)}
                        </span>
                      </div>
                      {isActive && <Check className="w-4 h-4 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="px-4 pb-5 sm:pb-4 pt-1 border-t border-cockpit-border">
              <p className="text-[10px] font-semibold text-cockpit-muted uppercase tracking-wider mb-3 pt-3">
                Período personalizado
              </p>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label
                    htmlFor={`${idPrefix}-draft-from`}
                    className="block text-xs text-cockpit-muted mb-1.5 font-medium"
                  >
                    Data inicial
                  </label>
                  <input
                    id={`${idPrefix}-draft-from`}
                    type="text"
                    inputMode="numeric"
                    value={draftFrom}
                    onChange={(e) => {
                      setDraftFrom(applyDateMask(e.target.value));
                      setValidationErr(null);
                    }}
                    placeholder="DD/MM/AAAA"
                    maxLength={10}
                    className="w-full px-3 py-2.5 sm:py-2 rounded-lg bg-gray-50 border border-cockpit-border text-sm text-gray-700 tabular-nums focus:outline-none focus:ring-2 focus:ring-cockpit-accent/50 focus:border-cockpit-accent/40 motion-safe:transition-all"
                    aria-invalid={validationErr != null ? true : undefined}
                    aria-describedby={
                      validationErr != null
                        ? `${idPrefix}-validation-err`
                        : undefined
                    }
                  />
                </div>
                <div className="pb-3 sm:pb-2">
                  <ArrowRight className="w-4 h-4 text-cockpit-muted" />
                </div>
                <div className="flex-1">
                  <label
                    htmlFor={`${idPrefix}-draft-to`}
                    className="block text-xs text-cockpit-muted mb-1.5 font-medium"
                  >
                    Data final
                  </label>
                  <input
                    id={`${idPrefix}-draft-to`}
                    type="text"
                    inputMode="numeric"
                    value={draftTo}
                    onChange={(e) => {
                      setDraftTo(applyDateMask(e.target.value));
                      setValidationErr(null);
                    }}
                    placeholder="DD/MM/AAAA"
                    maxLength={10}
                    className="w-full px-3 py-2.5 sm:py-2 rounded-lg bg-gray-50 border border-cockpit-border text-sm text-gray-700 tabular-nums focus:outline-none focus:ring-2 focus:ring-cockpit-accent/50 focus:border-cockpit-accent/40 motion-safe:transition-all"
                    aria-invalid={validationErr != null ? true : undefined}
                    aria-describedby={
                      validationErr != null
                        ? `${idPrefix}-validation-err`
                        : undefined
                    }
                  />
                </div>
              </div>
              {validationErr && (
                <p
                  id={`${idPrefix}-validation-err`}
                  role="alert"
                  className="text-xs text-red-600 mt-2 flex items-center gap-1"
                >
                  <X className="w-3 h-3 shrink-0" aria-hidden /> {validationErr}
                </p>
              )}
              <button
                type="button"
                onClick={validateAndApply}
                className="w-full mt-3 py-3 sm:py-2.5 rounded-lg bg-cockpit-accent text-white text-sm font-semibold hover:bg-cockpit-accentHover motion-safe:active:scale-[0.98] motion-safe:transition-all shadow-sm min-h-[48px] sm:min-h-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-cockpit-accent"
              >
                Aplicar período personalizado
              </button>
              {preset === "custom" && (
                <p className="text-[10px] text-cockpit-accent text-center mt-2">
                  Período personalizado ativo
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
