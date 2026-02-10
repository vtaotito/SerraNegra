import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post, put, del } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import type {
  SapConfig,
  SapConfigTestResponse,
  SapHealthResponse,
  SapSyncRequest,
  SapSyncResponse,
  SapSyncStatus,
} from "../types";

/**
 * Hook para buscar status de saude do SAP
 */
export function useSapHealth() {
  return useQuery<SapHealthResponse>({
    queryKey: ["sap", "health"],
    queryFn: () => get<SapHealthResponse>(API_ENDPOINTS.SAP_HEALTH),
    refetchInterval: 30000,
    retry: 1,
  });
}

/**
 * Hook para buscar status de sincronizacao
 */
export function useSapSyncStatus() {
  return useQuery<SapSyncStatus>({
    queryKey: ["sap", "sync", "status"],
    queryFn: () => get<SapSyncStatus>(API_ENDPOINTS.SAP_SYNC_STATUS),
    refetchInterval: 10000,
    retry: 1,
  });
}

/**
 * Hook para buscar configuracao atual do SAP
 */
export function useSapConfig() {
  return useQuery<SapConfig>({
    queryKey: ["sap", "config"],
    queryFn: () => get<SapConfig>(API_ENDPOINTS.SAP_CONFIG),
    retry: 1,
  });
}

/**
 * Hook para testar configuracao SAP
 */
export function useTestSapConfig() {
  return useMutation<SapConfigTestResponse, Error, SapConfig>({
    mutationFn: (config: SapConfig) =>
      post<SapConfigTestResponse>(API_ENDPOINTS.SAP_CONFIG_TEST, config),
  });
}

/**
 * Hook para salvar configuracao SAP
 */
export function useSaveSapConfig() {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean }, Error, SapConfig>({
    mutationFn: (config: SapConfig) =>
      put<{ success: boolean }>(API_ENDPOINTS.SAP_CONFIG, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sap", "config"] });
      queryClient.invalidateQueries({ queryKey: ["sap", "health"] });
    },
  });
}

/**
 * Hook para sincronizacao de pedidos (orders only)
 */
export function useSyncSap() {
  const queryClient = useQueryClient();

  return useMutation<SapSyncResponse, Error, SapSyncRequest | undefined>({
    mutationFn: (request?: SapSyncRequest) =>
      post<SapSyncResponse>(API_ENDPOINTS.SAP_SYNC, request || {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sap", "sync"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

/**
 * Hook para sincronizacao COMPLETA (todas as entidades)
 */
export function useSyncAll() {
  const queryClient = useQueryClient();

  return useMutation<SyncAllResponse, Error>({
    mutationFn: () =>
      post<SyncAllResponse>(API_ENDPOINTS.SAP_SYNC_ALL, {}),
    onSuccess: () => {
      // Invalidar tudo
      queryClient.invalidateQueries({ queryKey: ["sap"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

/**
 * Hook para sincronizar apenas Produtos
 */
export function useSyncProducts() {
  const queryClient = useQueryClient();

  return useMutation<BulkSyncResult, Error>({
    mutationFn: () =>
      post<BulkSyncResult>(API_ENDPOINTS.SAP_SYNC_PRODUCTS, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["sap", "sync"] });
    },
  });
}

/**
 * Hook para sincronizar apenas Estoque
 */
export function useSyncInventory() {
  const queryClient = useQueryClient();

  return useMutation<BulkSyncResult, Error>({
    mutationFn: () =>
      post<BulkSyncResult>(API_ENDPOINTS.SAP_SYNC_INVENTORY, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["sap", "sync"] });
    },
  });
}

/**
 * Hook para sincronizar apenas Clientes
 */
export function useSyncCustomers() {
  const queryClient = useQueryClient();

  return useMutation<BulkSyncResult, Error>({
    mutationFn: () =>
      post<BulkSyncResult>(API_ENDPOINTS.SAP_SYNC_CUSTOMERS, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["sap", "sync"] });
    },
  });
}

/**
 * Hook para revogar acesso SAP
 */
export function useRevokeSapAccess() {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean; message: string }, Error>({
    mutationFn: () =>
      del<{ success: boolean; message: string }>(API_ENDPOINTS.SAP_CONFIG),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sap"] });
      queryClient.resetQueries({ queryKey: ["sap"] });
    },
  });
}

/**
 * Hook para renovar sessao SAP
 */
export function useRefreshSapSession() {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean; message: string }, Error>({
    mutationFn: () =>
      post<{ success: boolean; message: string }>(API_ENDPOINTS.SAP_SESSION_REFRESH, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sap", "health"] });
    },
  });
}

// ---- Tipos ----

export type SyncAllResponse = {
  ok: boolean;
  message: string;
  results: Record<
    string,
    { ok: boolean; imported: number; errors: number; message: string }
  >;
  timestamp: string;
};

export type BulkSyncResult = {
  ok: boolean;
  message: string;
  upserted?: number;
  created?: number;
  updated?: number;
  total_sap?: number;
  timestamp: string;
};
