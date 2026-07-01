"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "./Spinner";

const RESEND_COOLDOWN_SECONDS = 30;

export function OtpStep({
  devOtp,
  otpInput,
  loading,
  onOtpChange,
  onSubmit,
  onResend,
}: {
  devOtp: string | null;
  otpInput: string;
  loading: boolean;
  onOtpChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onResend: () => Promise<void>;
}) {
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleResend() {
    if (cooldown > 0 || resending) return;
    setResending(true);
    try {
      await onResend();
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } finally {
      setResending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Enviamos um código de 6 dígitos para o seu e-mail. Ele expira em alguns
        minutos.
      </p>

      {devOtp && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="font-medium text-amber-800">
            Modo teste (SMTP não configurado)
          </p>
          <p className="text-amber-700 mt-1">
            Código:{" "}
            <span className="font-mono font-bold text-lg">{devOtp}</span>
          </p>
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="otp" className="text-sm font-medium">
          Código de verificação
        </label>
        <Input
          id="otp"
          type="text"
          inputMode="numeric"
          placeholder="000000"
          value={otpInput}
          onChange={(e) => onOtpChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
          disabled={loading}
          autoFocus
          className="h-11 text-center text-2xl tracking-[0.5em] font-mono"
          maxLength={6}
        />
      </div>

      <Button
        type="submit"
        className="w-full h-11"
        disabled={loading || otpInput.length !== 6}
      >
        {loading ? <Spinner /> : <Check className="h-4 w-4" />}
        {loading ? "Verificando..." : "Verificar"}
      </Button>

      <button
        type="button"
        onClick={handleResend}
        disabled={cooldown > 0 || resending}
        className="w-full text-center text-sm text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
      >
        {resending
          ? "Reenviando..."
          : cooldown > 0
            ? `Reenviar código em ${cooldown}s`
            : "Reenviar código"}
      </button>
    </form>
  );
}
