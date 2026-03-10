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

  // ========================================
  // ITEMS (Produtos)
  // ========================================

  async listItems(
    opts: { limit?: number; onlyActive?: boolean } = {},
    correlationId?: string
  ): Promise<SapItemRow[]> {
    const maxItems = opts.limit ?? 5000;

    const fullSelect = "ItemCode,ItemName,InventoryItem,SalesItem,PurchaseItem,InventoryUOM,SalesUnit,SalesPackagingUnit,SalesQtyPerPackUnit,SalesItemsPerUnit,QuantityOnStock,QuantityOrderedByCustomers,QuantityOrderedFromVendors,Valid,Frozen,ItemsGroupCode,BarCode,UpdateDate,U_COD,U_UNIT,U_EMBALA,U_SubNome,MinInventory,SWeight1";
    const packSelect = "ItemCode,ItemName,InventoryUOM,SalesUnit,SalesPackagingUnit,SalesQtyPerPackUnit,SalesItemsPerUnit,QuantityOnStock,Valid,Frozen,ItemsGroupCode,BarCode,U_COD,MinInventory";
    const minSelect = "ItemCode,ItemName,InventoryUOM,QuantityOnStock,Valid,Frozen,ItemsGroupCode";
    const bareSelect = "ItemCode,ItemName";

    const activeFilter = opts.onlyActive !== false ? "&$filter=Valid eq 'tYES' and Frozen eq 'tNO'" : "";

    const selectCandidates = [
      { select: fullSelect, filter: activeFilter },
      { select: packSelect, filter: activeFilter },
      { select: minSelect, filter: activeFilter },
      { select: fullSelect, filter: "" },
      { select: minSelect, filter: "" },
      { select: bareSelect, filter: "" },
    ];

    let lastError: unknown;
    for (let ci = 0; ci < selectCandidates.length; ci++) {
      const { select, filter } = selectCandidates[ci];
      try {
        const allItems: SapItemRow[] = [];
        const pageSize = 20;
        let skip = 0;

        while (allItems.length < maxItems) {
          const url = `/Items?$select=${select}${filter}&$top=${pageSize}&$skip=${skip}&$orderby=ItemCode asc`;
          const res = await this.client.get<{ value: SapItemRow[] }>(url, { correlationId });
          const page = res.data.value || [];
          if (page.length === 0) break;
          allItems.push(...page);
          console.log(`[listItems] Candidato #${ci + 1} - pagina skip=${skip}, recebidos ${page.length}, total acumulado ${allItems.length}`);

          if (page.length < pageSize) break;
          skip += pageSize;
        }

        console.log(`[listItems] Candidato #${ci + 1} OK - ${allItems.length} itens (paginado, ${Math.ceil(allItems.length / pageSize)} paginas)`);
        return allItems.slice(0, maxItems);
      } catch (err) {
        lastError = err;
        if (err instanceof SapHttpError && err.status === 400) continue;
        throw err;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Erro ao listar itens do SAP.");
  }

  // ========================================
  // ITEM GROUPS (Categorias/Grupos de Itens)
  // ========================================

  async listItemGroups(
    correlationId?: string
  ): Promise<SapItemGroupRow[]> {
    const selectCandidates = [
      "$select=Number,GroupName",
      "",
    ];

    let lastError: unknown;
    for (let ci = 0; ci < selectCandidates.length; ci++) {
      const sel = selectCandidates[ci];
      try {
        const allGroups: SapItemGroupRow[] = [];
        const pageSize = 20;
        let skip = 0;

        while (allGroups.length < 500) {
          const selPart = sel ? `${sel}&` : "";
          const url = `/ItemGroups?${selPart}$top=${pageSize}&$skip=${skip}`;
          const res = await this.client.get<{ value: SapItemGroupRow[] }>(url, { correlationId });
          const page = res.data.value || [];
          if (page.length === 0) break;
          allGroups.push(...page);
          if (page.length < pageSize) break;
          skip += pageSize;
        }

        console.log(`[listItemGroups] Candidato #${ci + 1} OK - ${allGroups.length} grupos (paginado)`);
        return allGroups;
      } catch (err) {
        lastError = err;
        if (err instanceof SapHttpError && err.status === 400) continue;
        throw err;
      }
    }
    console.log("[listItemGroups] Nenhum candidato funcionou - retornando vazio");
    return [];
  }

  // ========================================
  // INVENTORY (Estoque por depósito via OITW)
  // ========================================

  async listInventory(
    opts: { limit?: number } = {},
    correlationId?: string
  ): Promise<SapInventoryRow[]> {
    const maxItems = opts.limit ?? 5000;

    const expandCandidates = [
      { select: "ItemCode,ItemName", expand: "ItemWarehouseInfoCollection($select=WarehouseCode,InStock,Committed,Ordered)", filter: "&$filter=Valid eq 'tYES'" },
      { select: "ItemCode", expand: "ItemWarehouseInfoCollection($select=WarehouseCode,InStock)", filter: "" },
      { select: "ItemCode", expand: "ItemWarehouseInfoCollection", filter: "" },
    ];

    let lastError: unknown;
    for (let ci = 0; ci < expandCandidates.length; ci++) {
      const { select, expand, filter } = expandCandidates[ci];
      try {
        const allItems: SapItemWithWarehouse[] = [];
        const pageSize = 20;
        let skip = 0;

        while (allItems.length < maxItems) {
          const url = `/Items?$select=${select}&$expand=${expand}${filter}&$top=${pageSize}&$skip=${skip}`;
          const res = await this.client.get<{ value: SapItemWithWarehouse[] }>(url, { correlationId });
          const page = res.data.value || [];
          if (page.length === 0) break;
          allItems.push(...page);

          if (page.length < pageSize) break;
          skip += pageSize;
        }

        console.log(`[listInventory] Candidato #${ci + 1} OK - ${allItems.length} itens com warehouse info (paginado)`);

        const inventory: SapInventoryRow[] = [];
        for (const item of allItems) {
          const whInfo = item.ItemWarehouseInfoCollection || [];
          for (const wh of whInfo) {
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

    const fullSelect = "CardCode,CardName,CardType,FederalTaxID,Phone1,EmailAddress,Address,City,State,ZipCode,Valid,Frozen,UpdateDate,GroupCode,U_REGIAO";
    const minSelect = "CardCode,CardName,CardType,FederalTaxID,Phone1,EmailAddress";
    const bareSelect = "CardCode,CardName,FederalTaxID";

    candidates.push(`/BusinessPartners?$select=${fullSelect}&$filter=CardType eq '${cardType}' and Valid eq 'tYES'&$top=${limit}&$orderby=CardName asc`);
    candidates.push(`/BusinessPartners?$select=${minSelect}&$filter=CardType eq '${cardType}'&$top=${limit}&$orderby=CardName asc`);
    candidates.push(`/BusinessPartners?$select=${fullSelect}&$top=${limit}`);
    candidates.push(`/BusinessPartners?$select=${minSelect}&$top=${limit}`);
    candidates.push(`/BusinessPartners?$select=${bareSelect}&$top=${limit}`);

    let lastError: unknown;
    for (let i = 0; i < candidates.length; i++) {
      try {
        const res = await this.client.get<{ value: SapBusinessPartnerRow[] }>(candidates[i], { correlationId });
        const bps = res.data.value || [];
        console.log(`[listBusinessPartners] Candidato #${i + 1} OK - ${bps.length} parceiros`);
        return bps;
      } catch (err) {
        lastError = err;
        if (err instanceof SapHttpError && err.status === 400) continue;
        throw err;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Erro ao listar parceiros do SAP.");
  }

  // ========================================
  // INVOICES (Notas Fiscais / Documentos de Venda)
  // ========================================

  async listInvoices(
    opts: { limit?: number; dateFrom?: string; dateTo?: string } = {},
    correlationId?: string
  ): Promise<SapInvoiceRow[]> {
    const maxItems = opts.limit ?? 5000;

    let dateFilter = "";
    if (opts.dateFrom) dateFilter += ` and DocDate ge '${opts.dateFrom}'`;
    if (opts.dateTo) dateFilter += ` and DocDate le '${opts.dateTo}'`;
    const dateFilterClean = dateFilter.replace(/^ and /, "");
    const filterPart = dateFilterClean ? `&$filter=${dateFilterClean}` : "";

    const headerSelect = "DocEntry,DocNum,DocDate,CardCode,CardName,DocTotal,SalesPersonCode,Cancelled";

    const candidates: Array<{ label: string; buildUrl: (top: number, skip: number) => string; pageSize: number }> = [
      {
        label: "expand sem $select + filtro",
        buildUrl: (top, skip) => `/Invoices?$expand=DocumentLines${filterPart}&$top=${top}&$skip=${skip}&$orderby=DocDate desc`,
        pageSize: 20,
      },
      {
        label: "expand com $select + filtro",
        buildUrl: (top, skip) => `/Invoices?$select=${headerSelect}&$expand=DocumentLines($select=ItemCode,ItemDescription,Quantity,LineTotal,UnitPrice)${filterPart}&$top=${top}&$skip=${skip}&$orderby=DocDate desc`,
        pageSize: 20,
      },
      {
        label: "expand sem $select, sem filtro",
        buildUrl: (top, skip) => `/Invoices?$expand=DocumentLines&$top=${top}&$skip=${skip}&$orderby=DocDate desc`,
        pageSize: 20,
      },
      {
        label: "$select + filtro (rapido, sem lines)",
        buildUrl: (top, skip) => `/Invoices?$select=${headerSelect}${filterPart}&$top=${top}&$skip=${skip}&$orderby=DocDate desc`,
        pageSize: 100,
      },
      {
        label: "sem $select + filtro (rapido, sem lines)",
        buildUrl: (top, skip) => `/Invoices?${dateFilterClean ? `$filter=${dateFilterClean}&` : ""}$top=${top}&$skip=${skip}&$orderby=DocDate desc`,
        pageSize: 100,
      },
      {
        label: "$select sem filtro (rapido, sem lines)",
        buildUrl: (top, skip) => `/Invoices?$select=${headerSelect}&$top=${top}&$skip=${skip}&$orderby=DocDate desc`,
        pageSize: 100,
      },
    ];

    let lastError: unknown;
    for (let ci = 0; ci < candidates.length; ci++) {
      const { label, buildUrl, pageSize } = candidates[ci];
      try {
        const all: SapInvoiceRow[] = [];
        let skip = 0;

        while (all.length < maxItems) {
          const url = buildUrl(pageSize, skip);
          console.log(`[listInvoices] #${ci + 1} (${label}) url=${url.substring(0, 140)}...`);
          const res = await this.client.get<{ value: SapInvoiceRow[] }>(url, { correlationId });
          const page = res.data.value || [];
          if (page.length === 0) break;
          all.push(...page);
          console.log(`[listInvoices] #${ci + 1} skip=${skip} +${page.length} = ${all.length}`);
          if (page.length < pageSize) break;
          skip += pageSize;
        }

        const hasLines = all.length > 0 && Array.isArray(all[0].DocumentLines) && all[0].DocumentLines!.length > 0;
        console.log(`[listInvoices] #${ci + 1} (${label}) OK - ${all.length} notas, lines=${hasLines ? "sim" : "nao"}`);
        return all.slice(0, maxItems);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const status = err instanceof SapHttpError ? err.status : 0;
        const body = (err as any)?.responseBodyText?.slice(0, 300) ?? "";
        console.warn(`[listInvoices] #${ci + 1} (${label}) falhou (status=${status}): ${errMsg} ${body}`);
        lastError = err;
        if (status === 400 || status === 500 || status === 502 || status === 504) continue;
        if (errMsg.includes("timeout") || errMsg.includes("abort")) continue;
        throw err;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Erro ao listar notas fiscais do SAP.");
  }

  // ========================================
  // SALES PERSONS (Vendedores)
  // ========================================

  async listSalesPersons(
    correlationId?: string
  ): Promise<SapSalesPersonRow[]> {
    const candidates = [
      "$select=SalesEmployeeCode,SalesEmployeeName,Active",
      "$select=SalesEmployeeCode,SalesEmployeeName",
      "",
    ];

    let lastError: unknown;
    for (let ci = 0; ci < candidates.length; ci++) {
      const sel = candidates[ci];
      try {
        const all: SapSalesPersonRow[] = [];
        const pageSize = 20;
        let skip = 0;

        while (all.length < 200) {
          const selPart = sel ? `${sel}&` : "";
          const url = `/SalesPersons?${selPart}$top=${pageSize}&$skip=${skip}`;
          const res = await this.client.get<{ value: SapSalesPersonRow[] }>(url, { correlationId });
          const page = res.data.value || [];
          if (page.length === 0) break;
          all.push(...page);
          if (page.length < pageSize) break;
          skip += pageSize;
        }

        console.log(`[listSalesPersons] Candidato #${ci + 1} OK - ${all.length} vendedores`);
        return all;
      } catch (err) {
        lastError = err;
        if (err instanceof SapHttpError && err.status === 400) continue;
        throw err;
      }
    }
    console.log("[listSalesPersons] Nenhum candidato funcionou - retornando vazio");
    return [];
  }

  // ========================================
  // BUSINESS PARTNER GROUPS (Grupos de Clientes)
  // ========================================

  async listBusinessPartnerGroups(
    correlationId?: string
  ): Promise<SapBPGroupRow[]> {
    const candidates = [
      "$select=Code,Name,Type",
      "$select=Code,Name",
      "",
    ];

    let lastError: unknown;
    for (let ci = 0; ci < candidates.length; ci++) {
      const sel = candidates[ci];
      try {
        const selPart = sel ? `${sel}&` : "";
        const url = `/BusinessPartnerGroups?${selPart}$top=100`;
        const res = await this.client.get<{ value: SapBPGroupRow[] }>(url, { correlationId });
        const groups = res.data.value || [];
        console.log(`[listBPGroups] Candidato #${ci + 1} OK - ${groups.length} grupos`);
        return groups;
      } catch (err) {
        lastError = err;
        if (err instanceof SapHttpError && err.status === 400) continue;
        throw err;
      }
    }
    console.log("[listBPGroups] Nenhum candidato funcionou - retornando vazio");
    return [];
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
  SalesUnit?: string;
  SalesPackagingUnit?: string;
  SalesQtyPerPackUnit?: number;
  SalesItemsPerUnit?: number;
  QuantityOnStock?: number;
  QuantityOrderedByCustomers?: number;
  QuantityOrderedFromVendors?: number;
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
  FederalTaxID?: string;
  Phone1?: string;
  EmailAddress?: string;
  Address?: string;
  City?: string;
  State?: string;
  ZipCode?: string;
  Valid?: string;
  Frozen?: string;
  UpdateDate?: string;
  [key: string]: unknown;
};

export type SapItemGroupRow = {
  Number: number;
  GroupName: string;
  [key: string]: unknown;
};

export type SapInvoiceRow = {
  DocEntry?: number;
  DocNum?: number;
  DocDate?: string;
  DocDueDate?: string;
  TaxDate?: string;
  CardCode?: string;
  CardName?: string;
  DocumentStatus?: string;
  Cancelled?: string;
  DocTotal?: number;
  PaymentMethod?: string;
  PaymentGroupCode?: number;
  SalesPersonCode?: number;
  DocumentLines?: SapInvoiceLine[];
  [key: string]: unknown;
};

export type SapInvoiceLine = {
  ItemCode?: string;
  ItemDescription?: string;
  Quantity?: number;
  LineTotal?: number;
  DiscountPercent?: number;
  UnitPrice?: number;
  Price?: number;
  CFOPCode?: string;
  Usage?: number;
  [key: string]: unknown;
};

export type SapSalesPersonRow = {
  SalesEmployeeCode: number;
  SalesEmployeeName?: string;
  Active?: string;
  [key: string]: unknown;
};

export type SapBPGroupRow = {
  Code: number;
  Name?: string;
  Type?: string;
  [key: string]: unknown;
};
