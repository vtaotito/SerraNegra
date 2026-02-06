"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SapConfigForm } from "@/features/integration/components/SapConfigForm";
import { SapStatusCard } from "@/features/integration/components/SapStatusCard";
import { SapOrdersPreview } from "@/features/integration/components/SapOrdersPreview";
import { SapSyncHistory } from "@/features/integration/components/SapSyncHistory";
import { useSapConfig } from "@/features/integration/hooks/useSapIntegration";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Activity, Database } from "lucide-react";
import type { SapSyncHistoryItem } from "@/features/integration/types";

export default function IntegracaoPage() {
  const { data: currentConfig, isLoading: isLoadingConfig } = useSapConfig();

  // Mock history (substituir por query real quando endpoint estiver disponível)
  const mockHistory: SapSyncHistoryItem[] = [];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integração SAP B1</h1>
          <p className="text-muted-foreground">
            Configure e monitore a integração com SAP Business One
          </p>
        </div>

        {/* Status Card (sempre visível) */}
        <SapStatusCard />

        {/* Tabs */}
        <Tabs defaultValue="status" className="space-y-6">
          <TabsList>
            <TabsTrigger value="status" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Status
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configuração
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Pedidos SAP
            </TabsTrigger>
          </TabsList>

          {/* Tab: Status */}
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
                    <span className="text-muted-foreground">Total sincronizado (hoje):</span>
                    <span className="font-medium">0</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Taxa de sucesso:</span>
                    <span className="font-medium text-green-600">100%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tempo médio de sync:</span>
                    <span className="font-medium">N/A</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Erros (últimas 24h):</span>
                    <span className="font-medium">0</span>
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
                    <span className="text-muted-foreground">Uptime:</span>
                    <span className="font-medium">N/A</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab: Configuração */}
          <TabsContent value="config" className="space-y-6">
            <SapConfigForm initialConfig={currentConfig} />

            {/* Informações Técnicas */}
            <Card>
              <CardHeader>
                <h3 className="font-semibold">Informações Técnicas</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Endpoints Disponíveis</h4>
                  <div className="space-y-1 text-sm font-mono text-muted-foreground">
                    <div>GET /api/sap/health</div>
                    <div>GET /api/sap/orders</div>
                    <div>GET /api/sap/orders/:docEntry</div>
                    <div>PATCH /api/sap/orders/:docEntry/status</div>
                    <div>POST /api/sap/sync</div>
                    <div>GET /api/sap/sync/status</div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">UDFs Utilizados</h4>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div>
                      <span className="font-mono">U_WMS_STATUS</span> - Status do pedido no WMS
                    </div>
                    <div>
                      <span className="font-mono">U_WMS_ORDER_ID</span> - ID interno do WMS
                    </div>
                    <div>
                      <span className="font-mono">U_WMS_LAST_EVENT</span> - Último evento
                    </div>
                    <div>
                      <span className="font-mono">U_WMS_LAST_TS</span> - Timestamp da atualização
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">Mapeamento de Status</h4>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div>SAP <span className="font-mono">bost_Open</span> → WMS A_SEPARAR</div>
                    <div>SAP <span className="font-mono">bost_Close</span> → WMS DESPACHADO</div>
                    <div>WMS DESPACHADO → SAP <span className="font-mono">U_WMS_STATUS='DISPATCHED'</span></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Pedidos SAP */}
          <TabsContent value="orders" className="space-y-6">
            <SapOrdersPreview />

            {/* Info */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6">
                <p className="text-sm text-blue-900">
                  <strong>💡 Dica:</strong> Os pedidos listados aqui são consultados diretamente
                  do SAP B1 via Service Layer. Para importá-los para o WMS, use o botão
                  "Sincronizar Agora" na aba Status.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
