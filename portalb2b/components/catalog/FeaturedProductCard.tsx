"use client";

import Link from "next/link";
import Image from "next/image";
import { Package, PackageCheck, PackageX } from "lucide-react";
import { getProductImageBySku } from "@/lib/product-images";
import { cn } from "@/lib/utils";
import { FavoriteButton } from "@/components/catalog/FavoriteButton";

export interface FeaturedProduct {
  sku: string;
  name: string;
  imageUrl?: string | null;
  imageThumbUrl?: string | null;
  inStock?: boolean;
  orderCount?: number;
}

/**
 * Card compacto de produto usado na home (destaques, favoritos e mais
 * comprados) com botão de favoritar sobreposto. Mantém o layout enxuto do
 * catálogo real (imagem + nome), sem preço (modelo B2B precifica no pedido).
 */
export function FeaturedProductCard({ product }: { product: FeaturedProduct }) {
  const imgSrc = product.imageThumbUrl ?? product.imageUrl ?? getProductImageBySku(product.sku);

  return (
    <div className="group relative flex h-full flex-col rounded-lg border bg-white p-3 text-center transition-all hover:border-gsn-brand/30 hover:shadow-md">
      <FavoriteButton sku={product.sku} variant="overlay" className="absolute right-2 top-2 z-10" />
      <Link href={`/catalogo/${product.sku}`} className="flex h-full flex-col">
        <div className="relative mb-2 flex h-24 items-center justify-center">
          {imgSrc ? (
            <Image
              src={imgSrc}
              alt={product.name}
              fill
              className="object-contain transition-transform group-hover:scale-105"
              sizes="150px"
            />
          ) : (
            <Package className="h-10 w-10 text-muted-foreground/20" />
          )}
        </div>
        <p className="mb-1 line-clamp-2 text-xs font-medium leading-tight text-gsn-text">
          {product.name}
        </p>
        <div className="mt-auto flex items-center justify-center gap-1 pt-1">
          {product.inStock ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700">
              <PackageCheck className="h-3 w-3" /> Em estoque
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
              <PackageX className="h-3 w-3" /> Sem estoque
            </span>
          )}
          {typeof product.orderCount === "number" && product.orderCount > 0 && (
            <span
              className={cn(
                "inline-flex items-center rounded-full bg-gsn-brand/10 px-1.5 text-[10px] font-medium text-gsn-brand-dark",
              )}
            >
              {product.orderCount}x
            </span>
          )}
        </div>
      </Link>
    </div>
  );
}
