"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, KeyRound, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

const GSN_LOGO_EXTERNAL =
  "https://garrafariaserranegra.com.br/wp-content/uploads/2021/03/cropped-gsn-logo2021.png";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/esqueci-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok && res.status !== 200) {
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : "Não foi possível processar sua solicitação."
        );
      }

      setSubmitted(true);
      toast.success("Solicitação registrada com sucesso.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao solicitar redefinição de senha."
      );
    } finally {
      setLoading(false);
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
          <h1 className="text-4xl font-bold text-white mb-4">Esqueceu a senha?</h1>
          <p className="text-lg text-gsn-200/80 max-w-md mx-auto">
            Vamos enviar um link seguro para o seu e-mail cadastrado para que
            você possa definir uma nova senha.
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
                <KeyRound className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">
                  Redefinir senha
                </h2>
                <p className="text-sm text-gray-500">
                  Informe o e-mail da sua conta
                </p>
              </div>
            </div>

            {submitted ? (
              <div className="mt-6 space-y-4">
                <div
                  role="status"
                  className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800"
                >
                  <p className="font-medium">Solicitação recebida.</p>
                  <p className="mt-1">
                    Se o e-mail informado estiver cadastrado, você receberá em
                    instantes um link para criar uma nova senha. O link é
                    válido por <strong>1 hora</strong> e só pode ser usado uma
                    vez.
                  </p>
                  <p className="mt-2 text-xs text-green-700/80">
                    Não recebeu? Verifique a pasta de spam ou tente novamente
                    em alguns minutos.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    setEmail("");
                  }}
                  className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-gsn-700 bg-gsn-50 hover:bg-gsn-100 transition"
                >
                  Solicitar novamente
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 mb-1.5"
                  >
                    E-mail cadastrado
                  </label>
                  <div className="relative">
                    <span
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      aria-hidden="true"
                    >
                      <Mail className="w-4 h-4" />
                    </span>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      autoFocus
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gsn-700/40 focus:border-gsn-700 outline-none transition"
                      placeholder="email@exemplo.com"
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500">
                    Por segurança, não confirmamos se este e-mail está
                    cadastrado.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium text-white bg-gsn-700 hover:bg-gsn-800 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm shadow-gsn-700/25"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Mail className="w-4 h-4" aria-hidden="true" />
                  )}
                  {loading ? "Enviando..." : "Enviar link de redefinição"}
                </button>
              </form>
            )}

            <div className="mt-6 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gsn-700 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                Voltar para o login
              </Link>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            painel.garrafariaserranegra.com.br
          </p>
        </div>
      </div>
    </div>
  );
}
