"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ShoppingCart,
  Package,
  Users,
  Warehouse,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
} from "lucide-react";
import type { SyncEntityStatus } from "../types";
import type { SapSyncStatus } from "../types";

const ENTITY_ICONS = {
  ORDERS: ShoppingCart,
  PRODUCTS: Package,
  CUSTOMERS: Users,
  STOCK: Warehouse,
};

const ENTITY_ROUTES: Record<string, string> = {
  ORDERS: "/pedidos",
  PRODUCTS: "/produtos",
  CUSTOMERS: "/pedidos",
  STOCK: "/estoque",
};

interface SapEntityOverviewProps {
  syncStatus?: SapSyncStatus;
  isLoading?: boolean;
}

/**
 * Visão geral das entidades sincronizadas SAP → WMS.
 * Como sync_control não tem endpoint REST, derivamos os dados do syncStatus
 * e das informações de design (migrations/seed).
 */
export function SapEntityOverview({
  syncStatus,
  isLoading,
}: SapEntityOverviewProps) {
  // Entidades baseadas no seed da migration 004_create_sync_and_audit_tables
  const entities: SyncEntityStatus[] = [
    {
      entityType: "ORDERS",
      label: "Pedidos",
      icon: "ShoppingCart",
      syncIntervalMinutes: 5,
      isEnabled: true,
      lastSyncAt: syncStatus?.last_sync_date ?? undefined,
      lastSyncStatus: syncStatus?.last_sync_status ?? null,
      totalSynced: syncStatus?.last_sync_count ?? 0,
      errorCount: syncStatus?.error ? 1 : 0,
      description:
        "Pedidos de venda (Orders) do SAP B1 → WMS Core. Sincronização via Worker a cada 30s.",
    },
    {
      entityType: "PRODUCTS",
      label: "Produtos",
      icon: "Package",
      syncIntervalMinutes: 30,
      isEnabled: false,
      totalSynced: 0,
      errorCount: 0,
      description:
        "Itens do cadastro de produtos (Items) do SAP B1. Mapeamento disponível, sync automático não ativado.",
    },
    {
      entityType: "CUSTOMERS",
      label: "Clientes",
      icon: "Users",
      syncIntervalMinutes: 60,
      isEnabled: false,
      totalSynced: 0,
      errorCount: 0,
      description:
        "Parceiros de Negócio (BusinessPartners) do SAP B1. Mapeamento disponível, sync automático não ativado.",
    },
    {
      entityType: "STOCK",
      label: "Estoque",
      icon: "Warehouse",
      syncIntervalMinutes: 15,
      isEnabled: false,
      totalSynced: 0,
      errorCount: 0,
      description:
        "Estoque por depósito (WarehouseGenEntries) do SAP B1. Mapeamento disponível, sync automático não ativado.",
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Entidades Sincronizadas</h3>
        <p className="text-sm text-muted-foreground">
          Visão geral das entidades mapeadas entre SAP B1 e WMS Core
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {entities.map((entity) => {
          const Icon = ENTITY_ICONS[entity.entityType];
          const route = ENTITY_ROUTES[entity.entityType];

          return (
            <Card
              key={entity.entityType}
              className={`relative overflow-hidden ${
                entity.isEnabled
                  ? "border-l-4 border-l-green-500"
                  : "border-l-4 border-l-gray-300"
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    {entity.label}
                  </CardTitle>
                  <Badge
                    variant={entity.isEnabled ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {entity.isEnabled ? "Ativo" : "Não ativado"}
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  {entity.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md bg-muted/50 p-2">
                    <span className="text-lg font-bold block">
                      {entity.totalSynced}
                    </span>
                    <span className="text-[10px] uppercase text-muted-foreground">
                      Sincronizados
                    </span>
                  </div>
                  <div className="rounded-md bg-muted/50 p-2">
                    <span className="text-lg font-bold block">
                      {entity.syncIntervalMinutes}m
                    </span>
                    <span className="text-[10px] uppercase text-muted-foreground">
                      Intervalo
                    </span>
                  </div>
                  <div className="rounded-md bg-muted/50 p-2">
                    <span
                      className={`text-lg font-bold block ${
                        entity.errorCount > 0 ? "text-red-600" : "text-green-600"
                      }`}
                    >
                      {entity.errorCount}
                    </span>
                    <span className="text-[10px] uppercase text-muted-foreground">
                      Erros
                    </span>
                  </div>
                </div>

                {/* Status da última sync */}
                {entity.isEnabled && (
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      {entity.lastSyncStatus === "SUCCESS" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      ) : entity.lastSyncStatus === "FAILED" ? (
                        <XCircle className="h-3.5 w-3.5 text-red-600" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <span className="text-muted-foreground">
                        {entity.lastSyncAt
                          ? `Última sync: ${new Date(entity.lastSyncAt).toLocaleString("pt-BR")}`
                          : "Nunca sincronizado"}
                      </span>
                    </div>
                  </div>
                )}

                {!entity.isEnabled && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-600">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>Mapeamento disponível — ative no backend para sincronizar</span>
                  </div>
                )}

                {/* Link para página */}
                <Link href={route}>
                  <Button variant="ghost" size="sm" className="w-full mt-2">
                    Ver {entity.label.toLowerCase()} no WMS
                    <ArrowRight className="h-4 w-4 ml-auto" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
