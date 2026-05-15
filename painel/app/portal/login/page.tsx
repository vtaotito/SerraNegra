"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { CNPJInput } from "@/components/b2b/CNPJInput";
import { useB2BAuth } from "@/contexts/B2BAuthContext";
import {
  authLookup,
  authVerifyEmail,
  authVerifyOTP,
  authSetPassword,
  authForgotPassword,
  authRegister,
  cleanCNPJ,
  fmtCNPJ,
  type LookupResponse,
} from "@/lib/b2b-api";

type Step =
  | "login"
  | "lookup"
  | "verify-email"
  | "otp"
  | "set-password"
  | "forgot"
  | "register"
  | "success";

export default function PortalLoginPage() {
  const router = useRouter();
  const { login, setSession } = useB2BAuth();

  const [step, setStep] = useState<Step>("login");
  const [cnpj, setCnpj] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // primeiro acesso
  const [lookupData, setLookupData] = useState<LookupResponse | null>(null);
  const [otp, setOtp] = useState("");
  const [tempToken, setTempToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);

  // registro
  const [regRazao, setRegRazao] = useState("");
  const [regEmail, setRegEmail] = useState("");

  const handleError = (err: unknown) => {
    setError(err instanceof Error ? err.message : "Erro inesperado. Tente novamente.");
  };

  const resetFlow = useCallback(() => {
    setStep("login");
    setError("");
    setSuccessMsg("");
    setOtp("");
    setTempToken("");
    setNewPassword("");
    setConfirmPassword("");
    setLookupData(null);
  }, []);

  // ── Login padrão ──
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cnpj.length < 14) {
      setError("Informe um CNPJ válido.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await login(cleanCNPJ(cnpj), password);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  // ── Primeiro acesso: lookup ──
  const handleLookup = async () => {
    if (cnpj.length < 14) {
      setError("Informe um CNPJ válido.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await authLookup(cleanCNPJ(cnpj));
      setLookupData(res);
      if (res.hasPassword) {
        setStep("login");
        setError("Este CNPJ já possui senha cadastrada. Faça login normalmente.");
      } else {
        setStep("verify-email");
      }
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  // ── Verificar email ──
  const handleVerifyEmail = async () => {
    if (!lookupData) return;
    setLoading(true);
    setError("");
    try {
      await authVerifyEmail(cleanCNPJ(cnpj), lookupData.email);
      setStep("otp");
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  // ── Verificar OTP ──
  const handleOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 4) {
      setError("Informe o código recebido.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await authVerifyOTP(cleanCNPJ(cnpj), otp);
      setTempToken(res.tempToken);
      setStep("set-password");
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  // ── Definir senha ──
  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await authSetPassword(cleanCNPJ(cnpj), tempToken, newPassword);
      setSession(res.token, res.customer);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  // ── Esqueci senha ──
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cnpj.length < 14) {
      setError("Informe um CNPJ válido.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await authForgotPassword(cleanCNPJ(cnpj));
      setSuccessMsg(res.message || "Instruções de recuperação enviadas para o e-mail cadastrado.");
      setStep("success");
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  // ── Registro ──
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cnpj.length < 14 || !regRazao || !regEmail) {
      setError("Preencha todos os campos.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await authRegister({
        cnpj: cleanCNPJ(cnpj),
        razaoSocial: regRazao,
        email: regEmail,
      });
      setSuccessMsg(
        res.message || "Cadastro realizado! Entraremos em contato para liberar seu acesso.",
      );
      setStep("success");
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cockpit-bg px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cockpit-accent mb-4">
            <span className="text-white font-bold text-xl">GSN</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Portal do Cliente</h1>
          <p className="text-sm text-cockpit-muted mt-1">Garrafaria Serra Negra</p>
        </div>

        <div className="bg-white rounded-2xl border border-cockpit-border shadow-sm p-6 sm:p-8">
          {/* ── Login ── */}
          {step === "login" && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">CNPJ</label>
                  <CNPJInput value={cnpj} onValueChange={(raw) => setCnpj(raw)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Senha</label>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Digite sua senha"
                      className="w-full rounded-lg border border-cockpit-border bg-white px-4 py-3 pr-12 text-sm text-gray-900 placeholder:text-cockpit-muted/60 focus:outline-none focus:ring-2 focus:ring-cockpit-accent focus:border-transparent transition-shadow"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-cockpit-muted hover:text-gray-700"
                      tabIndex={-1}
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {error && <ErrorMsg msg={error} />}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-cockpit-accent text-white text-sm font-semibold hover:bg-cockpit-accentHover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Entrar
              </button>

              <div className="flex flex-col gap-2 text-center">
                <button
                  type="button"
                  onClick={() => { setError(""); setStep("forgot"); }}
                  className="text-sm text-cockpit-accent hover:underline"
                >
                  Esqueci minha senha
                </button>
                <button
                  type="button"
                  onClick={() => { setError(""); setStep("lookup"); }}
                  className="text-sm text-cockpit-muted hover:text-cockpit-accent"
                >
                  Primeiro acesso? Ativar conta
                </button>
                <button
                  type="button"
                  onClick={() => { setError(""); setStep("register"); }}
                  className="text-sm text-cockpit-muted hover:text-cockpit-accent"
                >
                  Ainda não tenho cadastro
                </button>
              </div>
            </form>
          )}

          {/* ── Primeiro acesso: Lookup ── */}
          {step === "lookup" && (
            <div className="space-y-5">
              <BackButton onClick={resetFlow} />
              <div className="text-center">
                <h2 className="text-lg font-semibold text-gray-900">Primeiro Acesso</h2>
                <p className="text-sm text-cockpit-muted mt-1">
                  Informe o CNPJ para ativar sua conta
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">CNPJ</label>
                <CNPJInput value={cnpj} onValueChange={(raw) => setCnpj(raw)} />
              </div>
              {error && <ErrorMsg msg={error} />}
              <button
                type="button"
                onClick={handleLookup}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-cockpit-accent text-white text-sm font-semibold hover:bg-cockpit-accentHover disabled:opacity-50 transition-colors"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Buscar CNPJ
              </button>
            </div>
          )}

          {/* ── Verificar e-mail ── */}
          {step === "verify-email" && lookupData && (
            <div className="space-y-5">
              <BackButton onClick={resetFlow} />
              <div className="text-center">
                <h2 className="text-lg font-semibold text-gray-900">Verificação de E-mail</h2>
                <p className="text-sm text-cockpit-muted mt-1">
                  Encontramos sua empresa:{" "}
                  <strong className="text-gray-900">{lookupData.cardName}</strong>
                </p>
              </div>
              <div className="bg-cockpit-bg rounded-lg p-4 text-sm">
                <p className="text-cockpit-muted">
                  Enviaremos um código de verificação para:
                </p>
                <p className="font-medium text-gray-900 mt-1">{lookupData.email}</p>
              </div>
              {error && <ErrorMsg msg={error} />}
              <button
                type="button"
                onClick={handleVerifyEmail}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-cockpit-accent text-white text-sm font-semibold hover:bg-cockpit-accentHover disabled:opacity-50 transition-colors"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Enviar Código
              </button>
            </div>
          )}

          {/* ── Digitar OTP ── */}
          {step === "otp" && (
            <form onSubmit={handleOTP} className="space-y-5">
              <BackButton onClick={() => { setError(""); setStep("verify-email"); }} />
              <div className="text-center">
                <h2 className="text-lg font-semibold text-gray-900">Código de Verificação</h2>
                <p className="text-sm text-cockpit-muted mt-1">
                  Digite o código enviado para seu e-mail
                </p>
              </div>
              <input
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="w-full rounded-lg border border-cockpit-border bg-white px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] text-gray-900 placeholder:text-cockpit-muted/40 focus:outline-none focus:ring-2 focus:ring-cockpit-accent focus:border-transparent transition-shadow"
                autoFocus
              />
              {error && <ErrorMsg msg={error} />}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-cockpit-accent text-white text-sm font-semibold hover:bg-cockpit-accentHover disabled:opacity-50 transition-colors"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Verificar
              </button>
            </form>
          )}

          {/* ── Definir senha ── */}
          {step === "set-password" && (
            <form onSubmit={handleSetPassword} className="space-y-5">
              <div className="text-center">
                <h2 className="text-lg font-semibold text-gray-900">Definir Senha</h2>
                <p className="text-sm text-cockpit-muted mt-1">
                  Crie uma senha para acessar o portal
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Nova Senha
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPw ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full rounded-lg border border-cockpit-border bg-white px-4 py-3 pr-12 text-sm text-gray-900 placeholder:text-cockpit-muted/60 focus:outline-none focus:ring-2 focus:ring-cockpit-accent focus:border-transparent transition-shadow"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw(!showNewPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-cockpit-muted hover:text-gray-700"
                      tabIndex={-1}
                    >
                      {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Confirmar Senha
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a senha"
                    className="w-full rounded-lg border border-cockpit-border bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-cockpit-muted/60 focus:outline-none focus:ring-2 focus:ring-cockpit-accent focus:border-transparent transition-shadow"
                  />
                </div>
              </div>
              {error && <ErrorMsg msg={error} />}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-cockpit-accent text-white text-sm font-semibold hover:bg-cockpit-accentHover disabled:opacity-50 transition-colors"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Definir Senha e Entrar
              </button>
            </form>
          )}

          {/* ── Esqueci senha ── */}
          {step === "forgot" && (
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <BackButton onClick={resetFlow} />
              <div className="text-center">
                <h2 className="text-lg font-semibold text-gray-900">Recuperar Senha</h2>
                <p className="text-sm text-cockpit-muted mt-1">
                  Informe seu CNPJ para receber instruções por e-mail
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">CNPJ</label>
                <CNPJInput value={cnpj} onValueChange={(raw) => setCnpj(raw)} />
              </div>
              {error && <ErrorMsg msg={error} />}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-cockpit-accent text-white text-sm font-semibold hover:bg-cockpit-accentHover disabled:opacity-50 transition-colors"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Enviar Recuperação
              </button>
            </form>
          )}

          {/* ── Registro ── */}
          {step === "register" && (
            <form onSubmit={handleRegister} className="space-y-5">
              <BackButton onClick={resetFlow} />
              <div className="text-center">
                <h2 className="text-lg font-semibold text-gray-900">Solicitar Cadastro</h2>
                <p className="text-sm text-cockpit-muted mt-1">
                  Preencha os dados para solicitar acesso ao portal
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">CNPJ</label>
                  <CNPJInput value={cnpj} onValueChange={(raw) => setCnpj(raw)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Razão Social
                  </label>
                  <input
                    type="text"
                    value={regRazao}
                    onChange={(e) => setRegRazao(e.target.value)}
                    placeholder="Nome da empresa"
                    className="w-full rounded-lg border border-cockpit-border bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-cockpit-muted/60 focus:outline-none focus:ring-2 focus:ring-cockpit-accent focus:border-transparent transition-shadow"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">E-mail</label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="contato@empresa.com.br"
                    className="w-full rounded-lg border border-cockpit-border bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-cockpit-muted/60 focus:outline-none focus:ring-2 focus:ring-cockpit-accent focus:border-transparent transition-shadow"
                  />
                </div>
              </div>
              {error && <ErrorMsg msg={error} />}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-cockpit-accent text-white text-sm font-semibold hover:bg-cockpit-accentHover disabled:opacity-50 transition-colors"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Enviar Solicitação
              </button>
            </form>
          )}

          {/* ── Sucesso ── */}
          {step === "success" && (
            <div className="space-y-5 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <p className="text-sm text-gray-700">{successMsg}</p>
              <button
                type="button"
                onClick={resetFlow}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cockpit-accent text-white text-sm font-semibold hover:bg-cockpit-accentHover transition-colors"
              >
                Voltar ao Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
      <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
      <p className="text-sm text-red-700">{msg}</p>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 text-sm text-cockpit-muted hover:text-cockpit-accent transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      Voltar
    </button>
  );
}
