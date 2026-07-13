import axios from "axios";

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api";

export const adminApi = axios.create({
  baseURL,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

adminApi.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("b2b_admin_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("b2b_admin_token");
      localStorage.removeItem("b2b_admin_user");
      window.location.href = "/b2b/admin/login";
    }
    const data = error.response?.data;
    const message =
      typeof data === "string"
        ? data
        : data?.message ?? data?.error ?? error.message ?? "Erro desconhecido";
    return Promise.reject(new Error(message));
  },
);

export async function adminGet<T>(url: string): Promise<T> {
  const res = await adminApi.get<T>(url);
  return res.data;
}

export async function adminPost<T>(url: string, data?: unknown): Promise<T> {
  const res = await adminApi.post<T>(url, data);
  return res.data;
}

export async function adminPatch<T>(url: string, data?: unknown): Promise<T> {
  const res = await adminApi.patch<T>(url, data);
  return res.data;
}

export async function adminPut<T>(url: string, data?: unknown): Promise<T> {
  const res = await adminApi.put<T>(url, data);
  return res.data;
}

export async function adminDelete<T>(url: string): Promise<T> {
  const res = await adminApi.delete<T>(url);
  return res.data;
}

/**
 * Upload multipart com o Bearer do admin, expondo o progresso (0–100) via
 * callback. Usado no upload de imagem de produto (drag-and-drop com barra).
 */
export async function adminUpload<T>(
  url: string,
  file: File,
  onProgress?: (percent: number) => void,
  fieldName = "file",
): Promise<T> {
  const form = new FormData();
  form.append(fieldName, file);
  const res = await adminApi.post<T>(url, form, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (evt) => {
      if (!onProgress) return;
      const total = evt.total ?? file.size;
      if (total > 0) onProgress(Math.min(100, Math.round((evt.loaded / total) * 100)));
    },
  });
  return res.data;
}
