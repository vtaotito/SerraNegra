import { formatBrMoney, xmlFloat, xmlInt, xmlString } from "./xml.js";
import type {
  ImperiumCargaInput,
  ImperiumFiltroProduto,
  ImperiumFornecedor,
  ImperiumNotaEntrada,
  ImperiumNotaSaida,
  ImperiumProdutoCadastro,
} from "./types.js";

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
  const embalagens = (input.embalagens ?? [])
    .map(
      (e) => `               <embalagem>
                  ${xmlString("codBarras", e.codBarras ?? "")}
                  ${xmlFloat("qtdEmbalagem", e.qtdEmbalagem)}
                  ${xmlString("descricao", e.descricao)}
                  ${xmlFloat("altura", e.altura ?? 0)}
                  ${xmlFloat("largura", e.largura ?? 0)}
                  ${xmlFloat("comprimento", e.comprimento ?? 0)}
                  ${xmlFloat("peso", e.peso ?? 0)}
                  ${xmlFloat("cubagem", e.cubagem ?? 0)}
               </embalagem>`,
    )
    .join("\n");

  return `
         ${xmlString("idProduto", input.idProduto)}
         ${xmlString("descricao", input.descricao)}
         ${xmlString("grade", input.grade)}
         ${xmlString("idFabricante", input.idFabricante)}
         ${xmlString("tipo", input.tipo)}
         ${xmlString("idClasse", input.idClasse)}
         <embalagens xsi:type="tns:ArrayOfembalagem">
${embalagens}
         </embalagens>
         ${xmlString("referencia", input.referencia ?? "")}
         ${xmlString("possuiPesoVariavel", input.possuiPesoVariavel ?? "N")}
         <volumes xsi:type="tns:ArrayOfvolume"/>`;
}

export function buildProdutoClasseSalvarXml(idClasse: string, nome: string, idClassePai = ""): string {
  return `
         ${xmlString("idClasse", idClasse)}
         ${xmlString("nome", nome)}
         ${xmlString("idClassePai", idClassePai)}`;
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

      const chave =
        nf.chaveAcesso && nf.chaveAcesso.replace(/\D/g, "").length === 44
          ? `               ${xmlString("chaveAcesso", nf.chaveAcesso.replace(/\D/g, ""))}`
          : "";

      return `            <item xsi:type="tns:notaFiscal">
${pedidos}
               ${xmlInt("numeroNf", nf.numeroNf)}
               ${xmlString("serieNf", nf.serieNf)}
               ${xmlString("cnpjEmitente", nf.cnpjEmitente)}
               ${xmlFloat("valorVenda", nf.valorVenda)}
${chave}
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

export function buildConsultaEstoqueGeralXml(idAreas = ""): string {
  return `
         ${xmlString("idAreas", idAreas)}`;
}

export function buildConsultarEstoqueXml(produtos: ImperiumFiltroProduto[], idAreas = ""): string {
  const items = produtos
    .map(
      (p) => `         		<filtroProduto>
         			${xmlString("codProduto", p.codProduto)}
         			${xmlString("grade", p.grade ?? "UNICA")}
         		</filtroProduto>`,
    )
    .join("\n");

  return `
         <produtos xsi:type="tns:ArrayOffiltroProduto">
${items}
         </produtos>
         ${xmlString("idAreas", idAreas)}`;
}

export function buildConsultarEstoqueFiltradoXml(tipoFiltro: string, filtro: string): string {
  return `
         ${xmlString("tipoFiltro", tipoFiltro)}
         ${xmlString("filtro", filtro)}`;
}

export function buildConsultarMovimentacaoXml(ponteiro: string): string {
  return `
         ${xmlString("ponteiro", ponteiro)}`;
}

export function buildFornecedorSalvarXml(input: ImperiumFornecedor): string {
  return `
         ${xmlString("idFornecedor", input.idFornecedor)}
         ${xmlString("cnpj", input.cnpj ?? "")}
         ${xmlString("insc", input.insc ?? "")}
         ${xmlString("nome", input.nome)}
         ${xmlString("cpf", input.cpf ?? "")}`;
}

export function buildNotaFiscalSalvarXml(input: ImperiumNotaEntrada): string {
  const itens = input.itens
    .map(
      (item) => `			<item xsi:type="tns:item">
				${xmlString("idProduto", item.idProduto)}
				${xmlString("grade", item.grade ?? "UNICA")}
				${xmlString("quantidade", String(item.quantidade))}
			</item>`,
    )
    .join("\n");

  return `
		${xmlString("idFornecedor", input.idFornecedor)}
		${xmlString("numero", input.numero)}
		${xmlString("serie", input.serie)}
		${xmlString("dataEmissao", input.dataEmissao)}
		${xmlString("tipoNota", "E")}
		${xmlString("placa", input.placa ?? "")}
		<itens xsi:type="tns:ArrayOfitem">
${itens}
		</itens>
		${xmlString("bonificacao", input.bonificacao ?? "N")}`;
}

export function buildNotaFiscalSalvarJsonXml(input: ImperiumNotaEntrada): string {
  const itensJson = JSON.stringify({
    produtos: input.itens.map((item) => ({
      idProduto: item.idProduto,
      grade: item.grade ?? "UNICA",
      quantidade: String(item.quantidade),
    })),
  });

  return `
         ${xmlString("idFornecedor", input.idFornecedor)}
         ${xmlString("numero", input.numero)}
         ${xmlString("serie", input.serie)}
         ${xmlString("dataEmissao", input.dataEmissao)}
         ${xmlString("placa", input.placa ?? "")}
         ${xmlString("itens", itensJson)}
         ${xmlString("bonificacao", input.bonificacao ?? "N")}
         ${xmlString("observacao", input.observacao ?? "")}
         ${xmlString("cnpjDestinatario", input.cnpjDestinatario ?? "")}`;
}

export function buildBuscarNfXml(input: {
  idFornecedor: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  tipoNota?: string;
}): string {
  return `
         ${xmlString("idFornecedor", input.idFornecedor)}
         ${xmlString("numero", input.numero)}
         ${xmlString("serie", input.serie)}
         ${xmlString("dataEmissao", input.dataEmissao)}
         ${input.tipoNota ? xmlString("tipoNota", input.tipoNota) : ""}`;
}
