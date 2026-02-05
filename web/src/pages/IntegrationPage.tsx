import { useState, useEffect } from "react";
import { sapHealthCheck, listSapOrders, syncSapOrders, isSapApiConfigured } from "../api/sap";
import type { UiOrder } from "../api/types";

type HealthStatus = "idle" | "loading" | "ok" | "error";
type SyncStatus = "idle" | "loading" | "success" | "error";

export function IntegrationPage() {
  const [healthStatus, setHealthStatus] = useState<HealthStatus>("idle");
  const [healthMessage, setHealthMessage] = useState<string>("");
  
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncMessage, setSyncMessage] = useState<string>("");
  
  const [orders, setOrders] = useState<UiOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string>("");

  const [stats, setStats] = useState({
    totalOrders: 0,
    openOrders: 0,
    closedOrders: 0,
    lastSync: ""
  });

  const isConfigured = isSapApiConfigured();

  // Test connection
  async function handleTestConnection() {
    setHealthStatus("loading");
    setHealthMessage("");

    try {
      const result = await sapHealthCheck();

      if (result.status === "ok") {
        setHealthStatus("ok");
        setHealthMessage(result.message);
      } else {
        setHealthStatus("error");
        setHealthMessage(result.message + (result.details ? ` - ${result.details}` : ""));
      }
    } catch (error) {
      setHealthStatus("error");
      setHealthMessage(
        error instanceof Error ? error.message : "Erro desconhecido ao testar conexão"
      );
    }
  }

  // Load orders from SAP
  async function handleLoadOrders() {
    setOrdersLoading(true);
    setOrdersError("");

    try {
      const sapOrders = await listSapOrders({
        docStatus: "O", // Apenas pedidos abertos
        limit: 100
      });

      setOrders(sapOrders);
      
      // Update stats
      const open = sapOrders.filter(o => o.status === "A_SEPARAR" || o.status === "EM_SEPARACAO").length;
      const closed = sapOrders.filter(o => o.status === "DESPACHADO").length;
      
      setStats({
        totalOrders: sapOrders.length,
        openOrders: open,
        closedOrders: closed,
        lastSync: new Date().toISOString()
      });
    } catch (error) {
      setOrdersError(
        error instanceof Error ? error.message : "Erro ao carregar pedidos"
      );
    } finally {
      setOrdersLoading(false);
    }
  }

  // Sync orders to WMS
  async function handleSyncOrders() {
    setSyncStatus("loading");
    setSyncMessage("Sincronizando pedidos do SAP...");

    try {
      const result = await syncSapOrders();
      
      if (result.ok) {
        setSyncStatus("success");
        setSyncMessage(`✓ ${result.message} (${result.imported} importados)`);
        
        // Reload orders after sync
        setTimeout(() => handleLoadOrders(), 1000);
      } else {
        setSyncStatus("error");
        setSyncMessage(`✗ Erro: ${result.message}`);
      }
    } catch (error) {
      setSyncStatus("error");
      setSyncMessage(
        `✗ Erro: ${error instanceof Error ? error.message : "Erro desconhecido"}`
      );
    }
  }

  // Auto-load orders on mount
  useEffect(() => {
    if (isConfigured) {
      handleLoadOrders();
    }
  }, [isConfigured]);

  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-lg">
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">
            ⚠ Integração SAP Não Configurada
          </h2>
          <p className="text-sm text-yellow-700">
            Configure VITE_API_BASE_URL no arquivo .env para habilitar a integração com SAP B1.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Integração SAP Business One</h1>
          <p className="mt-2 text-sm text-gray-600">
            Sincronização e monitoramento de pedidos do SAP B1 Service Layer
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Total de Pedidos</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">{stats.totalOrders}</div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Pedidos Abertos</div>
            <div className="mt-2 text-3xl font-bold text-blue-600">{stats.openOrders}</div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Pedidos Fechados</div>
            <div className="mt-2 text-3xl font-bold text-green-600">{stats.closedOrders}</div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Última Sincronização</div>
            <div className="mt-2 text-sm font-medium text-gray-900">
              {stats.lastSync ? new Date(stats.lastSync).toLocaleString('pt-BR') : "Nunca"}
            </div>
          </div>
        </div>

        {/* Actions Panel */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Ações</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Test Connection */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-2">1. Testar Conexão</h3>
              <p className="text-xs text-gray-600 mb-4">Valida credenciais e conectividade com SAP</p>
              
              <button
                onClick={handleTestConnection}
                disabled={healthStatus === "loading"}
                className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {healthStatus === "loading" ? "Testando..." : "Testar Conexão"}
              </button>

              {healthStatus === "ok" && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded text-xs text-green-800">
                  ✓ {healthMessage}
                </div>
              )}

              {healthStatus === "error" && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                  ✗ {healthMessage}
                </div>
              )}
            </div>

            {/* Load Orders */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-2">2. Carregar Pedidos</h3>
              <p className="text-xs text-gray-600 mb-4">Busca pedidos abertos do SAP B1</p>
              
              <button
                onClick={handleLoadOrders}
                disabled={ordersLoading}
                className="w-full px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {ordersLoading ? "Carregando..." : "Carregar Pedidos"}
              </button>

              {ordersError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                  ✗ {ordersError}
                </div>
              )}
            </div>

            {/* Sync to WMS */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-2">3. Sincronizar para WMS</h3>
              <p className="text-xs text-gray-600 mb-4">Importa pedidos do SAP para o WMS</p>
              
              <button
                onClick={handleSyncOrders}
                disabled={syncStatus === "loading"}
                className="w-full px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {syncStatus === "loading" ? "Sincronizando..." : "Sincronizar"}
              </button>

              {syncStatus === "success" && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded text-xs text-green-800">
                  {syncMessage}
                </div>
              )}

              {syncStatus === "error" && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                  {syncMessage}
                </div>
              )}

              {syncStatus === "loading" && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                  {syncMessage}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Pedidos SAP ({orders.length})
            </h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Doc Entry
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pedido
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Itens
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Criado em
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.length === 0 && !ordersLoading && (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">
                      Nenhum pedido encontrado. Clique em "Carregar Pedidos" para buscar do SAP.
                    </td>
                  </tr>
                )}

                {ordersLoading && (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        <span className="ml-3">Carregando pedidos...</span>
                      </div>
                    </td>
                  </tr>
                )}

                {orders.map((order) => (
                  <tr key={order.sapDocEntry} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      {order.sapDocEntry}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      #{order.externalOrderId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="font-medium">{order.customerName}</div>
                      <div className="text-xs text-gray-500">{order.customerId}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        order.status === "A_SEPARAR" ? "bg-yellow-100 text-yellow-800" :
                        order.status === "EM_SEPARACAO" ? "bg-blue-100 text-blue-800" :
                        order.status === "CONFERIDO" ? "bg-purple-100 text-purple-800" :
                        order.status === "DESPACHADO" ? "bg-green-100 text-green-800" :
                        "bg-gray-100 text-gray-800"
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {order.docTotal && order.currency ? (
                        <span className="font-medium">
                          {new Intl.NumberFormat('pt-BR', { 
                            style: 'currency', 
                            currency: order.currency === 'R$' ? 'BRL' : 'USD' 
                          }).format(order.docTotal)}
                        </span>
                      ) : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {order.items.length} item(ns)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
