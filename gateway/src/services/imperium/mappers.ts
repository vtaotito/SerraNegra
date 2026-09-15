import { loadImperiumConfig } from "./config.js";
import type { ImperiumCliente, ImperiumCargaInput, ImperiumNotaSaida, ImperiumProdutoCadastro } from "./types.js";

export type SapOrderRow = {
  doc_entry: number;
  doc_num: number;
  card_code: string | null;
  card_name: string | null;
  comments: string | null;
  address?: string | null;
  address2?: string | null;
  raw_json?: Record<string, unknown> | null;
};

export type SapOrderLine = {
  item_code: string | null;
  item_description?: string | null;
  quantity: number | string | null;
  line_total: number | string | null;
  unit_price?: number | string | null;
};

export type SapPartner = {
  CardCode?: string;
  CardName?: string;
  FederalTaxID?: string;
  Address?: string;
  City?: string;
  County?: string;
  State?: string;
  ZipCode?: string;
  CardType?: string;
  BPAddresses?: Array<{
    AddressType?: string;
    Street?: string;
    StreetNo?: string;
    Block?: string;
    City?: string;
    State?: string;
    ZipCode?: string;
    Building?: string;
  }>;
};

export type SapInvoiceRow = {
  nfe_number?: string | number | null;
  folio_number?: string | number | null;
  nfe_key?: string | null;
  series_number?: string | number | null;
  doc_total?: number | string | null;
  base_doc_num?: number | null;
  lines?: Array<{
    item_code?: string | null;
    quantity?: number | string | null;
    line_total?: number | string | null;
  }>;
};

function digitsOnly(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

function parseAddress(address?: string | null, address2?: string | null): {
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
} {
  const line1 = (address ?? "").trim();
  const line2 = (address2 ?? "").trim();
  let logradouro = line1;
  let numero = "";
  const streetMatch = line1.match(/^(.*?)[,\s]+(\d+\w*)\s*$/);
  if (streetMatch) {
    logradouro = streetMatch[1].trim();
    numero = streetMatch[2].trim();
  }

  const parts = line2.split(/[-,/]/).map((p) => p.trim()).filter(Boolean);
  let bairro = "";
  let cidade = "";
  let uf = "";
  if (parts.length >= 3) {
    bairro = parts[0];
    cidade = parts[1];
    uf = parts[parts.length - 1].slice(0, 2).toUpperCase();
  } else if (parts.length === 2) {
    cidade = parts[0];
    uf = parts[1].slice(0, 2).toUpperCase();
  } else if (parts.length === 1) {
    cidade = parts[0];
  }

  return { logradouro, numero, bairro, cidade, uf };
}

export function mapCliente(order: SapOrderRow, partner?: SapPartner | null): ImperiumCliente {
  const shipTo = partner?.BPAddresses?.find((a) => /ship/i.test(a.AddressType ?? "")) ?? partner?.BPAddresses?.[0];
  const parsed = parseAddress(
    order.address ?? (order.raw_json?.Address as string | undefined) ?? partner?.Address,
    order.address2 ?? (order.raw_json?.Address2 as string | undefined),
  );

  const cpfCnpj = digitsOnly(partner?.FederalTaxID);
  return {
    codCliente: order.card_code ?? partner?.CardCode ?? "",
    nome: order.card_name ?? partner?.CardName ?? "",
    cpfCnpj,
    tipoPessoa: cpfCnpj.length > 11 ? "J" : "F",
    logradouro: shipTo?.Street || parsed.logradouro,
    numero: shipTo?.StreetNo || parsed.numero,
    bairro: shipTo?.Block || parsed.bairro,
    cidade: shipTo?.City || partner?.City || parsed.cidade,
    uf: (shipTo?.State || partner?.State || parsed.uf).slice(0, 2).toUpperCase(),
    complemento: shipTo?.Building ?? "",
    referencia: "",
  };
}

export function mapCargaFromOrders(
  orders: Array<{ header: SapOrderRow; lines: SapOrderLine[] }>,
  opts: { placa?: string; placaExpedicao?: string; partnerByCard?: Record<string, SapPartner | null> } = {},
): ImperiumCargaInput {
  const cfg = loadImperiumConfig();
  const first = orders[0]?.header;
  if (!first) throw new Error("Nenhum pedido para montar a carga");

  const placa = (opts.placa ?? cfg.defaultPlaca).trim();
  if (!placa) throw new Error("Placa obrigatória para enviarPedidos");

  return {
    codCarga: String(first.doc_num),
    placa,
    placaExpedicao: opts.placaExpedicao ?? "",
    pedidos: orders.map(({ header, lines }) => ({
      codPedido: String(header.doc_num),
      tipo: "ENTREGA",
      linhaEntrega: header.address2 ?? "",
      cliente: mapCliente(header, opts.partnerByCard?.[header.card_code ?? ""] ?? null),
      observacao: header.comments,
      produtos: lines
        .filter((l) => l.item_code)
        .map((l) => ({
          codProduto: String(l.item_code),
          grade: cfg.defaultGrade,
          quantidade: Number(l.quantity) || 0,
          valorVenda: Number(l.line_total) || 0,
        })),
    })),
  };
}

export function mapProdutoCadastro(item: {
  ItemCode?: string;
  item_code?: string;
  ItemName?: string;
  item_name?: string;
  descricao?: string;
}): ImperiumProdutoCadastro {
  const cfg = loadImperiumConfig();
  const idProduto = String(item.ItemCode ?? item.item_code ?? "").trim();
  if (!idProduto) throw new Error("Item sem código");
  return {
    idProduto,
    descricao: String(item.ItemName ?? item.item_name ?? item.descricao ?? idProduto).slice(0, 120),
    grade: cfg.defaultGrade,
    idFabricante: cfg.defaultFabricante,
    tipo: "1",
    idClasse: cfg.defaultClasse,
  };
}

export function mapNotasSaida(invoices: SapInvoiceRow[]): ImperiumNotaSaida[] {
  const cfg = loadImperiumConfig();
  return invoices
    .filter((inv) => inv.nfe_key || inv.nfe_number)
    .map((inv) => ({
      codPedido: inv.base_doc_num != null ? String(inv.base_doc_num) : "",
      numeroNf: Number(inv.nfe_number ?? inv.folio_number ?? 0),
      serieNf: String(inv.series_number ?? "1"),
      cnpjEmitente: cfg.cnpjEmitente,
      valorVenda: Number(inv.doc_total) || 0,
      chaveAcesso: String(inv.nfe_key ?? ""),
      itens: (inv.lines ?? [])
        .filter((l) => l.item_code)
        .map((l) => ({
          codProduto: String(l.item_code),
          grade: cfg.defaultGrade,
          qtd: Math.round(Number(l.quantity) || 0),
          valorVenda: Number(l.line_total) || 0,
        })),
    }));
}
