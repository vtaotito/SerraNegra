"use client";

import { Info, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ESTADOS_BR, isValidEmail, type RegForm } from "./types";
import { Spinner } from "./Spinner";

export function RegisterStep({
  cnpj,
  regForm,
  loading,
  onChange,
  onSubmit,
}: {
  cnpj: string;
  regForm: RegForm;
  loading: boolean;
  onChange: (patch: Partial<RegForm>) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const canSubmit = !!regForm.razaoSocial.trim() && isValidEmail(regForm.email);

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <p>
          Não encontramos este CNPJ no nosso cadastro. Preencha os dados da
          empresa para solicitar a abertura de conta.
        </p>
      </div>

      <div className="rounded-lg bg-muted/50 p-2 text-sm text-center font-mono">
        {cnpj}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Razão Social *</label>
        <Input
          value={regForm.razaoSocial}
          onChange={(e) => onChange({ razaoSocial: e.target.value })}
          placeholder="Razão Social da empresa"
          disabled={loading}
          className="h-10"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Nome Fantasia</label>
        <Input
          value={regForm.nomeFantasia}
          onChange={(e) => onChange({ nomeFantasia: e.target.value })}
          placeholder="Nome fantasia (opcional)"
          disabled={loading}
          className="h-10"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">E-mail *</label>
          <Input
            type="email"
            value={regForm.email}
            onChange={(e) => onChange({ email: e.target.value })}
            placeholder="email@empresa.com"
            disabled={loading}
            className="h-10"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Telefone</label>
          <Input
            value={regForm.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
            placeholder="(00) 00000-0000"
            disabled={loading}
            className="h-10"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Endereço</label>
        <Input
          value={regForm.address}
          onChange={(e) => onChange({ address: e.target.value })}
          placeholder="Rua, número, bairro"
          disabled={loading}
          className="h-10"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Cidade</label>
          <Input
            value={regForm.city}
            onChange={(e) => onChange({ city: e.target.value })}
            disabled={loading}
            className="h-10"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">UF</label>
          <select
            value={regForm.state}
            onChange={(e) => onChange({ state: e.target.value })}
            disabled={loading}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">UF</option>
            {ESTADOS_BR.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">CEP</label>
          <Input
            value={regForm.zipCode}
            onChange={(e) => onChange({ zipCode: e.target.value })}
            placeholder="00000-000"
            disabled={loading}
            className="h-10"
          />
        </div>
      </div>

      <Button
        type="submit"
        className="w-full h-11 mt-2"
        disabled={loading || !canSubmit}
      >
        {loading ? <Spinner /> : <UserPlus className="h-4 w-4" />}
        {loading ? "Cadastrando..." : "Cadastrar"}
      </Button>
    </form>
  );
}
