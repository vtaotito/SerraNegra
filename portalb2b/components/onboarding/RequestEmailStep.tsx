"use client";

import { Info, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isValidEmail } from "./types";
import { Spinner } from "./Spinner";

export function RequestEmailStep({
  cardName,
  emailInput,
  contactInput,
  loading,
  onEmailChange,
  onContactChange,
  onSubmit,
}: {
  cardName?: string;
  emailInput: string;
  contactInput: string;
  loading: boolean;
  onEmailChange: (value: string) => void;
  onContactChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
        <p className="font-medium">{cardName}</p>
        <p className="text-muted-foreground">
          Encontramos sua empresa no nosso cadastro, mas ainda não há um e-mail
          de acesso vinculado a ela.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <p>
          Informe o e-mail que deseja usar para acessar o portal. A Garrafaria
          Serra Negra vai validar a solicitação e liberar seu acesso.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="access-email" className="text-sm font-medium">
          E-mail de acesso
        </label>
        <Input
          id="access-email"
          type="email"
          placeholder="seu@email.com"
          value={emailInput}
          onChange={(e) => onEmailChange(e.target.value)}
          disabled={loading}
          autoFocus
          className="h-11"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="access-contact" className="text-sm font-medium">
          Nome do contato{" "}
          <span className="text-muted-foreground font-normal">(opcional)</span>
        </label>
        <Input
          id="access-contact"
          type="text"
          placeholder="Responsável pela conta"
          value={contactInput}
          onChange={(e) => onContactChange(e.target.value)}
          disabled={loading}
          className="h-11"
        />
      </div>

      <Button
        type="submit"
        className="w-full h-11"
        disabled={loading || !isValidEmail(emailInput)}
      >
        {loading ? <Spinner /> : <UserPlus className="h-4 w-4" />}
        {loading ? "Enviando..." : "Solicitar acesso"}
      </Button>
    </form>
  );
}
