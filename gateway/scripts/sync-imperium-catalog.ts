import { readFileSync } from "node:fs";
import { loadImperiumConfig } from "../src/services/imperium/config.js";
import { callImperiumSoap } from "../src/services/imperium/soapClient.js";
import {
  buildFabricanteSalvarXml,
  buildProdutoClasseSalvarXml,
  buildProdutoSalvarXml,
} from "../src/services/imperium/builders.js";
import { mapProdutoCadastro } from "../src/services/imperium/mappers.js";

const tsvPath = process.argv[2];
if (!tsvPath) {
  console.error("Uso: tsx scripts/sync-imperium-catalog.ts <catalog.tsv>");
  process.exit(1);
}

const cfg = loadImperiumConfig();
if (!cfg.configured) {
  console.error("IMPERIUM_* não configurado");
  process.exit(1);
}

type Row = {
  sap_item_code: string;
  sap_item_name: string;
  ean: string;
  unit_of_measure: string;
  packaging_type: string;
  units_per_package: string;
  sap_group_code: string;
  category_name: string;
};

const lines = readFileSync(tsvPath, "utf8")
  .replace(/^\uFEFF/, "")
  .split(/\r?\n/)
  .map((l) => l.trimEnd())
  .filter((l) => l.length > 0 && !l.startsWith("sap_item_code"));

const rows: Row[] = lines.map((line) => {
  const [sap_item_code, sap_item_name, ean, unit_of_measure, packaging_type, units_per_package, sap_group_code, category_name] =
    line.split("\t");
  return {
    sap_item_code: sap_item_code?.trim() ?? "",
    sap_item_name: sap_item_name ?? "",
    ean: ean ?? "",
    unit_of_measure: unit_of_measure ?? "UN",
    packaging_type: packaging_type ?? "",
    units_per_package: units_per_package ?? "",
    sap_group_code: sap_group_code ?? "",
    category_name: category_name ?? "",
  };
}).filter((r) => r.sap_item_code);

async function mustOk(label: string, promise: ReturnType<typeof callImperiumSoap>) {
  const result = await promise;
  if (!result.ok) {
    throw new Error(`${label}: ${result.fault ?? `HTTP ${result.statusCode}`}`);
  }
  return result;
}

const fab = await mustOk(
  "fabricante",
  callImperiumSoap("fabricante", "salvar", buildFabricanteSalvarXml(cfg.defaultFabricante, "Garrafaria Serra Negra")),
);
console.log(`fabricante ${cfg.defaultFabricante} ok (${fab.durationMs}ms)`);

const classes = new Map<string, string>();
classes.set(cfg.defaultClasse, "GSN");
for (const r of rows) {
  if (r.sap_group_code) {
    classes.set(r.sap_group_code, r.category_name || `Grupo SAP ${r.sap_group_code}`);
  }
}

for (const [idClasse, nome] of classes) {
  await mustOk(
    `classe ${idClasse}`,
    callImperiumSoap("produtoClasse", "salvar", buildProdutoClasseSalvarXml(idClasse, nome)),
  );
}
console.log(`${classes.size} classes gravadas`);

let sent = 0;
let failed = 0;
const errors: string[] = [];

for (const row of rows) {
  const mapped = mapProdutoCadastro(row);
  const result = await callImperiumSoap("produto", "salvar", buildProdutoSalvarXml(mapped));
  if (result.ok) {
    sent += 1;
  } else {
    failed += 1;
    errors.push(`${mapped.idProduto}: ${result.fault ?? result.statusCode}`);
  }
  if ((sent + failed) % 50 === 0) {
    console.log(`progresso ${sent + failed}/${rows.length} enviados=${sent} falhas=${failed}`);
  }
}

console.log(JSON.stringify({ fetched: rows.length, sent, failed, errors: errors.slice(0, 25) }, null, 2));
if (failed > 0) process.exit(2);
