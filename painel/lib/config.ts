export const WMS_BASE_URL =
  process.env.NEXT_PUBLIC_WMS_BASE_URL || "http://31.97.174.120:8080";

// Portal B2B oficial (servido pelo nginx em /b2b). O portal interno legado em
// `painel/app/portal/*` foi descontinuado em favor deste.
export const B2B_PORTAL_URL =
  process.env.NEXT_PUBLIC_B2B_PORTAL_URL || "/b2b";
