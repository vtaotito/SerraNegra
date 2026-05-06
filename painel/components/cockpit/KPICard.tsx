"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  variation?: number;
  variationLabel?: string;
  subtitle?: string;
  icon?: React.ReactNode;
}

export function KPICard({
  title,
  value,
  variation,
  variationLabel,
  subtitle,
  icon,
}: KPICardProps) {
  const trend =
    variation === undefined
      ? null
      : variation > 0
        ? "up"
        : variation < 0
          ? "down"
          : "flat";

  return (
    <div className="rounded-xl border border-cockpit-border bg-white p-5 hover:border-cockpit-accent/30 motion-safe:transition-colors">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-cockpit-muted">{title}</p>
        {icon && (
          <div className="p-1.5 rounded-lg bg-cockpit-accent/10 text-cockpit-accent">
            {icon}
          </div>
        )}
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
      {(variation !== undefined || variationLabel) && (
        <div className="mt-2 flex items-center gap-2">
          {trend === "up" && (
            <span className="flex items-center gap-0.5 text-sm text-cockpit-accent">
              <TrendingUp className="w-3.5 h-3.5" />
              {variation!.toFixed(1)}%
            </span>
          )}
          {trend === "down" && (
            <span className="flex items-center gap-0.5 text-sm text-cockpit-danger">
              <TrendingDown className="w-3.5 h-3.5" />
              {variation!.toFixed(1)}%
            </span>
          )}
          {trend === "flat" && (
            <span className="flex items-center gap-0.5 text-sm text-cockpit-muted">
              <Minus className="w-3.5 h-3.5" />
              0%
            </span>
          )}
          {variationLabel && (
            <span className="text-xs text-cockpit-muted">{variationLabel}</span>
          )}
        </div>
      )}
      {subtitle && (
        <p className="mt-1 text-xs text-cockpit-muted">{subtitle}</p>
      )}
    </div>
  );
}
