/**
 * SAP B1 Mock Data - Dados Realistas para Testes
 * 
 * Baseado em dados reais da REDACTED_COMPANY_DB
 * Contém pedidos, clientes, produtos e estoque simulados
 */

import type {
  SapOrder,
  SapItem,
  SapWarehouse,
  SapDocumentLine,
  SapItemWarehouseInfo
} from "../src/sapTypes.js";

// ============================================================================
// CLIENTES (Business Partners)
// ============================================================================

export const mockBusinessPartners = [
  {
    CardCode: "C00369",
    CardName: "EUTIDES JACKSON SARMENTO",
    CardType: "cCustomer",
    Phone1: "(85) 98765-4321",
    EmailAddress: "eutides.sarmento@example.com",
    Address: "Rua das Flores, 123 - Centro",
    City: "Fortaleza",
    State: "CE",
    ZipCode: "60000-000",
    Country: "BR",
    U_CRM_Segment: "VAREJO",
    Valid: "tYES",
    Frozen: "tNO"
  },
  {
    CardCode: "C00512",
    CardName: "DISTRIBUIDORA NORDESTE LTDA",
    CardType: "cCustomer",
    Phone1: "(85) 3456-7890",
    EmailAddress: "contato@distrnordeste.com.br",
    Address: "Av. Bezerra de Menezes, 4500",
    City: "Fortaleza",
    State: "CE",
    ZipCode: "60540-000",
    Country: "BR",
    U_CRM_Segment: "ATACADO",
    Valid: "tYES",
    Frozen: "tNO"
  },
  {
    CardCode: "C00789",
    CardName: "MARIA APARECIDA COMERCIO",
    CardType: "cCustomer",
    Phone1: "(85) 99123-4567",
    EmailAddress: "maria.comercio@gmail.com",
    Address: "Rua Barão de Studart, 890",
    City: "Fortaleza",
    State: "CE",
    ZipCode: "60120-000",
    Country: "BR",
    U_CRM_Segment: "VAREJO",
    Valid: "tYES",
    Frozen: "tNO"
  },
  {
    CardCode: "C01024",
    CardName: "SUPERMERCADO BOM PREÇO",
    CardType: "cCustomer",
    Phone1: "(85) 3234-5678",
    EmailAddress: "compras@bompreco.com.br",
    Address: "Av. Washington Soares, 2300",
    City: "Fortaleza",
    State: "CE",
    ZipCode: "60810-000",
    Country: "BR",
    U_CRM_Segment: "ATACADO",
    Valid: "tYES",
    Frozen: "tNO"
  },
  {
    CardCode: "C01156",
    CardName: "JOSÉ ROBERTO SILVA - ME",
    CardType: "cCustomer",
    Phone1: "(85) 98888-7777",
    EmailAddress: "jrsilva.vendas@hotmail.com",
    Address: "Rua Coronel Jucá, 234",
    City: "Fortaleza",
    State: "CE",
    ZipCode: "60170-000",
    Country: "BR",
    U_CRM_Segment: "VAREJO",
    Valid: "tYES",
    Frozen: "tNO"
  }
];

// ============================================================================
// PRODUTOS (Items)
// ============================================================================

