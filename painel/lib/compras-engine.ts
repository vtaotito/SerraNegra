/* ──────────────────────────────────────────────────────────────
 * Engine de Gestão de Compras GSN
 *
 * Implementa as "REGRAS DOS KPIs - GESTÃO DE COMPRAS GSN":
 *  - Curva ABCD por faturamento (A ≤70%, B ≤85%, C ≤95%, D ≤100% acum.)
 *  - Curva 123 por volume       (1 ≤70%, 2 ≤90%, 3 ≤100% acum.)
 *  - Dois níveis: dentro de cada grupo (decisão operacional) e geral
 *    (visão macro). Regra de ouro: em divergência, vale a Classe Grupo.
 *  - Faixas de cobertura, fator de segurança e semáforo por Classe Grupo
 * ────────────────────────────────────────────────────────────── */

export type CurvaABCD = "A" | "B" | "C" | "D";
export type Curva123 = "1" | "2" | "3";
/** Classe combinada, ex.: "A1", "C2", "D3" */
export type ClasseCompra = `${CurvaABCD}${Curva123}`;

export type Semaforo = "critico" | "alerta" | "ok" | "excesso" | "sem_venda";

/* ─── Grupos de produto para compras ─────────────────────────── */

/** Prefixos que formam o grupo "OUTROS" (curva única) */
const OUTROS_PREFIXES = new Set(["EQ", "IS", "ME", "MO", "PA"]);

/** Prefixos fora da classificação (despesas e materiais auxiliares) */
export const COMPRAS_EXCLUDED_PREFIXES = new Set(["EM", "DA", "CH"]);

export const COMPRAS_GROUP_NAMES: Record<string, string> = {
  GN: "Garrafa Nacional",
  GI: "Garrafa Importada",
  GF: "Garrafão",
  PO: "Pote",
  AR: "Artesanal",
  LA: "Lacre",
  RO: "Rolha",
  TA: "Tampa Alumínio",
  TM: "Tampa Metálica",
  TP: "Tampa Plástica",
  OUTROS: "Outros",
};

/** Ordem de exibição dos grupos */
export const COMPRAS_GROUP_ORDER = [
  "GN", "GI", "GF", "PO", "AR", "LA", "RO", "TA", "TM", "TP", "OUTROS",
] as const;

/**
 * Grupo de compras a partir do prefixo do item (2 primeiros caracteres).
 * Retorna null para itens fora da classificação (EM, DA, CH e desconhecidos).
 */
export function getComprasGroup(itemCode: string | null | undefined): string | null {
  const prefix = (itemCode ?? "").slice(0, 2).toUpperCase();
  if (COMPRAS_EXCLUDED_PREFIXES.has(prefix)) return null;
  if (OUTROS_PREFIXES.has(prefix)) return "OUTROS";
  if (prefix in COMPRAS_GROUP_NAMES) return prefix;
  return null;
}

/* ─── Curvas Pareto ──────────────────────────────────────────── */

function classifyABCD(cumShare: number): CurvaABCD {
  if (cumShare <= 0.70) return "A";
  if (cumShare <= 0.85) return "B";
  if (cumShare <= 0.95) return "C";
  return "D";
}

function classify123(cumShare: number): Curva123 {
  if (cumShare <= 0.70) return "1";
  if (cumShare <= 0.90) return "2";
  return "3";
}

/**
 * Curva acumulada genérica: ordena por métrica desc e classifica pela
 * participação acumulada (incluindo o próprio item).
 */
function paretoClassify<T extends string>(
  items: { key: string; value: number }[],
  classify: (cumShare: number) => T,
  worst: T,
): Map<string, { classe: T; share: number; cumShare: number }> {
  const result = new Map<string, { classe: T; share: number; cumShare: number }>();
  const total = items.reduce((s, i) => s + Math.max(0, i.value), 0);
  if (total <= 0) {
    for (const i of items) result.set(i.key, { classe: worst, share: 0, cumShare: 1 });
    return result;
  }
  const sorted = [...items].sort((a, b) => b.value - a.value);
  let cum = 0;
  for (const i of sorted) {
    const v = Math.max(0, i.value);
    cum += v;
    const share = v / total;
    const cumShare = cum / total;
    // Item sem valor cai sempre na pior classe
    result.set(i.key, { classe: v > 0 ? classify(cumShare) : worst, share, cumShare });
  }
  return result;
}

/* ─── Classificação completa (grupo + geral) ─────────────────── */

export interface ComprasInputItem {
  /** Chave única do produto (ex.: chave unificada do catálogo) */
  key: string;
  /** Grupo de compras (resultado de getComprasGroup) */
  group: string;
  /** Faturamento 12 meses (R$) */
  revenue12m: number;
  /** Volume 12 meses em unidades */
  volume12m: number;
}

export interface ComprasClassification {
  abcGrupo: CurvaABCD;
  volGrupo: Curva123;
  /** Classe operacional — vale em caso de divergência (regra de ouro) */
  classeGrupo: ClasseCompra;
  abcGeral: CurvaABCD;
  volGeral: Curva123;
  classeGeral: ClasseCompra;
  /** Participação do produto no faturamento do grupo (0..1) */
  shareGrupo: number;
  /** Participação do produto no faturamento geral (0..1) */
  shareGeral: number;
}

