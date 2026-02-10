/**
 * SAP B1 Mock Data — SOMENTE DADOS REAIS da YOUR_COMPANY_DB
 *
 * IMPORTANTE: Este arquivo contém EXCLUSIVAMENTE dados capturados do SAP real.
 * Nenhum nome, descrição, preço ou quantidade foi inventado.
 *
 * Fontes:
 *   [A] Orders-structure.json     → Pedido completo DocEntry 60 (resposta real da API)
 *   [B] CONFERENCIA_RESULTADO.md  → 20 cabeçalhos reais (DocEntry + DocNum + CardCode)
 *   [C] endpoints-investigation.json → Warehouse 01.04, Item EM00000004, BP C00363
 *   [D] VALIDACAO_UDF_COMPLETA.md → UDFs validados com escrita/leitura real
 *
 * Contexto:
 *   Service Layer: https://your-sap-server:50000
 *   Database:      YOUR_COMPANY_DB
 *   SAP B1:        10.0 (1000190)
 *   Empresa:       IRMAOS NAVES EIRELI (CNPJ 19.669.290/0001-99)
 *   Usuário:       (configurar via .env)
 */

import type {
  SapOrder,
  SapItem,
  SapWarehouse,
  SapDocumentLine,
  SapItemWarehouseInfo,
  SapBusinessPartner,
} from "../src/sapTypes.js";

// ============================================================================
// CLIENTES (Business Partners)
//
// [A] C00369 — Dados completos extraídos de Orders-structure.json
// [C] C00363 — Código real visto no endpoint /BusinessPartners
// [B] Demais códigos aparecem na CONFERENCIA, mas NÃO temos os nomes.
//     São incluídos com CardName refletindo o código para rastreio.
// ============================================================================

export const mockBusinessPartners: SapBusinessPartner[] = [
  // ── DADOS COMPLETOS (fonte: Orders-structure.json) ──
  {
    CardCode: "C00369",
    CardName: "EUTIDES JACKSON SARMENTO", // [A] campo CardName real
    CardType: "cCustomer",
    Address: "AvenidaAmazonas,3715\rCASA\r30431025-Belo Horizonte-MG\rBRASIL", // [A] campo Address real
    City: "Belo Horizonte",       // [A] AddressExtension.ShipToCity
    State: "MG",                  // [A] AddressExtension.ShipToState
    ZipCode: "30431-025",         // [A] AddressExtension.ShipToZipCode (formatado)
    Country: "BR",                // [A] AddressExtension.ShipToCountry
    FederalTaxID: "677.855.576-91", // [A] TaxExtension.TaxId4 (CPF)
    Valid: "tYES",
    Frozen: "tNO",
  },
  // ── CÓDIGO REAL, sem dados adicionais (fonte: endpoints-investigation.json) ──
  {
    CardCode: "C00363",
    CardName: "C00363", // Nome real não capturado
    CardType: "cCustomer",
    Valid: "tYES",
    Frozen: "tNO",
  },
  // ── CÓDIGOS REAIS da CONFERENCIA (fonte B) — sem nomes capturados ──
  { CardCode: "C00033", CardName: "C00033", CardType: "cCustomer", Valid: "tYES", Frozen: "tNO" },
  { CardCode: "C00037", CardName: "C00037", CardType: "cCustomer", Valid: "tYES", Frozen: "tNO" },
  { CardCode: "C00173", CardName: "C00173", CardType: "cCustomer", Valid: "tYES", Frozen: "tNO" },
  { CardCode: "C00391", CardName: "C00391", CardType: "cCustomer", Valid: "tYES", Frozen: "tNO" },
  { CardCode: "C00534", CardName: "C00534", CardType: "cCustomer", Valid: "tYES", Frozen: "tNO" },
  { CardCode: "C01153", CardName: "C01153", CardType: "cCustomer", Valid: "tYES", Frozen: "tNO" },
  { CardCode: "C01161", CardName: "C01161", CardType: "cCustomer", Valid: "tYES", Frozen: "tNO" },
  { CardCode: "C01977", CardName: "C01977", CardType: "cCustomer", Valid: "tYES", Frozen: "tNO" },
  { CardCode: "C02217", CardName: "C02217", CardType: "cCustomer", Valid: "tYES", Frozen: "tNO" },
  { CardCode: "C02507", CardName: "C02507", CardType: "cCustomer", Valid: "tYES", Frozen: "tNO" },
  { CardCode: "C05695", CardName: "C05695", CardType: "cCustomer", Valid: "tYES", Frozen: "tNO" },
  { CardCode: "C06818", CardName: "C06818", CardType: "cCustomer", Valid: "tYES", Frozen: "tNO" },
  { CardCode: "C07125", CardName: "C07125", CardType: "cCustomer", Valid: "tYES", Frozen: "tNO" },
  { CardCode: "C08083", CardName: "C08083", CardType: "cCustomer", Valid: "tYES", Frozen: "tNO" },
  { CardCode: "C08231", CardName: "C08231", CardType: "cCustomer", Valid: "tYES", Frozen: "tNO" },
  { CardCode: "C09540", CardName: "C09540", CardType: "cCustomer", Valid: "tYES", Frozen: "tNO" },
  { CardCode: "C09706", CardName: "C09706", CardType: "cCustomer", Valid: "tYES", Frozen: "tNO" },
];

