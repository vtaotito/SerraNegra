"use client";

import { useCallback, type InputHTMLAttributes } from "react";
import { fmtCNPJ } from "@/lib/b2b-api";

interface CNPJInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onValueChange: (raw: string, formatted: string) => void;
}

export function CNPJInput({ value, onValueChange, className, ...rest }: CNPJInputProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/\D/g, "").slice(0, 14);
      onValueChange(raw, fmtCNPJ(raw));
    },
    [onValueChange],
  );

  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      value={fmtCNPJ(value)}
      onChange={handleChange}
      maxLength={18}
      placeholder="00.000.000/0000-00"
      className={
        className ??
        "w-full rounded-lg border border-cockpit-border bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-cockpit-muted/60 focus:outline-none focus:ring-2 focus:ring-cockpit-accent focus:border-transparent transition-shadow"
      }
    />
  );
}
