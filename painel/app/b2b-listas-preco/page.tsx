"use client";

import { ProtectedLayout } from "@/components/ProtectedLayout";
import { useAuth } from "@/components/AuthProvider";
import { useCallback, useEffect, useState } from "react";
import { FileSpreadsheet, Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PriceList {
  priceListNo: number;
  priceListName: string;
}

interface PreviewItem {
  itemCode: string;
  itemName: string | null;
  price: number;
  currency: string | null;
}

export default function B2BListasPrecoPage() {
  const { user } = useAuth();
  const [lists, setLists] = useState<PriceList[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadLists = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/b2b-admin/price-lists");
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error || "Erro");
      const rows: PriceList[] = j.data?.items ?? [];
      setLists(rows);
      if (rows.length && selected == null) setSelected(rows[0].priceListNo);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao listar");
    } finally {
      setLoading(false);
    }
  }, [selected]);

  const loadPreview = useCallback(async () => {
    if (selected == null) return;
    setPreviewLoading(true);
    try {
      const qs = new URLSearchParams({ limit: "60" });
      if (search.trim()) qs.set("search", search.trim());
      const res = await fetch(
        `/api/b2b-admin/price-lists/${selected}/preview?${qs}`,
      );
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error || "Erro no preview");
      setItems(j.data?.items ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no preview");
    } finally {
      setPreviewLoading(false);
    }
  }, [selected, search]);

  useEffect(() => {
    void loadLists();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selected != null) void loadPreview();
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user || !["admin", "supervisor", "comercial"].includes(user.role)) {
    return (
      <ProtectedLayout>
        <div className="p-8 text-sm text-gray-500">Sem permissão.</div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <div className="p-6 md:p-8 space-y-6 max-w-5xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
              Listas de preço B2B
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Consulta operacional das listas SAP (OPLN) para escolher na
              aprovação de cadastros. Para análise BI use Business Intelligence →
              Preços.
            </p>
          </div>
          <button
            onClick={() => void loadLists()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-gray-200 hover:bg-gray-50"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Atualizar
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-12 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando listas...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1 rounded-xl border border-gray-200 bg-white divide-y divide-gray-50 max-h-[70vh] overflow-y-auto">
              {lists.map((pl) => (
                <button
                  key={pl.priceListNo}
                  onClick={() => setSelected(pl.priceListNo)}
                  className={cn(
                    "w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition",
                    selected === pl.priceListNo && "bg-emerald-50/60",
                  )}
                >
                  <span className="font-mono text-xs text-gray-400">
                    #{pl.priceListNo}
                  </span>
                  <p className="font-medium text-gray-900">{pl.priceListName}</p>
                </button>
              ))}
              {lists.length === 0 && (
                <p className="p-4 text-sm text-gray-400">
                  Nenhuma lista ativa no SAP.
                </p>
              )}
            </div>

            <div className="md:col-span-2 rounded-xl border border-gray-200 bg-white p-4 space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void loadPreview();
                    }}
                    placeholder="Buscar por SKU..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm"
                  />
                </div>
                <button
                  onClick={() => void loadPreview()}
                  className="px-3 py-2 rounded-lg text-sm bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  Buscar
                </button>
              </div>

              {previewLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-8 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" /> Carregando preços...
                </div>
              ) : (
                <div className="rounded-lg border border-gray-100 divide-y divide-gray-50 max-h-[55vh] overflow-y-auto">
                  {items.length === 0 ? (
                    <p className="p-4 text-sm text-gray-400">Sem itens na amostra.</p>
                  ) : (
                    items.map((it) => (
                      <div
                        key={it.itemCode}
                        className="flex items-center justify-between px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-mono text-xs text-gray-500">
                            {it.itemCode}
                          </p>
                          <p className="truncate text-gray-800">
                            {it.itemName || "—"}
                          </p>
                        </div>
                        <span className="font-medium whitespace-nowrap ml-3">
                          {it.price.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}
