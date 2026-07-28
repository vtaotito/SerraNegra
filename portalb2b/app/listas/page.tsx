"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCart } from "@/lib/cart/context";
import { useShoppingLists, type ShoppingList } from "@/lib/shopping-lists";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import {
  ListOrdered,
  Package,
  ShoppingCart,
  Trash2,
  Pencil,
  ArrowRight,
} from "lucide-react";

export default function ListasPage() {
  const { lists, ready, deleteList, renameList } = useShoppingLists();
  const { addItem, clearCart, items: cartItems } = useCart();
  const router = useRouter();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  function loadList(list: ShoppingList, replace: boolean) {
    if (replace) clearCart();
    for (const item of list.items) {
      addItem(
        {
          sku: item.sku,
          name: item.name,
          unit: item.unit,
          unitsPerPack: item.unitsPerPack,
          maxUnits: 0,
        },
        item.quantity,
      );
    }
    toast.success(`Lista "${list.name}" carregada`, {
      description: `${list.items.length} produto(s) no carrinho`,
      action: {
        label: "Ver carrinho",
        onClick: () => router.push("/carrinho"),
      },
    });
    router.push("/carrinho");
  }

  function startRename(list: ShoppingList) {
    setRenamingId(list.id);
    setRenameValue(list.name);
  }

  function commitRename(id: string) {
    if (renameValue.trim()) {
      renameList(id, renameValue);
      toast.success("Lista renomeada");
    }
    setRenamingId(null);
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Header />
      <main className="mx-auto max-w-3xl px-4 pt-6 pb-24 sm:px-6 lg:px-8 md:pb-8">
        <Breadcrumb
          items={[
            { label: "Início", href: "/" },
            { label: "Listas de compra" },
          ]}
          className="mb-4"
        />

        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gsn-text">
              <ListOrdered className="h-7 w-7 text-gsn-brand" />
              Listas de compra
            </h1>
            <p className="text-muted-foreground">
              Modelos salvos neste dispositivo para repor o pedido com um clique
            </p>
          </div>
          {cartItems.length > 0 && (
            <Link href="/carrinho">
              <Button variant="outline" size="sm" className="border-gsn-brand text-gsn-brand-dark">
                <ShoppingCart className="mr-1.5 h-4 w-4" />
                Ir ao carrinho
              </Button>
            </Link>
          )}
        </div>

        {!ready ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : lists.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-12 text-center">
              <ListOrdered className="mb-3 h-10 w-10 text-muted-foreground/30" />
              <h3 className="text-lg font-semibold">Nenhuma lista salva</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Monte um carrinho e use &quot;Salvar como lista&quot; para criar um modelo de
                recompra.
              </p>
              <Link href="/catalogo" className="mt-4">
                <Button className="bg-gsn-brand text-white hover:bg-gsn-brand-dark">
                  <Package className="mr-1.5 h-4 w-4" />
                  Ir ao catálogo
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {lists.map((list) => (
              <Card key={list.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {renamingId === list.id ? (
                        <form
                          className="flex gap-2"
                          onSubmit={(e) => {
                            e.preventDefault();
                            commitRename(list.id);
                          }}
                        >
                          <Input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            autoFocus
                            aria-label="Nome da lista"
                          />
                          <Button type="submit" size="sm">
                            OK
                          </Button>
                        </form>
                      ) : (
                        <>
                          <h3 className="font-semibold text-gsn-text">{list.name}</h3>
                          <p className="text-xs text-muted-foreground">
                            {list.items.length} produto(s) · atualizada em{" "}
                            {formatDate(list.updatedAt)}
                          </p>
                        </>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Renomear"
                        onClick={() => startRename(list)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        aria-label="Excluir lista"
                        onClick={() => {
                          deleteList(list.id);
                          toast.success("Lista removida");
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {list.items.slice(0, 4).map((item) => (
                      <li key={item.sku} className="flex justify-between gap-2">
                        <span className="truncate">{item.name}</span>
                        <span className="flex-shrink-0 tabular-nums">
                          {item.quantity} {item.unit}
                        </span>
                      </li>
                    ))}
                    {list.items.length > 4 && (
                      <li className="text-xs">+{list.items.length - 4} outros</li>
                    )}
                  </ul>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      className="bg-gsn-brand text-white hover:bg-gsn-brand-dark"
                      onClick={() => loadList(list, true)}
                    >
                      <ShoppingCart className="mr-1.5 h-4 w-4" />
                      Carregar no carrinho
                      <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Button>
                    {cartItems.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => loadList(list, false)}
                      >
                        Somar ao carrinho
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
