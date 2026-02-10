"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart,
  Package,
  Users,
  Warehouse,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Database,
} from "lucide-react";

interface FieldMapping {
  sapField: string;
  sapType: string;
  wmsField: string;
  description: string;
}

interface EntityMapping {
  entity: string;
  sapEntity: string;
  icon: typeof ShoppingCart;
  color: string;
  fields: FieldMapping[];
}

const MAPPINGS: EntityMapping[] = [
  {
    entity: "Pedidos",
    sapEntity: "Orders (DocumentLines)",
    icon: ShoppingCart,
    color: "blue",
    fields: [
      { sapField: "DocEntry", sapType: "number", wmsField: "sap_doc_entry", description: "Chave primária SAP" },
      { sapField: "DocNum", sapType: "number", wmsField: "sap_doc_num / external_order_id", description: "Número do documento" },
      { sapField: "CardCode", sapType: "string", wmsField: "customer_id", description: "Código do cliente" },
      { sapField: "CardName", sapType: "string", wmsField: "customer_name", description: "Nome do cliente" },
      { sapField: "DocDate", sapType: "string", wmsField: "createdAt", description: "Data do pedido" },
      { sapField: "DocDueDate", sapType: "string", wmsField: "slaDueAt", description: "Data de vencimento (SLA)" },
      { sapField: "DocStatus", sapType: "string", wmsField: "sap_doc_status", description: "bost_Open / bost_Close" },
      { sapField: "DocTotal", sapType: "number", wmsField: "doc_total / total_amount", description: "Valor total do pedido" },
      { sapField: "DocCurrency", sapType: "string", wmsField: "currency", description: "Moeda (R$, US$)" },
      { sapField: "Comments", sapType: "string", wmsField: "metadata.sapComments", description: "Observações" },
      { sapField: "Address / Address2", sapType: "string", wmsField: "shipToAddress", description: "Endereço de entrega" },
      { sapField: "U_WMS_STATUS", sapType: "UDF", wmsField: "sap_udf_wms_status", description: "Status WMS gravado no SAP" },
      { sapField: "U_WMS_ORDERID", sapType: "UDF", wmsField: "sap_udf_wms_orderid", description: "ID WMS gravado no SAP" },
      { sapField: "U_WMS_LAST_EVENT", sapType: "UDF", wmsField: "sap_udf_wms_last_event", description: "Último evento WMS" },
    ],
  },
  {
    entity: "Linhas do Pedido",
    sapEntity: "DocumentLines",
    icon: Package,
    color: "purple",
    fields: [
      { sapField: "LineNum", sapType: "number", wmsField: "sap_line_num", description: "Número da linha" },
      { sapField: "ItemCode", sapType: "string", wmsField: "sku / sap_item_code", description: "Código do item" },
      { sapField: "ItemDescription", sapType: "string", wmsField: "product_description", description: "Descrição do item" },
      { sapField: "Quantity", sapType: "number", wmsField: "quantity", description: "Quantidade pedida" },
      { sapField: "WarehouseCode", sapType: "string", wmsField: "warehouse_code", description: "Depósito de origem" },
      { sapField: "Price / UnitPrice", sapType: "number", wmsField: "unit_price", description: "Preço unitário" },
      { sapField: "LineTotal", sapType: "number", wmsField: "line_total", description: "Total da linha" },
      { sapField: "MeasureUnit", sapType: "string", wmsField: "unit_of_measure", description: "Unidade de medida" },
      { sapField: "LineStatus", sapType: "string", wmsField: "—", description: "bost_Open / bost_Close" },
    ],
  },
  {
    entity: "Produtos",
    sapEntity: "Items",
    icon: Package,
    color: "green",
    fields: [
      { sapField: "ItemCode", sapType: "string", wmsField: "sku / sap_item_code", description: "Código do item" },
      { sapField: "ItemName", sapType: "string", wmsField: "sap_item_name / description", description: "Nome do item" },
      { sapField: "InventoryUOM", sapType: "string", wmsField: "unit_of_measure", description: "Unidade de medida" },
      { sapField: "InventoryItem", sapType: "tYES/tNO", wmsField: "flags.inventoryItem", description: "Item de estoque" },
      { sapField: "SalesItem", sapType: "tYES/tNO", wmsField: "flags.salesItem", description: "Item de venda" },
      { sapField: "Valid", sapType: "tYES/tNO", wmsField: "is_active", description: "Item válido/ativo" },
      { sapField: "Frozen", sapType: "tYES/tNO", wmsField: "is_active (inverso)", description: "Item congelado" },
    ],
  },
  {
    entity: "Clientes",
    sapEntity: "BusinessPartners",
    icon: Users,
    color: "orange",
    fields: [
      { sapField: "CardCode", sapType: "string", wmsField: "sap_card_code / customer_code", description: "Código do parceiro" },
      { sapField: "CardName", sapType: "string", wmsField: "sap_card_name / name", description: "Nome do parceiro" },
      { sapField: "Phone1", sapType: "string", wmsField: "phone", description: "Telefone" },
      { sapField: "EmailAddress", sapType: "string", wmsField: "email", description: "E-mail" },
      { sapField: "FederalTaxID", sapType: "string", wmsField: "document", description: "CPF/CNPJ" },
      { sapField: "Address", sapType: "string", wmsField: "address", description: "Endereço" },
      { sapField: "City", sapType: "string", wmsField: "city", description: "Cidade" },
      { sapField: "State", sapType: "string", wmsField: "state", description: "Estado" },
    ],
  },
  {
    entity: "Estoque",
    sapEntity: "WarehouseGenEntries / BinLocations",
    icon: Warehouse,
    color: "teal",
    fields: [
      { sapField: "ItemCode", sapType: "string", wmsField: "sku", description: "Código do item" },
      { sapField: "WarehouseCode", sapType: "string", wmsField: "warehouseCode", description: "Código do depósito" },
      { sapField: "InStock", sapType: "number", wmsField: "inStock", description: "Quantidade em estoque" },
      { sapField: "OnHand", sapType: "number", wmsField: "onHand", description: "Quantidade disponível" },
      { sapField: "Committed", sapType: "number", wmsField: "committed", description: "Quantidade comprometida" },
      { sapField: "Ordered", sapType: "number", wmsField: "ordered", description: "Quantidade em pedido" },
      { sapField: "BinAbsEntry", sapType: "number", wmsField: "binAbsEntry", description: "ID da posição (bin)" },
      { sapField: "BinCode", sapType: "string", wmsField: "binCode", description: "Código da posição (bin)" },
    ],
  },
];

