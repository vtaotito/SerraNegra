"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, FolderTree, AlertTriangle, Eye, EyeOff, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { adminPatch } from "@/lib/admin/api";
import { fetchCategories, type AdminCategory } from "@/lib/admin/catalog";
import { categoryColor } from "@/lib/catalog";
import { CategoryDrawer, type CategorySeoPatch } from "./CategoryDrawer";

function categorySeoComplete(c: AdminCategory): boolean {
  return !!(c.seo_title && c.seo_title.trim() && c.seo_description && c.seo_description.trim());
}

export function CategoriesTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-catalog-categories"],
    queryFn: fetchCategories,
  });

  const mutation = useMutation({
    mutationFn: (vars: { category_name: string; is_visible: boolean }) =>
      adminPatch("/b2b/admin/catalog/categories", vars),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["admin-catalog-categories"] });
      const prev = qc.getQueryData<{ ok: boolean; data: AdminCategory[] }>([
        "admin-catalog-categories",
      ]);
      qc.setQueryData<{ ok: boolean; data: AdminCategory[] }>(
        ["admin-catalog-categories"],
        (old) =>
          old
            ? {
                ...old,
                data: old.data.map((c) =>
                  c.category_name === vars.category_name
                    ? { ...c, is_visible: vars.is_visible }
                    : c,
                ),
              }
            : old,
      );
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["admin-catalog-categories"], ctx.prev);
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar categoria");
    },
    onSuccess: (_d, vars) => {
      toast.success(
        vars.is_visible
          ? `Categoria "${vars.category_name}" exibida no catálogo.`
          : `Categoria "${vars.category_name}" ocultada do catálogo.`,
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["admin-catalog-categories"] });
      qc.invalidateQueries({ queryKey: ["admin-catalog-overview"] });
    },
  });

  const seoMutation = useMutation({
    mutationFn: (patch: CategorySeoPatch) => adminPatch("/b2b/admin/catalog/categories", patch),
    onSuccess: () => {
      toast.success("SEO da categoria salvo.");
      setOpenCategory(null);
      qc.invalidateQueries({ queryKey: ["admin-catalog-categories"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao salvar SEO"),
  });

  const categories = data?.data ?? [];
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return categories;
    return categories.filter((c) => c.category_name.toLowerCase().includes(term));
  }, [categories, search]);

  const hiddenCount = categories.filter((c) => !c.is_visible).length;
  const selectedCategory = useMemo(
    () => categories.find((c) => c.category_name === openCategory) ?? null,
    [categories, openCategory],
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg bg-slate-800" />
        ))}
      </div>
    );
  }

  if (isError || !data?.ok) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Erro ao carregar categorias"
        action={
          <Button onClick={() => refetch()} className="bg-emerald-600 text-white hover:bg-emerald-700">
            Tentar novamente
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar categoria..."
            className="border-slate-600 bg-slate-800/60 pl-9 text-slate-100 placeholder:text-slate-500"
          />
        </div>
        <p className="text-xs text-slate-400">
          {categories.length} categorias · {hiddenCount} ocultas
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title="Nenhuma categoria encontrada"
          description="Ajuste a busca ou sincronize o catálogo."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((cat) => (
            <div
              key={cat.category_name}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-800/50 p-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="h-3 w-3 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: categoryColor(cat.category_name) }}
                />
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">{cat.category_name}</p>
                  <p className="text-xs text-slate-500">
                    {cat.product_count} produto(s)
                    {cat.updated_by ? ` · ajustado por ${cat.updated_by}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
                {categorySeoComplete(cat) ? (
                  <Badge variant="success" className="hidden gap-1 sm:inline-flex">
                    <Check className="h-3 w-3" /> SEO
                  </Badge>
                ) : (
                  <Badge variant="outline" className="hidden border-slate-600 text-slate-400 sm:inline-flex">
                    SEO pendente
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setOpenCategory(cat.category_name)}
                  className="h-8 gap-1 text-violet-300 hover:bg-violet-500/10 hover:text-violet-200"
                >
                  <Sparkles className="h-3.5 w-3.5" /> SEO
                </Button>
                <Badge variant={cat.is_visible ? "success" : "destructive"} className="gap-1">
                  {cat.is_visible ? (
                    <>
                      <Eye className="h-3 w-3" /> Visível
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-3 w-3" /> Oculta
                    </>
                  )}
                </Badge>
                <Switch
                  checked={cat.is_visible}
                  disabled={mutation.isPending}
                  onCheckedChange={(v) =>
                    mutation.mutate({ category_name: cat.category_name, is_visible: v })
                  }
                  aria-label={`Alternar visibilidade da categoria ${cat.category_name}`}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedCategory && (
        <CategoryDrawer
          category={selectedCategory}
          open={!!openCategory}
          saving={seoMutation.isPending}
          onClose={() => setOpenCategory(null)}
          onSave={async (patch) => {
            await seoMutation.mutateAsync(patch);
          }}
        />
      )}
    </div>
  );
}
