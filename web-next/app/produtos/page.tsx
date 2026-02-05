"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { useProducts } from "@/features/products/hooks/useProducts";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package } from "lucide-react";

export default function ProdutosPage() {
  const { data, isLoading, error } = useProducts({ limit: 50 });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Produtos</h1>
          <p className="text-muted-foreground">Catálogo de produtos e itens</p>
        </div>

        <Card>
          {isLoading && (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}

          {error && (
            <div className="p-6">
              <EmptyState
                icon={Package}
                title="Erro ao carregar produtos"
                description="Não foi possível carregar os produtos."
              />
            </div>
          )}

          {!isLoading && !error && (!data?.data || data.data.length === 0) && (
            <div className="p-6">
              <EmptyState
                icon={Package}
                title="Nenhum produto encontrado"
                description="Não há produtos cadastrados no sistema."
              />
            </div>
          )}

          {!isLoading && !error && data?.data && data.data.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase">SKU</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase">Descrição</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase">EAN</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase">Categoria</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase">UM</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.data.map((product) => (
                    <tr key={product.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 text-sm font-medium">{product.sku}</td>
                      <td className="px-4 py-3 text-sm">{product.description}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {product.ean || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {product.category || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm">{product.unit_of_measure}</td>
                      <td className="px-4 py-3 text-sm">
                        <Badge variant={product.is_active ? "default" : "outline"}>
                          {product.is_active ? "Ativo" : "Inativo"}
                        </Badge>
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