export const mockItems: SapItem[] = [
  {
    ItemCode: "TP0000016",
    ItemName: "TAMPA PLASTICA BRANCA 28MM - PCT C/100",
    InventoryUOM: "UN",
    InventoryItem: "tYES",
    SalesItem: "tYES",
    PurchaseItem: "tYES",
    Valid: "tYES",
    Frozen: "tNO",
    UpdateDate: "2026-01-15",
    UpdateTime: "1430"
  },
  {
    ItemCode: "GAR0001250",
    ItemName: "GARRAFA PET 1250ML CRISTAL - UNIDADE",
    InventoryUOM: "UN",
    InventoryItem: "tYES",
    SalesItem: "tYES",
    PurchaseItem: "tYES",
    Valid: "tYES",
    Frozen: "tNO",
    UpdateDate: "2026-01-20",
    UpdateTime: "0945"
  },
  {
    ItemCode: "ROT0050001",
    ItemName: "ROTULO ADESIVO 50X100MM - ROLO C/1000",
    InventoryUOM: "RL",
    InventoryItem: "tYES",
    SalesItem: "tYES",
    PurchaseItem: "tYES",
    Valid: "tYES",
    Frozen: "tNO",
    UpdateDate: "2026-01-18",
    UpdateTime: "1120"
  },
  {
    ItemCode: "CX0048030",
    ItemName: "CAIXA PAPELAO 48X30X30CM - 25 UNIDADES",
    InventoryUOM: "PC",
    InventoryItem: "tYES",
    SalesItem: "tYES",
    PurchaseItem: "tYES",
    Valid: "tYES",
    Frozen: "tNO",
    UpdateDate: "2026-01-22",
    UpdateTime: "1605"
  },
  {
    ItemCode: "LAC0500001",
    ItemName: "LACRE SEGURANÇA PLASTICO VERMELHO - PCT C/500",
    InventoryUOM: "PC",
    InventoryItem: "tYES",
    SalesItem: "tYES",
    PurchaseItem: "tYES",
    Valid: "tYES",
    Frozen: "tNO",
    UpdateDate: "2026-01-25",
    UpdateTime: "0830"
  },
  {
    ItemCode: "GAR0002000",
    ItemName: "GARRAFA PET 2000ML CRISTAL - UNIDADE",
    InventoryUOM: "UN",
    InventoryItem: "tYES",
    SalesItem: "tYES",
    PurchaseItem: "tYES",
    Valid: "tYES",
    Frozen: "tNO",
    UpdateDate: "2026-01-28",
    UpdateTime: "1515"
  },
  {
    ItemCode: "TP0000038",
    ItemName: "TAMPA PLASTICA AZUL 38MM - PCT C/100",
    InventoryUOM: "UN",
    InventoryItem: "tYES",
    SalesItem: "tYES",
    PurchaseItem: "tYES",
    Valid: "tYES",
    Frozen: "tNO",
    UpdateDate: "2026-01-30",
    UpdateTime: "1045"
  },
  {
    ItemCode: "FIT0050001",
    ItemName: "FITA ADESIVA TRANSPARENTE 50MM - ROLO",
    InventoryUOM: "RL",
    InventoryItem: "tYES",
    SalesItem: "tYES",
    PurchaseItem: "tYES",
    Valid: "tYES",
    Frozen: "tNO",
    UpdateDate: "2026-02-01",
    UpdateTime: "0920"
  }
];

// ============================================================================
// DEPÓSITOS (Warehouses)
// ============================================================================

export const mockWarehouses: SapWarehouse[] = [
  {
    WarehouseCode: "01.01",
    WarehouseName: "DEPOSITO PRINCIPAL - AREA A",
    Inactive: "tNO"
  },
  {
    WarehouseCode: "02.02",
    WarehouseName: "DEPOSITO SECUNDARIO - AREA B",
    Inactive: "tNO"
  },
  {
    WarehouseCode: "03.01",
    WarehouseName: "DEPOSITO EXPEDICAO",
    Inactive: "tNO"
  },
  {
    WarehouseCode: "04.01",
    WarehouseName: "DEPOSITO QUARENTENA",
    Inactive: "tNO"
  },
  {
    WarehouseCode: "99.99",
    WarehouseName: "DEPOSITO OBSOLETO (DESATIVADO)",
    Inactive: "tYES"
  }
];

// ============================================================================
// ESTOQUE (Item Warehouse Info)
// ============================================================================

