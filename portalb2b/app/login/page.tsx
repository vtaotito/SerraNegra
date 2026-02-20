"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { post } from "@/lib/api/client";
import { formatCnpj, cleanCnpj, isValidCnpj, maskEmail } from "@/lib/cnpj";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Package,
  LogIn,
  AlertCircle,
  ArrowLeft,
  Mail,
  KeyRound,
  UserPlus,
  Check,
  Eye,
  EyeOff,
} from "lucide-react";

type Step =
  | "cnpj"
  | "password"
  | "email"
  | "otp"
  | "set-password"
  | "register";

interface LookupResult {
  status: "has_password" | "needs_verification" | "not_found";
  cardCode?: string;
  cardName?: string;
  maskedEmail?: string;
  hasEmail?: boolean;
}

const ESTADOS_BR = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

export default function LoginPage() {
  const { isAuthenticated, setAuth } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>("cnpj");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [cnpj, setCnpj] = useState("");
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [emailInput, setEmailInput] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const [tempToken, setTempToken] = useState("");

  const [regForm, setRegForm] = useState({
    razaoSocial: "",
    nomeFantasia: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    contactName: "",
  });

  if (isAuthenticated) {
    router.replace("/");
    return null;
  }

  function handleCnpjChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCnpj(formatCnpj(e.target.value));
    setError("");
  }

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    const digits = cleanCnpj(cnpj);
    if (!isValidCnpj(digits)) {
      setError("CNPJ invalido");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await post<LookupResult>("/b2b/auth/lookup", {
        cnpj: digits,
      });
      setLookupResult(res);

      if (res.status === "has_password") {
        setStep("password");
      } else if (res.status === "needs_verification") {
        setStep("email");
      } else {
        setStep("register");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao buscar CNPJ");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    setError("");
    try {
      const res = await post<{ token: string; customer: any }>(
        "/b2b/auth/login",
        { cnpj: cleanCnpj(cnpj), password }
      );
      setAuth(res.token, res.customer);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    setLoading(true);
    setError("");
    try {
      await post("/b2b/auth/forgot-password", { cnpj: cleanCnpj(cnpj) });
      setStep("email");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!emailInput.trim()) return;

    setLoading(true);
    setError("");
    try {
      const res = await post<{
        ok: boolean;
        emailSent: boolean;
        devOtp?: string;
        maskedEmail: string;
      }>("/b2b/auth/verify-email", {
        cnpj: cleanCnpj(cnpj),
        email: emailInput.trim(),
      });

      if (res.devOtp) setDevOtp(res.devOtp);
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Email nao corresponde");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otpInput.length !== 6) return;

    setLoading(true);
    setError("");
    try {
      const res = await post<{ ok: boolean; tempToken: string }>(
        "/b2b/auth/verify-otp",
        { cnpj: cleanCnpj(cnpj), otp: otpInput }
      );
      setTempToken(res.tempToken);
      setStep("set-password");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Codigo invalido ou expirado"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Senha deve ter no minimo 8 caracteres");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas nao conferem");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await post<{ ok: boolean; token: string; customer: any }>(
        "/b2b/auth/set-password",
        { cnpj: cleanCnpj(cnpj), tempToken, password }
      );
      setAuth(res.token, res.customer);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar senha");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!regForm.razaoSocial || !regForm.email) {
      setError("Razao social e email sao obrigatorios");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await post<{
        ok: boolean;
        cardCode: string;
        emailSent: boolean;
        devOtp?: string;
        maskedEmail: string;
      }>("/b2b/auth/register", {
        cnpj: cleanCnpj(cnpj),
        ...regForm,
      });

      setLookupResult({
        status: "needs_verification",
        cardCode: res.cardCode,
        cardName: regForm.razaoSocial,
        maskedEmail: res.maskedEmail,
        hasEmail: true,
      });
      setEmailInput(regForm.email);
      if (res.devOtp) setDevOtp(res.devOtp);
      setStep("otp");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao cadastrar"
      );
    } finally {
      setLoading(false);
    }
  }

  function goBack() {
    setError("");
    setPassword("");
    setConfirmPassword("");
    setOtpInput("");
    setDevOtp(null);
    if (step === "password" || step === "email" || step === "register") {
      setStep("cnpj");
      setLookupResult(null);
    } else if (step === "otp") {
      setStep("email");
    } else if (step === "set-password") {
      setStep("otp");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 via-white to-emerald-50 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg">
            <Package className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl">Portal B2B</CardTitle>
            <CardDescription className="mt-1">
              {step === "cnpj" && "Informe o CNPJ da sua empresa"}
              {step === "password" && `Ola, ${lookupResult?.cardName}`}
              {step === "email" && "Confirme seu endereco de email"}
              {step === "otp" && "Codigo de verificacao"}
              {step === "set-password" && "Crie sua senha de acesso"}
              {step === "register" && "Cadastro de novo cliente"}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {step !== "cnpj" && (
            <button
              type="button"
              onClick={goBack}
              className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3 w-3" /> Voltar
            </button>
          )}

          {/* STEP: CNPJ */}
          {step === "cnpj" && (
            <form onSubmit={handleLookup} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="cnpj" className="text-sm font-medium">
                  CNPJ
                </label>
                <Input
                  id="cnpj"
                  type="text"
                  placeholder="00.000.000/0000-00"
                  value={cnpj}
                  onChange={handleCnpjChange}
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
                {loading ? (
                  <Spinner />
                ) : (
                  <LogIn className="h-4 w-4" />
                )}
                {loading ? "Buscando..." : "Continuar"}
              </Button>
            </form>
          )}

          {/* STEP: PASSWORD (usuario com senha) */}
          {step === "password" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p className="font-medium">{lookupResult?.cardName}</p>
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
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    autoFocus
                    className="h-11 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
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

              <Button
                type="submit"
                className="w-full h-11"
                disabled={loading || !password}
              >
                {loading ? <Spinner /> : <LogIn className="h-4 w-4" />}
                {loading ? "Entrando..." : "Entrar"}
              </Button>

              <button
                type="button"
                onClick={handleForgotPassword}
                className="w-full text-center text-sm text-primary hover:underline"
              >
                Esqueci minha senha
              </button>
            </form>
          )}

          {/* STEP: EMAIL VERIFICATION */}
          {step === "email" && (
            <form onSubmit={handleVerifyEmail} className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
                <p className="font-medium">{lookupResult?.cardName}</p>
                {lookupResult?.maskedEmail && (
                  <p className="text-muted-foreground">
                    Email cadastrado: {lookupResult.maskedEmail}
                  </p>
                )}
              </div>

              <p className="text-sm text-muted-foreground">
                Para continuar, confirme seu endereco de email digitando-o
                abaixo.
              </p>

              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Seu email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  disabled={loading}
                  autoFocus
                  className="h-11"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11"
                disabled={loading || !emailInput.trim()}
              >
                {loading ? <Spinner /> : <Mail className="h-4 w-4" />}
                {loading
                  ? "Enviando..."
                  : "Confirmar e enviar codigo"}
              </Button>
            </form>
          )}

          {/* STEP: OTP */}
          {step === "otp" && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enviamos um codigo de 6 digitos para o seu email.
              </p>

              {devOtp && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                  <p className="font-medium text-amber-800">
                    Modo teste (SMTP nao configurado)
                  </p>
                  <p className="text-amber-700 mt-1">
                    Codigo:{" "}
                    <span className="font-mono font-bold text-lg">
                      {devOtp}
                    </span>
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="otp" className="text-sm font-medium">
                  Codigo de verificacao
                </label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="000000"
                  value={otpInput}
                  onChange={(e) =>
                    setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
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
            </form>
          )}

          {/* STEP: SET PASSWORD */}
          {step === "set-password" && (
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  Email verificado com sucesso!
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="newPassword" className="text-sm font-medium">
                  Nova senha
                </label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Minimo 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoFocus
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="confirmPassword"
                  className="text-sm font-medium"
                >
                  Confirme a senha
                </label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Repita a senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  className="h-11"
                />
              </div>

              {password && password.length < 8 && (
                <p className="text-xs text-destructive">
                  A senha deve ter no minimo 8 caracteres
                </p>
              )}

              <Button
                type="submit"
                className="w-full h-11"
                disabled={
                  loading ||
                  password.length < 8 ||
                  password !== confirmPassword
                }
              >
                {loading ? (
                  <Spinner />
                ) : (
                  <KeyRound className="h-4 w-4" />
                )}
                {loading ? "Criando..." : "Criar senha e acessar"}
              </Button>
            </form>
          )}

          {/* STEP: REGISTER */}
          {step === "register" && (
            <form onSubmit={handleRegister} className="space-y-3">
              <p className="text-sm text-muted-foreground mb-2">
                CNPJ nao encontrado. Preencha seus dados para cadastro.
              </p>

              <div className="rounded-lg bg-muted/50 p-2 text-sm text-center font-mono">
                {cnpj}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Razao Social *
                </label>
                <Input
                  value={regForm.razaoSocial}
                  onChange={(e) =>
                    setRegForm({ ...regForm, razaoSocial: e.target.value })
                  }
                  placeholder="Razao Social da empresa"
                  disabled={loading}
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Nome Fantasia</label>
                <Input
                  value={regForm.nomeFantasia}
                  onChange={(e) =>
                    setRegForm({ ...regForm, nomeFantasia: e.target.value })
                  }
                  placeholder="Nome fantasia (opcional)"
                  disabled={loading}
                  className="h-10"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email *</label>
                  <Input
                    type="email"
                    value={regForm.email}
                    onChange={(e) =>
                      setRegForm({ ...regForm, email: e.target.value })
                    }
                    placeholder="email@empresa.com"
                    disabled={loading}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Telefone</label>
                  <Input
                    value={regForm.phone}
                    onChange={(e) =>
                      setRegForm({ ...regForm, phone: e.target.value })
                    }
                    placeholder="(00) 00000-0000"
                    disabled={loading}
                    className="h-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Endereco</label>
                <Input
                  value={regForm.address}
                  onChange={(e) =>
                    setRegForm({ ...regForm, address: e.target.value })
                  }
                  placeholder="Rua, numero, bairro"
                  disabled={loading}
                  className="h-10"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Cidade</label>
                  <Input
                    value={regForm.city}
                    onChange={(e) =>
                      setRegForm({ ...regForm, city: e.target.value })
                    }
                    disabled={loading}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">UF</label>
                  <select
                    value={regForm.state}
                    onChange={(e) =>
                      setRegForm({ ...regForm, state: e.target.value })
                    }
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
                    onChange={(e) =>
                      setRegForm({ ...regForm, zipCode: e.target.value })
                    }
                    placeholder="00000-000"
                    disabled={loading}
                    className="h-10"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 mt-2"
                disabled={
                  loading || !regForm.razaoSocial || !regForm.email
                }
              >
                {loading ? (
                  <Spinner />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                {loading ? "Cadastrando..." : "Cadastrar"}
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Garrafaria Serra Negra &mdash; Sistema de Pedidos B2B
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Spinner() {
  return (
    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}
