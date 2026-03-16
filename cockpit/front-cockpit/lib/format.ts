export function fmtBRL(v: number, decimals = 0): string {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function fmtNum(v: number): string {
  return v.toLocaleString("pt-BR");
}

export function fmtPct(v: number, decimals = 1): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(decimals)}%`;
}

export function fmtDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

export function fmtQty(v: number, decimals = 0): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export const STATE_TO_REGION: Record<string, string> = {
  SP: "Sudeste", RJ: "Sudeste", MG: "Sudeste", ES: "Sudeste",
  PR: "Sul", SC: "Sul", RS: "Sul",
  BA: "Nordeste", PE: "Nordeste", CE: "Nordeste", MA: "Nordeste", PB: "Nordeste",
  PI: "Nordeste", RN: "Nordeste", AL: "Nordeste", SE: "Nordeste",
  GO: "Centro-Oeste", MT: "Centro-Oeste", MS: "Centro-Oeste", DF: "Centro-Oeste",
  PA: "Norte", AM: "Norte", RO: "Norte", AC: "Norte", AP: "Norte", RR: "Norte", TO: "Norte",
};

export function getProductGroup(itemCode: string | undefined | null): string {
  if (!itemCode) return "Outro";
  const prefix = itemCode.substring(0, 2).toUpperCase();
  return prefix || "Outro";
}

export function fmtDate(date: Date): string {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function exportCSV(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(";"),
    ...rows.map((row) =>
      headers.map((h) => {
        const val = row[h];
        if (typeof val === "string" && val.includes(";")) return `"${val}"`;
        return String(val ?? "");
      }).join(";")
    ),
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
