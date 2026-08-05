/** Nome amigável do tipo de embalagem. */
export function packagingTypeName(type: string | null | undefined): string {
  if (!type) return "Unidade";
  const t = type.toLowerCase().trim();
  if (t.includes("cx") || t.includes("caixa")) return "Caixa";
  if (t.includes("frd") || t.includes("fardo")) return "Fardo";
  if (t.includes("plt") || t.includes("palet") || t.includes("pallet")) return "Palete";
  if (t.includes("sc") || t.includes("saco")) return "Saco";
  if (t.includes("pct") || t.includes("pcte") || t.includes("pacote") || t.includes("pack"))
    return "Pacote";
  if (t.includes("dz") || t.includes("duzia")) return "Dúzia";
  if (t.includes("engradado")) return "Engradado";
  if (t === "un" || t === "und" || t.includes("unidade")) return "Unidade";
  return type;
}

/** Rótulo completo, ex.: "Caixa c/12" ou "Unidade". */
export function packagingLabel(
  type: string | null | undefined,
  unitsPerPack: number,
): string {
  const name = packagingTypeName(type);
  if (unitsPerPack > 1 && name !== "Unidade") return `${name} c/${unitsPerPack}`;
  return name;
}

/** Rótulo curto para chips, ex.: "CX 12" ou "UND". */
export function packagingShort(
  type: string | null | undefined,
  unitsPerPack: number,
): string {
  const name = packagingTypeName(type);
  if (name === "Unidade") return "UND";
  const abbr: Record<string, string> = {
    Caixa: "CX",
    Fardo: "FRD",
    Palete: "PLT",
    Saco: "SC",
    Pacote: "PCT",
    Dúzia: "DZ",
    Engradado: "ENG",
  };
  const short = abbr[name] ?? name;
  return unitsPerPack > 1 ? `${short} ${unitsPerPack}` : short;
}