export const mockItemWarehouseInfo: Record<string, SapItemWarehouseInfo[]> = {
  "TP0000016": [
    { WarehouseCode: "01.01", InStock: 5000, Committed: 500, Ordered: 1000, Available: 4500 },
    { WarehouseCode: "02.02", InStock: 3000, Committed: 200, Ordered: 0, Available: 2800 },
    { WarehouseCode: "03.01", InStock: 500, Committed: 100, Ordered: 0, Available: 400 }
  ],
  "GAR0001250": [
    { WarehouseCode: "01.01", InStock: 12000, Committed: 2000, Ordered: 5000, Available: 10000 },
    { WarehouseCode: "02.02", InStock: 8000, Committed: 1500, Ordered: 0, Available: 6500 }
  ],
  "ROT0050001": [
    { WarehouseCode: "01.01", InStock: 250, Committed: 50, Ordered: 100, Available: 200 },
    { WarehouseCode: "02.02", InStock: 150, Committed: 30, Ordered: 0, Available: 120 }
  ],
  "CX0048030": [
    { WarehouseCode: "01.01", InStock: 800, Committed: 150, Ordered: 200, Available: 650 },
    { WarehouseCode: "03.01", InStock: 300, Committed: 50, Ordered: 0, Available: 250 }
  ],
  "LAC0500001": [
    { WarehouseCode: "01.01", InStock: 1500, Committed: 300, Ordered: 500, Available: 1200 },
    { WarehouseCode: "02.02", InStock: 1000, Committed: 200, Ordered: 0, Available: 800 }
  ],
  "GAR0002000": [
    { WarehouseCode: "01.01", InStock: 9000, Committed: 1800, Ordered: 3000, Available: 7200 },
    { WarehouseCode: "02.02", InStock: 6000, Committed: 1200, Ordered: 0, Available: 4800 }
  ],
  "TP0000038": [
    { WarehouseCode: "01.01", InStock: 4500, Committed: 450, Ordered: 800, Available: 4050 },
    { WarehouseCode: "02.02", InStock: 2500, Committed: 250, Ordered: 0, Available: 2250 }
  ],
  "FIT0050001": [
    { WarehouseCode: "01.01", InStock: 600, Committed: 100, Ordered: 150, Available: 500 },
    { WarehouseCode: "03.01", InStock: 200, Committed: 40, Ordered: 0, Available: 160 }
  ]
};

// ============================================================================
// PEDIDOS (Sales Orders)
// ============================================================================

