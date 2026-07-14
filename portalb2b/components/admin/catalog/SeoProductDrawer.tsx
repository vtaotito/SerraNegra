"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  ExternalLink,
  Sparkles,
  TrendingUp,
  Search,
  AlertTriangle,
  MousePointerClick,
  Eye,
} from "lucide-react";
import {
  Drawer,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SeoScorePanel } from "./SeoScorePanel";
import type { AdminProduct } from "@/lib/admin/catalog";
import { fetchProductMetrics, formatCtr, formatPosition } from "@/lib/admin/seo";

interface SeoProductDrawerProps {
  product: AdminProduct;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
}

function MetricStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-3">
      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className="mt-1 text-xl font-bold text-white">{value}</p>
    </div>
  );
}

/** Mini-gráfico de tendência da posição (menor = melhor, então invertido). */
function PositionTrend({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const width = 100;
  const height = 28;
  const step = width / (points.length - 1);
  // Posição menor é melhor → invertemos o eixo Y (topo = melhor).
  const path = points
    .map((p, i) => {
      const x = i * step;
      const y = ((p - min) / range) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-8 w-full" preserveAspectRatio="none">
      <path d={path} fill="none" stroke="#34d399" strokeWidth="1.5" />
    </svg>
  );
}

export function SeoProductDrawer({ product, open, onClose, onEdit }: SeoProductDrawerProps) {
  const metricsQuery = useQuery({
    queryKey: ["admin-seo-product-metrics", product.sku],
    queryFn: () => fetchProductMetrics(product.sku),
    enabled: open,
    retry: false,
  });

  const scoreInput = {
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    seoSlug: product.seoSlug,
    description: product.description,
    imageUrl: product.imageUrl,
    ogImageUrl: product.ogImageUrl,
    keywords: product.seoKeywords,
  };

  const res = metricsQuery.data;
  const gscNotConfigured = res?.code === "GSC_NOT_CONFIGURED" || (res && !res.ok && res.code === "GSC_NOT_CONFIGURED");
  const metric = res?.ok ? res.data.metric : null;
  const queries = res?.ok ? res.data.queries : [];
  const history = res?.ok ? res.data.history : [];

  return (
    <Drawer open={open} onClose={onClose}>
      <DrawerHeader
        title={product.name}
        description={`${product.sku}${product.category ? ` · ${product.category}` : ""}`}
        onClose={onClose}
      />
      <DrawerBody>
        {/* URL pública */}
        <section>
          {product.canonicalUrl ? (
            <a
              href={product.canonicalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 break-all text-sm text-emerald-400 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
              {product.canonicalUrl}
            </a>
          ) : (
            <div className="flex items-start gap-2 rounded-md border border-slate-700 bg-slate-800/40 p-2.5 text-xs text-slate-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
              <p>
                Este produto não tem página pública (sem slug de origem), então não é medido pelo
                Google Search Console.
              </p>
            </div>
          )}
        </section>

        {/* Qualidade (checklist) */}
        <SeoScorePanel input={scoreInput} defaultOpen />

        {/* Métricas GSC */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-sky-400" />
            <h3 className="text-sm font-semibold text-slate-200">Ranqueamento (Google Search Console)</h3>
          </div>

          {metricsQuery.isLoading ? (
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg bg-slate-800" />
              ))}
            </div>
          ) : gscNotConfigured ? (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>
                Google Search Console não configurado. Defina{" "}
                <code className="text-amber-100">GSC_SITE_URL</code> e a service account no gateway
                para ver métricas reais de ranqueamento.
              </p>
            </div>
          ) : !product.canonicalUrl ? (
            <p className="text-xs text-slate-500">Sem página pública para medir.</p>
          ) : metric ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <MetricStat icon={TrendingUp} label="Posição média" value={formatPosition(metric.position)} />
                <MetricStat icon={MousePointerClick} label="Cliques" value={metric.clicks.toLocaleString("pt-BR")} />
                <MetricStat icon={Eye} label="Impressões" value={metric.impressions.toLocaleString("pt-BR")} />
                <MetricStat icon={Search} label="CTR" value={formatCtr(metric.ctr)} />
              </div>
              {history.length >= 2 && (
                <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-3">
                  <p className="mb-1 text-xs text-slate-400">Tendência da posição</p>
                  <PositionTrend
                    points={history.filter((h) => h.position != null).map((h) => h.position as number)}
                  />
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-slate-500">
              Sem dados do GSC ainda. Use "Atualizar métricas" na aba SEO para buscar.
            </p>
          )}
        </section>

        {/* Top queries */}
        {queries.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-slate-200">Principais buscas</h3>
            </div>
            <div className="space-y-1">
              {queries.map((q) => (
                <div
                  key={q.query}
                  className="flex items-center justify-between gap-2 rounded-md border border-slate-700 bg-slate-800/40 px-3 py-2 text-xs"
                >
                  <span className="min-w-0 truncate text-slate-200">{q.query}</span>
                  <div className="flex flex-shrink-0 items-center gap-3 text-slate-400">
                    <span title="Posição">#{q.position.toFixed(1)}</span>
                    <Badge variant="secondary" className="text-[10px]">{q.clicks} cliques</Badge>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </DrawerBody>

      <DrawerFooter>
        <Button variant="ghost" onClick={onClose} className="mr-auto text-slate-300 hover:text-white">
          Fechar
        </Button>
        <Button onClick={onEdit} className="bg-violet-600 text-white hover:bg-violet-700">
          <Sparkles className="h-4 w-4" /> Editar / Gerar com IA
        </Button>
      </DrawerFooter>
    </Drawer>
  );
}
