"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ShoppingCart,
  Bell,
  Package,
  Minus,
  Plus,
  CheckCircle2,
  Loader2,
  Tag,
  Box,
  Barcode,
  Layers,
} from "lucide-react";
import {
  fetchProductDetail,
  notifyWhenAvailable,
  fmtBRL,
  type B2BProductDetail,
} from "@/lib/b2b-api";
import { useCart } from "@/contexts/CartContext";
import { ErrorState } from "@/components/cockpit/DataState";

export default function ProdutoDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const { addItem } = useCart();
  const sku = decodeURIComponent(String(params.sku));

  const [product, setProduct] = useState<B2BProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [notified, setNotified] = useState(false);

  useEffect(() => {
    if (!sku) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchProductDetail(sku);
        if (!cancelled) setProduct(res);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro ao carregar produto");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sku]);

  const handleAdd = () => {
    if (!product) return;
    addItem(
      {
        sku: product.sku,
        name: product.name,
        imageUrl: product.imageUrl,
        price: product.price,
        unitOfMeasure: product.unitOfMeasure,
      },
      qty,
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleNotify = async () => {
    if (!product) return;
    setNotifying(true);
    try {
      await notifyWhenAvailable(product.sku);
      setNotified(true);
    } catch {
      // silencioso
    } finally {
      setNotifying(false);
    }
  };

  if (loading) return <DetailSkeleton />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  if (!product) return null;

  return (
    <div className="space-y-6">
      <Link
        href="/portal/catalogo"
        className="inline-flex items-center gap-1.5 text-sm text-cockpit-muted hover:text-cockpit-accent transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar ao Catálogo
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Imagem */}
        <div className="rounded-2xl border border-cockpit-border bg-white p-6 flex items-center justify-center aspect-square">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <Package className="w-24 h-24 text-cockpit-muted/30" />
          )}
        </div>

        {/* Informações */}
        <div className="space-y-6">
          <div>
            {product.category && (
              <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-cockpit-accent/10 text-cockpit-accent mb-2">
                {product.category}
              </span>
            )}
            <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
          </div>

          {/* Detalhes */}
          <div className="grid grid-cols-2 gap-3">
            <InfoItem icon={<Barcode className="w-4 h-4" />} label="SKU" value={product.sku} />
            {product.ean && (
              <InfoItem icon={<Tag className="w-4 h-4" />} label="EAN" value={product.ean} />
            )}
            <InfoItem icon={<Layers className="w-4 h-4" />} label="Unidade" value={product.unitOfMeasure} />
            {product.packagingType && (
              <InfoItem icon={<Box className="w-4 h-4" />} label="Embalagem" value={product.packagingType} />
            )}
            {product.unitsPerPack && (
              <InfoItem icon={<Package className="w-4 h-4" />} label="Un/Pacote" value={String(product.unitsPerPack)} />
            )}
          </div>

          {/* Preço e estoque */}
          <div className="rounded-xl border border-cockpit-border bg-cockpit-bg/50 p-5">
            <div className="flex items-end justify-between mb-4">
              <div>
                <p className="text-sm text-cockpit-muted mb-0.5">Preço</p>
                <p className="text-3xl font-bold text-gray-900">{fmtBRL(product.price)}</p>
              </div>
              {product.inStock ? (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-sm font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  {product.stockQuantity} disponíveis
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 text-red-600 text-sm font-medium">
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  Indisponível
                </span>
              )}
            </div>

            {product.inStock ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center border border-cockpit-border rounded-lg bg-white">
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="p-2.5 hover:bg-cockpit-bg transition-colors rounded-l-lg"
                    aria-label="Diminuir"
                  >
                    <Minus className="w-4 h-4 text-gray-600" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 text-center text-sm font-medium text-gray-900 border-x border-cockpit-border py-2.5 focus:outline-none tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={() => setQty((q) => q + 1)}
                    className="p-2.5 hover:bg-cockpit-bg transition-colors rounded-r-lg"
                    aria-label="Aumentar"
                  >
                    <Plus className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleAdd}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                    added
                      ? "bg-emerald-500 text-white"
                      : "bg-cockpit-accent text-white hover:bg-cockpit-accentHover"
                  }`}
                >
                  {added ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Adicionado ao Carrinho!
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4" /> Adicionar ao Carrinho
                    </>
                  )}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleNotify}
                disabled={notifying || notified}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                  notified
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-cockpit-accent/10 text-cockpit-accent hover:bg-cockpit-accent/20"
                }`}
              >
                {notifying && <Loader2 className="w-4 h-4 animate-spin" />}
                {notified ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Você será avisado!
                  </>
                ) : (
                  <>
                    <Bell className="w-4 h-4" /> Avise-me quando disponível
                  </>
                )}
              </button>
            )}
          </div>

          {/* Descrição */}
          {(product.fullDescription || product.description) && (
            <div>
              <h2 className="text-sm font-semibold text-gray-900 mb-2">Descrição</h2>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {product.fullDescription || product.description}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-cockpit-bg/50 border border-cockpit-border">
      <span className="text-cockpit-muted">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] text-cockpit-muted uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium text-gray-900 truncate">{value}</p>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse motion-reduce:animate-none">
      <div className="h-4 w-28 bg-cockpit-border rounded" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="rounded-2xl border border-cockpit-border bg-white aspect-square" />
        <div className="space-y-4">
          <div className="h-5 w-20 bg-cockpit-border rounded-full" />
          <div className="h-8 w-64 bg-cockpit-border rounded" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 bg-cockpit-border rounded-lg" />
            ))}
          </div>
          <div className="h-36 bg-cockpit-border rounded-xl" />
        </div>
      </div>
    </div>
  );
}