export function classifyCompras(
  items: ComprasInputItem[],
): Map<string, ComprasClassification> {
  const out = new Map<string, ComprasClassification>();
  if (items.length === 0) return out;

  // Nível geral — todos os produtos juntos
  const abcGeral = paretoClassify(
    items.map((i) => ({ key: i.key, value: i.revenue12m })), classifyABCD, "D",
  );
  const volGeral = paretoClassify(
    items.map((i) => ({ key: i.key, value: i.volume12m })), classify123, "3",
  );

  // Nível grupo — curva calculada dentro de cada grupo
  const byGroup = new Map<string, ComprasInputItem[]>();
  for (const i of items) {
    const arr = byGroup.get(i.group) ?? [];
    arr.push(i);
    byGroup.set(i.group, arr);
  }

  const abcGrupo = new Map<string, { classe: CurvaABCD; share: number; cumShare: number }>();
  const volGrupo = new Map<string, { classe: Curva123; share: number; cumShare: number }>();
  for (const groupItems of byGroup.values()) {
    const abc = paretoClassify(
      groupItems.map((i) => ({ key: i.key, value: i.revenue12m })), classifyABCD, "D",
    );
    const vol = paretoClassify(
      groupItems.map((i) => ({ key: i.key, value: i.volume12m })), classify123, "3",
    );
    for (const [k, v] of abc) abcGrupo.set(k, v);
    for (const [k, v] of vol) volGrupo.set(k, v);
  }

  for (const i of items) {
    const ag = abcGrupo.get(i.key)!;
    const vg = volGrupo.get(i.key)!;
    const aG = abcGeral.get(i.key)!;
    const vG = volGeral.get(i.key)!;
    out.set(i.key, {
      abcGrupo: ag.classe,
      volGrupo: vg.classe,
      classeGrupo: `${ag.classe}${vg.classe}` as ClasseCompra,
      abcGeral: aG.classe,
      volGeral: vG.classe,
      classeGeral: `${aG.classe}${vG.classe}` as ClasseCompra,
      shareGrupo: ag.share,
      shareGeral: aG.share,
    });
  }
  return out;
}

/* ─── Faixas de cobertura + fator de segurança ───────────────── */

export interface CoberturaFaixa {
  /** Faixa ideal em meses de cobertura */
  idealMin: number;
  idealMax: number;
  /** Cobertura abaixo disso = CRÍTICO (comprar urgente) */
  critico: number;
  /** Cobertura abaixo disso = ALERTA (programar compra) */
  alerta: number;
  /** Cobertura acima disso = EXCESSO (não comprar) */
  excesso: number;
  /** Fator de segurança: estoque mínimo em meses de consumo */
  fatorSeguranca: number;
  /** Lead time em dias, quando definido pela regra */
  leadTimeDias: number | null;
}

const FAIXA_RAPIDA: CoberturaFaixa = {
  idealMin: 1, idealMax: 2, critico: 0.5, alerta: 1, excesso: 3,
  fatorSeguranca: 1.5, leadTimeDias: null,
};
const FAIXA_LENTA: CoberturaFaixa = {
  idealMin: 3, idealMax: 4, critico: 1.5, alerta: 3, excesso: 6,
  fatorSeguranca: 3.5, leadTimeDias: null,
};
/** GI (Garrafa Importada): vale para todos os itens do grupo — lead time 75 dias */
const FAIXA_GI: CoberturaFaixa = {
  idealMin: 4, idealMax: 7, critico: 3, alerta: 4, excesso: 9,
  fatorSeguranca: 3, leadTimeDias: 75,
};

const CLASSES_RAPIDAS = new Set<ClasseCompra>(["A1", "A2", "A3", "B1", "B2", "C1"]);

/**
 * Faixa de cobertura conforme a Classe Grupo. O grupo GI tem regra própria
 * independente da classe.
 */
export function getCoberturaFaixa(classeGrupo: ClasseCompra, group: string): CoberturaFaixa {
  if (group === "GI") return FAIXA_GI;
  return CLASSES_RAPIDAS.has(classeGrupo) ? FAIXA_RAPIDA : FAIXA_LENTA;
}

/* ─── Semáforo ───────────────────────────────────────────────── */

export const SEMAFORO_META: Record<Semaforo, { label: string; acao: string }> = {
  critico: { label: "Crítico", acao: "Comprar urgente" },
  alerta: { label: "Alerta", acao: "Programar compra" },
  ok: { label: "OK", acao: "Dentro da faixa" },
  excesso: { label: "Excesso", acao: "Não comprar" },
  sem_venda: { label: "Sem venda", acao: "Avaliar descontinuação" },
};

/**
 * Semáforo do produto a partir da cobertura em meses.
 * coberturaMeses = null quando não há consumo (sem venda no período).
 */
export function getSemaforo(coberturaMeses: number | null, faixa: CoberturaFaixa): Semaforo {
  if (coberturaMeses === null) return "sem_venda";
  if (coberturaMeses < faixa.critico) return "critico";
  if (coberturaMeses < faixa.alerta) return "alerta";
  if (coberturaMeses > faixa.excesso) return "excesso";
  return "ok";
}

/* ─── Estoque mínimo / máximo ────────────────────────────────── */

export interface EstoqueAlvo {
  /** Estoque mínimo em unidades (fator de segurança × consumo mensal) */
  minimo: number;
  /** Estoque máximo em unidades (mínimo × 2) */
  maximo: number;
}

export function getEstoqueAlvo(consumoMensalUnd: number, faixa: CoberturaFaixa): EstoqueAlvo {
  const minimo = consumoMensalUnd * faixa.fatorSeguranca;
  return { minimo, maximo: minimo * 2 };
}
