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
  ChevronRight,
  MapPin,
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
  imageUrl?: string | null;
}

const PAGE_SIZE = 36;

export default function NovaVendaPage() {
  const router = useRouter();

  // ─── Cliente ────────────────────────────────────────────────
  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [custQuery, setCustQuery] = useState("");
  const [custResults, setCustResults] = useState<CustomerRow[]>([]);
  const [custLoading, setCustLoading] = useState(false);
  const custInputRef = useRef<HTMLInputElement>(null);

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
    }, 300);
    return () => clearTimeout(t);
  }, [custQuery, customer]);

  // ─── Catálogo ───────────────────────────────────────────────
  const [prodQuery, setProdQuery] = useState("");
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [products, setProducts] = useState<UnifiedProduct[]>([]);
  const [prodTotal, setProdTotal] = useState(0);
  const [prodPage, setProdPage] = useState(1);
  const [prodPages, setProdPages] = useState(1);
  const [prodLoading, setProdLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const reqIdRef = useRef(0);

  // Sheet de produto (mobile-first)
  const [activeProduct, setActiveProduct] = useState<UnifiedProduct | null>(null);
  const [sheetSku, setSheetSku] = useState<string | null>(null);
  const [sheetQty, setSheetQty] = useState(1);
  const [cartOpen, setCartOpen] = useState(false);

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
    }, 280);
    return () => clearTimeout(t);
  }, [loadCatalog]);

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
        setCartOpen(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const openProduct = useCallback(
    (p: UnifiedProduct) => {
      const preferred =
        p.variants.find((v) => v.inStock && v.unitsPerPack > 1) ??
        p.variants.find((v) => v.inStock) ??
        p.variants[0];
      setActiveProduct(p);
      setSheetSku(preferred?.sku ?? null);
      setSheetQty(1);
    },
    [],
  );

  const closeProduct = useCallback(() => {
    setActiveProduct(null);
    setSheetSku(null);
    setSheetQty(1);
  }, []);

  const sheetVariant = useMemo(() => {
    if (!activeProduct || !sheetSku) return null;
    return activeProduct.variants.find((v) => v.sku === sheetSku) ?? activeProduct.variants[0] ?? null;
  }, [activeProduct, sheetSku]);

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
            imageUrl: variant.imageUrl ?? product.imageUrl,
          },
        ];
      });
      toast.success("Adicionado", {
        description: `${qty}× ${packagingLabel(variant.packagingType, variant.unitsPerPack)}`,
      });
    },
    [],
  );

  const confirmSheetAdd = () => {
    if (!activeProduct || !sheetVariant) return;
    addVariantToCart(activeProduct, sheetVariant, sheetQty);
    closeProduct();
  };

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
  const stepCustomerDone = !!customer;
  const stepProductsDone = cart.length > 0;

  // Bloqueia scroll do body quando sheet/cart mobile aberto
  useEffect(() => {
    const lock = !!activeProduct || cartOpen;
    if (!lock) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [activeProduct, cartOpen]);

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
    <div className="relative pb-28 lg:pb-6">
      {/* Header compacto */}
      <header className="sticky top-0 z-20 -mx-3 sm:-mx-4 lg:-mx-6 px-3 sm:px-4 lg:px-6 py-3 mb-4 bg-[var(--cockpit-bg)]/90 backdrop-blur-md border-b border-cockpit-border/60">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => router.push("/pedidos")}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white border border-cockpit-border text-gray-600 hover:bg-gray-50 active:scale-[0.98] transition"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-base sm:text-lg font-bold text-gray-900 truncate">
              Nova venda
            </h1>
            <p className="text-xs text-gray-500 truncate hidden sm:block">
              Pedido assistido no SAP
            </p>
          </div>
        </div>

        {/* Steps */}
        <ol className="mt-3 grid grid-cols-3 gap-1.5">
          <StepPill
            n={1}
            label="Cliente"
            done={stepCustomerDone}
            active={!stepCustomerDone}
            onClick={() => {
              if (!customer) custInputRef.current?.focus();
            }}
          />
          <StepPill
            n={2}
            label="Produtos"
            done={stepProductsDone}
            active={stepCustomerDone && !stepProductsDone}
          />
          <StepPill
            n={3}
            label="Pedido"
            done={canSubmit}
            active={stepCustomerDone && stepProductsDone}
            onClick={() => setCartOpen(true)}
          />
        </ol>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        {/* Coluna principal */}
        <div className="lg:col-span-8 space-y-4">
          {/* Cliente */}
          <section className="rounded-2xl bg-white border border-cockpit-border shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 pt-4 pb-2">
              <span
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold",
                  customer
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-gsn-50 text-gsn-700",
                )}
              >
                {customer ? <Check className="w-4 h-4" /> : "1"}
              </span>
              <h2 className="text-sm font-semibold text-gray-900">Cliente</h2>
            </div>

            <div className="px-4 pb-4">
              {customer ? (
                <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-gsn-50 to-white border border-gsn-100 p-3">
                  <div className="h-11 w-11 rounded-xl bg-gsn-700 text-white flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {customer.card_name}
                    </p>
                    <p className="text-xs text-gray-500 font-mono">{customer.card_code}</p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-400">
                      {customer.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {customer.phone}
                        </span>
                      )}
                      {(customer.city || customer.state) && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {[customer.city, customer.state].filter(Boolean).join("/")}
                        </span>
                      )}
                      {customer.email && (
                        <span className="inline-flex items-center gap-1 truncate max-w-[12rem]">
                          <Mail className="w-3 h-3" /> {customer.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomer(null);
                      setCustQuery("");
                      setTimeout(() => custInputRef.current?.focus(), 50);
                    }}
                    className="shrink-0 h-10 px-3 rounded-xl text-xs font-semibold text-gsn-700 bg-white border border-gsn-200 hover:bg-gsn-50 active:scale-[0.98] transition"
                  >
                    Trocar
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    ref={custInputRef}
                    value={custQuery}
                    onChange={(e) => setCustQuery(e.target.value)}
                    placeholder="Nome ou código do cliente"
                    autoComplete="off"
                    className="w-full h-12 pl-10 pr-4 rounded-xl border border-gray-200 bg-gray-50/80 text-sm placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-gsn-700/30 focus:border-gsn-700 outline-none transition"
                  />
                  {custQuery.trim().length >= 2 && (
                    <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 rounded-xl border border-cockpit-border bg-white shadow-xl overflow-hidden max-h-72 overflow-y-auto">
                      {custLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-5 h-5 animate-spin text-gsn-700" />
                        </div>
                      ) : custResults.length === 0 ? (
                        <p className="px-4 py-6 text-sm text-center text-gray-400">
                          Nenhum cliente encontrado
                        </p>
                      ) : (
                        custResults.map((c) => (
                          <button
                            key={c.card_code}
                            type="button"
                            onClick={() => {
                              setCustomer(c);
                              setCustQuery("");
                              setCustResults([]);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-gsn-50 active:bg-gsn-50/80 border-b border-gray-50 last:border-0 transition"
                          >
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {c.card_name}
                            </p>
                            <p className="text-xs text-gray-400 font-mono mt-0.5">
                              {c.card_code}
                              {c.city ? ` · ${c.city}` : ""}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Produtos */}
          <section className="rounded-2xl bg-white border border-cockpit-border shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 pt-4 pb-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold bg-gsn-50 text-gsn-700">
                2
              </span>
              <h2 className="text-sm font-semibold text-gray-900">Produtos</h2>
              {prodTotal > 0 && (
                <span className="ml-auto text-[11px] tabular-nums text-gray-400">
                  {fmtNum(products.length)}/{fmtNum(prodTotal)}
                </span>
              )}
            </div>

            <div className="px-4 pb-3 space-y-3 sticky top-[7.5rem] z-10 bg-white">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    value={prodQuery}
                    onChange={(e) => setProdQuery(e.target.value)}
                    placeholder="Buscar produto, SKU ou EAN"
                    autoComplete="off"
                    className="w-full h-11 pl-10 pr-3 rounded-xl border border-gray-200 bg-gray-50/80 text-sm placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-gsn-700/30 focus:border-gsn-700 outline-none transition"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setOnlyInStock((v) => !v)}
                  className={cn(
                    "h-11 px-3 rounded-xl text-xs font-semibold border shrink-0 transition active:scale-[0.98]",
                    onlyInStock
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-white border-gray-200 text-gray-600",
                  )}
                >
                  Estoque
                </button>
              </div>
            </div>

            <div className="px-2 pb-3 sm:px-3">
              {prodLoading ? (
                <div className="space-y-2 px-1">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-[4.5rem] rounded-xl bg-gray-100 animate-pulse"
                    />
                  ))}
                </div>
              ) : products.length === 0 ? (
                <div className="mx-1 flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-14 px-4 text-center">
                  <Package className="w-8 h-8 text-gray-300 mb-2" />
                  <p className="text-sm font-medium text-gray-500">
                    Nenhum produto encontrado
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Tente outro termo ou desative o filtro de estoque
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {products.map((p) => {
                    const inCartCount = p.variants.reduce(
                      (s, v) => s + (cartMap.get(v.sku)?.quantity ?? 0),
                      0,
                    );
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => openProduct(p)}
                          className="w-full flex items-center gap-3 px-2 sm:px-3 py-3 text-left hover:bg-gray-50/80 active:bg-gsn-50/40 transition rounded-xl"
                        >
                          <div className="h-14 w-14 rounded-xl bg-gray-100 border border-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                            {p.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={p.imageUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Boxes className="w-6 h-6 text-gray-300" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
                              {p.name}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              {p.category && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500">
                                  {p.category}
                                </span>
                              )}
                              <span className="text-[10px] text-gray-400">
                                {p.variants.length} emb.
                              </span>
                              <span
                                className={cn(
                                  "text-[10px] font-medium px-1.5 py-0.5 rounded-md",
                                  p.inStock
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-gray-100 text-gray-400",
                                )}
                              >
                                {p.inStock
                                  ? `${fmtNum(p.stockUnits)} un`
                                  : "Sem estoque"}
                              </span>
                              {inCartCount > 0 && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-gsn-50 text-gsn-700">
                                  {inCartCount} no pedido
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {prodPage < prodPages && !prodLoading && (
                <div className="pt-2 pb-1 flex justify-center">
                  <button
                    type="button"
                    disabled={loadingMore}
                    onClick={() => void loadCatalog(prodPage + 1, true)}
                    className="h-11 px-5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {loadingMore ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : null}
                    Carregar mais
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Carrinho desktop */}
        <aside className="hidden lg:block lg:col-span-4">
          <div className="sticky top-28">
            <CartPanel
              cart={cart}
              customer={customer}
              notes={notes}
              dueDate={dueDate}
              totalPacks={totalPacks}
              totalUnits={totalUnits}
              canSubmit={canSubmit}
              submitting={submitting}
              onNotes={setNotes}
              onDueDate={setDueDate}
              onQty={setQty}
              onRemove={removeLine}
              onSubmit={submit}
            />
          </div>
        </aside>
      </div>

      {/* Barra inferior mobile */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-30">
        <div className="mx-auto max-w-[1600px] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 bg-gradient-to-t from-[var(--cockpit-bg)] via-[var(--cockpit-bg)] to-transparent">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className={cn(
              "w-full h-14 rounded-2xl shadow-lg shadow-gsn-700/20 flex items-center gap-3 px-4 transition active:scale-[0.99]",
              cart.length > 0
                ? "bg-gsn-700 text-white"
                : "bg-white border border-cockpit-border text-gray-700",
            )}
          >
            <span
              className={cn(
                "relative inline-flex h-10 w-10 items-center justify-center rounded-xl",
                cart.length > 0 ? "bg-white/15" : "bg-gsn-50 text-gsn-700",
              )}
            >
              <ShoppingCart className="w-5 h-5" />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[1.15rem] h-[1.15rem] px-1 rounded-full bg-white text-gsn-800 text-[10px] font-bold flex items-center justify-center">
                  {cart.length}
                </span>
              )}
            </span>
            <span className="flex-1 text-left min-w-0">
              <span className="block text-sm font-semibold truncate">
                {cart.length === 0
                  ? "Carrinho vazio"
                  : `${fmtNum(totalPacks)} emb · ${fmtNum(totalUnits)} un`}
              </span>
              <span
                className={cn(
                  "block text-[11px] truncate",
                  cart.length > 0 ? "text-white/75" : "text-gray-400",
                )}
              >
                {!customer
                  ? "Selecione o cliente"
                  : cart.length === 0
                    ? "Toque num produto para adicionar"
                    : customer.card_name}
              </span>
            </span>
            <span
              className={cn(
                "text-xs font-bold shrink-0",
                cart.length > 0 ? "text-white" : "text-gsn-700",
              )}
            >
              Ver pedido
            </span>
          </button>
        </div>
      </div>

      {/* Sheet produto */}
      {activeProduct && (
        <Sheet onClose={closeProduct} title="Adicionar produto">
          <div className="flex gap-3 mb-4">
            <div className="h-16 w-16 rounded-xl bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
              {activeProduct.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeProduct.imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <Boxes className="w-7 h-7 text-gray-300" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 leading-snug">
                {activeProduct.name}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {activeProduct.category ?? "Catálogo"} · {activeProduct.variants.length}{" "}
                embalagens
              </p>
            </div>
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">
            Embalagem
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
            {activeProduct.variants.map((v) => {
              const selected = sheetVariant?.sku === v.sku;
              const cartQty = cartMap.get(v.sku)?.quantity;
              return (
                <button
                  key={v.sku}
                  type="button"
                  onClick={() => setSheetSku(v.sku)}
                  className={cn(
                    "min-h-[3.25rem] rounded-xl border px-3 py-2.5 text-left transition active:scale-[0.98]",
                    selected
                      ? "border-gsn-700 bg-gsn-50 ring-1 ring-gsn-700/30"
                      : "border-gray-200 bg-white hover:border-gray-300",
                    !v.inStock && "opacity-70",
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        v.inStock ? "bg-emerald-500" : "bg-red-400",
                      )}
                    />
                    <span className="text-sm font-semibold text-gray-900">
                      {packagingShort(v.packagingType, v.unitsPerPack)}
                    </span>
                    {cartQty ? (
                      <span className="ml-auto text-[10px] font-bold text-gsn-700">
                        ×{cartQty}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1 font-mono truncate">
                    {v.sku}
                    {v.inStock
                      ? ` · ${fmtNum(v.stockQuantity)} disp.`
                      : " · sem estoque"}
                  </p>
                </button>
              );
            })}
          </div>

          {sheetVariant && (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">
                Quantidade
              </p>
              <div className="flex items-center gap-3 mb-2">
                <div className="inline-flex items-center rounded-xl border border-gray-200 bg-gray-50">
                  <button
                    type="button"
                    onClick={() => setSheetQty((q) => Math.max(1, q - 1))}
                    className="h-12 w-12 inline-flex items-center justify-center text-gray-600 active:bg-gray-100 rounded-l-xl"
                    aria-label="Diminuir"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={sheetQty}
                    onChange={(e) =>
                      setSheetQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))
                    }
                    className="w-16 h-12 text-center text-base font-semibold bg-transparent border-0 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    aria-label="Quantidade de embalagens"
                  />
                  <button
                    type="button"
                    onClick={() => setSheetQty((q) => q + 1)}
                    className="h-12 w-12 inline-flex items-center justify-center text-gray-600 active:bg-gray-100 rounded-r-xl"
                    aria-label="Aumentar"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-sm text-gray-600 min-w-0">
                  <p className="font-medium truncate">
                    {packagingLabel(
                      sheetVariant.packagingType,
                      sheetVariant.unitsPerPack,
                    )}
                  </p>
                  <p className="text-xs text-gray-400">
                    {sheetVariant.unitsPerPack > 1
                      ? `= ${fmtNum(sheetQty * sheetVariant.unitsPerPack)} unidades`
                      : "unidade avulsa"}
                  </p>
                </div>
              </div>
            </>
          )}

          <div className="sticky bottom-0 -mx-4 px-4 pt-3 pb-1 bg-gradient-to-t from-white via-white to-transparent">
            <button
              type="button"
              onClick={confirmSheetAdd}
              disabled={!sheetVariant}
              className="w-full h-12 rounded-xl bg-gsn-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-gsn-800 disabled:opacity-50 active:scale-[0.99] transition"
            >
              <Plus className="w-4 h-4" />
              Adicionar ao pedido
            </button>
          </div>
        </Sheet>
      )}

      {/* Sheet carrinho mobile */}
      {cartOpen && (
        <div className="lg:hidden">
          <Sheet onClose={() => setCartOpen(false)} title="Seu pedido">
            <CartPanel
              cart={cart}
              customer={customer}
              notes={notes}
              dueDate={dueDate}
              totalPacks={totalPacks}
              totalUnits={totalUnits}
              canSubmit={canSubmit}
              submitting={submitting}
              onNotes={setNotes}
              onDueDate={setDueDate}
              onQty={setQty}
              onRemove={removeLine}
              onSubmit={submit}
              embedded
            />
          </Sheet>
        </div>
      )}
    </div>
  );
}

function StepPill({
  n,
  label,
  done,
  active,
  onClick,
}: {
  n: number;
  label: string;
  done?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-left border transition",
        done
          ? "bg-emerald-50 border-emerald-100 text-emerald-800"
          : active
            ? "bg-gsn-50 border-gsn-100 text-gsn-800"
            : "bg-white/70 border-cockpit-border text-gray-500",
      )}
    >
      <span
        className={cn(
          "inline-flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold shrink-0",
          done
            ? "bg-emerald-600 text-white"
            : active
              ? "bg-gsn-700 text-white"
              : "bg-gray-200 text-gray-600",
        )}
      >
        {done ? <Check className="w-3 h-3" /> : n}
      </span>
      <span className="text-[11px] font-semibold truncate">{label}</span>
    </button>
  );
}

function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom-4 fade-in duration-200"
      >
        <div className="flex justify-center sm:hidden mb-2">
          <span className="h-1 w-10 rounded-full bg-gray-200" />
        </div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 inline-flex items-center justify-center rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CartPanel({
  cart,
  customer,
  notes,
  dueDate,
  totalPacks,
  totalUnits,
  canSubmit,
  submitting,
  onNotes,
  onDueDate,
  onQty,
  onRemove,
  onSubmit,
  embedded,
}: {
  cart: CartLine[];
  customer: CustomerRow | null;
  notes: string;
  dueDate: string;
  totalPacks: number;
  totalUnits: number;
  canSubmit: boolean;
  submitting: boolean;
  onNotes: (v: string) => void;
  onDueDate: (v: string) => void;
  onQty: (sku: string, qty: number) => void;
  onRemove: (sku: string) => void;
  onSubmit: () => void;
  embedded?: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-white overflow-hidden",
        !embedded && "rounded-2xl border border-cockpit-border shadow-sm",
      )}
    >
      {!embedded && (
        <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-gsn-700" />
            Pedido
          </h2>
          {cart.length > 0 && (
            <span className="text-[11px] text-gray-500 tabular-nums">
              {fmtNum(totalPacks)} emb · {fmtNum(totalUnits)} un
            </span>
          )}
        </div>
      )}

      {embedded && cart.length > 0 && (
        <p className="text-xs text-gray-500 mb-3 tabular-nums">
          {cart.length} {cart.length === 1 ? "item" : "itens"} · {fmtNum(totalPacks)} emb ·{" "}
          {fmtNum(totalUnits)} un
        </p>
      )}

      <div className={cn(embedded ? "max-h-[40dvh]" : "max-h-[22rem]", "overflow-y-auto")}>
        {cart.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
              <Package className="w-6 h-6 text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-500">Nenhum item ainda</p>
            <p className="text-xs text-gray-400 mt-1">
              Toque em um produto para escolher a embalagem
            </p>
          </div>
        ) : (
          <ul className={cn("divide-y divide-gray-50", embedded ? "" : "px-0")}>
            {cart.map((l) => (
              <li key={l.sku} className="px-1 py-3 sm:px-4 first:pt-1">
                <div className="flex items-start gap-2.5">
                  <div className="h-11 w-11 rounded-lg bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                    {l.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Boxes className="w-4 h-4 text-gray-300" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 line-clamp-2">
                          {l.name}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {packagingLabel(l.packagingType, l.unitsPerPack)} · {l.sku}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemove(l.sku)}
                        className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 shrink-0"
                        aria-label="Remover"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="inline-flex items-center rounded-lg border border-gray-200">
                        <button
                          type="button"
                          onClick={() => onQty(l.sku, l.quantity - 1)}
                          className="h-9 w-9 inline-flex items-center justify-center text-gray-500"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          min={1}
                          inputMode="numeric"
                          value={l.quantity}
                          onChange={(e) =>
                            onQty(l.sku, Math.floor(Number(e.target.value) || 0))
                          }
                          className="w-12 h-9 text-center text-sm font-semibold border-0 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          onClick={() => onQty(l.sku, l.quantity + 1)}
                          className="h-9 w-9 inline-flex items-center justify-center text-gray-500"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {l.unitsPerPack > 1 && (
                        <span className="text-[11px] text-gray-400">
                          = {fmtNum(l.quantity * l.unitsPerPack)} un
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={cn("space-y-3", embedded ? "pt-3" : "p-4 border-t border-gray-100")}>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-1.5 mb-1.5">
            <CalendarDays className="w-3.5 h-3.5" /> Entrega
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => onDueDate(e.target.value)}
            className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-gsn-700/30"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5 block">
            Observações
          </label>
          <textarea
            value={notes}
            onChange={(e) => onNotes(e.target.value)}
            rows={2}
            placeholder="Condições, instruções…"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-gsn-700/30 resize-none"
          />
        </div>

        {!customer && cart.length > 0 && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 flex items-start gap-2">
            <User className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            Selecione o cliente para criar o pedido.
          </p>
        )}

        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="w-full h-12 rounded-xl text-sm font-semibold text-white bg-gsn-700 hover:bg-gsn-800 transition disabled:opacity-45 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 active:scale-[0.99]"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          Criar pedido no SAP
        </button>
      </div>
    </div>
  );
}