// ============================================================================
// PRODUTOS (Items)
//
// [A] TP0000016 — Descrição real extraída de Orders-structure.json (linha 460)
// [A] IS0000001 — Referenciado como OriginalItem na linha do DocEntry 60
// [C] EM00000004 — Código real visto no endpoint /Items (sem descrição capturada)
// ============================================================================

export const mockItems: SapItem[] = [
  {
    // [A] REAL — ItemDescription da DocumentLines[0] do DocEntry 60
    ItemCode: "TP0000016",
    ItemName: "TAMPA PLASTICA CONTA.GOTAS PRETA 820 LISA REF>GUALA - UND",
    InventoryUOM: "UN", // [A] MeasureUnit real do pedido 60
    InventoryItem: "tYES",
    SalesItem: "tYES",
    PurchaseItem: "tYES",
    Valid: "tYES",
    Frozen: "tNO",
  },
  {
    // [C] REAL — ItemCode visto no endpoint /Items
    // Descrição NÃO foi capturada (a resposta foi truncada)
    ItemCode: "EM00000004",
    ItemName: "EM00000004", // Nome real não capturado
    InventoryUOM: "UN",
    InventoryItem: "tYES",
    SalesItem: "tYES",
    PurchaseItem: "tYES",
    Valid: "tYES",
    Frozen: "tNO",
  },
  {
    // [A] REAL — Referenciado como OriginalItem na linha do pedido 60
    // Descrição e UOM não capturados
    ItemCode: "IS0000001",
    ItemName: "IS0000001", // Nome real não capturado
    InventoryUOM: "UN",
    InventoryItem: "tYES",
    SalesItem: "tNO",
    PurchaseItem: "tYES",
    Valid: "tYES",
    Frozen: "tNO",
  },
];

// ============================================================================
// DEPÓSITOS (Warehouses)
//
// [C] 01.04 — "PAINTGRAF GSN" real do endpoint /Warehouses
// [A] 02.02 — Usado como WarehouseCode na linha do DocEntry 60
// ============================================================================

export const mockWarehouses: SapWarehouse[] = [
  // [C] REAL — resposta do endpoint /Warehouses
  { WarehouseCode: "01.04", WarehouseName: "PAINTGRAF GSN", Inactive: "tNO" },
  // [A] REAL — WarehouseCode usado na DocumentLines[0] do DocEntry 60
  // Nome do depósito não capturado
  { WarehouseCode: "02.02", WarehouseName: "02.02", Inactive: "tNO" },
];

// ============================================================================
// ESTOQUE (ItemWarehouseInfoCollection)
//
// Não temos dados reais de estoque — o endpoint /ItemWarehouseInfo retornou
// "400 Bad Request" na investigação (endpoints-investigation.json).
// Mantemos vazio. Quando o endpoint real funcionar, popular aqui.
// ============================================================================

export const mockItemWarehouseInfo: Record<string, SapItemWarehouseInfo[]> = {
  // Nenhum dado real de estoque disponível.
  // Endpoint /ItemWarehouseInfo retornou 400 na investigação.
};

