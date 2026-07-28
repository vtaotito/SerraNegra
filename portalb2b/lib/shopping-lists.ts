"use client";

import { useCallback, useEffect, useState } from "react";
import type { CartItem } from "@/lib/cart/context";

const STORAGE_KEY = "b2b_shopping_lists";

export interface ShoppingListItem {
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  unitsPerPack: number;
}

export interface ShoppingList {
  id: string;
  name: string;
  items: ShoppingListItem[];
  updatedAt: string;
}

function loadLists(): ShoppingList[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ShoppingList[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (l) => l && typeof l.id === "string" && typeof l.name === "string" && Array.isArray(l.items),
    );
  } catch {
    return [];
  }
}

function persist(lists: ShoppingList[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
  } catch {
    /* quota */
  }
}

function newId(): string {
  return `list_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function cartItemsToListItems(items: CartItem[]): ShoppingListItem[] {
  return items.map((i) => ({
    sku: i.sku,
    name: i.name,
    unit: i.unit,
    quantity: i.quantity,
    unitsPerPack: i.unitsPerPack > 0 ? i.unitsPerPack : 1,
  }));
}

/**
 * Listas de compra persistidas no dispositivo (templates de recompra).
 */
export function useShoppingLists() {
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLists(loadLists());
    setReady(true);
  }, []);

  const saveFromCart = useCallback((name: string, items: CartItem[]) => {
    const trimmed = name.trim();
    if (!trimmed || items.length === 0) return null;
    const list: ShoppingList = {
      id: newId(),
      name: trimmed,
      items: cartItemsToListItems(items),
      updatedAt: new Date().toISOString(),
    };
    setLists((prev) => {
      const next = [list, ...prev].slice(0, 30);
      persist(next);
      return next;
    });
    return list;
  }, []);

  const renameList = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setLists((prev) => {
      const next = prev.map((l) =>
        l.id === id ? { ...l, name: trimmed, updatedAt: new Date().toISOString() } : l,
      );
      persist(next);
      return next;
    });
  }, []);

  const deleteList = useCallback((id: string) => {
    setLists((prev) => {
      const next = prev.filter((l) => l.id !== id);
      persist(next);
      return next;
    });
  }, []);

  const updateListFromCart = useCallback((id: string, items: CartItem[]) => {
    if (items.length === 0) return;
    setLists((prev) => {
      const next = prev.map((l) =>
        l.id === id
          ? {
              ...l,
              items: cartItemsToListItems(items),
              updatedAt: new Date().toISOString(),
            }
          : l,
      );
      persist(next);
      return next;
    });
  }, []);

  return {
    lists,
    ready,
    saveFromCart,
    renameList,
    deleteList,
    updateListFromCart,
  };
}
