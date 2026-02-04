import { useState } from "react";
import { sapHealthCheck, listSapOrders, isSapApiConfigured } from "../api/sap";
import type { UiOrder } from "../api/types";

type SapIntegrationPanelProps = {
  onOrdersLoaded?: (orders: UiOrder[]) => void;
};

export function SapIntegrationPanel({ onOrdersLoaded }: SapIntegrationPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [healthStatus, setHealthStatus] = useState<"idle" | "ok" | "error">("idle");
  const [healthMessage, setHealthMessage] = useState<string>("");
  const [syncStatus, setSyncStatus] = useState<string>("");

  const isConfigured = isSapApiConfigured();

  async function handleTestConnection() {
    setIsLoading(true);
    setHealthStatus("idle");
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
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSyncOrders() {
    setIsLoading(true);
    setSyncStatus("");

    try {
      setSyncStatus("Buscando pedidos do SAP...");
      const orders = await listSapOrders({
        docStatus: "O", // Apenas pedidos abertos
        limit: 100
      });

      setSyncStatus(`✓ ${orders.length} pedido(s) carregado(s) do SAP`);

      // Notificar componente pai
      if (onOrdersLoaded) {
        onOrdersLoaded(orders);
      }
    } catch (error) {
      setSyncStatus(
        `✗ Erro: ${error instanceof Error ? error.message : "Erro desconhecido"}`
      );
    } finally {
      setIsLoading(false);
    }
  }

  if (!isConfigured) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          ⚠ Integração SAP não configurada. Configure VITE_API_BASE_URL no .env
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <h3 className="text-lg font-semibold mb-4">Integração SAP Business One</h3>

      <div className="space-y-3">
        {/* Teste de Conexão */}
        <div>
          <button
            onClick={handleTestConnection}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "Testando..." : "Testar Conexão SAP"}
          </button>

          {healthStatus === "ok" && (
            <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-800">
              ✓ {healthMessage}
            </div>
          )}

          {healthStatus === "error" && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
              ✗ {healthMessage}
            </div>
          )}
        </div>

        {/* Sincronizar Pedidos */}
        <div className="border-t pt-3">
          <button
            onClick={handleSyncOrders}
            disabled={isLoading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "Carregando..." : "Sincronizar Pedidos"}
          </button>

          {syncStatus && (
            <div
              className={`mt-2 p-2 border rounded text-sm ${
                syncStatus.startsWith("✓")
                  ? "bg-green-50 border-green-200 text-green-800"
                  : syncStatus.startsWith("✗")
                  ? "bg-red-50 border-red-200 text-red-800"
                  : "bg-blue-50 border-blue-200 text-blue-800"
              }`}
            >
              {syncStatus}
            </div>
          )}
        </div>

        {/* Informações */}
        <div className="mt-4 p-3 bg-gray-50 rounded text-xs text-gray-600">
          <p className="font-medium mb-1">Informações:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Testar Conexão: valida credenciais SAP</li>
            <li>Sincronizar Pedidos: busca pedidos abertos (DocStatus = 'O')</li>
            <li>Os pedidos serão exibidos no kanban abaixo</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
