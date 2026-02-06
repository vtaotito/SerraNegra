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
 * Hook para buscar status de saúde do SAP
 */
export function useSapHealth() {
  return useQuery<SapHealthResponse>({
    queryKey: ["sap", "health"],
    queryFn: () => get<SapHealthResponse>(API_ENDPOINTS.SAP_HEALTH),
    refetchInterval: 30000, // Atualizar a cada 30s
    retry: 1,
  });
}

/**
 * Hook para buscar status de sincronização
 */
export function useSapSyncStatus() {
  return useQuery<SapSyncStatus>({
    queryKey: ["sap", "sync", "status"],
    queryFn: () => get<SapSyncStatus>(API_ENDPOINTS.SAP_SYNC_STATUS),
    refetchInterval: 10000, // Atualizar a cada 10s
    retry: 1,
  });
}

/**
 * Hook para buscar configuração atual do SAP
 */
export function useSapConfig() {
  return useQuery<SapConfig>({
    queryKey: ["sap", "config"],
    queryFn: () => get<SapConfig>(API_ENDPOINTS.SAP_CONFIG),
    retry: 1,
  });
}

/**
 * Hook para testar configuração SAP
 */
export function useTestSapConfig() {
  return useMutation<SapConfigTestResponse, Error, SapConfig>({
    mutationFn: (config: SapConfig) =>
      post<SapConfigTestResponse>(API_ENDPOINTS.SAP_CONFIG_TEST, config),
  });
}

/**
 * Hook para salvar configuração SAP
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
 * Hook para disparar sincronização manual
 */
export function useSyncSap() {
  const queryClient = useQueryClient();

  return useMutation<SapSyncResponse, Error, SapSyncRequest | undefined>({
    mutationFn: (request?: SapSyncRequest) =>
      post<SapSyncResponse>(API_ENDPOINTS.SAP_SYNC, request || {}),
    onSuccess: () => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ["sap", "sync"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
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
      // Invalidar todas as queries SAP
      queryClient.invalidateQueries({ queryKey: ["sap"] });
      queryClient.resetQueries({ queryKey: ["sap"] });
    },
  });
}

/**
 * Hook para renovar sessão SAP
 */
export function useRefreshSapSession() {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean; message: string }, Error>({
    mutationFn: () =>
      post<{ success: boolean; message: string }>("/sap/session/refresh", {}),
    onSuccess: () => {
      // Atualizar health após refresh
      queryClient.invalidateQueries({ queryKey: ["sap", "health"] });
    },
  });
}
