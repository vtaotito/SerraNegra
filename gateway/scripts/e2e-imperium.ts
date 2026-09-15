import { request } from "undici";
import {
  basicAuthHeader,
  loadImperiumConfig,
  type ImperiumService,
} from "../src/services/imperium/config.js";
import { callImperiumSoap } from "../src/services/imperium/soapClient.js";
import {
  buildEmptyBody,
  buildFabricanteSalvarXml,
  buildListCargasXml,
  buildConsultarPedidoXml,
  buildChecarStatusXml,
  buildConsultarCargaXml,
  buildConsultaEstoqueGeralXml,
  buildConsultarMovimentacaoXml,
  buildEnviarPedidosXml,
} from "../src/services/imperium/builders.js";
import { formatBrDate, xmlString } from "../src/services/imperium/xml.js";

type Row = {
  step: string;
  ok: boolean;
  status?: number;
  ms?: number;
  detail: string;
};

const rows: Row[] = [];
const cfg = loadImperiumConfig();
if (!cfg.configured) {
  console.error("IMPERIUM_* não configurado");
  process.exit(1);
}

function add(row: Row) {
  rows.push(row);
  const mark = row.ok ? "OK " : "FAL";
  console.log(`[${mark}] ${row.step} — ${row.detail}${row.ms != null ? ` (${row.ms}ms)` : ""}`);
}

async function wsdl(service: ImperiumService) {
  const url = `${cfg.baseUrl}/soap/index/wsdl/service/${service}`;
  const started = Date.now();
  try {
    const res = await request(url, {
      method: "GET",
      headers: { Authorization: basicAuthHeader(cfg.username, cfg.password), Accept: "text/xml" },
      headersTimeout: 20000,
      bodyTimeout: 20000,
    });
    const text = await res.body.text();
    const ms = Date.now() - started;
    const ns = text.match(/targetNamespace="([^"]+)"/)?.[1] ?? "";
    const ops = [...text.matchAll(/<operation name="([^"]+)"/g)].map((m) => m[1]);
    const uniqueOps = [...new Set(ops)];
    const wmsLocal = /wms\.local/i.test(text);
    add({
      step: `WSDL ${service}`,
      ok: res.statusCode === 200 && /definitions/i.test(text),
      status: res.statusCode,
      ms,
      detail: `ns=${ns || "?"} ops=${uniqueOps.join(",")} wms.local=${wmsLocal}`,
    });
    return { ns, ops: uniqueOps, wmsLocal, text };
  } catch (err) {
    add({
      step: `WSDL ${service}`,
      ok: false,
      ms: Date.now() - started,
      detail: err instanceof Error ? err.message : String(err),
    });
    return { ns: "", ops: [] as string[], wmsLocal: false, text: "" };
  }
}

async function soap(step: string, service: ImperiumService, method: string, xml: string) {
  const r = await callImperiumSoap(service, method, xml);
  const preview = (r.fault ?? r.bodyXml).replace(/\s+/g, " ").slice(0, 220);
  add({
    step,
    ok: r.ok,
    status: r.statusCode,
    ms: r.durationMs,
    detail: r.ok ? `HTTP ${r.statusCode} ${preview}` : r.fault ?? preview,
  });
  return r;
}

const services: ImperiumService[] = [
  "produto",
  "produtoClasse",
  "fabricante",
  "fornecedor",
  "expedicao",
  "notaFiscal",
  "estoque",
];

for (const s of services) await wsdl(s);

await soap("produto.listar", "produto", "listar", buildEmptyBody());
await soap("produto.buscar", "produto", "buscar", `\n         ${xmlString("idProduto", "AR00000001")}\n         ${xmlString("grade", "UNICA")}`);
await soap("fabricante.listar", "fabricante", "listar", buildEmptyBody());
await soap("fabricante.buscar", "fabricante", "buscar", `\n         ${xmlString("idFabricante", "1")}`);
await soap("produtoClasse.listar", "produtoClasse", "listar", buildEmptyBody());
await soap("fornecedor.listar", "fornecedor", "listar", buildEmptyBody());

const hoje = new Date();
const ini = new Date(hoje.getTime() - 30 * 86400000);
await soap("expedicao.listCargas", "expedicao", "listCargas", buildListCargasXml(formatBrDate(ini), formatBrDate(hoje)));
await soap("expedicao.listarPedidos", "expedicao", "listarPedidos", buildEmptyBody());
await soap("expedicao.consultarPedido", "expedicao", "consultarPedido", buildConsultarPedidoXml("1"));
await soap("expedicao.checarStatus", "expedicao", "checarStatus", buildChecarStatusXml("1"));
await soap("expedicao.consultarCarga", "expedicao", "consultarCarga", buildConsultarCargaXml("1"));

await soap("estoque.consultaEstoqueGeral", "estoque", "consultaEstoqueGeral", buildConsultaEstoqueGeralXml());
await soap("estoque.consultarMovimentacao", "estoque", "consultarMovimentacao", buildConsultarMovimentacaoXml("0"));

await soap(
  "notaFiscal.buscarNf",
  "notaFiscal",
  "buscarNf",
  `\n         ${xmlString("idFornecedor", "1")}\n         ${xmlString("numero", "1")}\n         ${xmlString("serie", "1")}\n         ${xmlString("dataEmissao", "01/01/2020")}`,
);

const cargaTeste = buildEnviarPedidosXml({
  codCarga: "GSN-E2E-1",
  placa: cfg.defaultPlaca,
  pedidos: [
    {
      codPedido: "GSN-E2E-1",
      tipo: "ENTREGA",
      linhaEntrega: "BH",
      cliente: {
        codCliente: "C-E2E",
        nome: "CLIENTE TESTE E2E GSN",
        cpfCnpj: "18921882000193",
        tipoPessoa: "J",
        logradouro: "RUA JOSE BENEDITO ANTAO",
        numero: "85",
        bairro: "CAICARAS",
        cidade: "BELO HORIZONTE",
        uf: "MG",
      },
      produtos: [{ codProduto: "AR00000001", grade: "UNICA", quantidade: 1, valorVenda: 1 }],
    },
  ],
});
await soap("expedicao.enviarPedidos E2E", "expedicao", "enviarPedidos", cargaTeste);

await soap("fabricante.salvar", "fabricante", "salvar", buildFabricanteSalvarXml("1", "Garrafaria Serra Negra"));

const ok = rows.filter((r) => r.ok).length;
const fail = rows.filter((r) => !r.ok).length;
console.log(JSON.stringify({ ok, fail, total: rows.length, cnpj: cfg.cnpjEmitente || null }, null, 2));
