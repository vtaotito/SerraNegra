"use client";

import { useState } from "react";
import Link from "next/link";
import { ShoppingCart, Bell, Minus, Plus, Package } from "lucide-react";
import type { B2BCatalogItem } from "@/lib/b2b-api";
import { fmtBRL } from "@/lib/b2b-api";
import { useCart } from "@/contexts/CartContext";

interface ProductCardProps {
  product: B2BCatalogItem;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
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
    setTimeout(() => setAdded(false), 1500);
    setQty(1);
  };

  return (
    <div className="rounded-xl border border-cockpit-border bg-white shadow-sm hover:border-cockpit-accent/30 motion-safe:transition-all duration-200 flex flex-col overflow-hidden">
      <Link
        href={`/portal/catalogo/${encodeURIComponent(product.sku)}`}
        className="block p-4 pb-0"
      >
        <div className="aspect-square bg-cockpit-bg rounded-lg flex items-center justify-center mb-3 overflow-hidden">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-contain p-2"
              loading="lazy"
            />
          ) : (
            <Package className="w-12 h-12 text-cockpit-muted/40" />
          )}
        </div>
        {product.category && (
          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-cockpit-accent/10 text-cockpit-accent mb-1.5">
            {product.category}
          </span>
        )}
        <h3 className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug mb-1">
          {product.name}
        </h3>
        <p className="text-xs text-cockpit-muted mb-2">{product.sku}</p>
      </Link>

      <div className="mt-auto px-4 pb-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-base font-bold text-gray-900">{fmtBRL(product.price)}</span>
          {product.inStock ? (
            <span className="flex items-center gap-1 text-xs text-emerald-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Em estoque
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-red-500">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              Indisponível
            </span>
          )}
        </div>

        {product.inStock ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-cockpit-border rounded-lg">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="p-1.5 hover:bg-cockpit-bg transition-colors rounded-l-lg"
                aria-label="Diminuir"
              >
                <Minus className="w-3.5 h-3.5 text-gray-600" />
              </button>
              <span className="px-3 text-sm font-medium text-gray-900 tabular-nums min-w-[2rem] text-center">
                {qty}
              </span>
              <button
                type="button"
                onClick={() => setQty((q) => q + 1)}
                className="p-1.5 hover:bg-cockpit-bg transition-colors rounded-r-lg"
                aria-label="Aumentar"
              >
                <Plus className="w-3.5 h-3.5 text-gray-600" />
              </button>
            </div>
            <button
              type="button"
              onClick={handleAdd}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                added
                  ? "bg-emerald-500 text-white"
                  : "bg-cockpit-accent text-white hover:bg-cockpit-accentHover"
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              {added ? "Adicionado!" : "Adicionar"}
            </button>
          </div>
        ) : (
          <Link
            href={`/portal/catalogo/${encodeURIComponent(product.sku)}`}
            className="flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-lg text-xs font-medium border border-cockpit-border text-cockpit-muted hover:bg-cockpit-bg transition-colors"
          >
            <Bell className="w-3.5 h-3.5" />
            Avise-me
          </Link>
        )}
      </div>
    </div>
  );
}
