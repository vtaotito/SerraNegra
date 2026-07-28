"use client";

import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useInbox } from "@/lib/messages/useInbox";
import { formatDateTime } from "@/lib/utils";
import { ArrowRight, ClipboardList, MessageSquare } from "lucide-react";

export default function MensagensPage() {
  const { items, unreadCount, isLoading, isError, isUnread } = useInbox();

  return (
    <div className="min-h-screen bg-muted/30">
      <Header />
      <main className="mx-auto max-w-3xl px-4 pt-6 pb-24 sm:px-6 lg:px-8 md:pb-8">
        <Breadcrumb
          items={[
            { label: "Início", href: "/" },
            { label: "Mensagens" },
          ]}
          className="mb-4"
        />

        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gsn-text">
            <MessageSquare className="h-7 w-7 text-gsn-brand" />
            Mensagens
          </h1>
          <p className="text-muted-foreground">
            Respostas da equipe de vendas nos seus pedidos
            {unreadCount > 0 ? ` · ${unreadCount} sem ler` : ""}
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <Card>
            <CardContent className="flex flex-col items-center py-12 text-center">
              <MessageSquare className="mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                Não foi possível carregar as mensagens.
              </p>
            </CardContent>
          </Card>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-12 text-center">
              <MessageSquare className="mb-3 h-10 w-10 text-muted-foreground/30" />
              <h3 className="text-lg font-semibold">Nenhuma conversa ainda</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Quando a equipe responder em um pedido, a mensagem aparece aqui.
              </p>
              <Link href="/pedidos" className="mt-4">
                <Button variant="outline" className="border-gsn-brand text-gsn-brand-dark">
                  <ClipboardList className="mr-1.5 h-4 w-4" />
                  Ver pedidos
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const unread = isUnread(item.docEntry);
              const label = item.docNum != null ? `#${item.docNum}` : `#${item.docEntry}`;
              return (
                <Link key={item.docEntry} href={`/pedidos/${item.docEntry}`}>
                  <Card
                    className={`transition-all hover:border-gsn-brand/30 hover:shadow-md ${
                      unread ? "border-gsn-brand/40 bg-gsn-brand/5" : ""
                    }`}
                  >
                    <CardContent className="flex items-start gap-3 p-4">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gsn-brand/10">
                        <MessageSquare className="h-5 w-5 text-gsn-brand" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-gsn-text">
                            Pedido {label}
                          </span>
                          {unread && (
                            <Badge className="bg-gsn-brand text-white hover:bg-gsn-brand">
                              Nova
                            </Badge>
                          )}
                          {item.lastAuthor === "seller" && !unread && (
                            <Badge variant="secondary">Resposta da equipe</Badge>
                          )}
                          {item.openRequests > 0 && (
                            <Badge variant="outline" className="border-amber-300 text-amber-800">
                              Solicitação em análise
                            </Badge>
                          )}
                        </div>
                        {item.lastBody && (
                          <p className="line-clamp-2 text-sm text-muted-foreground">
                            {item.lastBody}
                          </p>
                        )}
                        {item.lastAt && (
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(item.lastAt)}
                          </p>
                        )}
                      </div>
                      <ArrowRight className="mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
