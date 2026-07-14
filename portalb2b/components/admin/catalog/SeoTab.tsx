"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  ImageOff,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ExternalLink,
  Gauge,
  Globe,
  MousePointerClick,
  Eye,
  TrendingUp,
  Sparkles,
  Info,
  ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { fetchCategories, type AdminProduct } from "@/lib/admin/catalog";
import {
  fetchSeoDashboard,
  refreshSeoMetrics,
  gradeColor,
  scoreColor,
  formatCtr,
  formatPosition,
  type SeoDashboard,
  type SeoDashboardProduct,
  type SeoGrade,
} from "@/lib/admin/seo";
import { cn } from "@/lib/utils";
import { categoryColor } from "@/lib/catalog";
import { ProductDrawer, type ProductPatch } from "./ProductDrawer";
import { SeoProductDrawer } from "./SeoProductDrawer";

type SortField = "score" | "position" | "clicks" | "impressions";

const GRADES: SeoGrade[] = ["A", "B", "C", "D", "E"];

export function SeoTab() {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [category, setCategory] = useState("");
  const [gradeFilter, setGradeFilter] = useState<SeoGrade | "">("");
  const [onlyNoPublicUrl, setOnlyNoPublicUrl] = useState(false);
  const [sort, setSort] = useState<SortField>("score");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [detailSku, setDetailSku] = useState<string | null>(null);
  const [editSku, setEditSku] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-seo-dashboard", category],
    queryFn: () => fetchSeoDashboard(category || undefined),
  });

  const categoriesQuery = useQuery({
    queryKey: ["admin-catalog-categories"],
    queryFn: fetchCategories,
  });

  const dash: SeoDashboard | undefined = data?.data;

  const refreshMutation = useMutation({
    mutationFn: refreshSeoMetrics,
    onSuccess: () => {
      toast.success("Métricas do Search Console atualizadas.");
      qc.invalidateQueries({ queryKey: ["admin-seo-dashboard"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao atualizar métricas"),
  });

  // Produto para edição completa (reutiliza o ProductDrawer).
  const editProductQuery = useQuery({
    queryKey: ["admin-catalog-product", editSku],
    queryFn: () =>
      adminGet<{ ok: boolean; data: AdminProduct }>(
        `/b2b/admin/catalog/products/${encodeURIComponent(editSku as string)}`,
      ),
    enabled: !!editSku,
  });

  const detailProductQuery = useQuery({
    queryKey: ["admin-catalog-product", detailSku],
    queryFn: () =>
      adminGet<{ ok: boolean; data: AdminProduct }>(
        `/b2b/admin/catalog/products/${encodeURIComponent(detailSku as string)}`,
      ),
    enabled: !!detailSku,
  });

  const saveMutation = useMutation({
    mutationFn: (vars: { sku: string; patch: ProductPatch }) =>
      adminPatch<{ ok: boolean; data: AdminProduct }>(
        `/b2b/admin/catalog/products/${encodeURIComponent(vars.sku)}`,
        vars.patch,
      ),
    onSuccess: () => {
      toast.success("Produto atualizado.");
      qc.invalidateQueries({ queryKey: ["admin-catalog-product"] });
      qc.invalidateQueries({ queryKey: ["admin-seo-dashboard"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao salvar"),
  });

  const unlockMutation = useMutation({
    mutationFn: (sku: string) =>
      adminPost<{ ok: boolean; data: AdminProduct }>(
        `/b2b/admin/catalog/products/${encodeURIComponent(sku)}/unlock`,
      ),
    onSuccess: () => {
      toast.success("Produto destravado.");
      qc.invalidateQueries({ queryKey: ["admin-catalog-product"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao destravar"),
  });

  const rows = useMemo(() => {
    if (!dash) return [];
    let out = [...dash.products];
    const term = searchInput.trim().toLowerCase();
    if (term) {
      out = out.filter(
        (p) => p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term),
      );
    }
    if (gradeFilter) out = out.filter((p) => p.grade === gradeFilter);
    if (onlyNoPublicUrl) out = out.filter((p) => !p.hasPublicUrl);
    out.sort((a, b) => {
      const dir = order === "asc" ? 1 : -1;
      const av = a[sort] ?? (sort === "position" ? 9999 : 0);
      const bv = b[sort] ?? (sort === "position" ? 9999 : 0);
      return (Number(av) - Number(bv)) * dir;
    });
    return out;
  }, [dash, searchInput, gradeFilter, onlyNoPublicUrl, sort, order]);

  function toggleSort(field: SortField) {
    if (sort === field) setOrder((o) => (o === "asc" ? "desc" : "asc"));
    else {
      setSort(field);
      setOrder(field === "position" || field === "score" ? "asc" : "desc");
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl bg-slate-800" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl bg-slate-800" />
      </div>
    );
  }

  if (isError || !dash) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Erro ao carregar o painel de SEO"
        action={
          <Button onClick={() => refetch()} className="bg-emerald-600 text-white hover:bg-emerald-700">
            Tentar novamente
          </Button>
        }
      />
    );
  }

  const s = dash.summary;

  return (
    <div className="space-y-5">
      {/* Banners de configuração */}
      {(!dash.config.openaiConfigured || !dash.config.gscConfigured) && (
        <div className="space-y-2">
          {!dash.config.openaiConfigured && (
            <ConfigBanner
              icon={Sparkles}
              title="IA de SEO não configurada"
              text="Defina OPENAI_API_KEY (e opcionalmente OPENAI_MODEL) no gateway para habilitar a geração de conteúdo por IA."
            />
          )}
          {!dash.config.gscConfigured && (
            <ConfigBanner
              icon={Globe}
              title="Google Search Console não configurado"
              text="Defina GSC_SITE_URL e as credenciais da service account (GOOGLE_SERVICE_ACCOUNT_JSON ou GOOGLE_APPLICATION_CREDENTIALS) no gateway para ver o ranqueamento real."
            />
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={Gauge}
          label="Score médio"
          value={`${s.avgScore}`}
          accent="text-violet-400 bg-violet-500/10"
          valueClass={scoreColor(s.avgScore)}
        />
        <KpiCard
          icon={TrendingUp}
          label="Posição média"
          value={formatPosition(s.avgPosition)}
          accent="text-sky-400 bg-sky-500/10"
          hint={dash.config.gscConfigured ? undefined : "Requer GSC"}
        />
        <KpiCard
          icon={MousePointerClick}
          label="Cliques (28d)"
          value={s.totalClicks.toLocaleString("pt-BR")}
          accent="text-emerald-400 bg-emerald-500/10"
          hint={dash.config.gscConfigured ? formatCtr(s.avgCtr) + " CTR" : "Requer GSC"}
        />
        <KpiCard
          icon={ImageOff}
          label="Sem página pública"
          value={s.withoutPublicUrl.toLocaleString("pt-BR")}
          accent="text-amber-400 bg-amber-500/10"
          hint={`${s.withPublicUrl} com página`}
        />
      </div>

      {/* Distribuição de scores */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">Distribuição de qualidade</h3>
          <div className="flex items-center gap-2">
            {s.metricsFetchedAt && (
              <span className="hidden text-[11px] text-slate-500 sm:inline">
                GSC: {new Date(s.metricsFetchedAt).toLocaleString("pt-BR")}
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={!dash.config.gscConfigured || refreshMutation.isPending}
              onClick={() => refreshMutation.mutate()}
              className="border-slate-600 text-slate-200 hover:bg-slate-800 disabled:opacity-40"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshMutation.isPending && "animate-spin")} />
              Atualizar métricas
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {GRADES.map((g) => {
            const count = s.gradeDistribution[g] ?? 0;
            const pct = s.totalProducts ? Math.round((count / s.totalProducts) * 100) : 0;
            return (
              <button
                key={g}
                onClick={() => setGradeFilter((cur) => (cur === g ? "" : g))}
                className={cn(
                  "flex flex-1 flex-col items-center rounded-lg border p-2 transition-all",
                  gradeFilter === g ? "ring-2 ring-emerald-400" : "",
                  gradeColor(g),
                )}
              >
                <span className="text-lg font-bold">{g}</span>
                <span className="text-sm font-semibold">{count}</span>
                <span className="text-[10px] opacity-80">{pct}%</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por nome ou SKU..."
            className="border-slate-600 bg-slate-800/60 pl-9 text-slate-100 placeholder:text-slate-500"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-9 rounded-md border border-slate-600 bg-slate-800/60 px-2 text-sm text-slate-100"
          >
            <option value="">Todas as categorias</option>
            {(categoriesQuery.data?.data ?? []).map((c) => (
              <option key={c.category_name} value={c.category_name}>
                {c.category_name} ({c.product_count})
              </option>
            ))}
          </select>
          <button
            onClick={() => setOnlyNoPublicUrl((v) => !v)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors",
              onlyNoPublicUrl
                ? "border-amber-500/50 bg-amber-500/15 text-amber-200"
                : "border-slate-600 bg-slate-800/60 text-slate-300 hover:border-slate-500",
            )}
          >
            <ImageOff className="h-3.5 w-3.5" /> Sem página pública
          </button>
        </div>
      </div>

      {/* Tabela */}
      {rows.length === 0 ? (
        <EmptyState icon={Search} title="Nenhum produto encontrado" description="Ajuste a busca ou os filtros." />
      ) : (
        <>
          <div className="hidden rounded-xl border border-slate-700 bg-slate-800/30 md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-14">Foto</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("score")} className="flex items-center gap-1">
                      Score <ArrowUpDown className="h-3 w-3 opacity-50" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("position")} className="flex items-center gap-1">
                      Posição <ArrowUpDown className="h-3 w-3 opacity-50" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("clicks")} className="flex items-center gap-1">
                      Cliques <ArrowUpDown className="h-3 w-3 opacity-50" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("impressions")} className="flex items-center gap-1">
                      Impr. <ArrowUpDown className="h-3 w-3 opacity-50" />
                    </button>
                  </TableHead>
                  <TableHead>CTR</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.sku} className="cursor-pointer" onClick={() => setDetailSku(p.sku)}>
                    <TableCell>
                      <RowThumb product={p} />
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-slate-100">{p.name}</p>
                      <p className="flex items-center gap-1.5 text-xs text-slate-500">
                        {p.sku}
                        {p.category && (
                          <span className="inline-flex items-center gap-1">
                            ·
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: categoryColor(p.category) }}
                            />
                            {p.category}
                          </span>
                        )}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded border text-xs font-bold", gradeColor(p.grade))}>
                          {p.grade}
                        </span>
                        <span className={cn("text-sm font-semibold", scoreColor(p.score))}>{p.score}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-300">{formatPosition(p.position)}</TableCell>
                    <TableCell className="text-sm text-slate-300">{p.clicks.toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-sm text-slate-300">{p.impressions.toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-sm text-slate-300">{formatCtr(p.ctr || null)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()} className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {p.canonicalUrl && (
                          <a
                            href={p.canonicalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white"
                            aria-label="Abrir página pública"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditSku(p.sku)}
                          className="h-8 gap-1 text-violet-300 hover:bg-violet-500/10 hover:text-violet-200"
                        >
                          <Sparkles className="h-3.5 w-3.5" /> IA
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile */}
          <div className="space-y-2 md:hidden">
            {rows.map((p) => (
              <button
                key={p.sku}
                onClick={() => setDetailSku(p.sku)}
                className="flex w-full items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-left"
              >
                <RowThumb product={p} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-100">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.sku}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                    <span className={cn("inline-flex h-5 items-center rounded border px-1.5 font-bold", gradeColor(p.grade))}>
                      {p.grade} {p.score}
                    </span>
                    <span>#{formatPosition(p.position)}</span>
                    <span>{p.clicks} cliques</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Drawer de detalhe */}
      {detailSku && detailProductQuery.data?.data && (
        <SeoProductDrawer
          product={detailProductQuery.data.data}
          open={!!detailSku}
          onClose={() => setDetailSku(null)}
          onEdit={() => {
            setEditSku(detailSku);
            setDetailSku(null);
          }}
        />
      )}

      {/* Drawer de edição (reutiliza ProductDrawer) */}
      {editSku && editProductQuery.data?.data && (
        <ProductDrawer
          product={editProductQuery.data.data}
          open={!!editSku}
          saving={saveMutation.isPending}
          unlocking={unlockMutation.isPending}
          onClose={() => setEditSku(null)}
          onSave={async (patch) => {
            await saveMutation.mutateAsync({ sku: editSku, patch });
          }}
          onUnlock={() => unlockMutation.mutate(editSku)}
          onImageUploaded={() => {
            qc.invalidateQueries({ queryKey: ["admin-catalog-product"] });
            qc.invalidateQueries({ queryKey: ["admin-seo-dashboard"] });
          }}
        />
      )}

      {editSku && editProductQuery.isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        </div>
      )}
    </div>
  );
}

function ConfigBanner({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Info;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
      <Icon className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400" />
      <div>
        <p className="text-sm font-semibold text-amber-100">{title}</p>
        <p className="text-xs text-amber-200/80">{text}</p>
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  accent,
  valueClass,
  hint,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
  accent: string;
  valueClass?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
      <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", accent)}>
        <Icon className="h-5 w-5" />
      </span>
      <p className={cn("mt-3 text-2xl font-bold text-white", valueClass)}>{value}</p>
      <p className="text-xs font-medium text-slate-300">{label}</p>
      {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

function RowThumb({ product }: { product: SeoDashboardProduct }) {
  return (
    <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-md border border-slate-700 bg-slate-900">
      {product.imageUrl ? (
        <Image src={product.imageUrl} alt={product.name} fill unoptimized className="object-contain" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-slate-600">
          <ImageOff className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