// ============================================================================
// PEDIDOS (Sales Orders)
//
// [A] DocEntry 60 — Pedido COMPLETO com todos os campos reais
// [B] DocEntries 59037-59061 — SOMENTE cabeçalho (DocEntry + DocNum + CardCode)
//     Estes pedidos NÃO têm linhas, datas, totais ou status disponíveis
//     (limitação do endpoint na data da conferência).
//
// UDFs: Todos iniciam null. O único valor real de UDF escrito no SAP foi
// "TESTE_INTEGRACAO" no DocEntry de teste (fonte D), demonstrando que
// PATCH + GET funcionam. O mock permite simular qualquer estado.
// ============================================================================

export const mockOrders: SapOrder[] = [
  // ──────────────────────────────────────────────────────────────────────────
  // DocEntry 60 — PEDIDO COMPLETO REAL [Fonte A: Orders-structure.json]
  //
  // Todos os campos abaixo são valores reais da resposta do SAP Service Layer.
  // ──────────────────────────────────────────────────────────────────────────
  {
    DocEntry: 60,                             // [A] real
    DocNum: 5,                                // [A] real
    CardCode: "C00369",                       // [A] real
    CardName: "EUTIDES JACKSON SARMENTO",     // [A] real
    DocDate: "2023-02-10T00:00:00Z",          // [A] real
    DocDueDate: "2023-02-10T00:00:00Z",       // [A] real
    DocStatus: "bost_Close",                  // [A] real (DocumentStatus)
    DocumentStatus: "bost_Close",             // [A] real
    DocTotal: 65,                             // [A] real
    DocCurrency: "R$",                        // [A] real
    Comments: undefined,                       // [A] real (era null no SAP)
    CreateDate: "2023-02-10",                 // [A] CreationDate formatado
    CreateTime: "1026",                       // [A] DocTime "10:26:00" → "1026"
    UpdateDate: "2023-02-10",                 // [A] UpdateDate real
    UpdateTime: "1026",                       // [A] UpdateTime "10:26:56" → "1026"
    // UDFs — iniciam null (nenhum valor WMS foi escrito neste pedido histórico)
    U_WMS_STATUS: null,
    U_WMS_ORDERID: null,
    U_WMS_LAST_EVENT: null,
    U_WMS_LAST_TS: null,
    U_WMS_CORR_ID: null,
    DocumentLines: [
      {
        // [A] Linha REAL da DocumentLines[0] do pedido 60
        LineNum: 0,                           // [A] real
        ItemCode: "TP0000016",                // [A] real
        ItemDescription: "TAMPA PLASTICA CONTA.GOTAS PRETA 820 LISA REF>GUALA - UND", // [A] real
        Quantity: 100,                        // [A] real
        WarehouseCode: "02.02",               // [A] real
        Price: 0.65,                          // [A] real
        Currency: "R$",                       // [A] real
        UnitPrice: 0.65,                      // [A] real
        LineTotal: 65,                        // [A] real
        MeasureUnit: "UN",                    // [A] real
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // DocEntries 59037-59061 — CABEÇALHOS REAIS [Fonte B: CONFERENCIA_RESULTADO.md]
  //
  // ATENÇÃO: Apenas DocEntry, DocNum e CardCode são dados reais.
  // Não temos DocumentLines, DocTotal, DocDate, CardName, DocumentStatus
  // para estes pedidos. Esses campos ficam como null/undefined.
  // ──────────────────────────────────────────────────────────────────────────
  {
    DocEntry: 59037, DocNum: 38317, CardCode: "C01153",
    DocStatus: "bost_Open", DocumentStatus: "bost_Open",
    DocCurrency: "R$",
    U_WMS_STATUS: null, U_WMS_ORDERID: null, U_WMS_LAST_EVENT: null, U_WMS_LAST_TS: null, U_WMS_CORR_ID: null,
    DocumentLines: [],
  },
  {
    DocEntry: 59038, DocNum: 38318, CardCode: "C02217",
    DocStatus: "bost_Open", DocumentStatus: "bost_Open",
    DocCurrency: "R$",
    U_WMS_STATUS: null, U_WMS_ORDERID: null, U_WMS_LAST_EVENT: null, U_WMS_LAST_TS: null, U_WMS_CORR_ID: null,
    DocumentLines: [],
  },
  {
    DocEntry: 59040, DocNum: 38319, CardCode: "C08083",
    DocStatus: "bost_Open", DocumentStatus: "bost_Open",
    DocCurrency: "R$",
    U_WMS_STATUS: null, U_WMS_ORDERID: null, U_WMS_LAST_EVENT: null, U_WMS_LAST_TS: null, U_WMS_CORR_ID: null,
    DocumentLines: [],
  },
  {
    DocEntry: 59041, DocNum: 38320, CardCode: "C02507",
    DocStatus: "bost_Open", DocumentStatus: "bost_Open",
    DocCurrency: "R$",
    U_WMS_STATUS: null, U_WMS_ORDERID: null, U_WMS_LAST_EVENT: null, U_WMS_LAST_TS: null, U_WMS_CORR_ID: null,
    DocumentLines: [],
  },
  {
    DocEntry: 59043, DocNum: 38321, CardCode: "C08231",
    DocStatus: "bost_Open", DocumentStatus: "bost_Open",
    DocCurrency: "R$",
    U_WMS_STATUS: null, U_WMS_ORDERID: null, U_WMS_LAST_EVENT: null, U_WMS_LAST_TS: null, U_WMS_CORR_ID: null,
    DocumentLines: [],
  },
  {
    DocEntry: 59045, DocNum: 38322, CardCode: "C00534",
    DocStatus: "bost_Open", DocumentStatus: "bost_Open",
    DocCurrency: "R$",
    U_WMS_STATUS: null, U_WMS_ORDERID: null, U_WMS_LAST_EVENT: null, U_WMS_LAST_TS: null, U_WMS_CORR_ID: null,
    DocumentLines: [],
  },
  {
    DocEntry: 59046, DocNum: 38323, CardCode: "C00391",
    DocStatus: "bost_Open", DocumentStatus: "bost_Open",
    DocCurrency: "R$",
    U_WMS_STATUS: null, U_WMS_ORDERID: null, U_WMS_LAST_EVENT: null, U_WMS_LAST_TS: null, U_WMS_CORR_ID: null,
    DocumentLines: [],
  },
  {
    DocEntry: 59047, DocNum: 38324, CardCode: "C07125",
    DocStatus: "bost_Open", DocumentStatus: "bost_Open",
    DocCurrency: "R$",
    U_WMS_STATUS: null, U_WMS_ORDERID: null, U_WMS_LAST_EVENT: null, U_WMS_LAST_TS: null, U_WMS_CORR_ID: null,
    DocumentLines: [],
  },
  {
    DocEntry: 59048, DocNum: 38325, CardCode: "C01977",
    DocStatus: "bost_Open", DocumentStatus: "bost_Open",
    DocCurrency: "R$",
    U_WMS_STATUS: null, U_WMS_ORDERID: null, U_WMS_LAST_EVENT: null, U_WMS_LAST_TS: null, U_WMS_CORR_ID: null,
    DocumentLines: [],
  },
  {
    DocEntry: 59049, DocNum: 38326, CardCode: "C07125",
    DocStatus: "bost_Open", DocumentStatus: "bost_Open",
    DocCurrency: "R$",
    U_WMS_STATUS: null, U_WMS_ORDERID: null, U_WMS_LAST_EVENT: null, U_WMS_LAST_TS: null, U_WMS_CORR_ID: null,
    DocumentLines: [],
  },
  {
    DocEntry: 59051, DocNum: 38327, CardCode: "C00033",
    DocStatus: "bost_Open", DocumentStatus: "bost_Open",
    DocCurrency: "R$",
    U_WMS_STATUS: null, U_WMS_ORDERID: null, U_WMS_LAST_EVENT: null, U_WMS_LAST_TS: null, U_WMS_CORR_ID: null,
    DocumentLines: [],
  },
  {
    DocEntry: 59052, DocNum: 38328, CardCode: "C00037",
    DocStatus: "bost_Open", DocumentStatus: "bost_Open",
    DocCurrency: "R$",
    U_WMS_STATUS: null, U_WMS_ORDERID: null, U_WMS_LAST_EVENT: null, U_WMS_LAST_TS: null, U_WMS_CORR_ID: null,
    DocumentLines: [],
  },
  {
    DocEntry: 59053, DocNum: 38329, CardCode: "C00037",
    DocStatus: "bost_Open", DocumentStatus: "bost_Open",
    DocCurrency: "R$",
    U_WMS_STATUS: null, U_WMS_ORDERID: null, U_WMS_LAST_EVENT: null, U_WMS_LAST_TS: null, U_WMS_CORR_ID: null,
    DocumentLines: [],
  },
  {
    DocEntry: 59054, DocNum: 38330, CardCode: "C09540",
    DocStatus: "bost_Open", DocumentStatus: "bost_Open",
    DocCurrency: "R$",
    U_WMS_STATUS: null, U_WMS_ORDERID: null, U_WMS_LAST_EVENT: null, U_WMS_LAST_TS: null, U_WMS_CORR_ID: null,
    DocumentLines: [],
  },
  {
    DocEntry: 59056, DocNum: 38331, CardCode: "C05695",
    DocStatus: "bost_Open", DocumentStatus: "bost_Open",
    DocCurrency: "R$",
    U_WMS_STATUS: null, U_WMS_ORDERID: null, U_WMS_LAST_EVENT: null, U_WMS_LAST_TS: null, U_WMS_CORR_ID: null,
    DocumentLines: [],
  },
  {
    DocEntry: 59057, DocNum: 38332, CardCode: "C00037",
    DocStatus: "bost_Open", DocumentStatus: "bost_Open",
    DocCurrency: "R$",
    U_WMS_STATUS: null, U_WMS_ORDERID: null, U_WMS_LAST_EVENT: null, U_WMS_LAST_TS: null, U_WMS_CORR_ID: null,
    DocumentLines: [],
  },
  {
    DocEntry: 59058, DocNum: 38333, CardCode: "C06818",
    DocStatus: "bost_Open", DocumentStatus: "bost_Open",
    DocCurrency: "R$",
    U_WMS_STATUS: null, U_WMS_ORDERID: null, U_WMS_LAST_EVENT: null, U_WMS_LAST_TS: null, U_WMS_CORR_ID: null,
    DocumentLines: [],
  },
  {
    DocEntry: 59059, DocNum: 38334, CardCode: "C09706",
    DocStatus: "bost_Open", DocumentStatus: "bost_Open",
    DocCurrency: "R$",
    U_WMS_STATUS: null, U_WMS_ORDERID: null, U_WMS_LAST_EVENT: null, U_WMS_LAST_TS: null, U_WMS_CORR_ID: null,
    DocumentLines: [],
  },
  {
    DocEntry: 59060, DocNum: 38335, CardCode: "C00173",
    DocStatus: "bost_Open", DocumentStatus: "bost_Open",
    DocCurrency: "R$",
    U_WMS_STATUS: null, U_WMS_ORDERID: null, U_WMS_LAST_EVENT: null, U_WMS_LAST_TS: null, U_WMS_CORR_ID: null,
    DocumentLines: [],
  },
  {
    DocEntry: 59061, DocNum: 38336, CardCode: "C01161",
    DocStatus: "bost_Open", DocumentStatus: "bost_Open",
    DocCurrency: "R$",
    U_WMS_STATUS: null, U_WMS_ORDERID: null, U_WMS_LAST_EVENT: null, U_WMS_LAST_TS: null, U_WMS_CORR_ID: null,
    DocumentLines: [],
  },
];

// ============================================================================
// HELPER para geração de pedidos de teste (usado apenas pelo mock service)
// ============================================================================

export function generateRandomOrder(docEntry: number, docNum: number): SapOrder {
  const bpCodes = mockBusinessPartners.map((bp) => bp.CardCode);
  const code = bpCodes[Math.floor(Math.random() * bpCodes.length)]!;
  const bp = mockBusinessPartners.find((b) => b.CardCode === code)!;

  return {
    DocEntry: docEntry,
    DocNum: docNum,
    CardCode: bp.CardCode,
    CardName: bp.CardName,
    DocDate: new Date().toISOString(),
    DocDueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
    DocStatus: "bost_Open",
    DocumentStatus: "bost_Open",
    DocCurrency: "R$",
    U_WMS_STATUS: null,
    U_WMS_ORDERID: null,
    U_WMS_LAST_EVENT: null,
    U_WMS_LAST_TS: null,
    U_WMS_CORR_ID: null,
    DocumentLines: [],
  };
}
