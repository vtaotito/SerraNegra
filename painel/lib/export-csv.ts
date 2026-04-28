/** Gera CSV com separador ; (Excel PT-BR) e BOM UTF-8. */
export function toCsv(rows: string[][], header: string[]): string {
  const esc = (cell: string) => {
    const s = String(cell ?? "");
    if (/[;\n\r"]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [header.map(esc).join(";"), ...rows.map((r) => r.map(esc).join(";"))];
  return "\uFEFF" + lines.join("\r\n");
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/[^\w.\-]+/g, "_");
  a.click();
  URL.revokeObjectURL(url);
}
