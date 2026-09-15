import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { callImperiumSoap } from "../src/services/imperium/soapClient.js";
import { loadImperiumConfig } from "../src/services/imperium/config.js";
import {
  buildConsultaEstoqueGeralXml,
  buildConsultarEstoqueXml,
  buildConsultarMovimentacaoXml,
  buildEmptyBody,
} from "../src/services/imperium/builders.js";
import { parseEstoqueResponse, parseMovimentacaoResponse } from "../src/services/imperium/xml.js";
import type { ImperiumEstoquePosicao } from "../src/services/imperium/types.js";

const cfg = loadImperiumConfig();
if (!cfg.configured) {
  console.error("IMPERIUM_* não configurado");
  process.exit(1);
}

const ponteiroArg = process.argv[2] ?? "0";
const skuArgs = process.argv.slice(3);

function briefFault(label: string, r: Awaited<ReturnType<typeof callImperiumSoap>>) {
  if (!r.ok) {
    throw new Error(`${label}: ${r.fault ?? `HTTP ${r.statusCode}`} (${r.durationMs}ms)`);
  }
}

function catalogSkus(): string[] {
  const tsv = resolve("tests/gsn-catalog.tsv");
  if (!existsSync(tsv)) return [];
  return readFileSync(tsv, "utf8")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.split("\t")[0]?.trim())
    .filter((sku): sku is string => Boolean(sku));
}

let positions: ImperiumEstoquePosicao[] = [];
let method = "consultaEstoqueGeral";

const geral = await callImperiumSoap("estoque", "consultaEstoqueGeral", buildConsultaEstoqueGeralXml());
if (geral.ok) {
  positions = parseEstoqueResponse(geral.bodyXml);
  console.log(`consultaEstoqueGeral ok (${geral.durationMs}ms) itens=${positions.length}`);
} else {
  console.log(`consultaEstoqueGeral falhou: ${geral.fault ?? geral.statusCode}`);
}

if (positions.length === 0) {
  method = "produto.listar";
  const listar = await callImperiumSoap("produto", "listar", buildEmptyBody());
  briefFault("produto.listar", listar);
  positions = parseEstoqueResponse(listar.bodyXml);
  console.log(`produto.listar ok (${listar.durationMs}ms) itens=${positions.length}`);
}

if (positions.length === 0) {
  const skus = skuArgs.length > 0 ? skuArgs : catalogSkus();
  if (skus.length === 0) {
    throw new Error("Nenhuma posição retornada e nenhum SKU disponível para consultarEstoque");
  }
  method = "consultarEstoque";
  const batchSize = 80;
  for (let i = 0; i < skus.length; i += batchSize) {
    const batch = skus.slice(i, i + batchSize).map((codProduto) => ({
      codProduto,
      grade: cfg.defaultGrade,
    }));
    const res = await callImperiumSoap("estoque", "consultarEstoque", buildConsultarEstoqueXml(batch));
    briefFault(`consultarEstoque ${i}-${i + batch.length}`, res);
    const parsed = parseEstoqueResponse(res.bodyXml);
    positions.push(...parsed);
    console.log(`consultarEstoque ${i + 1}-${i + batch.length}/${skus.length} +${parsed.length}`);
  }
}

const mov = await callImperiumSoap(
  "estoque",
  "consultarMovimentacao",
  buildConsultarMovimentacaoXml(ponteiroArg),
);
const movements = mov.ok ? parseMovimentacaoResponse(mov.bodyXml) : [];
if (mov.ok) {
  console.log(`consultarMovimentacao ponteiro=${ponteiroArg} ok (${mov.durationMs}ms) itens=${movements.length}`);
} else {
  console.log(`consultarMovimentacao falhou: ${mov.fault ?? mov.statusCode}`);
}

const comSaldo = positions.filter((p) => p.estoqueDisponivel > 0 || p.estoqueArmazenado > 0);
const maxPointer = movements.reduce((acc, m) => {
  const n = Number(m.ponteiro);
  return Number.isFinite(n) && n > acc ? n : acc;
}, Number(ponteiroArg) || 0);

const outPath = resolve("tests/gsn-estoque.tsv");
const header = ["codProduto", "grade", "areaArmazenagem", "estoqueArmazenado", "estoqueDisponivel"].join("\t");
const lines = positions.map((p) =>
  [p.codProduto, p.grade, p.areaArmazenagem, p.estoqueArmazenado, p.estoqueDisponivel].join("\t"),
);
writeFileSync(outPath, [header, ...lines].join("\n"), "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      method,
      positions: positions.length,
      comSaldo: comSaldo.length,
      movements: movements.length,
      ponteiro: String(maxPointer),
      sample: positions.slice(0, 8),
      sampleMov: movements.slice(0, 5),
      tsv: outPath,
    },
    null,
    2,
  ),
);
