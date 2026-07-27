"use client";

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

export interface CartItem {
  sku: string;
  name: string;
  unit: string;
  /** Quantidade total em UNIDADES. */
  quantity: number;
  /** Unidades por embalagem (passo de compra; 1 = unidade avulsa). */
  unitsPerPack: number;
  /**
   * Estoque disponível em UNIDADES (informativo, 0 = desconhecido).
   * NÃO limita a quantidade pedível — o cliente pode pedir acima do estoque; o
   * excedente é sinalizado ao vendedor. Mantido apenas para exibir avisos.
   */
  maxUnits: number;
}

interface CartState {
  items: CartItem[];
  totalItems: number;
}

const STORAGE_KEY = "b2b_cart";

/**
 * Normaliza a quantidade para inteiro >= 0. NÃO aplica teto de estoque: o cliente
 * pode pedir acima do disponível (o excedente vira interação com o vendedor).
 */
function clampQty(quantity: number): number {
  return Math.max(0, Math.round(quantity));
}

function loadInitialState(): CartState {
  if (typeof window === "undefined") return { items: [], totalItems: 0 };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { items: [], totalItems: 0 };
    const items = JSON.parse(raw) as CartItem[];
    if (!Array.isArray(items)) return { items: [], totalItems: 0 };
    const clean: CartItem[] = items
      .filter((i) => i && typeof i.sku === "string" && typeof i.quantity === "number")
      .map((i) => ({
        sku: i.sku,
        name: i.name,
        unit: i.unit ?? "UN",
        quantity: i.quantity,
        unitsPerPack:
          typeof i.unitsPerPack === "number" && i.unitsPerPack > 0 ? i.unitsPerPack : 1,
        maxUnits: typeof i.maxUnits === "number" && i.maxUnits > 0 ? i.maxUnits : 0,
      }));
    return { items: clean, totalItems: clean.reduce((s, i) => s + i.quantity, 0) };
  } catch {
    return { items: [], totalItems: 0 };
  }
}

type CartAction =
  | { type: "ADD"; item: Omit<CartItem, "quantity">; quantity: number }
  | { type: "UPDATE_QTY"; sku: string; quantity: number }
  | { type: "REMOVE"; sku: string }
  | { type: "CLEAR" };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD": {
      const existing = state.items.find((i) => i.sku === action.item.sku);
      // O item recebido traz os limites de estoque mais recentes do catálogo.
      const maxUnits = action.item.maxUnits ?? 0;
      const unitsPerPack = action.item.unitsPerPack ?? 1;
      let items: CartItem[];
      if (existing) {
        items = state.items.map((i) =>
          i.sku === action.item.sku
            ? {
                ...i,
                ...action.item,
                unitsPerPack,
                maxUnits,
                quantity: clampQty(i.quantity + action.quantity),
              }
            : i,
        );
      } else {
        items = [
          ...state.items,
          { ...action.item, unitsPerPack, maxUnits, quantity: clampQty(action.quantity) },
        ];
      }
      return { items, totalItems: items.reduce((s, i) => s + i.quantity, 0) };
    }
    case "UPDATE_QTY": {
      const items = action.quantity <= 0
        ? state.items.filter((i) => i.sku !== action.sku)
        : state.items.map((i) =>
            i.sku === action.sku ? { ...i, quantity: clampQty(action.quantity) } : i,
          );
      return { items, totalItems: items.reduce((s, i) => s + i.quantity, 0) };
    }
    case "REMOVE": {
      const items = state.items.filter((i) => i.sku !== action.sku);
      return { items, totalItems: items.reduce((s, i) => s + i.quantity, 0) };
    }
    case "CLEAR":
      return { items: [], totalItems: 0 };
    default:
      return state;
  }
}

interface CartContextType extends CartState {
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  updateQuantity: (sku: string, quantity: number) => void;
  removeItem: (sku: string) => void;
  clearCart: () => void;
  getItem: (sku: string) => CartItem | undefined;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    cartReducer,
    undefined as unknown as CartState,
    loadInitialState,
  );

  // Persiste o carrinho para que o cliente nao perca o pedido em andamento
  // ao recarregar a pagina ou navegar entre as telas.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
    } catch {
      /* ignora cota/erros de storage */
    }
  }, [state.items]);

  const addItem = useCallback((item: Omit<CartItem, "quantity">, quantity = 1) => {
    dispatch({ type: "ADD", item, quantity });
  }, []);

  const updateQuantity = useCallback((sku: string, quantity: number) => {
    dispatch({ type: "UPDATE_QTY", sku, quantity });
  }, []);

  const removeItem = useCallback((sku: string) => {
    dispatch({ type: "REMOVE", sku });
  }, []);

  const clearCart = useCallback(() => {
    dispatch({ type: "CLEAR" });
  }, []);

  const getItem = useCallback(
    (sku: string) => state.items.find((i) => i.sku === sku),
    [state.items]
  );

  return (
    <CartContext.Provider value={{ ...state, addItem, updateQuantity, removeItem, clearCart, getItem }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
