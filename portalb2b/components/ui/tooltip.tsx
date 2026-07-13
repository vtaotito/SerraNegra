"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

/** Tooltip leve baseado em hover/focus (sem dependência externa). */
export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  const pos: Record<string, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-1.5",
    left: "right-full top-1/2 -translate-y-1/2 mr-1.5",
    right: "left-full top-1/2 -translate-y-1/2 ml-1.5",
  };
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 hidden whitespace-nowrap rounded-md bg-slate-950 px-2 py-1 text-xs text-slate-100 shadow-lg ring-1 ring-slate-700 group-hover:block group-focus-within:block",
          pos[side],
          className,
        )}
      >
        {content}
      </span>
    </span>
  );
}
