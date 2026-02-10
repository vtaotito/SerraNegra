"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SapConfigForm } from "@/features/integration/components/SapConfigForm";
import { SapStatusCard } from "@/features/integration/components/SapStatusCard";
import { SapOrdersPreview } from "@/features/integration/components/SapOrdersPreview";
import { SapSyncHistory } from "@/features/integration/components/SapSyncHistory";
import { SapEntityOverview } from "@/features/integration/components/SapEntityOverview";
import { SapFieldMappings } from "@/features/integration/components/SapFieldMappings";
import { useSapConfig, useSapSyncStatus } from "@/features/integration/hooks/useSapIntegration";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Settings,
  Activity,
  Database,
  LayoutGrid,
  Map,
  Info,
} from "lucide-react";
import type { SapSyncHistoryItem } from "@/features/integration/types";

export default function IntegracaoPage() {
  const { data: currentConfig, isLoading: isLoadingConfig } = useSapConfig();
  const { data: syncStatus, isLoading: isLoadingSyncStatus } = useSapSyncStatus();

  // Mock history (substituir por query real quando endpoint /sync/logs estiver disponível)
  const mockHistory: SapSyncHistoryItem[] = [];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Integração SAP B1
          </h1>
          <p className="text-muted-foreground">
            Configure, monitore e navegue pelos dados sincronizados com SAP
            Business One
          </p>
        </div>

        {/* Status Card (sempre visível) */}
        <SapStatusCard />

        {/* Tabs */}
        <Tabs defaultValue="entities" className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="entities" className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Entidades</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              <span className="hidden sm:inline">Pedidos SAP</span>
            </TabsTrigger>
            <TabsTrigger value="status" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Status</span>
            </TabsTrigger>
            <TabsTrigger value="mappings" className="flex items-center gap-2">
              <Map className="h-4 w-4" />
              <span className="hidden sm:inline">Mapeamento</span>
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Configuração</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab: Entidades Sincronizadas */}
          <TabsContent value="entities" className="space-y-6">
            <SapEntityOverview
              syncStatus={syncStatus}
              isLoading={isLoadingSyncStatus}
            />
          </TabsContent>

          {/* Tab: Pedidos SAP */}
          <TabsContent value="orders" className="space-y-6">
            <SapOrdersPreview />

            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6">
                <p className="text-sm text-blue-900">
                  <strong>Dica:</strong> Clique em qualquer pedido para ver todos
                  os campos SAP. Os pedidos listados aqui são consultados
                  diretamente do SAP B1 via Service Layer. Para importá-los para o
                  WMS, use o botão &quot;Sincronizar Agora&quot; no card de status.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Status & Histórico */}
          <TabsContent value="status" className="space-y-6">
            <SapSyncHistory history={mockHistory} isLoading={false} />

            <div className="grid gap-6 md:grid-cols-2">
              {/* Métricas de Integração */}
              <Card>
                <CardHeader>
                  <h3 className="font-semibold">Métricas de Integração</h3>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Total sincronizado (hoje):
                    </span>
                    <span className="font-medium">
                      {syncStatus?.last_sync_count ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Taxa de sucesso:
                    </span>
                    <span
                      className={`font-medium ${
                        syncStatus?.last_sync_status === "FAILED"
                          ? "text-red-600"
                          : "text-green-600"
                      }`}
                    >
                      {syncStatus?.last_sync_status === "FAILED" ? "Erro" : "100%"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Pedidos abertos SAP:
                    </span>
                    <span className="font-medium text-blue-600">
                      {syncStatus?.sap_open_orders ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Erros (últimas 24h):
                    </span>
                    <span className="font-medium">
                      {syncStatus?.error ? 1 : 0}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Info do Worker */}
              <Card>
                <CardHeader>
                  <h3 className="font-semibold">Worker de Sincronização</h3>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status:</span>
                    <span className="font-medium text-green-600">Ativo</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Intervalo:</span>
                    <span className="font-medium">30 segundos</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Modo:</span>
                    <span className="font-medium">Polling incremental</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Idempotência:</span>
                    <span className="font-medium">
                      Por sap_doc_entry (cursor)
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab: Mapeamento de Campos */}
          <TabsContent value="mappings" className="space-y-6">
            <SapFieldMappings />
          </TabsContent>

          {/* Tab: Configuração */}
          <TabsContent value="config" className="space-y-6">
            <SapConfigForm initialConfig={currentConfig} />

            {/* Informações Técnicas */}
            <Card>
              <CardHeader>
                <h3 className="font-semibold flex items-center gap-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  Informações Técnicas
                </h3>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="text-sm font-medium mb-2">
                    Endpoints Disponíveis
                  </h4>
                  <div className="space-y-1 text-sm font-mono text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className="text-green-600 font-semibold w-14 text-right">
                        GET
                      </span>
                      <span>/sap/health</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-600 font-semibold w-14 text-right">
                        GET
                      </span>
                      <span>/sap/orders</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-600 font-semibold w-14 text-right">
                        GET
                      </span>
                      <span>/sap/orders/:docEntry</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-amber-600 font-semibold w-14 text-right">
                        PATCH
                      </span>
                      <span>/sap/orders/:docEntry/status</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-blue-600 font-semibold w-14 text-right">
                        POST
                      </span>
                      <span>/sap/sync</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-600 font-semibold w-14 text-right">
                        GET
                      </span>
                      <span>/sap/sync/status</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-600 font-semibold w-14 text-right">
                        GET
                      </span>
                      <span>/sap/config</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-amber-600 font-semibold w-14 text-right">
                        PUT
                      </span>
                      <span>/sap/config</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-blue-600 font-semibold w-14 text-right">
                        POST
                      </span>
                      <span>/sap/config/test</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-red-600 font-semibold w-14 text-right">
                        DELETE
                      </span>
                      <span>/sap/config</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-blue-600 font-semibold w-14 text-right">
                        POST
                      </span>
                      <span>/sap/session/refresh</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-600 font-semibold w-14 text-right">
                        GET
                      </span>
                      <span>/sap/cache/stats</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-red-600 font-semibold w-14 text-right">
                        DELETE
                      </span>
                      <span>/sap/cache</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">UDFs Utilizados</h4>
                  <div className="grid gap-2 md:grid-cols-2 text-sm">
                    <div className="rounded-md border p-2">
                      <span className="font-mono text-xs font-semibold text-purple-700 block">
                        U_WMS_STATUS
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Status do pedido no WMS
                      </span>
                    </div>
                    <div className="rounded-md border p-2">
                      <span className="font-mono text-xs font-semibold text-purple-700 block">
                        U_WMS_ORDERID
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ID interno do WMS
                      </span>
                    </div>
                    <div className="rounded-md border p-2">
                      <span className="font-mono text-xs font-semibold text-purple-700 block">
                        U_WMS_LAST_EVENT
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Último evento processado
                      </span>
                    </div>
                    <div className="rounded-md border p-2">
                      <span className="font-mono text-xs font-semibold text-purple-700 block">
                        U_WMS_LAST_TS
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Timestamp da última atualização
                      </span>
                    </div>
                    <div className="rounded-md border p-2">
                      <span className="font-mono text-xs font-semibold text-purple-700 block">
                        U_WMS_CORR_ID
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ID de correlação (idempotência)
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">
                    Mapeamento de Status
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 rounded-md border p-2">
                      <span className="font-mono text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                        bost_Open
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-mono text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                        A_SEPARAR
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        (SAP → WMS)
                      </span>
                    </div>
                    <div className="flex items-center gap-2 rounded-md border p-2">
                      <span className="font-mono text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                        bost_Close
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-mono text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                        DESPACHADO
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        (SAP → WMS)
                      </span>
                    </div>
                    <div className="flex items-center gap-2 rounded-md border p-2">
                      <span className="font-mono text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                        DESPACHADO
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-mono text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                        U_WMS_STATUS=&apos;DISPATCHED&apos;
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        (WMS → SAP)
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
