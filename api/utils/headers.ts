import { HttpHeaders } from "../http.js";

export const getHeaderValue = (headers: HttpHeaders, name: string): string | undefined => {
  const normalized = name.toLowerCase();
  return Object.entries(headers).find(([key]) => key.toLowerCase() === normalized)?.[1];
};
