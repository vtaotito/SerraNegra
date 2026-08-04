import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Notas fiscais unificadas em /pedidos?view=notas.
 * Mantém deep-links legados (search / pedido).
 */
export default async function ComercialDadosRedirect({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  params.set("view", "notas");

  for (const key of ["pedido", "search"] as const) {
    const v = first(sp[key]);
    if (v) params.set(key === "search" ? "pedido" : key, v);
  }

  redirect(`/pedidos?${params.toString()}`);
}
