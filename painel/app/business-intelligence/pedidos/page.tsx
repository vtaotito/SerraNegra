import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Pedidos unificados em /pedidos (abas Operação + Análise).
 * Mantém deep-links legados do BI (cardCode, clientName, search).
 */
export default async function PedidosBIRedirect({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  params.set("view", "analise");

  for (const key of ["cardCode", "clientName", "search"] as const) {
    const v = first(sp[key]);
    if (v) params.set(key, v);
  }

  redirect(`/pedidos?${params.toString()}`);
}
