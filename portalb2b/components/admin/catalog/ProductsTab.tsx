"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  ImageOff,
  Lock,
  EyeOff,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  PackageSearch,
  AlertTriangle,
  Loader2,
  X,
  Unlock,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { adminGet, adminPatch, adminPost } from "@/lib/admin/api";
import {
  buildProductsUrl,
  fetchCategories,
  seoIsComplete,
  type AdminProduct,
  type ProductsResponse,
  type SortField,
  type SortOrder,
  type VisibilityFilter,
} from "@/lib/admin/catalog";
import { cn } from "@/lib/utils";
import { categoryColor } from "@/lib/catalog";
import { ProductDrawer, type ProductPatch } from "./ProductDrawer";
import type { ProductFilterPreset } from "./types";

const PAGE_SIZE = 20;

interface ProductsTabProps {
  preset: ProductFilterPreset;
  presetNonce: number;
}

function highlight(text: string, term: string) {
  const t = term.trim();
  if (!t) return text;
  const idx = text.toLowerCase().indexOf(t.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-emerald-400/30 px-0.5 text-emerald-100">
        {text.slice(idx, idx + t.length)}
      </mark>
      {text.slice(idx + t.length)}
    </>
  );
}

export function ProductsTab({ preset, presetNonce }: ProductsTabProps) {
  const qc = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [visibility, setVisibility] = useState<VisibilityFilter>("all");
  const [locked, setLocked] = useState<"all" | "locked" | "unlocked">("all");
  const [noImage, setNoImage] = useState(false);
  const [sort, setSort] = useState<SortField>("name");
  const [order, setOrder] = useState<SortOrder>("asc");
  const [page, setPage] = useState(1);
  const [selectedSkus, setSelectedSkus] = useState<Set<string>>(new Set());
  const [openSku, setOpenSku] = useState<string | null>(null);

  // Aplica o preset vindo dos KPIs da Visão geral.
  useEffect(() => {
    setVisibility(preset === "hidden" ? "hidden" : "all");
    setLocked(preset === "locked" ? "locked" : "all");
    setNoImage(preset === "noImage");
    setPage(1);
  }, [preset, presetNonce]);

  // Debounce da busca.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filters = { search, category, visibility, locked, noImage, sort, order, page, limit: PAGE_SIZE };

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["admin-catalog-products", filters],
    queryFn: () => adminGet<ProductsResponse>(buildProductsUrl(filters)),
    placeholderData: (prev) => prev,
  });

  const categoriesQuery = useQuery({
    queryKey: ["admin-catalog-categories"],
    queryFn: fetchCategories,
  });

  const products = data?.data ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  const selected = useMemo(
    () => products.find((p) => p.sku === openSku) ?? null,
    [products, openSku],
  );

  function patchCache(updated: AdminProduct) {
    qc.setQueryData<ProductsResponse>(["admin-catalog-products", filters], (old) =>
      old ? { ...old, data: old.data.map((p) => (p.sku === updated.sku ? updated : p)) } : old,
    );
  }

  const saveMutation = useMutation({
    mutationFn: (vars: { sku: string; patch: ProductPatch }) =>
      adminPatch<{ ok: boolean; data: AdminProduct }>(
        `/b2b/admin/catalog/products/${encodeURIComponent(vars.sku)}`,
        vars.patch,
      ),
    onSuccess: (res) => {
      if (res.data) patchCache(res.data);
      toast.success("Produto atualizado.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao salvar"),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["admin-catalog-overview"] });
    },
  });

  const unlockMutation = useMutation({
    mutationFn: (sku: string) =>
      adminPost<{ ok: boolean; data: AdminProduct }>(
        `/b2b/admin/catalog/products/${encodeURIComponent(sku)}/unlock`,
      ),
    onSuccess: (res) => {
      if (res.data) patchCache(res.data);
      toast.success("Produto destravado — voltará a seguir o sync.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao destravar"),
    onSettled: () => qc.invalidateQueries({ queryKey: ["admin-catalog-overview"] }),
  });

  // Ação em massa (ocultar/exibir/destravar).
  const bulkMutation = useMutation({
    mutationFn: async (vars: { skus: string[]; action: "hide" | "show" | "unlock" }) => {
      for (const sku of vars.skus) {
        if (vars.action === "unlock") {
          await adminPost(`/b2b/admin/catalog/products/${encodeURIComponent(sku)}/unlock`);
        } else {
          await adminPatch(`/b2b/admin/catalog/products/${encodeURIComponent(sku)}`, {
            admin_hidden: vars.action === "hide",
          });
        }
      }
    },
    onSuccess: (_d, vars) => {
      toast.success(
        vars.action === "hide"
          ? `${vars.skus.length} produto(s) ocultado(s).`
          : vars.action === "show"
            ? `${vars.skus.length} produto(s) exibido(s).`
            : `${vars.skus.length} produto(s) destravado(s).`,
      );
      setSelectedSkus(new Set());
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro na ação em massa"),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["admin-catalog-products"] });
      qc.invalidateQueries({ queryKey: ["admin-catalog-overview"] });
    },
  });

  function toggleSort(field: SortField) {
    if (sort === field) setOrder((o) => (o === "asc" ? "desc" : "asc"));
    else {
      setSort(field);
      setOrder("asc");
    }
  }

  function toggleSelect(sku: string) {
    setSelectedSkus((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku);
      else next.add(sku);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedSkus((prev) =>
      prev.size === products.length ? new Set() : new Set(products.map((p) => p.sku)),
    );
  }

  const activeFiltersCount =
    (category ? 1 : 0) + (visibility !== "all" ? 1 : 0) + (locked !== "all" ? 1 : 0) + (noImage ? 1 : 0);

  function clearFilters() {
    setCategory("");
    setVisibility("all");
    setLocked("all");
    setNoImage(false);
    setSearchInput("");
    setPage(1);
  }

  const SortIcon = ({ field }: { field: SortField }) =>
    sort !== field ? (
      <ArrowUpDown className="h-3 w-3 opacity-50" />
    ) : order === "asc" ? (
      <ArrowUp className="h-3 w-3 text-emerald-400" />
    ) : (
      <ArrowDown className="h-3 w-3 text-emerald-400" />
    );

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por nome, SKU ou EAN..."
            className="border-slate-600 bg-slate-800/60 pl-9 text-slate-100 placeholder:text-slate-500"
          />
          {isFetching && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-500" />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-md border border-slate-600 bg-slate-800/60 px-2 text-sm text-slate-100"
          >
            <option value="">Todas as categorias</option>
            {(categoriesQuery.data?.data ?? []).map((c) => (
              <option key={c.category_name} value={c.category_name}>
                {c.category_name} ({c.product_count})
              </option>
            ))}
          </select>

          <FilterChip active={noImage} onClick={() => { setNoImage((v) => !v); setPage(1); }}>
            <ImageOff className="h-3.5 w-3.5" /> Sem imagem
          </FilterChip>
          <FilterChip
            active={visibility === "hidden"}
            onClick={() => { setVisibility((v) => (v === "hidden" ? "all" : "hidden")); setPage(1); }}
          >
            <EyeOff className="h-3.5 w-3.5" /> Ocultos
          </FilterChip>
          <FilterChip
            active={locked === "locked"}
            onClick={() => { setLocked((v) => (v === "locked" ? "all" : "locked")); setPage(1); }}
          >
            <Lock className="h-3.5 w-3.5" /> Travados
          </FilterChip>

          {activeFiltersCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-9 gap-1 text-slate-400 hover:text-white"
            >
              <X className="h-3.5 w-3.5" /> Limpar
            </Button>
          )}
        </div>
      </div>

      {/* Barra de ações em massa */}
      {selectedSkus.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
          <span className="text-sm text-emerald-200">{selectedSkus.size} selecionado(s)</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={bulkMutation.isPending}
              onClick={() => bulkMutation.mutate({ skus: [...selectedSkus], action: "hide" })}
              className="h-8 gap-1 text-slate-200 hover:bg-slate-800"
            >
              <EyeOff className="h-3.5 w-3.5" /> Ocultar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={bulkMutation.isPending}
              onClick={() => bulkMutation.mutate({ skus: [...selectedSkus], action: "show" })}
              className="h-8 gap-1 text-slate-200 hover:bg-slate-800"
            >
              <Eye className="h-3.5 w-3.5" /> Exibir
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={bulkMutation.isPending}
              onClick={() => bulkMutation.mutate({ skus: [...selectedSkus], action: "unlock" })}
              className="h-8 gap-1 text-slate-200 hover:bg-slate-800"
            >
              <Unlock className="h-3.5 w-3.5" /> Destravar
            </Button>
            {bulkMutation.isPending && <Loader2 className="h-4 w-4 animate-spin text-emerald-300" />}
          </div>
        </div>
      )}

      {/* Conteúdo */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg bg-slate-800" />
          ))}
        </div>
      ) : isError || !data?.ok ? (
        <EmptyState
          icon={AlertTriangle}
          title="Erro ao carregar produtos"
          description="Não foi possível buscar os produtos do catálogo."
          action={
            <Button onClick={() => refetch()} className="bg-emerald-600 text-white hover:bg-emerald-700">
              Tentar novamente
            </Button>
          }
        />
      ) : products.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="Nenhum produto encontrado"
          description="Ajuste a busca ou os filtros para ver mais resultados."
          action={
            activeFiltersCount > 0 || search ? (
              <Button onClick={clearFilters} variant="outline" className="border-slate-600 text-slate-200">
                Limpar filtros
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Desktop: tabela */}
          <div className="hidden rounded-xl border border-slate-700 bg-slate-800/30 md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      aria-label="Selecionar todos"
                      checked={products.length > 0 && selectedSkus.size === products.length}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-slate-500 bg-slate-800 accent-emerald-500"
                    />
                  </TableHead>
                  <TableHead className="w-14">Foto</TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("name")} className="flex items-center gap-1">
                      Produto <SortIcon field="name" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("category")} className="flex items-center gap-1">
                      Categoria <SortIcon field="category" />
                    </button>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow
                    key={p.sku}
                    data-state={selectedSkus.has(p.sku) ? "selected" : undefined}
                    className="cursor-pointer"
                    onClick={() => setOpenSku(p.sku)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Selecionar ${p.name}`}
                        checked={selectedSkus.has(p.sku)}
                        onChange={() => toggleSelect(p.sku)}
                        className="h-4 w-4 rounded border-slate-500 bg-slate-800 accent-emerald-500"
                      />
                    </TableCell>
                    <TableCell>
                      <ProductThumb product={p} />
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-slate-100">{highlight(p.name, search)}</p>
                      <p className="text-xs text-slate-500">{p.sku}</p>
                    </TableCell>
                    <TableCell>
                      {p.category ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-slate-300">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: categoryColor(p.category) }}
                          />
                          {p.category}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusChips product={p} />
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()} className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Switch
                          checked={!p.adminHidden}
                          disabled={saveMutation.isPending}
                          onCheckedChange={(v) =>
                            saveMutation.mutate({ sku: p.sku, patch: { admin_hidden: !v } })
                          }
                          aria-label="Alternar visibilidade"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setOpenSku(p.sku)}
                          className="h-8 text-slate-300 hover:bg-slate-700 hover:text-white"
                        >
                          Editar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile: cards */}
          <div className="space-y-2 md:hidden">
            {products.map((p) => (
              <button
                key={p.sku}
                onClick={() => setOpenSku(p.sku)}
                className="flex w-full items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-left"
              >
                <ProductThumb product={p} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-100">{highlight(p.name, search)}</p>
                  <p className="text-xs text-slate-500">{p.sku}{p.category ? ` · ${p.category}` : ""}</p>
                  <div className="mt-1"><StatusChips product={p} /></div>
                </div>
              </button>
            ))}
          </div>

          {/* Paginação */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-slate-400">
              {total.toLocaleString("pt-BR")} produto(s) · página {page} de {pages}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="border-slate-600 text-slate-200 disabled:opacity-40"
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= pages}
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                className="border-slate-600 text-slate-200 disabled:opacity-40"
              >
                Próxima
              </Button>
            </div>
          </div>
        </>
      )}

      {selected && (
        <ProductDrawer
          product={selected}
          open={!!openSku}
          saving={saveMutation.isPending}
          unlocking={unlockMutation.isPending}
          onClose={() => setOpenSku(null)}
          onSave={async (patch) => {
            await saveMutation.mutateAsync({ sku: selected.sku, patch });
          }}
          onUnlock={() => unlockMutation.mutate(selected.sku)}
          onImageUploaded={(updated) => {
            patchCache(updated);
            qc.invalidateQueries({ queryKey: ["admin-catalog-overview"] });
          }}
        />
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors",
        active
          ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-200"
          : "border-slate-600 bg-slate-800/60 text-slate-300 hover:border-slate-500",
      )}
    >
      {children}
    </button>
  );
}

function ProductThumb({ product }: { product: AdminProduct }) {
  const src = product.imageThumbUrl ?? product.imageUrl;
  return (
    <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-md border border-slate-700 bg-slate-900">
      {src ? (
        <Image src={src} alt={product.name} fill unoptimized className="object-contain" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-slate-600">
          <ImageOff className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}

function StatusChips({ product }: { product: AdminProduct }) {
  return (
    <div className="flex flex-wrap gap-1">
      {product.adminHidden && (
        <Badge variant="destructive" className="gap-1 text-[10px]">
          <EyeOff className="h-2.5 w-2.5" /> Oculto
        </Badge>
      )}
      {product.contentLocked && (
        <Badge variant="warning" className="gap-1 text-[10px]">
          <Lock className="h-2.5 w-2.5" /> Travado
        </Badge>
      )}
      {!product.imageUrl && (
        <Badge variant="secondary" className="text-[10px]">Sem imagem</Badge>
      )}
      {!seoIsComplete(product) && (
        <Badge variant="outline" className="border-slate-600 text-[10px] text-slate-400">
          SEO incompleto
        </Badge>
      )}
      {!product.adminHidden && product.imageUrl && product.contentLocked === false && seoIsComplete(product) && (
        <Badge variant="success" className="text-[10px]">OK</Badge>
      )}
    </div>
  );
}
