import { SapServiceLayerClient } from "../../../sap-connector/src/index.js";
import { SapHttpError } from "../../../sap-connector/src/errors.js";
import { WmsQueriesHelper, WMS_QUERIES, type EnrichedInventoryRow, type ItemPriceRow } from "../../../sap-connector/src/sqlQueries.js";

/**
 * Serviço para sincronizar entidades adicionais do SAP B1:
 * - Items (Produtos/Catálogo)
 * - WarehouseGenEntries / ItemWarehouseInfo (Estoque por depósito)
 * - BusinessPartners (Clientes)
 */
export class SapEntitiesService {
  constructor(private readonly client: SapServiceLayerClient) {}

  getSapClient(): SapServiceLayerClient {
    return this.client;
  }

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
                ItemName: item.ItemName,
                WarehouseCode: wh.WarehouseCode,
                InStock: inStock,
                Committed: committed,
                Ordered: ordered,
                Available: Math.max(inStock - committed, 0),
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

    console.log("[listInventory] $expand falhou — tentando fallback via Items (campos agregados)");

    const fallbackCandidates = [
      "ItemCode,ItemName,QuantityOnStock,QuantityOrderedByCustomers,QuantityOrderedFromVendors,MinInventory",
      "ItemCode,ItemName,QuantityOnStock",
    ];

    for (let fi = 0; fi < fallbackCandidates.length; fi++) {
      const sel = fallbackCandidates[fi];
      try {
        const allItems: SapItemRow[] = [];
        const pageSize = 20;
        let skip = 0;

        while (allItems.length < maxItems) {
          const url = `/Items?$select=${sel}&$filter=Valid eq 'tYES' and Frozen eq 'tNO'&$top=${pageSize}&$skip=${skip}&$orderby=ItemCode asc`;
          const res = await this.client.get<{ value: SapItemRow[] }>(url, { correlationId });
          const page = res.data.value || [];
          if (page.length === 0) break;
          allItems.push(...page);
          if (page.length < pageSize) break;
          skip += pageSize;
        }

        console.log(`[listInventory] Fallback #${fi + 1} OK - ${allItems.length} itens com estoque agregado`);

        const inventory: SapInventoryRow[] = [];
        for (const item of allItems) {
          const inStock = item.QuantityOnStock ?? 0;
          const committed = item.QuantityOrderedByCustomers ?? 0;
          const ordered = item.QuantityOrderedFromVendors ?? 0;
          if (inStock > 0 || committed > 0 || ordered > 0) {
            inventory.push({
              ItemCode: item.ItemCode,
              ItemName: item.ItemName,
              WarehouseCode: "GERAL",
              InStock: inStock,
              Committed: committed,
              Ordered: ordered,
              Available: Math.max(inStock - committed, 0),
              MinStock: (item as any).MinInventory ?? 0,
            });
          }
        }
        return inventory;
      } catch (err) {
        console.warn(`[listInventory] Fallback #${fi + 1} falhou:`, err instanceof Error ? err.message : err);
        if (err instanceof SapHttpError && err.status === 400) continue;
      }
    }