export const mockOrders: SapOrder[] = [
  // Pedido 1 - Aberto, múltiplas linhas
  {
    DocEntry: 60,
    DocNum: 5,
    CardCode: "C00369",
    CardName: "EUTIDES JACKSON SARMENTO",
    DocDate: "2026-02-03T00:00:00Z",
    DocDueDate: "2026-02-10T00:00:00Z",
    DocStatus: "bost_Open",
    DocumentStatus: "bost_Open",
    DocTotal: 2850.50,
    DocCurrency: "R$",
    Comments: "Pedido urgente - cliente VIP",
    CreateDate: "2026-02-03",
    CreateTime: "0830",
    UpdateDate: "2026-02-03",
    UpdateTime: "0830",
    U_WMS_STATUS: null,
    U_WMS_ORDERID: null,
    DocumentLines: [
      {
        LineNum: 0,
        ItemCode: "TP0000016",
        ItemDescription: "TAMPA PLASTICA BRANCA 28MM - PCT C/100",
        Quantity: 100,
        WarehouseCode: "02.02",
        Price: 0.65,
        Currency: "R$",
        UnitPrice: 0.65,
        LineTotal: 65.00
      },
      {
        LineNum: 1,
        ItemCode: "GAR0001250",
        ItemDescription: "GARRAFA PET 1250ML CRISTAL - UNIDADE",
        Quantity: 2000,
        WarehouseCode: "01.01",
        Price: 1.25,
        Currency: "R$",
        UnitPrice: 1.25,
        LineTotal: 2500.00
      },
      {
        LineNum: 2,
        ItemCode: "ROT0050001",
        ItemDescription: "ROTULO ADESIVO 50X100MM - ROLO C/1000",
        Quantity: 5,
        WarehouseCode: "01.01",
        Price: 57.10,
        Currency: "R$",
        UnitPrice: 57.10,
        LineTotal: 285.50
      }
    ]
  },

  // Pedido 2 - Aberto, prioridade alta
  {
    DocEntry: 61,
    DocNum: 6,
    CardCode: "C00512",
    CardName: "DISTRIBUIDORA NORDESTE LTDA",
    DocDate: "2026-02-03T00:00:00Z",
    DocDueDate: "2026-02-05T00:00:00Z",
    DocStatus: "bost_Open",
    DocumentStatus: "bost_Open",
    DocTotal: 15680.00,
    DocCurrency: "R$",
    Comments: "URGENTE - Prazo curto - Cliente atacadista",
    CreateDate: "2026-02-03",
    CreateTime: "0945",
    UpdateDate: "2026-02-03",
    UpdateTime: "1120",
    U_WMS_STATUS: "A_SEPARAR",
    U_WMS_ORDERID: null,
    DocumentLines: [
      {
        LineNum: 0,
        ItemCode: "GAR0002000",
        ItemDescription: "GARRAFA PET 2000ML CRISTAL - UNIDADE",
        Quantity: 5000,
        WarehouseCode: "01.01",
        Price: 1.80,
        Currency: "R$",
        UnitPrice: 1.80,
        LineTotal: 9000.00
      },
      {
        LineNum: 1,
        ItemCode: "TP0000038",
        ItemDescription: "TAMPA PLASTICA AZUL 38MM - PCT C/100",
        Quantity: 200,
        WarehouseCode: "01.01",
        Price: 0.85,
        Currency: "R$",
        UnitPrice: 0.85,
        LineTotal: 170.00
      },
      {
        LineNum: 2,
        ItemCode: "CX0048030",
        ItemDescription: "CAIXA PAPELAO 48X30X30CM - 25 UNIDADES",
        Quantity: 150,
        WarehouseCode: "01.01",
        Price: 42.40,
        Currency: "R$",
        UnitPrice: 42.40,
        LineTotal: 6360.00
      },
      {
        LineNum: 3,
        ItemCode: "FIT0050001",
        ItemDescription: "FITA ADESIVA TRANSPARENTE 50MM - ROLO",
        Quantity: 50,
        WarehouseCode: "01.01",
        Price: 3.00,
        Currency: "R$",
        UnitPrice: 3.00,
        LineTotal: 150.00
      }
    ]
  },

  // Pedido 3 - Aberto, pedido pequeno
  {
    DocEntry: 62,
    DocNum: 7,
    CardCode: "C00789",
    CardName: "MARIA APARECIDA COMERCIO",
    DocDate: "2026-02-04T00:00:00Z",
    DocDueDate: "2026-02-11T00:00:00Z",
    DocStatus: "bost_Open",
    DocumentStatus: "bost_Open",
    DocTotal: 1895.00,
    DocCurrency: "R$",
    Comments: "",
    CreateDate: "2026-02-04",
    CreateTime: "1015",
    UpdateDate: "2026-02-04",
    UpdateTime: "1015",
    U_WMS_STATUS: null,
    U_WMS_ORDERID: null,
    DocumentLines: [
      {
        LineNum: 0,
        ItemCode: "GAR0001250",
        ItemDescription: "GARRAFA PET 1250ML CRISTAL - UNIDADE",
        Quantity: 1000,
        WarehouseCode: "02.02",
        Price: 1.25,
        Currency: "R$",
        UnitPrice: 1.25,
        LineTotal: 1250.00
      },
      {
        LineNum: 1,
        ItemCode: "LAC0500001",
        ItemDescription: "LACRE SEGURANÇA PLASTICO VERMELHO - PCT C/500",
        Quantity: 50,
        WarehouseCode: "01.01",
        Price: 12.90,
        Currency: "R$",
        UnitPrice: 12.90,
        LineTotal: 645.00
      }
    ]
  },

  // Pedido 4 - Fechado (entregue)
  {
    DocEntry: 58,
    DocNum: 3,
    CardCode: "C01024",
    CardName: "SUPERMERCADO BOM PREÇO",
    DocDate: "2026-02-01T00:00:00Z",
    DocDueDate: "2026-02-08T00:00:00Z",
    DocStatus: "bost_Close",
    DocumentStatus: "bost_Close",
    DocTotal: 8950.00,
    DocCurrency: "R$",
    Comments: "Entrega realizada com sucesso",
    CreateDate: "2026-02-01",
    CreateTime: "0800",
    UpdateDate: "2026-02-02",
    UpdateTime: "1645",
    U_WMS_STATUS: "DESPACHADO",
    U_WMS_ORDERID: "550e8400-e29b-41d4-a716-446655440001",
    U_WMS_LAST_EVENT: "DESPACHAR",
    U_WMS_LAST_TS: "2026-02-02T16:45:00Z",
    DocumentLines: [
      {
        LineNum: 0,
        ItemCode: "GAR0002000",
        ItemDescription: "GARRAFA PET 2000ML CRISTAL - UNIDADE",
        Quantity: 3000,
        WarehouseCode: "01.01",
        Price: 1.80,
        Currency: "R$",
        UnitPrice: 1.80,
        LineTotal: 5400.00
      },
      {
        LineNum: 1,
        ItemCode: "TP0000038",
        ItemDescription: "TAMPA PLASTICA AZUL 38MM - PCT C/100",
        Quantity: 150,
        WarehouseCode: "01.01",
        Price: 0.85,
        Currency: "R$",
        UnitPrice: 0.85,
        LineTotal: 127.50
      },
      {
        LineNum: 2,
        ItemCode: "CX0048030",
        ItemDescription: "CAIXA PAPELAO 48X30X30CM - 25 UNIDADES",
        Quantity: 80,
        WarehouseCode: "03.01",
        Price: 42.40,
        Currency: "R$",
        UnitPrice: 42.40,
        LineTotal: 3392.00
      },
      {
        LineNum: 3,
        ItemCode: "FIT0050001",
        ItemDescription: "FITA ADESIVA TRANSPARENTE 50MM - ROLO",
        Quantity: 10,
        WarehouseCode: "01.01",
        Price: 3.00,
        Currency: "R$",
        UnitPrice: 3.00,
        LineTotal: 30.00
      }
    ]
  },

  // Pedido 5 - Aberto, pedido grande
  {
    DocEntry: 63,
    DocNum: 8,
    CardCode: "C01156",
    CardName: "JOSÉ ROBERTO SILVA - ME",
    DocDate: "2026-02-04T00:00:00Z",
    DocDueDate: "2026-02-15T00:00:00Z",
    DocStatus: "bost_Open",
    DocumentStatus: "bost_Open",
    DocTotal: 4520.50,
    DocCurrency: "R$",
    Comments: "Cliente solicita embalagem reforçada",
    CreateDate: "2026-02-04",
    CreateTime: "1430",
    UpdateDate: "2026-02-04",
    UpdateTime: "1430",
    U_WMS_STATUS: null,
    U_WMS_ORDERID: null,
    DocumentLines: [
      {
        LineNum: 0,
        ItemCode: "TP0000016",
        ItemDescription: "TAMPA PLASTICA BRANCA 28MM - PCT C/100",
        Quantity: 300,
        WarehouseCode: "01.01",
        Price: 0.65,
        Currency: "R$",
        UnitPrice: 0.65,
        LineTotal: 195.00
      },
      {
        LineNum: 1,
        ItemCode: "GAR0001250",
        ItemDescription: "GARRAFA PET 1250ML CRISTAL - UNIDADE",
        Quantity: 3000,
        WarehouseCode: "01.01",
        Price: 1.25,
        Currency: "R$",
        UnitPrice: 1.25,
        LineTotal: 3750.00
      },
      {
        LineNum: 2,
        ItemCode: "ROT0050001",
        ItemDescription: "ROTULO ADESIVO 50X100MM - ROLO C/1000",
        Quantity: 10,
        WarehouseCode: "02.02",
        Price: 57.10,
        Currency: "R$",
        UnitPrice: 57.10,
        LineTotal: 571.00
      },
      {
        LineNum: 3,
        ItemCode: "LAC0500001",
        ItemDescription: "LACRE SEGURANÇA PLASTICO VERMELHO - PCT C/500",
        Quantity: 4,
        WarehouseCode: "02.02",
        Price: 12.90,
        Currency: "R$",
        UnitPrice: 12.90,
        LineTotal: 51.60
      }
    ]
  },

  // Pedido 6 - Fechado recentemente
  {
    DocEntry: 59,
    DocNum: 4,
    CardCode: "C00512",
    CardName: "DISTRIBUIDORA NORDESTE LTDA",
    DocDate: "2026-02-02T00:00:00Z",
    DocDueDate: "2026-02-09T00:00:00Z",
    DocStatus: "bost_Close",
    DocumentStatus: "bost_Close",
    DocTotal: 12450.00,
    DocCurrency: "R$",
    Comments: "Pedido fechado - entrega confirmada",
    CreateDate: "2026-02-02",
    CreateTime: "0915",
    UpdateDate: "2026-02-03",
    UpdateTime: "1130",
    U_WMS_STATUS: "DESPACHADO",
    U_WMS_ORDERID: "550e8400-e29b-41d4-a716-446655440002",
    U_WMS_LAST_EVENT: "DESPACHAR",
    U_WMS_LAST_TS: "2026-02-03T11:30:00Z",
    U_WMS_CORR_ID: "corr-2026020209151234",
    DocumentLines: [
      {
        LineNum: 0,
        ItemCode: "GAR0001250",
        ItemDescription: "GARRAFA PET 1250ML CRISTAL - UNIDADE",
        Quantity: 8000,
        WarehouseCode: "01.01",
        Price: 1.25,
        Currency: "R$",
        UnitPrice: 1.25,
        LineTotal: 10000.00
      },
      {
        LineNum: 1,
        ItemCode: "TP0000016",
        ItemDescription: "TAMPA PLASTICA BRANCA 28MM - PCT C/100",
        Quantity: 400,
        WarehouseCode: "02.02",
        Price: 0.65,
        Currency: "R$",
        UnitPrice: 0.65,
        LineTotal: 260.00
      },
      {
        LineNum: 2,
        ItemCode: "CX0048030",
        ItemDescription: "CAIXA PAPELAO 48X30X30CM - 25 UNIDADES",
        Quantity: 50,
        WarehouseCode: "03.01",
        Price: 42.40,
        Currency: "R$",
        UnitPrice: 42.40,
        LineTotal: 2120.00
      },
      {
        LineNum: 3,
        ItemCode: "FIT0050001",
        ItemDescription: "FITA ADESIVA TRANSPARENTE 50MM - ROLO",
        Quantity: 23,
        WarehouseCode: "01.01",
        Price: 3.00,
        Currency: "R$",
        UnitPrice: 3.00,
        LineTotal: 69.00
      }
    ]
  }
];

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

