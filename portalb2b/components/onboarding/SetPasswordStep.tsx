"use client";

import { Check, KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Spinner } from "./Spinner";

function scorePassword(password: string): { score: number; label: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const label = score <= 1 ? "Fraca" : score <= 3 ? "Média" : "Forte";
  return { score: Math.min(score, 4), label };
}

export function SetPasswordStep({
  password,
  confirmPassword,
  loading,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
}: {
  password: string;
  confirmPassword: string;
  loading: boolean;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const { score, label } = scorePassword(password);
  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4" />
          E-mail verificado com sucesso!
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="newPassword" className="text-sm font-medium">
          Nova senha
        </label>
        <Input
          id="newPassword"
          type="password"
          placeholder="Mínimo 8 caracteres"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          disabled={loading}
          autoFocus
          className="h-11"
        />
        {password.length > 0 && (
          <div className="space-y-1">
            <div className="flex gap-1">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors",
                    i < score
                      ? score <= 1
                        ? "bg-destructive"
                        : score <= 3
                          ? "bg-amber-400"
                          : "bg-emerald-500"
                      : "bg-muted",
                  )}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Força: {label}</p>
          </div>
        )}
        {tooShort && (
          <p className="text-xs text-destructive">
            A senha deve ter no mínimo 8 caracteres
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="confirmPassword" className="text-sm font-medium">
          Confirme a senha
        </label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder="Repita a senha"
          value={confirmPassword}
          onChange={(e) => onConfirmPasswordChange(e.target.value)}
          disabled={loading}
          className="h-11"
        />
        {mismatch && (
          <p className="text-xs text-destructive">As senhas não conferem</p>
        )}
      </div>

      <Button
        type="submit"
        className="w-full h-11"
        disabled={loading || password.length < 8 || password !== confirmPassword}
      >
        {loading ? <Spinner /> : <KeyRound className="h-4 w-4" />}
        {loading ? "Criando..." : "Criar senha e acessar"}
      </Button>
    </form>
  );
}