    console.log("[listInventory] Nenhum candidato funcionou - retornando vazio");
    return [];
  }

  // ========================================
  // INVENTORY ENRICHED (via SQLQueries: OITM+OITW+OITB)
  // ========================================

  async listInventoryEnriched(
    correlationId?: string
  ): Promise<SapEnrichedInventoryRow[]> {
    const helper = new WmsQueriesHelper(this.client);

    const FALLBACK_QUERY = {
      QueryCategory: -1,
      QueryDescription: "WMS_Inventory_Enriched",
      Query: `SELECT T0.ItemCode, T0.ItemName, T0.InvntryUom AS UoM, T0.AvgPrice, T0.LastPurPrc, T0.LastPurDat, T0.LstSalDate, T0.SWeight1 AS GrossWeight, T0.MaxInvtry AS MaxStock, T0.LeadTime, T0.NumInSale AS LastSaleQty, T0.NumInBuy AS LastBuyQty, T0.ItmsGrpCod, T2.ItmsGrpNam AS GroupName, T1.WhsCode AS WarehouseCode, T1.OnHand, T1.IsCommited AS Committed, T1.OnOrder AS Ordered, T1.MinStock AS WhsMinStock, T1.MaxStock AS WhsMaxStock, T1.CountDate AS LastCountDate FROM OITM T0 INNER JOIN OITW T1 ON T0.ItemCode = T1.ItemCode LEFT JOIN OITB T2 ON T0.ItmsGrpCod = T2.ItmsGrpCod WHERE T0.frozenFor = 'N' AND T0.validFor = 'Y' AND (T1.OnHand <> 0 OR T1.IsCommited <> 0 OR T1.OnOrder <> 0) ORDER BY T0.ItemCode, T1.WhsCode`,
    };

    try {
      try {
        await helper.ensureQuery(WMS_QUERIES.INVENTORY_ENRICHED, { correlationId });
      } catch (e1) {
        console.warn(`[listInventoryEnriched] ensureQuery com UDFs falhou, tentando sem UDFs:`, e1 instanceof Error ? e1.message : e1);
        try {
          await helper.deleteQuery("WMS_Inventory_Enriched", { correlationId }).catch(() => {});
        } catch { /* ignore */ }
        await helper.ensureQuery(FALLBACK_QUERY, { correlationId });
      }

      const result = await helper.getInventoryEnriched({ correlationId });
      const rows = result.value || [];
      console.log(`[listInventoryEnriched] SQLQuery OK - ${rows.length} linhas`);

      return rows.map((r) => ({
        ItemCode: r.ItemCode,
        ItemName: r.ItemName ?? "",
        WarehouseCode: r.WarehouseCode,
        InStock: r.OnHand ?? 0,
        Committed: r.Committed ?? 0,
        Ordered: r.Ordered ?? 0,
        Available: Math.max((r.OnHand ?? 0) - (r.Committed ?? 0), 0),
        MinStock: r.WhsMinStock ?? 0,
        UoM: r.UoM ?? "UN",
        AvgPrice: r.AvgPrice ?? 0,
        LastPurPrc: r.LastPurPrc ?? 0,
        LastPurDat: r.LastPurDat ?? null,
        LstSalDate: r.LstSalDate ?? null,
        GrossWeight: r.GrossWeight ?? 0,
        MaxStock: r.MaxStock ?? 0,
        WhsMaxStock: r.WhsMaxStock ?? 0,
        LeadTime: r.LeadTime ?? 0,
        LastSaleQty: r.LastSaleQty ?? 0,
        LastBuyQty: r.LastBuyQty ?? 0,
        ItmsGrpCod: r.ItmsGrpCod ?? 0,
        GroupName: r.GroupName ?? null,
        LastCountDate: r.LastCountDate ?? null,
        U_COD: r.U_COD ?? null,
        U_UNIT: r.U_UNIT ?? null,
        U_EMBALA: r.U_EMBALA ?? null,
        U_SubNome: r.U_SubNome ?? null,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[listInventoryEnriched] SQLQuery falhou (${msg}), usando fallback OData`);
      return [];
    }
  }

  // ========================================
  // ITEMS WITH PRICING (OData enriquecido - Nível 3)
  // ========================================

  async listItemsWithPricing(
    opts: { limit?: number } = {},
    correlationId?: string
  ): Promise<SapItemPricingRow[]> {
    const maxItems = opts.limit ?? 5000;

    const selectCandidates = [
      "ItemCode,ItemName,InventoryUOM,AvgPrice,LastPurchasePrice,LastPurchaseDate,SWeight1,MaxInventory,LeadTime,ItemsGroupCode",
      "ItemCode,ItemName,InventoryUOM,AvgPrice,ItemsGroupCode",
      "ItemCode,ItemName,AvgPrice",
      "ItemCode,ItemName,InventoryUOM,QuantityOnStock,ItemsGroupCode,SWeight1,MinInventory",
    ];

    let lastError: unknown;
    for (let ci = 0; ci < selectCandidates.length; ci++) {
      const sel = selectCandidates[ci];
      try {
        const allItems: SapItemPricingRow[] = [];
        const pageSize = 20;
        let skip = 0;

        while (allItems.length < maxItems) {
          const url = `/Items?$select=${sel}&$filter=Valid eq 'tYES' and Frozen eq 'tNO'&$top=${pageSize}&$skip=${skip}&$orderby=ItemCode asc`;
          const res = await this.client.get<{ value: SapItemPricingRow[] }>(url, { correlationId });
          const page = res.data.value || [];
          if (page.length === 0) break;
          allItems.push(...page);
          if (page.length < pageSize) break;
          skip += pageSize;
        }

        console.log(`[listItemsWithPricing] Candidato #${ci + 1} OK - ${allItems.length} itens (campos: ${sel.split(',').length})`);
        return allItems.slice(0, maxItems);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const status = err instanceof SapHttpError ? err.status : 0;
        console.warn(`[listItemsWithPricing] Candidato #${ci + 1} falhou (status=${status}): ${errMsg.substring(0, 120)}`);
        lastError = err;
        if (err instanceof SapHttpError && err.status === 400) continue;
        throw err;
      }
    }
    console.warn("[listItemsWithPricing] Nenhum candidato funcionou");
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

    // --- PHASE 1: Fetch invoice headers (fast, no $expand) ---
    const headerCandidates: Array<{ label: string; buildUrl: (top: number, skip: number) => string; pageSize: number }> = [
      {
        label: "$select + filtro",
        buildUrl: (top, skip) => `/Invoices?$select=${headerSelect}${filterPart}&$top=${top}&$skip=${skip}&$orderby=DocDate desc`,
        pageSize: 100,
      },
      {
        label: "sem $select + filtro",
        buildUrl: (top, skip) => `/Invoices?${dateFilterClean ? `$filter=${dateFilterClean}&` : ""}$top=${top}&$skip=${skip}&$orderby=DocDate desc`,
        pageSize: 100,
      },
      {
        label: "$select sem filtro",
        buildUrl: (top, skip) => `/Invoices?$select=${headerSelect}&$top=${top}&$skip=${skip}&$orderby=DocDate desc`,
        pageSize: 100,
      },
    ];

    let invoices: SapInvoiceRow[] = [];
    let headerOk = false;
    let lastError: unknown;

    for (let ci = 0; ci < headerCandidates.length; ci++) {
      const { label, buildUrl, pageSize } = headerCandidates[ci];
      try {
        const all: SapInvoiceRow[] = [];
        let skip = 0;
        while (all.length < maxItems) {
          const url = buildUrl(pageSize, skip);
          console.log(`[listInvoices] HEADERS #${ci + 1} (${label}) skip=${skip}`);
          const res = await this.client.get<{ value: SapInvoiceRow[] }>(url, { correlationId });
          const page = res.data.value || [];
          if (page.length === 0) break;
          all.push(...page);
          if (page.length < pageSize) break;
          skip += pageSize;
        }
        console.log(`[listInvoices] HEADERS #${ci + 1} (${label}) OK - ${all.length} notas`);
        invoices = all.slice(0, maxItems);
        headerOk = true;
        break;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const status = err instanceof SapHttpError ? err.status : 0;
        console.warn(`[listInvoices] HEADERS #${ci + 1} (${label}) falhou (status=${status}): ${errMsg}`);
        lastError = err;
        if (status === 400 || status === 500 || status === 502 || status === 504) continue;
        if (errMsg.includes("timeout") || errMsg.includes("abort")) continue;
        throw err;
      }
    }

    if (!headerOk) {
      throw lastError instanceof Error ? lastError : new Error("Erro ao listar notas fiscais do SAP.");
    }

    if (invoices.length === 0) return invoices;

    // --- PHASE 2: Enrich each invoice with DocumentLines via GET /Invoices({DocEntry}) ---
    const CONCURRENCY = 5;
    let enriched = 0;
    let enrichErrors = 0;

    for (let i = 0; i < invoices.length; i += CONCURRENCY) {
      const batch = invoices.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async (inv) => {
          const docEntry = inv.DocEntry;
          if (!docEntry) return null;
          try {
            const url = `/Invoices(${docEntry})`;
            const res = await this.client.get<SapInvoiceRow>(url, { correlationId });
            return res.data;
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.warn(`[listInvoices] ENRICH DocEntry=${docEntry} falhou: ${errMsg}`);
            return null;
          }
        })
      );

      for (let j = 0; j < batch.length; j++) {
        const result = results[j];
        if (result.status === "fulfilled" && result.value) {
          const full = result.value;
          if (Array.isArray(full.DocumentLines) && full.DocumentLines.length > 0) {
            invoices[i + j].DocumentLines = full.DocumentLines;
            enriched++;
          }
        } else {
          enrichErrors++;
        }
      }
    }

    console.log(`[listInvoices] ENRICH completo: ${enriched}/${invoices.length} com DocumentLines, ${enrichErrors} erros`);
    return invoices;
  }

  // ========================================
  // SALES ORDERS (Pedidos de Venda)
  // ========================================

  async listSalesOrders(
    opts: { limit?: number; dateFrom?: string; dateTo?: string; skipEnrich?: boolean } = {},
    correlationId?: string
  ): Promise<SapSalesOrderRow[]> {
    const maxItems = opts.limit ?? 5000;

    let dateFilter = "";
    if (opts.dateFrom) dateFilter += ` and DocDate ge '${opts.dateFrom}'`;
    if (opts.dateTo) dateFilter += ` and DocDate le '${opts.dateTo}'`;
    const dateFilterClean = dateFilter.replace(/^ and /, "");
    const filterPart = dateFilterClean ? `&$filter=${dateFilterClean}` : "";

    const headerSelect =
      "DocEntry,DocNum,DocDate,DocDueDate,CardCode,CardName,DocTotal,DocCurrency,DocStatus,DocumentStatus,SalesPersonCode,Cancelled,Comments";

    // --- PHASE 1: Headers (fast, no $expand) ---
    // SAP Service Layer: tentamos pedir 500 registros por página via Prefer header
    const SAP_PAGE = 500;
    const preferHeaders = { "Prefer": "odata.maxpagesize=500" };

    const headerCandidates: Array<{
      label: string;
      buildUrl: (top: number, skip: number) => string;
      pageSize: number;
    }> = [
      {
        label: "sem $select + filtro (page 500)",
        buildUrl: (top, skip) =>
          `/Orders?${dateFilterClean ? `$filter=${dateFilterClean}&` : ""}$top=${top}&$skip=${skip}&$orderby=DocDate desc`,
        pageSize: SAP_PAGE,
      },
      {
        label: "$select + filtro (page 500)",
        buildUrl: (top, skip) =>
          `/Orders?$select=${headerSelect}${filterPart}&$top=${top}&$skip=${skip}&$orderby=DocDate desc`,
        pageSize: SAP_PAGE,
      },
      {
        label: "fallback page 20",
        buildUrl: (top, skip) =>
          `/Orders?${dateFilterClean ? `$filter=${dateFilterClean}&` : ""}$top=${top}&$skip=${skip}&$orderby=DocDate desc`,
        pageSize: 20,
      },
    ];

    let orders: SapSalesOrderRow[] = [];
    let headerOk = false;
    let lastError: unknown;

    for (let ci = 0; ci < headerCandidates.length; ci++) {
      const { label, buildUrl, pageSize } = headerCandidates[ci];
      try {
        const all: SapSalesOrderRow[] = [];
        let skip = 0;
        while (all.length < maxItems) {
          const url = buildUrl(pageSize, skip);
          console.log(`[listSalesOrders] HEADERS #${ci + 1} (${label}) skip=${skip}`);
          const res = await this.client.get<{ value: SapSalesOrderRow[] }>(url, { correlationId, headers: preferHeaders });
          const page = res.data.value || [];
          if (page.length === 0) break;
          all.push(...page);
          skip += page.length;
          if (page.length < pageSize) break;
        }
        console.log(`[listSalesOrders] HEADERS #${ci + 1} (${label}) OK - ${all.length} pedidos`);
        orders = all.slice(0, maxItems);
        headerOk = true;
        break;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const status = err instanceof SapHttpError ? err.status : 0;
        console.warn(`[listSalesOrders] HEADERS #${ci + 1} (${label}) falhou (status=${status}): ${errMsg}`);
        lastError = err;
        if (status === 400 || status === 500 || status === 502 || status === 504) continue;
        if (errMsg.includes("timeout") || errMsg.includes("abort")) continue;
        throw err;
      }
    }

    if (!headerOk) {
      throw lastError instanceof Error ? lastError : new Error("Erro ao listar pedidos de venda do SAP.");
    }

    if (orders.length === 0) return orders;
    if (opts.skipEnrich) return orders;

    // --- PHASE 2: Enrich each order with DocumentLines via GET /Orders({DocEntry}) ---
    const CONCURRENCY = 10;
    let enriched = 0;
    let enrichErrors = 0;

    for (let i = 0; i < orders.length; i += CONCURRENCY) {
      if (i > 0 && i % 200 === 0) {
        console.log(`[listSalesOrders] ENRICH progresso: ${i}/${orders.length} (${enriched} OK, ${enrichErrors} erros)`);
      }
      const batch = orders.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async (ord) => {
          const docEntry = ord.DocEntry;
          if (!docEntry) return null;
          try {
            const url = `/Orders(${docEntry})`;
            const res = await this.client.get<SapSalesOrderRow>(url, { correlationId });
            return res.data;
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.warn(`[listSalesOrders] ENRICH DocEntry=${docEntry} falhou: ${errMsg}`);
            return null;
          }
        })
      );

      for (let j = 0; j < batch.length; j++) {
        const result = results[j];
        if (result.status === "fulfilled" && result.value) {
          const full = result.value;
          if (Array.isArray(full.DocumentLines) && full.DocumentLines.length > 0) {
            orders[i + j].DocumentLines = full.DocumentLines;
            enriched++;
          }
        } else {
          enrichErrors++;
        }
      }
    }

    console.log(`[listSalesOrders] ENRICH completo: ${enriched}/${orders.length} com DocumentLines, ${enrichErrors} erros`);
    return orders;
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

  // ========================================
  // ITEM PRICES (Tabelas de Preço via SQLQuery ITM1+OPLN)
  // ========================================

  async listItemPrices(
    correlationId?: string
  ): Promise<ItemPriceRow[]> {
    // Nível 1: SQLQuery (mais rápido, direto no HANA)
    try {
      const helper = new WmsQueriesHelper(this.client);
      await helper.ensureQuery(WMS_QUERIES.ITEM_PRICES, { correlationId });
      const result = await helper.getItemPrices({ correlationId });
      const rows = result.value || [];
      console.log(`[listItemPrices] SQLQuery OK - ${rows.length} linhas de preço`);
      if (rows.length > 0) return rows;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[listItemPrices] SQLQuery falhou (${msg}), tentando fallbacks`);
    }

    const listMap = await this.loadPriceLists(correlationId);
    if (listMap.size === 0) {
      console.warn("[listItemPrices] Nenhuma lista de preços encontrada");
      return [];
    }

    // Nível 2: /Items com $select=ItemCode,ItemPrices (menos dados)
    try {
      const rows = await this.fetchItemPricesFullObject(listMap, correlationId, true);
      console.log(`[listItemPrices] Select-mode OK - ${rows.length} linhas`);
      if (rows.length > 0) return rows;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[listItemPrices] Select-mode falhou: ${msg}`);
    }

    // Nível 3: /Items sem $select (objeto completo, mais lento)
    try {
      const rows = await this.fetchItemPricesFullObject(listMap, correlationId, false);
      console.log(`[listItemPrices] Full-object OK - ${rows.length} linhas`);
      if (rows.length > 0) return rows;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[listItemPrices] Full-object falhou: ${msg}`);
    }

    return [];
  }

  private async loadPriceLists(
    correlationId?: string
  ): Promise<Map<number, string>> {
    const candidates = [
      "/PriceLists?$select=PriceListNo,PriceListName,Active&$filter=Active eq 'tYES'&$top=50",
      "/PriceLists?$select=PriceListNo,PriceListName&$top=50",
      "/PriceLists?$top=50",
    ];

    for (let i = 0; i < candidates.length; i++) {
      try {
        const res = await this.client.get<{ value: Array<{ PriceListNo: number; PriceListName: string; Active?: string }> }>(
          candidates[i], { correlationId }
        );
        const lists = (res.data.value || []).filter(
          l => !l.Active || l.Active === "tYES"
        );
        console.log(`[loadPriceLists] Candidato #${i + 1} OK - ${lists.length} listas`);
        return new Map(lists.map(l => [l.PriceListNo, l.PriceListName]));
      } catch (err) {
        if (err instanceof SapHttpError && err.status === 400) continue;
        console.warn(`[loadPriceLists] Candidato #${i + 1} falhou:`, err instanceof Error ? err.message : err);
      }
    }
    return new Map();
  }

  /**
   * Busca itens SEM $select (objeto completo) para obter ItemPrices embutido.
   * SAP B1 SL retorna ItemPrices quando o item completo é solicitado.
   */
  private async fetchItemPricesFullObject(
    listMap: Map<number, string>,
    correlationId: string | undefined,
    useSelect: boolean
  ): Promise<ItemPriceRow[]> {
    type ItemFull = {
      ItemCode: string;
      ItemPrices?: Array<{ PriceList: number; Price: number; Currency?: string }>;
    };

    const allItems: ItemFull[] = [];
    const requestTop = useSelect ? 100 : 50;
    let skip = 0;

    while (allItems.length < 3000) {
      const selectClause = useSelect ? "$select=ItemCode,ItemPrices&" : "";
      const url = `/Items?${selectClause}$filter=Valid eq 'tYES' and Frozen eq 'tNO'&$top=${requestTop}&$skip=${skip}`;
      const res = await this.client.get<{ value: ItemFull[] }>(url, { correlationId });
      const page = res.data.value || [];
      if (page.length === 0) break;

      if (allItems.length === 0 && page.length > 0) {
        const keys = Object.keys(page[0]);
        console.log(`[fetchItemPricesFullObject] Campos (${keys.length}): ${keys.slice(0, 10).join(", ")}... ItemPrices: ${keys.includes("ItemPrices")}`);
        const sample = (page[0] as ItemFull).ItemPrices;
        if (sample && sample.length > 0) {
          console.log(`[fetchItemPricesFullObject] 1o preço: ${JSON.stringify(sample[0])}`);
        }
      }

      allItems.push(...page);
      skip += page.length;

      if (allItems.length % 200 === 0) {
        console.log(`[fetchItemPricesFullObject] progresso: ${allItems.length} itens`);
      }
    }

    console.log(`[fetchItemPricesFullObject] Total: ${allItems.length} itens`);

    const rows: ItemPriceRow[] = [];
    let zeroCount = 0;
    let noListCount = 0;
    for (const item of allItems) {
      for (const ip of item.ItemPrices ?? []) {
        const listName = listMap.get(ip.PriceList);
        if (!listName) { noListCount++; continue; }
        if (ip.Price === 0) { zeroCount++; }
        rows.push({ ItemCode: item.ItemCode, Price: ip.Price, PriceList: ip.PriceList, ListName: listName });
      }
    }
    console.log(`[fetchItemPricesFullObject] Resultado: ${rows.length} linhas (${zeroCount} com preço 0, ${noListCount} sem lista)`);
    return rows;
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
  ItemName?: string;
  WarehouseCode: string;
  InStock: number;
  Committed: number;
  Ordered: number;
  Available?: number;
  MinStock?: number;
};

