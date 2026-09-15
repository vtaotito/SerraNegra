import { callImperiumSoap } from "../src/services/imperium/soapClient.js";
import { loadImperiumConfig } from "../src/services/imperium/config.js";
import {
  buildBuscarNfXml,
  buildConsultarCargaXml,
  buildConsultarPedidoXml,
  buildFornecedorSalvarXml,
  buildInformarNotaFiscalXml,
  buildNotaFiscalSalvarJsonXml,
} from "../src/services/imperium/builders.js";
import { extractTag, formatBrDate, parseEstoqueResponse, parseSoapBoolean, xmlString } from "../src/services/imperium/xml.js";

const cfg = loadImperiumConfig();
if (!cfg.configured) {
  console.error("IMPERIUM_* não configurado");
  process.exit(1);
}

function brief(label: string, r: Awaited<ReturnType<typeof callImperiumSoap>>) {
  console.log(
    JSON.stringify({
      label,
      ok: r.ok,
      status: r.statusCode,
      fault: r.fault,
      bool: r.booleanReturn,
      situacao: extractTag(r.bodyXml, "situacao"),
      statusNf: extractTag(r.bodyXml, "status"),
      preview: r.bodyXml.replace(/\s+/g, " ").slice(0, 280),
    }),
  );
  return r;
}

const pedido = await callImperiumSoap("expedicao", "consultarPedido", buildConsultarPedidoXml("GSN-E2E-1"));
brief("consultarPedido GSN-E2E-1", pedido);

const carga = await callImperiumSoap("expedicao", "consultarCarga", buildConsultarCargaXml("GSN-E2E-1"));
brief("consultarCarga GSN-E2E-1", carga);

const forn = await callImperiumSoap(
  "fornecedor",
  "salvar",
  buildFornecedorSalvarXml({
    idFornecedor: "GSN1",
    nome: "FORNECEDOR E2E GSN",
    cnpj: "18921882000193",
    insc: "ISENTO",
  }),
);
brief("fornecedor.salvar GSN1", forn);

const hoje = formatBrDate(new Date());
const nfXml = buildNotaFiscalSalvarJsonXml({
  idFornecedor: "GSN1",
  numero: "900001",
  serie: "1",
  dataEmissao: hoje,
  placa: cfg.defaultPlaca,
  observacao: "E2E GSN entrada AR00000001",
  cnpjDestinatario: cfg.cnpjEmitente,
  itens: [{ idProduto: "AR00000001", grade: "UNICA", quantidade: 10 }],
});
const nf = await callImperiumSoap("notaFiscal", "salvarJson", nfXml);
brief("notaFiscal.salvarJson 900001", nf);

const buscar = await callImperiumSoap(
  "notaFiscal",
  "buscarNf",
  buildBuscarNfXml({
    idFornecedor: "GSN1",
    numero: "900001",
    serie: "1",
    dataEmissao: hoje,
  }),
);
brief("notaFiscal.buscarNf 900001", buscar);

const produto = await callImperiumSoap(
  "produto",
  "buscar",
  `\n         ${xmlString("idProduto", "AR00000001")}\n         ${xmlString("grade", "UNICA")}`,
);
const stock = parseEstoqueResponse(produto.bodyXml);
brief("produto.buscar AR00000001", produto);
console.log(JSON.stringify({ stock }));

const chave = `31160918921882000193550010009000011000000010`;
const nfSaida = await callImperiumSoap(
  "expedicao",
  "informarNotaFiscal",
  buildInformarNotaFiscalXml([
    {
      codPedido: "GSN-E2E-1",
      numeroNf: 900001,
      serieNf: "1",
      cnpjEmitente: cfg.cnpjEmitente,
      valorVenda: 1,
      chaveAcesso: chave.padEnd(44, "0").slice(0, 44),
      itens: [{ codProduto: "AR00000001", grade: "UNICA", qtd: 1, valorVenda: 1 }],
    },
  ]),
);
brief("expedicao.informarNotaFiscal GSN-E2E-1", nfSaida);

console.log(JSON.stringify({
  cnpjEmitente: cfg.cnpjEmitente,
  enviarPedidosJaOk: true,
  consultarPedido: pedido.ok,
  fornecedor: forn.ok && parseSoapBoolean(forn.bodyXml),
  nfEntrada: nf.ok && nf.booleanReturn,
  stock,
}, null, 2));
