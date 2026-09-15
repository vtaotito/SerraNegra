import { readFileSync } from "node:fs";
import { callImperiumSoap } from "../src/services/imperium/soapClient.js";
import { buildProdutoSalvarXml } from "../src/services/imperium/builders.js";
import { mapProdutoCadastro } from "../src/services/imperium/mappers.js";

const want = new Set(process.argv.slice(2));
if (want.size === 0) {
  console.error("Informe os códigos, ex: tsx scripts/retry-failed-products.ts GN000000152 ME0000003");
  process.exit(1);
}

const rows = readFileSync("tests/gsn-catalog.tsv", "utf8")
  .replace(/^\uFEFF/, "")
  .split(/\r?\n/)
  .filter(Boolean);

let found = 0;
for (const line of rows) {
  const [sap_item_code, sap_item_name, ean, unit_of_measure, packaging_type, units_per_package, sap_group_code] =
    line.split("\t");
  const code = sap_item_code?.trim();
  if (!code || !want.has(code)) continue;
  found += 1;
  const mapped = mapProdutoCadastro({
    sap_item_code: code,
    sap_item_name,
    ean,
    unit_of_measure,
    packaging_type,
    units_per_package,
    sap_group_code,
  });
  const result = await callImperiumSoap("produto", "salvar", buildProdutoSalvarXml(mapped));
  console.log(JSON.stringify({
    id: mapped.idProduto,
    ok: result.ok,
    fault: result.fault,
    descLen: mapped.descricao.length,
    refLen: mapped.referencia?.length ?? 0,
  }));
}

if (found === 0) {
  console.error("Nenhum código encontrado no TSV");
  process.exit(1);
}