export type SapEnrichedInventoryRow = SapInventoryRow & {
  UoM: string;
  AvgPrice: number;
  LastPurPrc: number;
  LastPurDat: string | null;
  LstSalDate: string | null;
  GrossWeight: number;
  MaxStock: number;
  WhsMaxStock: number;
  LeadTime: number;
  LastSaleQty: number;
  LastBuyQty: number;
  ItmsGrpCod: number;
  GroupName: string | null;
  LastCountDate: string | null;
  U_COD: string | null;
  U_UNIT: string | null;
  U_EMBALA: string | null;
  U_SubNome: string | null;
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

export type SapSalesOrderRow = {
  DocEntry?: number;
  DocNum?: number;
  DocDate?: string;
  DocDueDate?: string;
  CardCode?: string;
  CardName?: string;
  DocTotal?: number;
  DocCurrency?: string;
  DocStatus?: string;
  DocumentStatus?: string;
  SalesPersonCode?: number;
  Cancelled?: string;
  Comments?: string;
  DocumentLines?: SapSalesOrderLine[];
  [key: string]: unknown;
};

export type SapSalesOrderLine = {
  LineNum?: number;
  ItemCode?: string;
  ItemDescription?: string;
  Quantity?: number;
  Price?: number;
  LineTotal?: number;
  WarehouseCode?: string;
  DiscountPercent?: number;
  UnitPrice?: number;
  CFOPCode?: string;
  Weight1?: number;
  TaxCode?: string;
  Usage?: number;
  [key: string]: unknown;
};

export type SapItemPricingRow = {
  ItemCode: string;
  ItemName?: string;
  InventoryUOM?: string;
  AvgPrice?: number;
  LastPurchasePrice?: number;
  LastPurchaseDate?: string;
  SWeight1?: number;
  MaxInventory?: number;
  LeadTime?: number;
  ItemsGroupCode?: number;
  MinInventory?: number;
  QuantityOnStock?: number;
  [key: string]: unknown;
};
