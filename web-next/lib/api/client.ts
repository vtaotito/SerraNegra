import axios, { AxiosError, AxiosRequestConfig } from "axios";

// Base URL da API
// Desenvolvimento: http://localhost:8000 (Core direto)
// Produção: /api (path relativo via Nginx → Gateway)
const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api";
const timeout = parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT || "30000", 10);

// Criar instância do axios
export const apiClient = axios.create({
  baseURL,
  timeout,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor para adicionar headers de autenticação (desenvolvimento)
apiClient.interceptors.request.use((config) => {
  // Auth headers (desenvolvimento)
  config.headers["X-User-Id"] = process.env.NEXT_PUBLIC_DEV_USER_ID || "dev-user";
  config.headers["X-User-Role"] = process.env.NEXT_PUBLIC_DEV_USER_ROLE || "SUPERVISOR";
  config.headers["X-User-Name"] = process.env.NEXT_PUBLIC_DEV_USER_NAME || "Usuário Dev";

  return config;
});

// Interceptor para tratamento de erros
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<any>) => {
    // Log do erro (desenvolvimento)
    if (process.env.NODE_ENV === "development") {
      console.error("API Error:", error.response?.data || error.message);
    }

    // Extrair mensagem de erro
    let errorMessage = "Erro desconhecido";
    
    if (error.response?.data) {
      const data = error.response.data;
      // Se data é string, usar diretamente
      if (typeof data === "string") {
        errorMessage = data;
      }
      // Se data é objeto com message, error, ou details
      else if (typeof data === "object") {
        errorMessage = data.message || data.error || data.details || data.detail || errorMessage;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }

    // Retornar erro formatado sempre como string
    return Promise.reject(new Error(errorMessage));
  }
);

/**
 * Wrapper genérico para GET
 */
export async function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await apiClient.get<T>(url, config);
  return response.data;
}

/**
 * Wrapper genérico para POST
 */
export async function post<T>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig
): Promise<T> {
  const response = await apiClient.post<T>(url, data, config);
  return response.data;
}

/**
 * Wrapper genérico para PUT
 */
export async function put<T>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig
): Promise<T> {
  const response = await apiClient.put<T>(url, data, config);
  return response.data;
}

/**
 * Wrapper genérico para DELETE
 */
export async function del<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await apiClient.delete<T>(url, config);
  return response.data;
}
