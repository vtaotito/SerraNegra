"use client";

import { BadgeCheck, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isValidEmail } from "./types";
import { Spinner } from "./Spinner";

export function EmailVerifyStep({
  cardName,
  maskedEmail,
  emailInput,
  loading,
  onEmailChange,
  onSubmit,
}: {
  cardName?: string;
  maskedEmail?: string;
  emailInput: string;
  loading: boolean;
  onEmailChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
        <BadgeCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
        <div>
          <p className="font-medium text-emerald-800">{cardName}</p>
          <p className="text-emerald-700">
            Cliente identificado na Garrafaria Serra Negra.
          </p>
        </div>
      </div>

      {maskedEmail && (
        <p className="text-sm text-muted-foreground">
          Enviaremos um código para o e-mail cadastrado{" "}
          <span className="font-medium text-foreground">{maskedEmail}</span>.
          Confirme-o abaixo para continuar.
        </p>
      )}

      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          Seu e-mail
        </label>
        <Input
          id="email"
          type="email"
          placeholder="seu@email.com"
          value={emailInput}
          onChange={(e) => onEmailChange(e.target.value)}
          disabled={loading}
          autoFocus
          className="h-11"
        />
      </div>

      <Button
        type="submit"
        className="w-full h-11"
        disabled={loading || !isValidEmail(emailInput)}
      >
        {loading ? <Spinner /> : <Mail className="h-4 w-4" />}
        {loading ? "Enviando..." : "Confirmar e enviar código"}
      </Button>
    </form>
  );
}
