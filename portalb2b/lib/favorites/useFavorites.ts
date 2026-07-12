"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { del, get, post } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/context";

export interface FavoriteItem {
  sku: string;
  name: string;
  imageUrl: string | null;
  imageThumbUrl: string | null;
  inStock: boolean;
  stockQuantity: number;
  category: string | null;
  unitOfMeasure: string;
  price: number;
}

interface FavoritesResponse {
  items: FavoriteItem[];
}

export const FAVORITES_QUERY_KEY = ["b2b-favorites"] as const;

/**
 * Hook central de favoritos: mantém a lista de favoritos do cliente em cache,
 * expõe um Set de SKUs para marcação rápida em qualquer tela e um `toggle`
 * otimista. A query só roda quando o cliente está autenticado.
 */
export function useFavorites() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<FavoritesResponse>({
    queryKey: FAVORITES_QUERY_KEY,
    queryFn: () => get<FavoritesResponse>("/b2b/favorites"),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const items = query.data?.items ?? [];

  const skuSet = useMemo(() => new Set(items.map((it) => it.sku)), [items]);

  const mutation = useMutation({
    mutationFn: async ({ sku, next }: { sku: string; next: boolean }) => {
      if (next) {
        await post("/b2b/favorites", { sku });
      } else {
        await del(`/b2b/favorites/${encodeURIComponent(sku)}`);
      }
    },
    onMutate: async ({ sku, next }) => {
      await queryClient.cancelQueries({ queryKey: FAVORITES_QUERY_KEY });
      const previous = queryClient.getQueryData<FavoritesResponse>(FAVORITES_QUERY_KEY);
      queryClient.setQueryData<FavoritesResponse>(FAVORITES_QUERY_KEY, (old) => {
        const list = old?.items ?? [];
        if (next) {
          if (list.some((it) => it.sku === sku)) return old ?? { items: list };
          const placeholder: FavoriteItem = {
            sku,
            name: sku,
            imageUrl: null,
            imageThumbUrl: null,
            inStock: false,
            stockQuantity: 0,
            category: null,
            unitOfMeasure: "UN",
            price: 0,
          };
          return { items: [placeholder, ...list] };
        }
        return { items: list.filter((it) => it.sku !== sku) };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(FAVORITES_QUERY_KEY, context.previous);
      }
      toast.error("Não foi possível atualizar os favoritos.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: FAVORITES_QUERY_KEY });
    },
  });

  function toggle(sku: string) {
    const next = !skuSet.has(sku);
    mutation.mutate({ sku, next });
    return next;
  }

  return {
    items,
    skuSet,
    isLoading: query.isLoading,
    isError: query.isError,
    toggle,
    isFavorite: (sku: string) => skuSet.has(sku),
    isPending: mutation.isPending,
  };
}
