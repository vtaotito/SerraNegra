"use client";

import { Check, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PendingKind } from "./types";

export function PendingStep({
  pendingKind,
  onRestart,
}: {
  pendingKind: PendingKind;
  onRestart: () => void;
}) {
  const isEmailAccess = pendingKind === "email-access";

  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 border-2 border-emerald-200">
        <Check className="h-8 w-8 text-emerald-600" />
      </div>
      <div className="space-y-2">
        <p className="text-base font-medium text-foreground">
          {isEmailAccess
            ? "Solicitação de acesso enviada!"
            : "Cadastro enviado com sucesso!"}
        </p>
        <p className="text-sm text-muted-foreground">
          {isEmailAccess
            ? "Recebemos sua solicitação de acesso. A Garrafaria Serra Negra vai validar e você receberá um e-mail quando o acesso for liberado para fazer o primeiro acesso."
            : "Sua solicitação foi recebida e será analisada pela nossa equipe comercial. Você receberá um e-mail quando o cadastro for aprovado."}
        </p>
      </div>

      <div className="flex items-center justify-center gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        Status atual: em análise pela equipe da Garrafaria
      </div>

      <Button onClick={onRestart} variant="outline" className="mt-2">
        Voltar ao início
      </Button>
    </div>
  );
}
