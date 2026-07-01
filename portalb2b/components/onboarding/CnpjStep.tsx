"use client";

import { LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cleanCnpj } from "@/lib/cnpj";
import { Spinner } from "./Spinner";

export function CnpjStep({
  cnpj,
  loading,
  onChange,
  onSubmit,
}: {
  cnpj: string;
  loading: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Informe o CNPJ da sua empresa. Vamos identificar automaticamente se você
        já é cliente da Garrafaria Serra Negra.
      </p>
      <div className="space-y-2">
        <label htmlFor="cnpj" className="text-sm font-medium">
          CNPJ
        </label>
        <Input
          id="cnpj"
          type="text"
          inputMode="numeric"
          placeholder="00.000.000/0000-00"
          value={cnpj}
          onChange={onChange}
          disabled={loading}
          autoFocus
          className="h-11 text-center text-lg tracking-wider"
          maxLength={18}
        />
      </div>
      <Button
        type="submit"
        className="w-full h-11"
        disabled={loading || cleanCnpj(cnpj).length !== 14}
      >
        {loading ? <Spinner /> : <LogIn className="h-4 w-4" />}
        {loading ? "Buscando..." : "Continuar"}
      </Button>
    </form>
  );
}
