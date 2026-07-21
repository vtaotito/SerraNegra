// ---------------------------------------------------------------------------
// Helpers para extrair informações do nome de produto SAP.
//
// Fonte ÚNICA de parsing de item do painel (Compras BI + Catálogo). A lógica
// replica a do Portal B2B (gateway/src/services/b2bCatalogService.ts) para que
// as três telas unifiquem produtos de forma idêntica: agrupam por
// "prefixo SAP + nome-base sem embalagem", mantendo cor/fechamento/diâmetro.
//
// Robusto às variações reais do SAP da Garrafaria:
//   "TAMPA PLASTICA ROSCA 28MM - UND"                 -> embalaQty = 1
//   "GARRAFA NACIONAL 600ML AMB - CAIXA C/12 UND"     -> embalaQty = 12
//   "ROLHA CONICA 100UN - FARDO C/ 1.000"             -> embalaQty = 1000
//   "GARRAFA ... ROLHA 22.5MM  FARDO C/ 20 UND"       -> embalaQty = 20 (sem hífen)
//   "GARRAFA ... ROSCA 33MM-  CAIXA C/20 UNID"        -> embalaQty = 20
//   "GARRAFA ... ROSCA 33MM UND"                      -> embalaQty = 1
// ---------------------------------------------------------------------------

/**
 * Palavras de embalagem reconhecidas (com abreviações). Usadas no nome-base
 * (getBaseProductName) — casam com/sem hífen, com ou sem "C/", e "UND/UNID"
 * opcional no fim. Mais longas primeiro.
 */
const PACK_WORD =
  "(?:CAIXA|CX|FARDO|FD|PALETE|PALET|PALLET|PLT|PACK|PACOTE|PCTE?|SACO|SC|ENGRADADO|DUZIA|DZ)";

/** Alternância (lowercase) de embalagem para a contagem de unidades. */
const PACK_ALT =
  "(?:caixa|cx|fardo|fd|pallet|palete|palet|plt|pack|pacote|pcte|pct|saco|sc|engradado|duzia|dz)";

/** Unidade individual (un/und/unid/unidade[s]) — tolerante às variações do SAP. */
const UNIT_RX = "(?:un|und|unid|unidades?)";

/**
 * Converte a quantidade capturada do nome (ex.: "1.200", "24") em inteiro. No
 * padrão brasileiro o "." (e às vezes ",") é separador de MILHAR para contagens
 * de embalagem ("PALETE C/ 1.200 UND" = 1200), então removemos esses
 * separadores antes de converter.
 */
function parsePackUnits(raw: string): number {
  const digits = raw.replace(/[.,]/g, "");
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : 0;
}

/** Normaliza a palavra de embalagem capturada para o rótulo de exibição (MAIÚSCULO). */
function packWordToType(w: string): string {
  const t = w.toLowerCase();
  if (t === "fardo" || t === "fd") return "FARDO";
  if (t === "pallet" || t.startsWith("palet") || t === "plt") return "PALETE";
  if (t === "saco" || t === "sc") return "SACO";
  if (t === "pacote" || t === "pcte" || t === "pct") return "PACOTE";
  if (t === "pack") return "PACK";
  if (t === "engradado") return "ENGRADADO";
  if (t === "duzia" || t === "dz") return "DUZIA";
  return "CAIXA"; // caixa | cx | fallback genérico multi-unidade
}

/**
 * Extrai a embalagem (tipo + unidades) do NOME do item. Espelha
 * `parsePackagingFromName` do portal. Retorna { units: 1, type: null } quando o
 * item é individual (UND) ou não há indicação de embalagem.
 *
 * Evita falsos positivos como "CAIXA 550 ML 425X250X130" (produto que É a
 * caixa) e "... 22,5MM - UND" (diâmetro/rosca), que resultam em 1.
 */
