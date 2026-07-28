"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  useSalesperson,
  whatsappHref,
  type Salesperson,
} from "@/lib/salesperson";
import { Mail, MessageCircle, Phone, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

export function SalespersonCard({
  className,
  compact = false,
  salesperson: salespersonProp,
  loading: loadingProp,
}: {
  className?: string;
  compact?: boolean;
  /** Quando omitido, busca via hook. */
  salesperson?: Salesperson | null;
  loading?: boolean;
}) {
  const hook = useSalesperson();
  const salesperson = salespersonProp !== undefined ? salespersonProp : hook.salesperson;
  const loading = loadingProp !== undefined ? loadingProp : hook.loading;

  if (loading) return null;
  if (
    !salesperson ||
    !(salesperson.name || salesperson.whatsapp || salesperson.phone || salesperson.email)
  ) {
    return null;
  }

  const wa = whatsappHref(salesperson.whatsapp);

  return (
    <Card className={cn(className)}>
      <CardContent className={cn(compact ? "p-3" : "p-4")}>
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gsn-brand/10">
            <UserRound className="h-4 w-4 text-gsn-brand" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Seu vendedor
            </p>
            <p className="truncate text-sm font-semibold text-gsn-text">
              {salesperson.name ?? `Vendedor ${salesperson.code}`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp
            </a>
          )}
          {salesperson.phone && (
            <a
              href={`tel:${salesperson.phone.replace(/\D/g, "")}`}
              className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium text-gsn-text transition hover:bg-muted"
            >
              <Phone className="h-3.5 w-3.5" />
              {salesperson.phone}
            </a>
          )}
          {salesperson.email && (
            <a
              href={`mailto:${salesperson.email}`}
              className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium text-gsn-text transition hover:bg-muted"
            >
              <Mail className="h-3.5 w-3.5" />
              E-mail
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
