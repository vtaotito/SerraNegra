"use client";

import { Eye, EyeOff, LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "./Spinner";

export function PasswordStep({
  cardName,
  cnpj,
  password,
  showPassword,
  loading,
  onPasswordChange,
  onToggleShowPassword,
  onSubmit,
  onForgotPassword,
}: {
  cardName?: string;
  cnpj: string;
  password: string;
  showPassword: boolean;
  loading: boolean;
  onPasswordChange: (value: string) => void;
  onToggleShowPassword: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onForgotPassword: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-lg bg-muted/50 p-3 text-sm">
        <p className="font-medium">{cardName}</p>
        <p className="text-muted-foreground">CNPJ: {cnpj}</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">
          Senha
        </label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="Digite sua senha"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            disabled={loading}
            autoFocus
            className="h-11 pr-10"
          />
          <button
            type="button"
            onClick={onToggleShowPassword}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <Button type="submit" className="w-full h-11" disabled={loading || !password}>
        {loading ? <Spinner /> : <LogIn className="h-4 w-4" />}
        {loading ? "Entrando..." : "Entrar"}
      </Button>

      <button
        type="button"
        onClick={onForgotPassword}
        className="w-full text-center text-sm text-primary hover:underline"
      >
        Esqueci minha senha
      </button>
    </form>
  );
}
