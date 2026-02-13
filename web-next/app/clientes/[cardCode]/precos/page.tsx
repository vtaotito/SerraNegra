"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ArrowLeft, DollarSign, Search, Trash2 } from "lucide-react";
import { useProducts } from "@/features/products/hooks/useProducts";
import {
  useCustomerPricing,
  useDeactivateCustomerPricing,
  useUpsertCustomerPricing,
} from "@/features/customers/hooks/useCustomerPricing";

export default function ClientePrecosPage() {
  const params = useParams<{ cardCode: string }>();
  const cardCode = decodeURIComponent(params.cardCode);

  const [sku, setSku] = useState("");
  const [price, setPrice] = useState<string>("0");
  const [currency, setCurrency] = useState("BRL");
  const [search, setSearch] = useState("");

  const pricingQuery = useCustomerPricing(cardCode, { limit: 100, offset: 0 });
  const upsert = useUpsertCustomerPricing(cardCode);
  const deactivate = useDeactivateCustomerPricing(cardCode);

  const productsQuery = useProducts(
    useMemo(
      () => ({
        search: search.trim() ? search.trim() : undefined,
        limit: 10,
      }),
      [search]
    )
  );

  const pricingItems = pricingQuery.data?.data || [];
  const suggestions = productsQuery.data?.data || [];

  async function onSave() {
    const normalizedSku = sku.trim();
    const numericPrice = Number(price);

    if (!normalizedSku) return;
    if (Number.isNaN(numericPrice) || numericPrice < 0) return;

    await upsert.mutateAsync({
      sku: normalizedSku,
      payload: { price: numericPrice, currency, is_active: true },
    });
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Link href="/clientes">
                <Button variant="outline" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </Button>
              </Link>
              <h1 className="text-3xl font-bold tracking-tight">
                Preços por Cliente
              </h1>
            </div>
            <p className="text-muted-foreground mt-2">
              Cliente: <span className="font-medium">{cardCode}</span>
            </p>
          </div>
        </div>

        <Card className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">
                SKU
              </label>
              <Input
                placeholder="Ex: 1000001"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Preço
              </label>
              <Input
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Moeda
              </label>
              <Input
                placeholder="BRL"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Button
              onClick={onSave}
              disabled={upsert.isPending || !sku.trim()}
              className="gap-2"
            >
              <DollarSign className="h-4 w-4" />
              Salvar preço
            </Button>

            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar produto para preencher SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {search.trim() && (
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                Sugestões
              </div>
              {productsQuery.isLoading && (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              )}
              {!productsQuery.isLoading && suggestions.length === 0 && (
                <div className="text-sm text-muted-foreground">
                  Nenhum produto encontrado.
                </div>
              )}
              {!productsQuery.isLoading && suggestions.length > 0 && (
                <ul className="space-y-1">
                  {suggestions.map((p) => (
                    <li key={p.sku}>
                      <button
                        type="button"
                        onClick={() => {
                          setSku(p.sku);
                          setSearch("");
                        }}
                        className="w-full text-left rounded-md px-2 py-2 hover:bg-muted transition-colors"
                      >
                        <div className="text-sm font-medium">{p.sku}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {p.description}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Card>

        <Card>
          {pricingQuery.isLoading && (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          )}

          {pricingQuery.error && (
            <div className="p-6">
              <EmptyState
                icon={DollarSign}
                title="Erro ao carregar preços"
                description="Não foi possível carregar os preços do cliente."
              />
            </div>
          )}

          {!pricingQuery.isLoading && !pricingQuery.error && pricingItems.length === 0 && (
            <div className="p-8">
              <EmptyState
                icon={DollarSign}
                title="Nenhum preço configurado"
                description="Adicione um SKU e defina um preço para este cliente."
              />
            </div>
          )}

          {!pricingQuery.isLoading && !pricingQuery.error && pricingItems.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase">
                      SKU
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase">
                      Descrição
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase">
                      Preço
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pricingItems.map((it) => (
                    <tr key={`${it.customer_card_code}-${it.sku}`} className="hover:bg-muted/50">
                      <td className="px-4 py-3 text-sm font-medium">{it.sku}</td>
                      <td className="px-4 py-3 text-sm">{it.description || "—"}</td>
                      <td className="px-4 py-3 text-sm">
                        {it.currency} {it.price.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Badge variant={it.is_active ? "default" : "outline"}>
                          {it.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          disabled={deactivate.isPending || !it.is_active}
                          onClick={() => deactivate.mutate({ sku: it.sku })}
                        >
                          <Trash2 className="h-4 w-4" />
                          Desativar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}

