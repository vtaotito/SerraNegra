"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Users, Search, Settings2 } from "lucide-react";
import { useCustomers } from "@/features/customers/hooks/useCustomers";

export default function ClientesPage() {
  const [search, setSearch] = useState("");

  const params = useMemo(
    () => ({
      search: search.trim() ? search.trim() : undefined,
      limit: 50,
      offset: 0,
    }),
    [search]
  );

  const { data, isLoading, error } = useCustomers(params);
  const customers = data?.data || [];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">
            Lista de clientes (Business Partners) sincronizados do SAP B1
          </p>
        </div>

        <Card className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por código ou nome..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              {data?.total !== undefined ? `${data.total} clientes` : " "}
            </div>
          </div>
        </Card>

        <Card>
          {isLoading && (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          )}

          {error && (
            <div className="p-6">
              <EmptyState
                icon={Users}
                title="Erro ao carregar clientes"
                description="Não foi possível carregar os clientes."
              />
            </div>
          )}

          {!isLoading && !error && customers.length === 0 && (
            <div className="p-8">
              <EmptyState
                icon={Users}
                title="Nenhum cliente encontrado"
                description="Sincronize os clientes do SAP para aparecerem aqui."
              />
            </div>
          )}

          {!isLoading && !error && customers.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase">
                      CardCode
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase">
                      Nome
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase">
                      Localidade
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
                  {customers.map((c) => (
                    <tr key={c.card_code} className="hover:bg-muted/50">
                      <td className="px-4 py-3 text-sm font-medium">
                        {c.card_code}
                      </td>
                      <td className="px-4 py-3 text-sm">{c.card_name}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {c.city || "—"}
                        {c.state ? `/${c.state}` : ""}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Badge variant={c.is_active ? "default" : "outline"}>
                          {c.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <Link href={`/clientes/${encodeURIComponent(c.card_code)}/precos`}>
                          <Button size="sm" variant="outline" className="gap-2">
                            <Settings2 className="h-4 w-4" />
                            Preços
                          </Button>
                        </Link>
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

