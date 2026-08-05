"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Search,
  Plus,
  Minus,
  Trash2,
  Loader2,
  ShoppingCart,
  User,
  Package,
  Check,
  X,
  Building2,
  Phone,
  Mail,
  CalendarDays,
  Boxes,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { fetchCustomers, type CustomerRow } from "@/lib/cockpit-api";
import { packagingLabel, packagingShort } from "@/lib/packaging-label";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CatalogVariant {
  sku: string;
  packagingType: string;
  unitsPerPack: number;
  unitOfMeasure: string;
  inStock: boolean;
  stockQuantity: number;
  stockUnits: number;
  imageUrl?: string | null;
}

interface UnifiedProduct {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  imageUrl: string | null;
  inStock: boolean;
  stockUnits: number;
  variants: CatalogVariant[];
}

interface CartLine {
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  packagingType: string | null;
  unitsPerPack: number;
  stockQuantity: number;
}

const PAGE_SIZE = 48;

export default function NovaVendaPage() {
  const router = useRouter();

  // ─── Cliente ────────────────────────────────────────────────
  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [custQuery, setCustQuery] = useState("");
  const [custResults, setCustResults] = useState<CustomerRow[]>([]);
  const [custLoading, setCustLoading] = useState(false);

  useEffect(() => {
    if (customer) return;
    const q = custQuery.trim();
    if (q.length < 2) {
      setCustResults([]);
      return;
    }
    setCustLoading(true);
    const t = setTimeout(() => {
      fetchCustomers({ search: q, active: true, limit: 50 })
        .then((r) => setCustResults(r.data ?? []))
        .catch(() => setCustResults([]))
        .finally(() => setCustLoading(false));
    }, 350);
    return () => clearTimeout(t);
  }, [custQuery, customer]);

  // ─── Catálogo unificado ─────────────────────────────────────
  const [prodQuery, setProdQuery] = useState("");
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [products, setProducts] = useState<UnifiedProduct[]>([]);
  const [prodTotal, setProdTotal] = useState(0);
  const [prodPage, setProdPage] = useState(1);
  const [prodPages, setProdPages] = useState(1);
  const [prodLoading, setProdLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const reqIdRef = useRef(0);

  // Seleção por produto: embalagem + qtd de embalagens
  const [selectedPack, setSelectedPack] = useState<Record<string, string>>({});
  const [packQty, setPackQty] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const loadCatalog = useCallback(
    async (page: number, append: boolean) => {
      const reqId = ++reqIdRef.current;
      if (append) setLoadingMore(true);
      else setProdLoading(true);

      const qs = new URLSearchParams({
        limit: String(PAGE_SIZE),
        page: String(page),
      });
      if (prodQuery.trim()) qs.set("search", prodQuery.trim());
      if (onlyInStock) qs.set("inStock", "true");

      try {
        const r = await fetch(`/api/b2b-admin/catalog/unified?${qs.toString()}`);
        const j = await r.json();
        if (reqId !== reqIdRef.current) return;
        if (!j.success) {
          if (!append) setProducts([]);
          return;
        }
        const items = (j.data?.items ?? []) as UnifiedProduct[];
        setProducts((prev) => (append ? [...prev, ...items] : items));
        setProdTotal(Number(j.data?.total ?? 0));
        setProdPage(Number(j.data?.page ?? page));
        setProdPages(Number(j.data?.pages ?? 1));
      } catch {
        if (reqId === reqIdRef.current && !append) setProducts([]);
      } finally {
        if (reqId === reqIdRef.current) {
          setProdLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [prodQuery, onlyInStock],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      setProdPage(1);
      void loadCatalog(1, false);
    }, 300);
    return () => clearTimeout(t);
  }, [loadCatalog]);

  // Defaults de embalagem ao carregar produtos
  useEffect(() => {
    setSelectedPack((prev) => {
      const next = { ...prev };
      for (const p of products) {
        if (next[p.id]) continue;
        const preferred =
          p.variants.find((v) => v.inStock && v.unitsPerPack > 1) ??
          p.variants.find((v) => v.inStock) ??
          p.variants[0];
        if (preferred) next[p.id] = preferred.sku;
      }
      return next;
    });
    setPackQty((prev) => {
      const next = { ...prev };
      for (const p of products) {
        if (next[p.id] == null) next[p.id] = 1;
      }
      return next;
    });
  }, [products]);

  // ─── Carrinho ───────────────────────────────────────────────
  const [cart, setCart] = useState<CartLine[]>([]);
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const cartMap = useMemo(() => {
    const m = new Map<string, CartLine>();
    for (const l of cart) m.set(l.sku, l);
    return m;
  }, [cart]);

  // Duplicar pedido: hidrata cliente + itens vindos do drawer (sessionStorage).
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem("wms_duplicate_order");
    } catch {
      raw = null;
    }
    if (!raw) return;
    try {
      sessionStorage.removeItem("wms_duplicate_order");
      const data = JSON.parse(raw) as {
        customer?: CustomerRow | null;
        items?: { sku: string; name: string; quantity: number }[];
      };
      if (data.customer) setCustomer(data.customer);
      if (Array.isArray(data.items) && data.items.length > 0) {
        setCart(
          data.items.map((it) => ({
            sku: it.sku,
            name: it.name,
            unit: "UN",
            quantity: Number(it.quantity) || 1,
            packagingType: null,
            unitsPerPack: 1,
            stockQuantity: 0,
          })),
        );
        toast.success("Pedido duplicado", {
          description: "Revise os itens e finalize a venda assistida.",
        });
      }
    } catch {
      /* payload inválido — ignora */
    }
  }, []);

  const addVariantToCart = useCallback(
    (product: UnifiedProduct, variant: CatalogVariant, packs: number) => {
      const qty = Math.max(1, Math.floor(packs) || 1);
      setCart((prev) => {
        const existing = prev.find((l) => l.sku === variant.sku);
        if (existing) {
          return prev.map((l) =>
            l.sku === variant.sku ? { ...l, quantity: l.quantity + qty } : l,
          );
        }
        return [
          ...prev,
          {
            sku: variant.sku,
            name: product.name,
            unit: variant.unitOfMeasure || "UN",
            quantity: qty,
            packagingType: variant.packagingType,
            unitsPerPack: variant.unitsPerPack,
            stockQuantity: variant.stockQuantity,
          },
        ];
      });
      toast.success("Adicionado ao carrinho", {
        description: `${qty}× ${packagingLabel(variant.packagingType, variant.unitsPerPack)} · ${variant.sku}`,
      });
    },
    [],
  );

  const setQty = useCallback((sku: string, qty: number) => {
    setCart((prev) =>
      prev
        .map((l) => (l.sku === sku ? { ...l, quantity: Math.max(0, qty) } : l))
        .filter((l) => l.quantity > 0),
    );
  }, []);

  const removeLine = useCallback((sku: string) => {
    setCart((prev) => prev.filter((l) => l.sku !== sku));
  }, []);

  const totalPacks = cart.reduce((s, l) => s + l.quantity, 0);
  const totalUnits = cart.reduce((s, l) => s + l.quantity * (l.unitsPerPack || 1), 0);
  const canSubmit = !!customer && cart.length > 0 && !submitting;

  const submit = async () => {
    if (!customer || cart.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/b2b-admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardCode: customer.card_code,
          cardName: customer.card_name,
          items: cart.map((l) => ({ sku: l.sku, quantity: l.quantity })),
          notes: notes.trim() || undefined,
          dueDate: dueDate || undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error || "Erro ao criar pedido");
      toast.success(`Pedido #${j.data.docNum ?? j.data.docEntry} criado`);
      router.push(`/pedidos?docEntry=${j.data.docEntry}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar pedido");
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/pedidos")}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-gsn-700" />
            Nova venda assistida
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Monte o pedido em nome do cliente. Escolha a embalagem e a quantidade
            de cada produto.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Cliente */}
          <Section title="1. Cliente" icon={User} done={!!customer}>
            {customer ? (
              <div className="flex items-start justify-between gap-3 rounded-lg border border-gsn-200 bg-gsn-50/50 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-gsn-700 shrink-0" />
                    {customer.card_name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{customer.card_code}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-gray-500">
                    {customer.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {customer.phone}
                      </span>
                    )}
                    {customer.email && (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {customer.email}
                      </span>
                    )}
                    {(customer.city || customer.state) && (
                      <span>
                        {[customer.city, customer.state].filter(Boolean).join(" / ")}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setCustomer(null);
                    setCustQuery("");
                  }}
                  className="text-xs font-medium text-gsn-700 hover:text-gsn-800 shrink-0"
                >
                  Trocar
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={custQuery}
                  onChange={(e) => setCustQuery(e.target.value)}
                  placeholder="Buscar cliente por nome ou código…"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gsn-700/40 focus:border-gsn-700 outline-none"
                />
                {(custLoading || custResults.length > 0) && custQuery.trim().length >= 2 && (
                  <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-50">
                    {custLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="w-4 h-4 animate-spin text-gsn-700" />
                      </div>
                    ) : (
                      custResults.map((c) => (
                        <button
                          key={c.card_code}
                          onClick={() => setCustomer(c)}
                          className="w-full text-left px-3 py-2.5 hover:bg-gsn-50/50 transition"
                        >
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {c.card_name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {c.card_code}
                            {c.city ? ` · ${c.city}/${c.state ?? ""}` : ""}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* Produtos */}
          <Section
            title="2. Produtos"
            icon={Package}
            badge={
              prodTotal > 0
                ? `${fmtNum(products.length)} de ${fmtNum(prodTotal)}`
                : undefined
            }
          >
            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={prodQuery}
                  onChange={(e) => setProdQuery(e.target.value)}
                  placeholder="Buscar por nome, código ou EAN…"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gsn-700/40 focus:border-gsn-700 outline-none"
                />
              </div>
              <label className="inline-flex items-center gap-2 px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 cursor-pointer select-none shrink-0">
                <input
                  type="checkbox"
                  checked={onlyInStock}
                  onChange={(e) => setOnlyInStock(e.target.checked)}
                  className="rounded border-gray-300 text-gsn-700 focus:ring-gsn-700/40"
                />
                Só com estoque
              </label>
            </div>

            <p className="text-xs text-gray-400 mb-3">
              Selecione a embalagem (UND, caixa, fardo…) e a quantidade de embalagens
              antes de adicionar.
            </p>

            <div className="space-y-2 max-h-[36rem] overflow-y-auto pr-0.5">
              {prodLoading ? (
                <div className="flex items-center justify-center h-32 rounded-lg border border-gray-200">
                  <Loader2 className="w-5 h-5 animate-spin text-gsn-700" />
                </div>
              ) : products.length === 0 ? (
                <div className="flex items-center justify-center h-32 rounded-lg border border-gray-200 text-sm text-gray-400">
                  Nenhum produto encontrado.
                </div>
              ) : (
                products.map((p) => {
                  // Aberto por padrão para o vendedor já ver embalagem + quantidade.
                  const isOpen = expanded[p.id] !== false;
                  const sku = selectedPack[p.id] ?? p.variants[0]?.sku;
                  const variant = p.variants.find((v) => v.sku === sku) ?? p.variants[0];
                  const qty = packQty[p.id] ?? 1;
                  const inCart = variant ? cartMap.get(variant.sku) : undefined;
                  const unitsOut = variant ? qty * (variant.unitsPerPack || 1) : 0;

                  return (
                    <div
                      key={p.id}
                      className="rounded-xl border border-gray-200 bg-white overflow-hidden"
                    >
                      <div className="flex items-start gap-3 p-3">
                        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                          {p.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Boxes className="w-5 h-5 text-gray-300" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 leading-snug">
                                {p.name}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {p.category ? `${p.category} · ` : ""}
                                {p.variants.length}{" "}
                                {p.variants.length === 1 ? "embalagem" : "embalagens"}
                                {p.inStock
                                  ? ` · ${fmtNum(p.stockUnits)} un em estoque`
                                  : " · sem estoque"}
                              </p>
                            </div>
                            {p.variants.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpanded((prev) => ({
                                    ...prev,
                                    [p.id]: !isOpen,
                                  }))
                                }
                                className="p-1 rounded text-gray-400 hover:bg-gray-50 shrink-0"
                                aria-label={isOpen ? "Recolher" : "Expandir"}
                              >
                                {isOpen ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </div>

                          {isOpen && variant && (
                            <div className="mt-3 space-y-2.5">
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
                                  Embalagem
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {p.variants.map((v) => {
                                    const selected = v.sku === variant.sku;
                                    const cartQty = cartMap.get(v.sku)?.quantity;
                                    return (
                                      <button
                                        key={v.sku}
                                        type="button"
                                        onClick={() =>
                                          setSelectedPack((prev) => ({
                                            ...prev,
                                            [p.id]: v.sku,
                                          }))
                                        }
                                        title={`${packagingLabel(v.packagingType, v.unitsPerPack)} · ${v.sku}${v.inStock ? "" : " · sem estoque"}`}
                                        className={cn(
                                          "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition",
                                          selected
                                            ? "border-gsn-700 bg-gsn-50 text-gsn-800"
                                            : "border-gray-200 bg-white text-gray-600 hover:border-gray-300",
                                          !v.inStock && "opacity-60",
                                        )}
                                      >
                                        <span
                                          className={cn(
                                            "h-1.5 w-1.5 rounded-full shrink-0",
                                            v.inStock ? "bg-emerald-500" : "bg-red-400",
                                          )}
                                        />
                                        {packagingShort(v.packagingType, v.unitsPerPack)}
                                        {cartQty ? (
                                          <span className="text-[10px] text-gsn-700 font-semibold">
                                            ·{cartQty}
                                          </span>
                                        ) : null}
                                      </button>
                                    );
                                  })}
                                </div>
                                <p className="text-[11px] text-gray-400 mt-1.5">
                                  SKU {variant.sku}
                                  {" · "}
                                  {variant.inStock
                                    ? `${fmtNum(variant.stockQuantity)} ${packagingLabel(variant.packagingType, variant.unitsPerPack).toLowerCase()} (${fmtNum(variant.stockUnits)} un)`
                                    : "sem estoque nesta embalagem"}
                                </p>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <div className="inline-flex items-center border border-gray-200 rounded-lg bg-white">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPackQty((prev) => ({
                                        ...prev,
                                        [p.id]: Math.max(1, (prev[p.id] ?? 1) - 1),
                                      }))
                                    }
                                    className="px-2.5 py-2 text-gray-500 hover:bg-gray-50 rounded-l-lg"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <input
                                    type="number"
                                    min={1}
                                    value={qty}
                                    onChange={(e) =>
                                      setPackQty((prev) => ({
                                        ...prev,
                                        [p.id]: Math.max(
                                          1,
                                          Math.floor(Number(e.target.value) || 1),
                                        ),
                                      }))
                                    }
                                    className="w-14 text-center text-sm border-0 focus:ring-0 outline-none py-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    aria-label="Quantidade de embalagens"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPackQty((prev) => ({
                                        ...prev,
                                        [p.id]: (prev[p.id] ?? 1) + 1,
                                      }))
                                    }
                                    className="px-2.5 py-2 text-gray-500 hover:bg-gray-50 rounded-r-lg"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <span className="text-xs text-gray-500">
                                  {packagingLabel(
                                    variant.packagingType,
                                    variant.unitsPerPack,
                                  )}
                                  {variant.unitsPerPack > 1
                                    ? ` = ${fmtNum(unitsOut)} un`
                                    : ""}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => addVariantToCart(p, variant, qty)}
                                  className={cn(
                                    "ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition shrink-0",
                                    inCart
                                      ? "bg-gsn-50 text-gsn-800 border border-gsn-200 hover:bg-gsn-100"
                                      : "bg-gsn-700 text-white hover:bg-gsn-800",
                                  )}
                                >
                                  {inCart ? (
                                    <>
                                      <Check className="w-3.5 h-3.5" />
                                      Adicionar mais
                                      <span className="opacity-70">({inCart.quantity})</span>
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="w-3.5 h-3.5" />
                                      Adicionar
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          )}

                          {!isOpen && variant && (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="text-xs text-gray-500">
                                {packagingLabel(
                                  variant.packagingType,
                                  variant.unitsPerPack,
                                )}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setExpanded((prev) => ({ ...prev, [p.id]: true }))
                                }
                                className="text-xs font-medium text-gsn-700 hover:text-gsn-800"
                              >
                                Escolher embalagem
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {prodPage < prodPages && (
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => void loadCatalog(prodPage + 1, true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {loadingMore ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                  Carregar mais produtos
                </button>
              </div>
            )}
          </Section>
        </div>

        {/* Carrinho */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-4 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-gsn-700" />
                Carrinho
              </h2>
              {cart.length > 0 && (
                <span className="text-xs text-gray-500">
                  {cart.length} {cart.length === 1 ? "SKU" : "SKUs"} ·{" "}
                  {fmtNum(totalPacks)} emb · {fmtNum(totalUnits)} un
                </span>
              )}
            </div>

            <div className="max-h-[22rem] overflow-y-auto divide-y divide-gray-50">
              {cart.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-gray-400">
                  Escolha embalagem e quantidade nos produtos.
                </div>
              ) : (
                cart.map((l) => (
                  <div key={l.sku} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {l.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {l.sku}
                          {" · "}
                          {packagingLabel(l.packagingType, l.unitsPerPack)}
                        </p>
                      </div>
                      <button
                        onClick={() => removeLine(l.sku)}
                        className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="inline-flex items-center border border-gray-200 rounded-lg">
                        <button
                          onClick={() => setQty(l.sku, l.quantity - 1)}
                          className="px-2 py-1.5 text-gray-500 hover:bg-gray-50 rounded-l-lg"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          min={1}
                          value={l.quantity}
                          onChange={(e) =>
                            setQty(l.sku, Math.floor(Number(e.target.value) || 0))
                          }
                          className="w-14 text-center text-sm border-0 focus:ring-0 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          onClick={() => setQty(l.sku, l.quantity + 1)}
                          className="px-2 py-1.5 text-gray-500 hover:bg-gray-50 rounded-r-lg"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="text-xs text-gray-400">
                        {l.unitsPerPack > 1
                          ? `= ${fmtNum(l.quantity * l.unitsPerPack)} un`
                          : l.unit}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-gray-100 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5 mb-1">
                  <CalendarDays className="w-3.5 h-3.5" /> Data de entrega (opcional)
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-gsn-700/40"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">
                  Observações (opcional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Condições, instruções…"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-gsn-700/40 resize-none"
                />
              </div>

              {!customer && cart.length > 0 && (
                <p className="text-xs text-amber-600 flex items-center gap-1.5">
                  <X className="w-3.5 h-3.5" /> Selecione o cliente para concluir.
                </p>
              )}

              <button
                onClick={submit}
                disabled={!canSubmit}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-gsn-700 hover:bg-gsn-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Criar pedido
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  done,
  badge,
  children,
}: {
  title: string;
  icon: typeof User;
  done?: boolean;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <div
          className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center",
            done ? "bg-emerald-50 text-emerald-600" : "bg-gsn-50 text-gsn-700",
          )}
        >
          {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
        </div>
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {badge && (
          <span className="ml-auto text-[11px] text-gray-400 tabular-nums">{badge}</span>
        )}
      </div>
      {children}
    </div>
  );
}
