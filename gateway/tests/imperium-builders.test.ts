import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { buildEnviarPedidosXml, buildProdutoSalvarXml, buildInformarNotaFiscalXml } from "../src/services/imperium/builders.js";
import { escapeXml, formatBrMoney, parseSoapBoolean, extractSoapFault, buildSoapEnvelope } from "../src/services/imperium/xml.js";
import { mapCargaFromOrders, mapProdutoCadastro, mapCliente } from "../src/services/imperium/mappers.js";

describe("Imperium XML helpers", () => {
  it("escapa caracteres especiais", () => {
    assert.equal(escapeXml(`A&B <C> "x"`), "A&amp;B &lt;C&gt; &quot;x&quot;");
  });

  it("formata dinheiro no padrão dos XMLs", () => {
    assert.equal(formatBrMoney(5850), "5850,00");
    assert.equal(formatBrMoney(13.9), "13,90");
  });

  it("interpreta retorno SOAP boolean", () => {
    assert.equal(parseSoapBoolean("<ns1:salvarResponse><return xsi:type=\"xsd:boolean\">true</return></ns1:salvarResponse>"), true);
    assert.equal(parseSoapBoolean("<return>false</return>"), false);
    assert.equal(extractSoapFault("<SOAP-ENV:Fault><faultstring>Produto inválido</faultstring></SOAP-ENV:Fault>"), "Produto inválido");
  });

  it("monta envelope SOAP RPC", () => {
    const xml = buildSoapEnvelope("http://129.148.29.26:82/soap/index/index/service/produto", "tns", "listar", "");
    assert.match(xml, /<tns:listar /);
    assert.match(xml, /soapenv:Envelope/);
    assert.match(xml, /129\.148\.29\.26:82/);
  });
});

describe("Imperium builders", () => {
  it("enviarPedidos contém carga, placa e pedido", () => {
    const xml = buildEnviarPedidosXml({
      codCarga: "2755761",
      placa: "ABC1234",
      pedidos: [
        {
          codPedido: "2755761",
          tipo: "ENTREGA",
          linhaEntrega: "FUNDAO",
          cliente: {
            codCliente: "12",
            nome: "AUTO SERV IDEAL",
            cpfCnpj: "31466253000189",
            tipoPessoa: "J",
            logradouro: "RUA AMERICO BITANCOURT",
            numero: "400",
            bairro: "CENTRO",
            cidade: "FUNDAO",
            uf: "ES",
          },
          produtos: [{ codProduto: "10", grade: "UNICA", quantidade: 130, valorVenda: 5850 }],
        },
      ],
    });
    assert.match(xml, /<codCarga[^>]*>2755761<\/codCarga>/);
    assert.match(xml, /<placa[^>]*>ABC1234<\/placa>/);
    assert.match(xml, /<codPedido[^>]*>2755761<\/codPedido>/);
    assert.match(xml, /<valorVenda[^>]*>5850,00<\/valorVenda>/);
    assert.match(xml, /<cpf_cnpj[^>]*>31466253000189<\/cpf_cnpj>/);
  });

  it("produto.salvar segue o contrato simplificado", () => {
    const xml = buildProdutoSalvarXml({
      idProduto: "200",
      descricao: "PRODUTO DE TESTE",
      grade: "UNICA",
      idFabricante: "1",
      tipo: "1",
      idClasse: "130900",
    });
    assert.match(xml, /<idProduto[^>]*>200<\/idProduto>/);
    assert.match(xml, /<tipo[^>]*>1<\/tipo>/);
  });

  it("informarNotaFiscal inclui chave de 44 dígitos", () => {
    const xml = buildInformarNotaFiscalXml([
      {
        codPedido: "449475",
        numeroNf: 140872,
        serieNf: "55/1",
        cnpjEmitente: "27264001000280",
        valorVenda: 59.99,
        chaveAcesso: "51080701212344000127550010000000981364117781",
        itens: [{ codProduto: "101028", grade: "UNICA", qtd: 1, valorVenda: 13.99 }],
      },
    ]);
    assert.match(xml, /<chaveAcesso[^>]*>51080701212344000127550010000000981364117781<\/chaveAcesso>/);
    assert.match(xml, /<numeroNf[^>]*>140872<\/numeroNf>/);
  });
});

describe("Imperium mappers", () => {
  it("mapeia pedido SAP para carga 1:1", () => {
    process.env.IMPERIUM_DEFAULT_GRADE = "UNICA";
    const carga = mapCargaFromOrders(
      [
        {
          header: {
            doc_entry: 1,
            doc_num: 90001,
            card_code: "C0001",
            card_name: "Cliente Teste",
            comments: "obs",
            address: "RUA DAS FLORES, 10",
            address2: "CENTRO - BH - MG",
          },
          lines: [{ item_code: "SKU1", quantity: 2, line_total: 20 }],
        },
      ],
      { placa: "AAA0000" },
    );
    assert.equal(carga.codCarga, "90001");
    assert.equal(carga.pedidos[0].produtos[0].codProduto, "SKU1");
    assert.equal(carga.pedidos[0].cliente.cidade, "BH");
    assert.equal(carga.pedidos[0].cliente.uf, "MG");
  });

  it("usa FederalTaxID do SAP para tipo pessoa", () => {
    const cliente = mapCliente(
      { doc_entry: 1, doc_num: 1, card_code: "C1", card_name: "X", comments: null },
      { FederalTaxID: "12.345.678/0001-99" },
    );
    assert.equal(cliente.cpfCnpj, "12345678000199");
    assert.equal(cliente.tipoPessoa, "J");
  });

  it("mapeia item do catálogo", () => {
    const p = mapProdutoCadastro({ ItemCode: "ABC", ItemName: "Garrafa" });
    assert.equal(p.idProduto, "ABC");
    assert.equal(p.tipo, "1");
  });
});
