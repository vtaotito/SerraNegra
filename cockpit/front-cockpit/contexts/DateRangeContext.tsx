"use client";

import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import { startOfMonth, subMonths, format, parse, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

export type PresetKey =
  | "current_month"
  | "last_3m"
  | "last_6m"
  | "last_12m"
  | "ytd"
  | "all"
  | "custom";

export interface DateRange {
  from: Date;
  to: Date;
}

export interface DateRangeContextValue {
  preset: PresetKey;
  range: DateRange;
  label: string;
  setPreset: (key: PresetKey) => void;
  setCustomRange: (from: Date, to: Date) => void;
  isInRange: (dateStr: string, fmt?: string) => boolean;
  monthsInRange: number;
}

const PRESETS: Record<Exclude<PresetKey, "custom">, { label: string; rangeFn: () => DateRange }> = {
  current_month: {
    label: "Mês atual",
    rangeFn: () => ({ from: startOfMonth(new Date()), to: new Date() }),
  },
  last_3m: {
    label: "Últimos 3 meses",
    rangeFn: () => ({ from: startOfMonth(subMonths(new Date(), 2)), to: new Date() }),
  },
  last_6m: {
    label: "Últimos 6 meses",
    rangeFn: () => ({ from: startOfMonth(subMonths(new Date(), 5)), to: new Date() }),
  },
  last_12m: {
    label: "Últimos 12 meses",
    rangeFn: () => ({ from: startOfMonth(subMonths(new Date(), 11)), to: new Date() }),
  },
  ytd: {
    label: "Ano corrente",
    rangeFn: () => ({ from: new Date(new Date().getFullYear(), 0, 1), to: new Date() }),
  },
  all: {
    label: "Todo período",
    rangeFn: () => ({ from: new Date(2023, 2, 1), to: new Date() }),
  },
};

const DateRangeContext = createContext<DateRangeContextValue | null>(null);

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const [preset, setPresetState] = useState<PresetKey>("last_3m");
  const [customFrom, setCustomFrom] = useState<Date>(startOfMonth(subMonths(new Date(), 2)));
  const [customTo, setCustomTo] = useState<Date>(new Date());

  const range = useMemo<DateRange>(() => {
    if (preset === "custom") return { from: customFrom, to: customTo };
    return PRESETS[preset].rangeFn();
  }, [preset, customFrom, customTo]);

  const label = useMemo(() => {
    if (preset !== "custom") return PRESETS[preset].label;
    const fmtD = (d: Date) => format(d, "dd/MM/yyyy", { locale: ptBR });
    return `${fmtD(range.from)} — ${fmtD(range.to)}`;
  }, [preset, range]);

  const monthsInRange = useMemo(() => {
    const diffMs = range.to.getTime() - range.from.getTime();
    return Math.max(1, Math.round(diffMs / (30.44 * 24 * 60 * 60 * 1000)));
  }, [range]);

  const setPreset = useCallback((key: PresetKey) => {
    setPresetState(key);
  }, []);

  const setCustomRange = useCallback((from: Date, to: Date) => {
    setCustomFrom(from);
    setCustomTo(to);
    setPresetState("custom");
  }, []);

  const isInRange = useCallback(
    (dateStr: string, dateFmt = "dd/MM/yyyy") => {
      try {
        const d = parse(dateStr, dateFmt, new Date());
        return isWithinInterval(d, {
          start: startOfDay(range.from),
          end: endOfDay(range.to),
        });
      } catch {
        return true;
      }
    },
    [range]
  );

  const value = useMemo<DateRangeContextValue>(
    () => ({ preset, range, label, setPreset, setCustomRange, isInRange, monthsInRange }),
    [preset, range, label, setPreset, setCustomRange, isInRange, monthsInRange]
  );

  return (
    <DateRangeContext.Provider value={value}>{children}</DateRangeContext.Provider>
  );
}

export function useDateRange(): DateRangeContextValue {
  const ctx = useContext(DateRangeContext);
  if (!ctx) throw new Error("useDateRange must be used inside DateRangeProvider");
  return ctx;
}

export function formatRangeShort(range: DateRange): string {
  const fmtM = (d: Date) => format(d, "MMM yyyy", { locale: ptBR });
  return `${fmtM(range.from)} — ${fmtM(range.to)}`;
}