/**
 * Gera um novo pedido mock com dados aleatórios
 */
export function generateRandomOrder(docEntry: number, docNum: number): SapOrder {
  const customers = mockBusinessPartners.filter(bp => bp.Valid === "tYES");
  const customer = customers[Math.floor(Math.random() * customers.length)];
  
  const now = new Date();
  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + Math.floor(Math.random() * 14) + 1);

  const numLines = Math.floor(Math.random() * 4) + 1;
  const lines: SapDocumentLine[] = [];
  let total = 0;

  for (let i = 0; i < numLines; i++) {
    const item = mockItems[Math.floor(Math.random() * mockItems.length)];
    const warehouse = mockWarehouses.filter(w => w.Inactive === "tNO")[0];
    const quantity = Math.floor(Math.random() * 1000) + 100;
    const price = Math.random() * 50 + 5;
    const lineTotal = quantity * price;
    total += lineTotal;

    lines.push({
      LineNum: i,
      ItemCode: item.ItemCode,
      ItemDescription: item.ItemName,
      Quantity: quantity,
      WarehouseCode: warehouse.WarehouseCode,
      Price: parseFloat(price.toFixed(2)),
      Currency: "R$",
      UnitPrice: parseFloat(price.toFixed(2)),
      LineTotal: parseFloat(lineTotal.toFixed(2))
    });
  }

  return {
    DocEntry: docEntry,
    DocNum: docNum,
    CardCode: customer.CardCode,
    CardName: customer.CardName,
    DocDate: now.toISOString(),
    DocDueDate: dueDate.toISOString(),
    DocStatus: "bost_Open",
    DocumentStatus: "bost_Open",
    DocTotal: parseFloat(total.toFixed(2)),
    DocCurrency: "R$",
    Comments: "",
    CreateDate: now.toISOString().split('T')[0],
    CreateTime: now.toTimeString().split(' ')[0].replace(/:/g, '').substring(0, 4),
    UpdateDate: now.toISOString().split('T')[0],
    UpdateTime: now.toTimeString().split(' ')[0].replace(/:/g, '').substring(0, 4),
    DocumentLines: lines
  };
}

/**
 * Retorna pedidos filtrados por status
 */
export function getOrdersByStatus(status: "open" | "closed" | "all"): SapOrder[] {
  if (status === "all") return mockOrders;
  
  const sapStatus = status === "open" ? "bost_Open" : "bost_Close";
  return mockOrders.filter(o => o.DocStatus === sapStatus);
}

/**
 * Retorna pedidos de um cliente específico
 */
export function getOrdersByCustomer(cardCode: string): SapOrder[] {
  return mockOrders.filter(o => o.CardCode === cardCode);
}

/**
 * Retorna estoque de um produto
 */
export function getItemStock(itemCode: string): SapItemWarehouseInfo[] {
  return mockItemWarehouseInfo[itemCode] || [];
}
