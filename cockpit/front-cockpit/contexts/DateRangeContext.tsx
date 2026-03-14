"use client";

import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import {
  startOfMonth, endOfMonth, subMonths, startOfWeek, subDays,
  format, parse, isWithinInterval, startOfDay, endOfDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";

export type PresetKey =
  | "today"
  | "current_week"
  | "last_7d"
  | "current_month"
  | "last_month"
  | "two_months_ago"
  | "last_3m"
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

const today = () => new Date();

type HintValue = string | (() => string);

const PRESETS: Record<Exclude<PresetKey, "custom">, { label: string; hint: HintValue; rangeFn: () => DateRange }> = {
  today: {
    label: "Hoje",
    hint: "Somente hoje",
    rangeFn: () => ({ from: startOfDay(today()), to: today() }),
  },
  current_week: {
    label: "Semana corrente",
    hint: "Seg — Hoje",
    rangeFn: () => ({ from: startOfWeek(today(), { weekStartsOn: 1 }), to: today() }),
  },
  last_7d: {
    label: "Últimos 7 dias",
    hint: "7 dias",
    rangeFn: () => ({ from: subDays(today(), 6), to: today() }),
  },
  current_month: {
    label: "Mês atual",
    hint: "Desde dia 1",
    rangeFn: () => ({ from: startOfMonth(today()), to: today() }),
  },
  last_month: {
    label: "Mês anterior",
    hint: () => {
      const m = subMonths(today(), 1);
      return format(m, "MMMM", { locale: ptBR });
    },
    rangeFn: () => {
      const m = subMonths(today(), 1);
      return { from: startOfMonth(m), to: endOfMonth(m) };
    },
  },
  two_months_ago: {
    label: "2 meses atrás",
    hint: () => {
      const m = subMonths(today(), 2);
      return format(m, "MMMM", { locale: ptBR });
    },
    rangeFn: () => {
      const m = subMonths(today(), 2);
      return { from: startOfMonth(m), to: endOfMonth(m) };
    },
  },
  last_3m: {
    label: "Últimos 3 meses",
    hint: "90 dias",
    rangeFn: () => ({ from: startOfMonth(subMonths(today(), 2)), to: today() }),
  },
};

function getHint(key: Exclude<PresetKey, "custom">): string {
  const h = PRESETS[key].hint;
  return typeof h === "function" ? h() : h;
}

const DateRangeContext = createContext<DateRangeContextValue | null>(null);

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const [preset, setPresetState] = useState<PresetKey>("current_month");
  const [customFrom, setCustomFrom] = useState<Date>(startOfMonth(new Date()));
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
  const fmtM = (d: Date) => format(d, "dd MMM yyyy", { locale: ptBR });
  return `${fmtM(range.from)} — ${fmtM(range.to)}`;
}

export { PRESETS, getHint };
