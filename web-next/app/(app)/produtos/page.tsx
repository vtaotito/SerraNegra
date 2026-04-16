"use client";

import Link from "next/link";
import { useProducts } from "@/features/products/hooks/useProducts";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, RefreshCw, Database } from "lucide-react";

export default function ProdutosPage() {
  const { data, isLoading, error } = useProducts({ limit: 50 });

  const hasProducts = data?.data && data.data.length > 0;

  return (
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

        {!isLoading && !error && !hasProducts && (
          <div className="p-8 text-center">
            <Database className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Catálogo de produtos vazio
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
              O catálogo de produtos será populado automaticamente quando a
              sincronização completa com o SAP B1 estiver ativa. Os itens do
              SAP serão importados para cá.
            </p>
            <div className="flex gap-3 justify-center">
              <Link href="/integracao">
                <Button variant="outline" className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Ir para Integração
                </Button>
              </Link>
            </div>
            <div className="mt-8 rounded-lg bg-muted/50 border p-4 max-w-sm mx-auto text-left">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                Próximos passos
              </h4>
              <ol className="text-xs text-muted-foreground space-y-1.5">
                <li className="flex gap-2">
                  <Badge variant="outline" className="text-[10px] px-1.5 h-4">1</Badge>
                  Configure a integração SAP B1
                </li>
                <li className="flex gap-2">
                  <Badge variant="outline" className="text-[10px] px-1.5 h-4">2</Badge>
                  Teste a conexão com o SAP
                </li>
                <li className="flex gap-2">
                  <Badge variant="outline" className="text-[10px] px-1.5 h-4">3</Badge>
                  Sincronize dados (pedidos incluem itens)
                </li>
                <li className="flex gap-2">
                  <Badge variant="outline" className="text-[10px] px-1.5 h-4">4</Badge>
                  Produtos aparecerão automaticamente
                </li>
              </ol>
            </div>
          </div>
        )}

        {!isLoading && !error && hasProducts && (
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
                {data!.data.map((product) => (
                  <tr key={product.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 text-sm font-medium">{product.sku}</td>
                    <td className="px-4 py-3 text-sm">{product.description}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{product.ean || "—"}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{product.category || "—"}</td>
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
  );
}