export function SapFieldMappings() {
  const [expandedEntity, setExpandedEntity] = useState<string | null>("Pedidos");

  const toggleEntity = (entity: string) => {
    setExpandedEntity((prev) => (prev === entity ? null : entity));
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Database className="h-5 w-5 text-muted-foreground" />
          Mapeamento SAP → WMS
        </h3>
        <p className="text-sm text-muted-foreground">
          Campos mapeados do SAP Business One Service Layer para o WMS Core
        </p>
      </div>

      <div className="space-y-2">
        {MAPPINGS.map((mapping) => {
          const Icon = mapping.icon;
          const isExpanded = expandedEntity === mapping.entity;

          return (
            <Card key={mapping.entity} className="overflow-hidden">
              <button
                type="button"
                className="w-full text-left"
                onClick={() => toggleEntity(mapping.entity)}
              >
                <CardHeader className="py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <CardTitle className="text-sm">{mapping.entity}</CardTitle>
                        <CardDescription className="text-xs">
                          SAP: {mapping.sapEntity} &middot; {mapping.fields.length} campos
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {mapping.fields.length} campos
                      </Badge>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CardHeader>
              </button>

              {isExpanded && (
                <CardContent className="pt-0">
                  <div className="overflow-x-auto -mx-6 px-6">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-[10px] uppercase text-muted-foreground">
                          <th className="text-left py-2 pr-3">Campo SAP</th>
                          <th className="text-left py-2 pr-3">Tipo</th>
                          <th className="text-center py-2 pr-3" />
                          <th className="text-left py-2 pr-3">Campo WMS</th>
                          <th className="text-left py-2">Descrição</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {mapping.fields.map((field) => (
                          <tr
                            key={field.sapField}
                            className="hover:bg-muted/30 transition-colors"
                          >
                            <td className="py-2 pr-3 font-mono font-semibold text-blue-700">
                              {field.sapField}
                            </td>
                            <td className="py-2 pr-3">
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5"
                              >
                                {field.sapType}
                              </Badge>
                            </td>
                            <td className="py-2 pr-3 text-center">
                              <ArrowRight className="h-3 w-3 text-muted-foreground inline" />
                            </td>
                            <td className="py-2 pr-3 font-mono text-green-700">
                              {field.wmsField}
                            </td>
                            <td className="py-2 text-muted-foreground">
                              {field.description}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
