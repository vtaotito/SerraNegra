import { SapServiceLayerClient } from "../../../sap-connector/src/index.js";
import { SapHttpError } from "../../../sap-connector/src/errors.js";

/**
 * Serviço para sincronizar entidades adicionais do SAP B1:
 * - Items (Produtos/Catálogo)
 * - WarehouseGenEntries / ItemWarehouseInfo (Estoque por depósito)
 * - BusinessPartners (Clientes)
 */
export class SapEntitiesService {
  constructor(private readonly client: SapServiceLayerClient) {}

  private escapeODataLiteral(value: string): string {
    return value.replace(/'/g, "''");
  }

  private async queryWithCandidates<T>(
    context: string,
    candidates: string[],
    correlationId?: string
  ): Promise<T[]> {
    let lastError: unknown;
    for (let i = 0; i < candidates.length; i++) {
      try {
        const res = await this.client.get<{ value: T[] }>(candidates[i], { correlationId });
        const rows = res.data.value || [];
        console.log(`[${context}] Candidato #${i + 1} OK - ${rows.length} registros`);
        return rows;
      } catch (err) {
        lastError = err;
        if (err instanceof SapHttpError && err.status === 400) continue;
        throw err;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error(`Erro ao consultar entidade SAP (${context}).`);
  }

  // ========================================
  // ITEMS (Produtos)
  // ========================================

  async listItems(
    opts: { limit?: number; onlyActive?: boolean } = {},
    correlationId?: string
  ): Promise<SapItemRow[]> {
    const limit = opts.limit ?? 200;
    const candidates: string[] = [];

    const fullSelect = "ItemCode,ItemName,InventoryItem,SalesItem,PurchaseItem,InventoryUOM,Valid,Frozen,ItemsGroupCode,BarCode,UpdateDate";
    const minSelect = "ItemCode,ItemName,InventoryUOM,Valid,Frozen";
    const bareSelect = "ItemCode,ItemName";

    const activeFilter = opts.onlyActive !== false ? "&$filter=Valid eq 'tYES' and Frozen eq 'tNO'" : "";

    candidates.push(`/Items?$select=${fullSelect}${activeFilter}&$top=${limit}&$orderby=ItemCode asc`);
    candidates.push(`/Items?$select=${minSelect}${activeFilter}&$top=${limit}&$orderby=ItemCode asc`);
    candidates.push(`/Items?$select=${fullSelect}&$top=${limit}`);
    candidates.push(`/Items?$select=${minSelect}&$top=${limit}`);
    candidates.push(`/Items?$select=${bareSelect}&$top=${limit}`);

    return this.queryWithCandidates<SapItemRow>("listItems", candidates, correlationId);
  }

  // ========================================
  // INVENTORY (Estoque por depósito via OITW)
  // ========================================

  async listInventory(
    opts: { limit?: number } = {},
    correlationId?: string
  ): Promise<SapInventoryRow[]> {
    const limit = opts.limit ?? 500;

    // A abordagem via Service Layer para estoque por warehouse:
    // Opção 1: /Items com $expand=ItemWarehouseInfoCollection
    // Opção 2: Query SQL via /SQLQueries
    // Opção 3: /sml.svc/OITW
    // Vamos tentar expand primeiro, depois fallback
    const candidates: string[] = [];

    // Tentar expand do ItemWarehouseInfoCollection
    candidates.push(
      `/Items?$select=ItemCode,ItemName&$expand=ItemWarehouseInfoCollection($select=WarehouseCode,InStock,Committed,Ordered)&$top=${limit}&$filter=Valid eq 'tYES'`
    );
    candidates.push(
      `/Items?$select=ItemCode&$expand=ItemWarehouseInfoCollection($select=WarehouseCode,InStock)&$top=${limit}`
    );
    candidates.push(
      `/Items?$select=ItemCode&$expand=ItemWarehouseInfoCollection&$top=${limit}`
    );

    let lastError: unknown;
    for (let i = 0; i < candidates.length; i++) {
      try {
        const res = await this.client.get<{ value: SapItemWithWarehouse[] }>(candidates[i], { correlationId });
        const items = res.data.value || [];
        console.log(`[listInventory] Candidato #${i + 1} OK - ${items.length} itens com warehouse info`);

        // Flatten: cada item pode ter múltiplos warehouses
        const inventory: SapInventoryRow[] = [];
        for (const item of items) {
          const whInfo = item.ItemWarehouseInfoCollection || [];
          for (const wh of whInfo) {
            // Só incluir se tem estoque
            const inStock = wh.InStock ?? 0;
            const committed = wh.Committed ?? 0;
            const ordered = wh.Ordered ?? 0;
            if (inStock > 0 || committed > 0 || ordered > 0) {
              inventory.push({
                ItemCode: item.ItemCode,
                WarehouseCode: wh.WarehouseCode,
                InStock: inStock,
                Committed: committed,
                Ordered: ordered,
              });
            }
          }
        }
        return inventory;
      } catch (err) {
        lastError = err;
        if (err instanceof SapHttpError && err.status === 400) continue;
        throw err;
      }
    }

    // Se expand não funciona, retornar lista vazia (feature não suportada)
    console.log("[listInventory] Nenhum candidato funcionou - retornando vazio");
    return [];
  }

  // ========================================
  // BUSINESS PARTNERS (Clientes)
  // ========================================

  async listBusinessPartners(
    opts: { limit?: number; cardType?: string } = {},
    correlationId?: string
  ): Promise<SapBusinessPartnerRow[]> {
    const limit = opts.limit ?? 200;
    const cardType = opts.cardType ?? "cCustomer"; // cCustomer, cSupplier, cLead

    const candidates: string[] = [];

    const fullSelect = "CardCode,CardName,CardType,Phone1,EmailAddress,Address,City,State,Valid,Frozen,UpdateDate";
    const minSelect = "CardCode,CardName,CardType,Phone1,EmailAddress";
    const bareSelect = "CardCode,CardName";

    candidates.push(`/BusinessPartners?$select=${fullSelect}&$filter=CardType eq '${cardType}' and Valid eq 'tYES'&$top=${limit}&$orderby=CardName asc`);
    candidates.push(`/BusinessPartners?$select=${minSelect}&$filter=CardType eq '${cardType}'&$top=${limit}&$orderby=CardName asc`);
    candidates.push(`/BusinessPartners?$select=${fullSelect}&$top=${limit}`);
    candidates.push(`/BusinessPartners?$select=${minSelect}&$top=${limit}`);
    candidates.push(`/BusinessPartners?$select=${bareSelect}&$top=${limit}`);

    return this.queryWithCandidates<SapBusinessPartnerRow>("listBusinessPartners", candidates, correlationId);
  }

  // ========================================
  // SALES PERSONS (Vendedores)
  // ========================================

  async listSalesPersons(
    opts: { limit?: number } = {},
    correlationId?: string
  ): Promise<SapSalesPersonRow[]> {
    const limit = opts.limit ?? 200;
    const candidates: string[] = [];

    candidates.push(`/SalesPersons?$select=SalesEmployeeCode,SalesEmployeeName,Active&$top=${limit}&$orderby=SalesEmployeeName asc`);
    candidates.push(`/SalesPersons?$select=SalesEmployeeCode,SalesEmployeeName&$top=${limit}`);
    candidates.push(`/SalesPersons?$top=${limit}`);

    return this.queryWithCandidates<SapSalesPersonRow>("listSalesPersons", candidates, correlationId);
  }

  // ========================================
  // SPECIAL PRICES (Preço por cliente/item)
  // ========================================

  async listSpecialPrices(
    opts: { limit?: number; cardCode?: string; itemCode?: string } = {},
    correlationId?: string
  ): Promise<SapSpecialPriceRow[]> {
    const limit = opts.limit ?? 200;
    const filters: string[] = [];

    if (opts.cardCode) {
      filters.push(`CardCode eq '${this.escapeODataLiteral(opts.cardCode)}'`);
    }
    if (opts.itemCode) {
      filters.push(`ItemCode eq '${this.escapeODataLiteral(opts.itemCode)}'`);
    }
    const filterQuery = filters.length > 0 ? `&$filter=${filters.join(" and ")}` : "";

    const candidates: string[] = [];
    candidates.push(
      `/SpecialPrices?$select=CardCode,ItemCode,Price,Currency,PriceListNum,ValidFrom,ValidTo${filterQuery}&$top=${limit}`
    );
    candidates.push(`/SpecialPrices?$select=CardCode,ItemCode,Price${filterQuery}&$top=${limit}`);
    candidates.push(`/SpecialPrices?$select=CardCode,ItemCode${filterQuery}&$top=${limit}`);
    candidates.push(`/SpecialPrices?$top=${limit}`);

    return this.queryWithCandidates<SapSpecialPriceRow>("listSpecialPrices", candidates, correlationId);
  }

  // ========================================
  // DRAFTS (Rascunhos de pedido)
  // ========================================

  async listDrafts(
    opts: { limit?: number; onlySalesOrders?: boolean } = {},
    correlationId?: string
  ): Promise<SapDraftRow[]> {
    const limit = opts.limit ?? 200;
    const onlySalesOrders = opts.onlySalesOrders !== false;
    const candidates: string[] = [];

    const fullSelect =
      "DocEntry,DocNum,CardCode,CardName,DocDate,DocDueDate,DocTotal,DocCurrency,ObjType,DocObjectCode,UpdateDate";
    const minSelect = "DocEntry,DocNum,CardCode,CardName,DocDate,DocTotal";

    if (onlySalesOrders) {
      candidates.push(`/Drafts?$select=${fullSelect}&$filter=ObjType eq '17'&$top=${limit}&$orderby=DocEntry desc`);
      candidates.push(`/Drafts?$select=${fullSelect}&$filter=DocObjectCode eq 'oOrders'&$top=${limit}&$orderby=DocEntry desc`);
      candidates.push(`/Drafts?$select=${minSelect}&$filter=ObjType eq '17'&$top=${limit}&$orderby=DocEntry desc`);
    }

    candidates.push(`/Drafts?$select=${fullSelect}&$top=${limit}&$orderby=DocEntry desc`);
    candidates.push(`/Drafts?$select=${minSelect}&$top=${limit}&$orderby=DocEntry desc`);
    candidates.push(`/Drafts?$top=${limit}`);

    return this.queryWithCandidates<SapDraftRow>("listDrafts", candidates, correlationId);
  }

  // ========================================
  // INVOICES (Notas/Faturas)
  // ========================================

  async listInvoices(
    opts: { limit?: number; onlyOpen?: boolean } = {},
    correlationId?: string
  ): Promise<SapInvoiceRow[]> {
    const limit = opts.limit ?? 200;
    const onlyOpen = opts.onlyOpen === true;
    const candidates: string[] = [];

    const fullSelect =
      "DocEntry,DocNum,CardCode,CardName,DocDate,DocDueDate,DocTotal,DocCurrency,DocStatus,DocumentStatus,UpdateDate";
    const minSelect = "DocEntry,DocNum,CardCode,CardName,DocDate,DocTotal,DocStatus";

    if (onlyOpen) {
      candidates.push(`/Invoices?$select=${fullSelect}&$filter=DocStatus eq 'O'&$top=${limit}&$orderby=DocEntry desc`);
      candidates.push(`/Invoices?$select=${fullSelect}&$filter=DocumentStatus eq 'bost_Open'&$top=${limit}&$orderby=DocEntry desc`);
      candidates.push(`/Invoices?$select=${minSelect}&$filter=DocStatus eq 'O'&$top=${limit}&$orderby=DocEntry desc`);
    }

    candidates.push(`/Invoices?$select=${fullSelect}&$top=${limit}&$orderby=DocEntry desc`);
    candidates.push(`/Invoices?$select=${minSelect}&$top=${limit}&$orderby=DocEntry desc`);
    candidates.push(`/Invoices?$top=${limit}`);

    return this.queryWithCandidates<SapInvoiceRow>("listInvoices", candidates, correlationId);
  }

  // ========================================
  // INCOMING PAYMENTS (Pagamentos)
  // ========================================

  async listIncomingPayments(
    opts: { limit?: number; cardCode?: string } = {},
    correlationId?: string
  ): Promise<SapIncomingPaymentRow[]> {
    const limit = opts.limit ?? 200;
    const candidates: string[] = [];
    const filter = opts.cardCode
      ? `&$filter=CardCode eq '${this.escapeODataLiteral(opts.cardCode)}'`
      : "";

    const fullSelect =
      "DocEntry,DocNum,CardCode,CardName,DocDate,DocCurrency,CashSum,TransferSum,DocTotal,UpdateDate";
    const minSelect = "DocEntry,DocNum,CardCode,CardName,DocDate,DocTotal";

    candidates.push(`/IncomingPayments?$select=${fullSelect}${filter}&$top=${limit}&$orderby=DocEntry desc`);
    candidates.push(`/IncomingPayments?$select=${minSelect}${filter}&$top=${limit}&$orderby=DocEntry desc`);
    candidates.push(`/IncomingPayments?$top=${limit}`);

    return this.queryWithCandidates<SapIncomingPaymentRow>("listIncomingPayments", candidates, correlationId);
  }
}

// ---- Tipos SAP ----

export type SapItemRow = {
  ItemCode: string;
  ItemName?: string;
  InventoryItem?: string;
  SalesItem?: string;
  PurchaseItem?: string;
  InventoryUOM?: string;
  Valid?: string;
  Frozen?: string;
  ItemsGroupCode?: number;
  BarCode?: string;
  UpdateDate?: string;
  [key: string]: unknown;
};

type SapWarehouseInfo = {
  WarehouseCode: string;
  InStock?: number;
  Committed?: number;
  Ordered?: number;
  [key: string]: unknown;
};

type SapItemWithWarehouse = {
  ItemCode: string;
  ItemName?: string;
  ItemWarehouseInfoCollection?: SapWarehouseInfo[];
  [key: string]: unknown;
};

export type SapInventoryRow = {
  ItemCode: string;
  WarehouseCode: string;
  InStock: number;
  Committed: number;
  Ordered: number;
};

export type SapBusinessPartnerRow = {
  CardCode: string;
  CardName?: string;
  CardType?: string;
  Phone1?: string;
  EmailAddress?: string;
  Address?: string;
  City?: string;
  State?: string;
  Valid?: string;
  Frozen?: string;
  UpdateDate?: string;
  [key: string]: unknown;
};

export type SapSalesPersonRow = {
  SalesEmployeeCode: number;
  SalesEmployeeName?: string;
  Active?: string;
  [key: string]: unknown;
};

export type SapSpecialPriceRow = {
  CardCode?: string;
  ItemCode?: string;
  Price?: number;
  Currency?: string;
  PriceListNum?: number;
  ValidFrom?: string;
  ValidTo?: string;
  [key: string]: unknown;
};

export type SapDraftRow = {
  DocEntry: number;
  DocNum?: number;
  CardCode?: string;
  CardName?: string;
  DocDate?: string;
  DocDueDate?: string;
  DocTotal?: number;
  DocCurrency?: string;
  ObjType?: string;
  DocObjectCode?: string;
  UpdateDate?: string;
  [key: string]: unknown;
};

export type SapInvoiceRow = {
  DocEntry: number;
  DocNum?: number;
  CardCode?: string;
  CardName?: string;
  DocDate?: string;
  DocDueDate?: string;
  DocTotal?: number;
  DocCurrency?: string;
  DocStatus?: string;
  DocumentStatus?: string;
  UpdateDate?: string;
  [key: string]: unknown;
};

export type SapIncomingPaymentRow = {
  DocEntry: number;
  DocNum?: number;
  CardCode?: string;
  CardName?: string;
  DocDate?: string;
  DocCurrency?: string;
  CashSum?: number;
  TransferSum?: number;
  DocTotal?: number;
  UpdateDate?: string;
  [key: string]: unknown;
};
