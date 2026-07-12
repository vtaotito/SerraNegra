"use client";

import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFavorites } from "@/lib/favorites/useFavorites";

type Variant = "overlay" | "inline";

interface FavoriteButtonProps {
  sku: string;
  variant?: Variant;
  className?: string;
  /** Rótulo textual ao lado do coração (apenas na variante inline). */
  showLabel?: boolean;
}

/**
 * Botão de favoritar reutilizável. `overlay` posiciona-se no canto de um card
 * (sobre a imagem); `inline` fica ao lado de um título ou de ações.
 */
export function FavoriteButton({
  sku,
  variant = "overlay",
  className,
  showLabel = false,
}: FavoriteButtonProps) {
  const { isFavorite, toggle } = useFavorites();
  const active = isFavorite(sku);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    toggle(sku);
  }

  const base =
    "inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gsn-brand/40";

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={active}
        aria-label={active ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        className={cn(
          base,
          "gap-1.5 rounded-md px-2.5 h-9 text-sm font-medium",
          active
            ? "text-rose-600 hover:bg-rose-50"
            : "text-muted-foreground hover:bg-muted hover:text-rose-600",
          className,
        )}
      >
        <Heart className={cn("h-4 w-4", active && "fill-rose-600")} />
        {showLabel && <span>{active ? "Favorito" : "Favoritar"}</span>}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={active}
      aria-label={active ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      className={cn(
        base,
        "h-9 w-9 rounded-full bg-white/90 shadow-sm backdrop-blur hover:bg-white",
        active ? "text-rose-600" : "text-muted-foreground hover:text-rose-600",
        className,
      )}
    >
      <Heart className={cn("h-[18px] w-[18px]", active && "fill-rose-600")} />
    </button>
  );
}
