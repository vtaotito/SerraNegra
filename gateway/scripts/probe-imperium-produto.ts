import { request } from "undici";
import { callImperiumSoap } from "../src/services/imperium/soapClient.js";
import { basicAuthHeader, loadImperiumConfig } from "../src/services/imperium/config.js";
import { buildSoapEnvelope } from "../src/services/imperium/xml.js";
import {
  buildEmptyBody,
  buildFabricanteSalvarXml,
  buildProdutoClasseSalvarXml,
  buildProdutoSalvarXml,
} from "../src/services/imperium/builders.js";
import { extractSoapFault, parseSoapBoolean } from "../src/services/imperium/xml.js";

function brief(label: string, r: Awaited<ReturnType<typeof callImperiumSoap>>) {
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify({
    ok: r.ok,
    status: r.statusCode,
    fault: r.fault,
    bool: r.booleanReturn,
    preview: r.bodyXml.slice(0, 500),
  }, null, 2));
}

brief("produto.listar", await callImperiumSoap("produto", "listar", buildEmptyBody()));
brief("fabricante.salvar", await callImperiumSoap("fabricante", "salvar", buildFabricanteSalvarXml("1", "Garrafaria Serra Negra")));
brief("produtoClasse.salvar", await callImperiumSoap("produtoClasse", "salvar", buildProdutoClasseSalvarXml("101", "Cachaca")));
brief("produto.salvar", await callImperiumSoap("produto", "salvar", buildProdutoSalvarXml({
  idProduto: "GSNTEST1",
  descricao: "PRODUTO TESTE GSN",
  grade: "UNICA",
  idFabricante: "1",
  tipo: "1",
  idClasse: "101",
  referencia: "GSNTEST1",
  possuiPesoVariavel: "N",
  embalagens: [{ qtdEmbalagem: 1, descricao: "UN" }],
})));

const cfg = loadImperiumConfig();
const ns = "http://wms.local/soap/index/index/service/produto";
const inner = buildProdutoSalvarXml({
  idProduto: "GSNTEST1",
  descricao: "PRODUTO TESTE GSN",
  grade: "UNICA",
  idFabricante: "1",
  tipo: "1",
  idClasse: "101",
  referencia: "GSNTEST1",
  possuiPesoVariavel: "N",
  embalagens: [{ qtdEmbalagem: 1, descricao: "UN" }],
});
const envelope = buildSoapEnvelope(ns, "tns", "salvar", inner);
const variants: Array<{ label: string; url: string; headers: Record<string, string> }> = [
  {
    label: "ns wms.local + Host wms.local",
    url: `${cfg.baseUrl}/soap/index/index/service/produto`,
    headers: { Host: "wms.local", SOAPAction: `${ns}#salvar` },
  },
  {
    label: "POST no WSDL endpoint",
    url: `${cfg.baseUrl}/soap/index/wsdl/service/produto`,
    headers: { SOAPAction: `${ns}#salvar` },
  },
];

for (const v of variants) {
  const res = await request(v.url, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(cfg.username, cfg.password),
      "Content-Type": "text/xml; charset=utf-8",
      Accept: "text/xml, application/xml, */*",
      ...v.headers,
    },
    body: envelope,
  });
  const bodyXml = await res.body.text();
  console.log(`\n=== variant ${v.label} ===`);
  console.log(JSON.stringify({
    status: res.statusCode,
    fault: extractSoapFault(bodyXml),
    bool: parseSoapBoolean(bodyXml),
    preview: bodyXml.slice(0, 400),
  }, null, 2));
}
