import { formatBrMoney, xmlFloat, xmlInt, xmlString } from "./xml.js";
import type { ImperiumCargaInput, ImperiumNotaSaida, ImperiumProdutoCadastro } from "./types.js";

export function buildEnviarPedidosXml(input: ImperiumCargaInput): string {
  const pedidos = input.pedidos
    .map((pedido) => {
      const produtos = pedido.produtos
        .map(
          (p) => `                <tns:produto xsi:type="tns:produto">
                  ${xmlString("codProduto", p.codProduto)}
                  ${xmlString("grade", p.grade)}
                  ${p.lote ? xmlString("lote", p.lote) : `<lote xsi:nil="true"/>`}
                  ${xmlString("quantidade", String(p.quantidade))}
                  <quantidadeAtendida xsi:nil="true"/>
                  <quantidadeConferida xsi:nil="true"/>
                  <fatorEmbalagemVenda xsi:nil="true"/>
                  <proprietario xsi:nil="true"/>
                  <embalado xsi:nil="true"/>
                  ${xmlString("valorVenda", formatBrMoney(p.valorVenda))}
                  <seriais xsi:nil="true"/>
                </tns:produto>`,
        )
        .join("\n");

      const c = pedido.cliente;
      return `            <tns:pedido xsi:type="tns:pedido">
              ${xmlString("codPedido", pedido.codPedido)}
              ${xmlString("tipo", pedido.tipo || "ENTREGA")}
              ${xmlString("linhaEntrega", pedido.linhaEntrega ?? "")}
              <tns:itinerario xsi:type="tns:itinerario">
                 ${xmlString("idItinerario", pedido.itinerarioId ?? pedido.linhaEntrega ?? "")}
                 ${xmlString("nomeItinerario", pedido.itinerarioNome ?? pedido.linhaEntrega ?? "")}
              </tns:itinerario>
              <tns:cliente xsi:type="tns:cliente">
                  ${xmlString("codCliente", c.codCliente)}
                  ${xmlString("nome", c.nome)}
                  ${xmlString("cpf_cnpj", c.cpfCnpj)}
                  ${xmlString("tipoPessoa", c.tipoPessoa)}
                  ${xmlString("logradouro", c.logradouro)}
                  ${xmlString("numero", c.numero)}
                  ${xmlString("bairro", c.bairro)}
                  ${xmlString("cidade", c.cidade)}
                  ${xmlString("uf", c.uf)}
                  ${xmlString("complemento", c.complemento ?? "")}
                  ${xmlString("referencia", c.referencia ?? "")}
              </tns:cliente>
              <produtos>
${produtos}
              </produtos>
              <centralEntrega xsi:nil="true"/>
              <pontoTransbordo xsi:nil="true"/>
              ${pedido.observacao ? xmlString("observacao", pedido.observacao) : `<observacao xsi:nil="true"/>`}
            </tns:pedido>`;
    })
    .join("\n");

  return `
      ${xmlString("codCarga", input.codCarga)}
      ${xmlString("placa", input.placa)}
      ${xmlString("placaExpedicao", input.placaExpedicao ?? "")}
      <pedidos xsi:type="tns:pedidos">
      	<pedidos>
${pedidos}
      	</pedidos>
      </pedidos>`;
}

export function buildProdutoSalvarXml(input: ImperiumProdutoCadastro): string {
  return `
         ${xmlString("idProduto", input.idProduto)}
         ${xmlString("descricao", input.descricao)}
         ${xmlString("grade", input.grade)}
         ${xmlString("idFabricante", input.idFabricante)}
         ${xmlString("tipo", input.tipo)}
         ${xmlString("idClasse", input.idClasse)}`;
}

export function buildInformarNotaFiscalXml(notas: ImperiumNotaSaida[]): string {
  const items = notas
    .map((nf) => {
      const pedidos = nf.codPedido
        ? `	          <pedidos xsi:type="tns:ArrayOfpedidoFaturado">
	          	<item xsi:type="tns:pedidoFaturado">
	           		${xmlString("codPedido", nf.codPedido)}
	           		${xmlString("tipoPedido", "ENTREGA")}
	          	</item>
	          </pedidos>`
        : `<pedidos xsi:nil="true"/>`;

      const produtos = nf.itens
        .map(
          (item) => `	          	<item xsi:type="tns:notaFiscalProduto">
	           		${xmlString("codProduto", item.codProduto)}
	           		${xmlString("grade", item.grade)}
					${xmlInt("qtd", item.qtd)}
	           		${xmlFloat("valorVenda", item.valorVenda)}
	           	</item>`,
        )
        .join("\n");

      return `            <item xsi:type="tns:notaFiscal">
${pedidos}
               ${xmlInt("numeroNf", nf.numeroNf)}
               ${xmlString("serieNf", nf.serieNf)}
               ${xmlString("cnpjEmitente", nf.cnpjEmitente)}
               ${xmlFloat("valorVenda", nf.valorVenda)}
               ${xmlString("chaveAcesso", nf.chaveAcesso)}
	          <itens xsi:type="tns:ArrayOfnotaFiscalProduto">
${produtos}
	          </itens>
            </item>`;
    })
    .join("\n");

  return `
         <nf xsi:type="tns:ArrayOfnotaFiscal">
${items}
         </nf>`;
}

export function buildChecarStatusXml(idCargaExterno: string, tipoCarga = "C"): string {
  return `
         ${xmlInt("idCargaExterno", Number(idCargaExterno) || 0)}
         ${xmlString("tipoCarga", tipoCarga)}`;
}

export function buildConsultarCargaXml(idCargaExterno: string, tipoCarga = "C"): string {
  return `
         ${xmlString("idCargaExterno", idCargaExterno)}
         ${xmlString("tipoCarga", tipoCarga)}`;
}

export function buildCancelarPedidoXml(idPedido: string): string {
  return `
         ${xmlString("idCargaExterno", "")}
         ${xmlString("tipoCarga", "C")}
         ${xmlString("tipoPedido", "ENTREGA")}
         ${xmlString("idPedido", idPedido)}`;
}

export function buildCancelarNotaFiscalXml(cnpjEmitente: string, numeroNf: number, serieNF: string): string {
  return `
         ${xmlString("cnpjEmitente", cnpjEmitente)}
         ${xmlInt("numeroNf", numeroNf)}
         ${xmlString("serieNF", serieNF)}`;
}

export function buildListCargasXml(dataInicial: string, dataFinal: string): string {
  return `
         ${xmlString("dataInicial", dataInicial)}
         ${xmlString("dataFinal", dataFinal)}`;
}

export function buildConsultarPedidoXml(idPedido: string): string {
  return `
         ${xmlString("idPedido", idPedido)}`;
}

export function buildFabricanteSalvarXml(idFabricante: string, nome: string): string {
  return `
         ${xmlString("idFabricante", idFabricante)}
         ${xmlString("nome", nome)}`;
}

export function buildEmptyBody(): string {
  return "";
}
