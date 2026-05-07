"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

const GSN_LOGO_EXTERNAL =
  "https://garrafariaserranegra.com.br/wp-content/uploads/2021/03/cropped-gsn-logo2021.png";

type ValidationState =
  | { status: "loading" }
  | { status: "valid"; maskedEmail: string; expiresAt: string }
  | { status: "invalid"; error: string };

interface PasswordRule {
  label: string;
  test: (value: string) => boolean;
}

const PASSWORD_RULES: PasswordRule[] = [
  { label: "Mínimo de 8 caracteres", test: (v) => v.length >= 8 },
  { label: "Ao menos uma letra maiúscula", test: (v) => /[A-Z]/.test(v) },
  { label: "Ao menos uma letra minúscula", test: (v) => /[a-z]/.test(v) },
  { label: "Ao menos um número", test: (v) => /[0-9]/.test(v) },
];

export default function RedefinirSenhaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [validation, setValidation] = useState<ValidationState>({
    status: "loading",
  });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    if (!token) {
      setValidation({
        status: "invalid",
        error: "Link inválido. Solicite uma nova redefinição de senha.",
      });
      return;
    }

    (async () => {
      try {
        const res = await fetch(
          `/api/auth/redefinir-senha?token=${encodeURIComponent(token)}`,
          { cache: "no-store" }
        );
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        if (res.ok && data?.valid) {
          setValidation({
            status: "valid",
            maskedEmail: data.maskedEmail ?? "",
            expiresAt: data.expiresAt ?? "",
          });
        } else {
          setValidation({
            status: "invalid",
            error:
              typeof data?.error === "string"
                ? data.error
                : "Link expirado ou inválido.",
          });
        }
      } catch {
        if (!active) return;
        setValidation({
          status: "invalid",
          error: "Falha ao validar o link. Tente novamente.",
        });
      }
    })();

    return () => {
      active = false;
    };
  }, [token]);

  const passwordChecks = useMemo(
    () => PASSWORD_RULES.map((rule) => ({ ...rule, ok: rule.test(password) })),
    [password]
  );
  const allRulesPassed = passwordChecks.every((c) => c.ok);
  const matches = password.length > 0 && password === confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allRulesPassed) {
      toast.error("A senha não atende aos requisitos mínimos.");
      return;
    }
    if (!matches) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/redefinir-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : "Não foi possível redefinir a senha."
        );
      }
      setDone(true);
      toast.success("Senha redefinida com sucesso.");
      setTimeout(() => router.replace("/login"), 1500);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao redefinir senha."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-gsn-950 via-gsn-900 to-gsn-950 items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(170,26,27,0.25),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(160,120,40,0.12),transparent_50%)]" />
        <div className="relative z-10 text-center px-12">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-white/10 backdrop-blur-sm mb-8 ring-1 ring-white/10 shadow-2xl">
            <Image
              src={GSN_LOGO_EXTERNAL}
              alt="Garrafaria Serra Negra"
              width={64}
              height={64}
              className="object-contain"
              unoptimized
            />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Nova senha</h1>
          <p className="text-lg text-gsn-200/80 max-w-md mx-auto">
            Crie uma senha forte para proteger seu acesso ao painel.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white mb-4 shadow-lg ring-1 ring-gray-100">
              <Image
                src="/favicon.png"
                alt="GSN"
                width={36}
                height={36}
                className="object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Garrafaria Serra Negra
            </h1>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-center gap-3 mb-1">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gsn-50 text-gsn-700">
                <ShieldCheck className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">
                  Definir nova senha
                </h2>
                <p className="text-sm text-gray-500">
                  {validation.status === "valid" && validation.maskedEmail
                    ? `Conta: ${validation.maskedEmail}`
                    : "Confirme sua nova senha abaixo"}
                </p>
              </div>
            </div>

            {validation.status === "loading" && (
              <div className="mt-8 flex flex-col items-center gap-3 py-6 text-gray-500">
                <Loader2
                  className="w-6 h-6 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
                <span className="text-sm">Validando link...</span>
              </div>
            )}

            {validation.status === "invalid" && (
              <div className="mt-6 space-y-4">
                <div
                  role="alert"
                  className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle
                      className="w-5 h-5 mt-0.5 flex-shrink-0"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="font-medium">Não foi possível validar o link.</p>
                      <p className="mt-1">{validation.error}</p>
                    </div>
                  </div>
                </div>
                <Link
                  href="/esqueci-senha"
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium text-white bg-gsn-700 hover:bg-gsn-800 transition shadow-sm shadow-gsn-700/25"
                >
                  <KeyRound className="w-4 h-4" aria-hidden="true" />
                  Solicitar novo link
                </Link>
                <Link
                  href="/login"
                  className="block w-full text-center text-sm text-gray-500 hover:text-gsn-700 transition"
                >
                  Voltar ao login
                </Link>
              </div>
            )}

            {validation.status === "valid" && done && (
              <div className="mt-6 space-y-4">
                <div
                  role="status"
                  className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 flex items-start gap-2"
                >
                  <CheckCircle2
                    className="w-5 h-5 mt-0.5 flex-shrink-0"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-medium">Senha redefinida.</p>
                    <p className="mt-1">
                      Você será redirecionado para o login automaticamente.
                    </p>
                  </div>
                </div>
                <Link
                  href="/login"
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium text-white bg-gsn-700 hover:bg-gsn-800 transition shadow-sm shadow-gsn-700/25"
                >
                  Ir para o login agora
                </Link>
              </div>
            )}

            {validation.status === "valid" && !done && (
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-gray-700 mb-1.5"
                  >
                    Nova senha
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      aria-describedby="password-rules"
                      className="w-full px-3.5 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gsn-700/40 focus:border-gsn-700 outline-none transition"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={
                        showPassword ? "Ocultar senha" : "Mostrar senha"
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  <ul
                    id="password-rules"
                    className="mt-2 space-y-1 text-xs"
                    aria-live="polite"
                  >
                    {passwordChecks.map((rule) => (
                      <li
                        key={rule.label}
                        className={
                          rule.ok
                            ? "text-green-700"
                            : "text-gray-500"
                        }
                      >
                        <span aria-hidden="true">{rule.ok ? "✓" : "•"}</span>{" "}
                        {rule.label}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <label
                    htmlFor="confirm"
                    className="block text-sm font-medium text-gray-700 mb-1.5"
                  >
                    Confirmar nova senha
                  </label>
                  <input
                    id="confirm"
                    name="confirm"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    aria-invalid={confirm.length > 0 && !matches}
                    className={`w-full px-3.5 py-2.5 border rounded-lg text-sm focus:ring-2 outline-none transition ${
                      confirm.length > 0 && !matches
                        ? "border-red-300 focus:ring-red-500/30 focus:border-red-500"
                        : "border-gray-300 focus:ring-gsn-700/40 focus:border-gsn-700"
                    }`}
                    placeholder="Repita a senha"
                  />
                  {confirm.length > 0 && !matches && (
                    <p
                      role="alert"
                      className="mt-1 text-xs text-red-600"
                    >
                      As senhas não coincidem.
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submitting || !allRulesPassed || !matches}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium text-white bg-gsn-700 hover:bg-gsn-800 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm shadow-gsn-700/25"
                >
                  {submitting ? (
                    <Loader2
                      className="w-4 h-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                  )}
                  {submitting ? "Salvando..." : "Salvar nova senha"}
                </button>
              </form>
            )}

            {validation.status !== "invalid" && (
              <div className="mt-6 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gsn-700 transition"
                >
                  <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                  Voltar para o login
                </Link>
              </div>
            )}
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            painel.garrafariaserranegra.com.br
          </p>
        </div>
      </div>
    </div>
  );
}
