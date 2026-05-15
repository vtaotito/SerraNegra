"use client";

const STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
  O: { label: "Aberto", bg: "bg-emerald-50", text: "text-emerald-700" },
  C: { label: "Fechado", bg: "bg-gray-100", text: "text-gray-600" },
  open: { label: "Aberto", bg: "bg-emerald-50", text: "text-emerald-700" },
  closed: { label: "Fechado", bg: "bg-gray-100", text: "text-gray-600" },
};

interface StatusBadgeProps {
  status: string;
  cancelled?: string;
  className?: string;
}

export function StatusBadge({ status, cancelled, className = "" }: StatusBadgeProps) {
  if (cancelled === "Y" || cancelled === "tYES") {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 ${className}`}
      >
        Cancelado
      </span>
    );
  }

  const s = STATUS_MAP[status] ?? { label: status, bg: "bg-gray-100", text: "text-gray-600" };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${s.bg} ${s.text} ${className}`}
    >
      {s.label}
    </span>
  );
}
