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

function soapText(value: string | null | undefined, max = 80): string {
  return (value ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function parseAddress(address?: string | null, address2?: string | null): {
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
} {
  const lines = [address, address2]
    .filter(Boolean)
    .join("\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^BRASIL$/i.test(l));

  let logradouro = lines[0] ?? "";
  let numero = "";
  let bairro = "";
  let cidade = "";
  let uf = "";

  const streetMatch = logradouro.match(/^(.*?)[,\s]+(\d+\w*)\s*$/);
  if (streetMatch) {
    logradouro = streetMatch[1].trim();
    numero = streetMatch[2].trim();
  }

  for (const line of lines.slice(1)) {
    const loc = line.match(/^(?:[\d.]{5,}-?\d*)-([A-Za-zÀ-ú\s]+)-([A-Za-z]{2})$/);
    if (loc) {
      cidade = loc[1].trim();
      uf = loc[2].slice(0, 2).toUpperCase();
      continue;
    }
    const parts = line.split(/[-,/]/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 3 && parts[parts.length - 1].length <= 2) {
      bairro = bairro || parts[0];
      cidade = cidade || parts[1];
      uf = uf || parts[parts.length - 1].slice(0, 2).toUpperCase();
    } else if (parts.length === 2 && parts[1].length <= 2) {
      cidade = cidade || parts[0];
      uf = uf || parts[1].slice(0, 2).toUpperCase();
    }
  }

  return {
    logradouro: soapText(logradouro, 60),
    numero: soapText(numero, 10),
    bairro: soapText(bairro, 40),
    cidade: soapText(cidade, 40),
    uf: soapText(uf, 2),
  };
}

export function mapCliente(order: SapOrderRow, partner?: SapPartner | null): ImperiumCliente {
  const shipTo = partner?.BPAddresses?.find((a) => /ship/i.test(a.AddressType ?? "")) ?? partner?.BPAddresses?.[0];
  const parsed = parseAddress(
    order.address ?? (order.raw_json?.Address as string | undefined) ?? partner?.Address,
    order.address2 ?? (order.raw_json?.Address2 as string | undefined),
  );

  const raw = order.raw_json ?? {};
  const cpfCnpj = digitsOnly(
    partner?.FederalTaxID
      ?? (raw.FederalTaxID as string | undefined)
      ?? (raw.LicTradNum as string | undefined)
      ?? (raw.TaxIdNum as string | undefined),
  );
  return {
    codCliente: soapText(order.card_code ?? partner?.CardCode ?? "", 20),
    nome: soapText(order.card_name ?? partner?.CardName ?? "", 80),
    cpfCnpj,
    tipoPessoa: cpfCnpj.length === 11 ? "F" : "J",
    logradouro: soapText(shipTo?.Street || parsed.logradouro, 60),
    numero: soapText(shipTo?.StreetNo || parsed.numero, 10),
    bairro: soapText(shipTo?.Block || parsed.bairro, 40),
    cidade: soapText(shipTo?.City || partner?.City || parsed.cidade, 40),
    uf: soapText(shipTo?.State || partner?.State || parsed.uf, 2),
    complemento: soapText(shipTo?.Building ?? "", 40),
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
    pedidos: orders.map(({ header, lines }) => {
      const cliente = mapCliente(header, opts.partnerByCard?.[header.card_code ?? ""] ?? null);
      const linha = soapText(cliente.cidade || cliente.uf || "GSN", 40);
      return {
        codPedido: String(header.doc_num),
        tipo: "ENTREGA",
        linhaEntrega: linha,
        itinerarioId: linha,
        itinerarioNome: linha,
        cliente,
        observacao: soapText(header.comments, 120),
        produtos: lines
          .filter((l) => l.item_code)
          .map((l) => ({
            codProduto: String(l.item_code),
            grade: cfg.defaultGrade,
            quantidade: Number(l.quantity) || 0,
            valorVenda: Number(l.line_total) || 0,
          })),
      };
    }),
  };
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&ndash;/g, "-")
    .replace(/&mdash;/g, "-");
}

/** Oracle DSC_PRODUTO é VARCHAR2(100 BYTE); acentos e lixo de encoding estouram o limite. */
export function sanitizeProdutoDescricao(value: string, maxBytes = 100): string {
  const cleaned = decodeHtmlEntities(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  let out = "";
  for (const ch of cleaned) {
    if (Buffer.byteLength(out + ch, "utf8") > maxBytes) break;
    out += ch;
  }
  return out || "PRODUTO";
}

export function mapProdutoCadastro(item: {
  ItemCode?: string;
  item_code?: string;
  sap_item_code?: string;
  ItemName?: string;
  item_name?: string;
  sap_item_name?: string;
  descricao?: string;
  ean?: string | null;
  unit_of_measure?: string | null;
  packaging_type?: string | null;
  units_per_package?: number | string | null;
  sap_group_code?: number | string | null;
}): ImperiumProdutoCadastro {
  const cfg = loadImperiumConfig();
  const idProduto = String(item.ItemCode ?? item.item_code ?? item.sap_item_code ?? "").trim();
  if (!idProduto) throw new Error("Item sem código");

  const unidade = (item.unit_of_measure ?? item.packaging_type ?? "UN").trim() || "UN";
  const ean = (item.ean ?? "").trim();
  const packQty = Number(item.units_per_package);
  const embalagens = [
    {
      codBarras: ean,
      qtdEmbalagem: 1,
      descricao: unidade.slice(0, 20) || "UN",
    },
  ];
  if (Number.isFinite(packQty) && packQty > 1) {
    embalagens.push({
      codBarras: "",
      qtdEmbalagem: packQty,
      descricao: (item.packaging_type ?? "CX").slice(0, 20) || "CX",
    });
  }

  const group = item.sap_group_code != null && String(item.sap_group_code).trim() !== ""
    ? String(item.sap_group_code)
    : cfg.defaultClasse;

  return {
    idProduto,
    descricao: sanitizeProdutoDescricao(
      String(item.ItemName ?? item.item_name ?? item.sap_item_name ?? item.descricao ?? idProduto),
    ),
    grade: cfg.defaultGrade,
    idFabricante: cfg.defaultFabricante,
    tipo: "1",
    idClasse: group,
    referencia: idProduto.slice(0, 10),
    possuiPesoVariavel: "N",
    embalagens,
  };
}

export function cnpjFromNfeKey(chave: string | null | undefined): string {
  const digits = digitsOnly(chave);
  if (digits.length !== 44) return "";
  return digits.slice(6, 20);
}

export function mapNotasSaida(invoices: SapInvoiceRow[]): ImperiumNotaSaida[] {
  const cfg = loadImperiumConfig();
  return invoices
    .filter((inv) => inv.nfe_key || inv.nfe_number)
    .map((inv) => {
      const chave = String(inv.nfe_key ?? "");
      return {
        codPedido: inv.base_doc_num != null ? String(inv.base_doc_num) : "",
        numeroNf: Number(inv.nfe_number ?? inv.folio_number ?? 0),
        serieNf: String(inv.series_number ?? "1"),
        cnpjEmitente: cnpjFromNfeKey(chave) || cfg.cnpjEmitente,
        valorVenda: Number(inv.doc_total) || 0,
        chaveAcesso: chave,
        itens: (inv.lines ?? [])
          .filter((l) => l.item_code)
          .map((l) => ({
            codProduto: String(l.item_code),
            grade: cfg.defaultGrade,
            qtd: Math.round(Number(l.quantity) || 0),
            valorVenda: Number(l.line_total) || 0,
          })),
      };
    });
}
