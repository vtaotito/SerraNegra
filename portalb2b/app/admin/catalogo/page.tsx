"use client";

import { useState } from "react";
import { LayoutDashboard, Package, FolderTree, RefreshCw, Search } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { adminPost } from "@/lib/admin/api";
import { OverviewTab } from "@/components/admin/catalog/OverviewTab";
import { ProductsTab } from "@/components/admin/catalog/ProductsTab";
import { CategoriesTab } from "@/components/admin/catalog/CategoriesTab";
import { SeoTab } from "@/components/admin/catalog/SeoTab";
import type { ProductFilterPreset } from "@/components/admin/catalog/types";

type TabValue = "overview" | "products" | "categories" | "seo";

export default function CatalogAdminPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabValue>("overview");
  const [preset, setPreset] = useState<ProductFilterPreset>("all");
  // Força a aba Produtos a reaplicar o preset mesmo se já estiver aberta.
  const [presetNonce, setPresetNonce] = useState(0);

  const syncMutation = useMutation({
    mutationFn: () => adminPost("/b2b/admin/sync/catalog"),
    onSuccess: () => {
      toast.success("Sincronização concluída.");
      qc.invalidateQueries({ queryKey: ["admin-catalog-overview"] });
      qc.invalidateQueries({ queryKey: ["admin-catalog-products"] });
      qc.invalidateQueries({ queryKey: ["admin-catalog-categories"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao sincronizar"),
  });

  function handleNavigate(target: { tab: "products" | "categories"; preset?: ProductFilterPreset }) {
    if (target.tab === "products") {
      setPreset(target.preset ?? "all");
      setPresetNonce((n) => n + 1);
    }
    setTab(target.tab);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-400">
            Controle a visibilidade por categoria, edite produtos, imagens e SEO.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="border-slate-600 text-slate-200 hover:bg-slate-800"
        >
          <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
          Sincronizar catálogo
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
        <TabsList>
          <TabsTrigger value="overview">
            <LayoutDashboard className="h-4 w-4" /> Visão geral
          </TabsTrigger>
          <TabsTrigger value="products">
            <Package className="h-4 w-4" /> Produtos
          </TabsTrigger>
          <TabsTrigger value="categories">
            <FolderTree className="h-4 w-4" /> Categorias
          </TabsTrigger>
          <TabsTrigger value="seo">
            <Search className="h-4 w-4" /> SEO
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab onNavigate={handleNavigate} />
        </TabsContent>
        <TabsContent value="products">
          <ProductsTab preset={preset} presetNonce={presetNonce} />
        </TabsContent>
        <TabsContent value="categories">
          <CategoriesTab />
        </TabsContent>
        <TabsContent value="seo">
          <SeoTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