function parseEmbalagem(itemDescription?: string | null): { units: number; type: string | null } {
  const s = (itemDescription ?? "").trim();
  if (!s) return { units: 1, type: null };
  const lower = s.toLowerCase();

  // Melhor candidato = ocorrência mais à direita (sufixo de embalagem no final).
  type PackHit = { idx: number; units: number; type: string };
  const hits: PackHit[] = [];
  const consider = (idx: number, packWord: string | null, rawNum: string) => {
    const u = parsePackUnits(rawNum);
    if (!(u > 1 && u <= 999999)) return;
    hits.push({ idx, units: u, type: packWord ? packWordToType(packWord) : "CAIXA" });
  };

  // A) <PACK> [C/ | COM] <N>  — contagem explícita por embalagem.
  const reA = new RegExp(`\\b(${PACK_ALT})\\b\\s*(?:c\\s*[\\/.]\\s*|com\\s+)\\s*([\\d.,]+)`, "gi");
  for (const m of lower.matchAll(reA)) consider(m.index ?? 0, m[1], m[2]);

  // B) <PACK> <N> <UNIT>  — contagem sem "C/", mas seguida de UN/UND/UNID.
  const reB = new RegExp(`\\b(${PACK_ALT})\\b\\s*([\\d.,]+)\\s*${UNIT_RX}\\b`, "gi");
  for (const m of lower.matchAll(reB)) consider(m.index ?? 0, m[1], m[2]);

  if (hits.length > 0) {
    // Ocorrência mais à direita vence (sufixo de embalagem no final do nome).
    const best = hits.reduce((a, b) => (b.idx >= a.idx ? b : a));
    return { units: best.units, type: best.type };
  }

  // C) <N> <UNIT> ao final, sem palavra de embalagem ("... 980 UNID").
  const mc = lower.match(new RegExp(`([\\d.,]+)\\s*${UNIT_RX}\\s*$`, "i"));
  if (mc) {
    const u = parsePackUnits(mc[1]);
    if (u > 1 && u <= 999999) return { units: u, type: "CAIXA" };
  }

  return { units: 1, type: null };
}

/**
 * Retorna o número de unidades por embalagem.
 * Retorna 1 quando a descrição vem como UND/UNID ou não contém indicação.
 */
export function getEmbalaQty(itemDescription?: string | null): number {
  return parseEmbalagem(itemDescription).units;
}

/**
 * Rótulo da embalagem para exibição no catálogo: "UND", "FARDO C/20",
 * "CAIXA C/24", "PALETE C/1200". A primeira palavra é o TIPO (usada em
 * filtros/mix de embalagem via split(" ")[0]).
 */
export function getEmbalaLabel(itemDescription?: string | null): string {
  const { units, type } = parseEmbalagem(itemDescription);
  if (units <= 1) return "UND";
  return `${type ?? "CAIXA"} C/${units}`;
}

/** Total de unidades (qty × embalaQty) para uma linha de pedido. */
export function getLineUnits(line: {
  Quantity?: number | string;
  ItemDescription?: string | null;
}): number {
  const qty = Number(line.Quantity) || 0;
  return qty * getEmbalaQty(line.ItemDescription);
}

/** Sigla (2 chars) do código SAP — ex: "GN0000022" → "GN". */
export function getProductPrefix(itemCode?: string | null): string {
  if (!itemCode) return "OUTRO";
  return itemCode.substring(0, 2).toUpperCase() || "OUTRO";
}

/**
 * Nome "base" do produto, sem o sufixo/inline de embalagem
 * ("- CAIXA C/12 UND", "- UND", "FARDO C/1.000", "PALETE C/ 1200 UND" etc.).
 * Cobre embalagem com e sem hífen, "UND/UNID/UN" soltos e todas as palavras de
 * embalagem. Em MAIÚSCULAS e sem espaços duplicados — pronto para servir de
 * chave de agrupamento. Preserva cor/fechamento/diâmetro (ex.: "ROLHA 22.5MM").
 */
export function getBaseProductName(itemDescription?: string | null): string {
  let s = (itemDescription ?? "").trim();
  // " - <PACK> [C/]N [UND]" no final (com hífen).
  s = s.replace(
    new RegExp(`\\s*[-–]\\s*${PACK_WORD}\\s*(?:C\\s*/\\s*)?[\\d.,]*\\s*(?:UND|UNID)?\\s*$`, "i"),
    "",
  );
  // " - UND" no final.
  s = s.replace(/\s*[-–]\s*(?:UND|UNID)\s*$/i, "");
  // "<PACK> [C/]N [UND]" inline no final (sem hífen).
  s = s.replace(
    new RegExp(`\\s+${PACK_WORD}\\s*(?:C\\s*/\\s*)?[\\d.,]+\\s*(?:UND|UNID)?\\s*$`, "i"),
    "",
  );
  // Sufixo de unidade "solto" no final, sem hífen nem palavra de embalagem
  // (ex.: "...22.5MM UND", "...ROSCA 33MM UN"). Sem isso, a variante avulsa não
  // agruparia com as embalagens do mesmo produto.
  s = s.replace(/\s+(?:UND|UNID|UN)\s*$/i, "");
  return s.replace(/\s{2,}/g, " ").trim().toUpperCase();
}

/**
 * Chave de unificação de produto (mesma regra usada em /catalogo e Compras):
 *   "<sigla>::<nome_base>".
 * Ex.: "GN GARRAFA NACIONAL 600ML AMB - CAIXA C/12 UND"
 *   →  "GN::GARRAFA NACIONAL 600ML AMB"
 */
export function getUnifiedProductKey(itemCode?: string | null, itemDescription?: string | null): string {
  const prefix = getProductPrefix(itemCode);
  const baseName = getBaseProductName(itemDescription);
  return `${prefix}::${baseName || (itemCode ?? "—")}`;
}
