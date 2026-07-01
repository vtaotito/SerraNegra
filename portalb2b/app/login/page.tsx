"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth/context";
import { post } from "@/lib/api/client";
import { formatCnpj, cleanCnpj, isValidCnpj } from "@/lib/cnpj";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle, ArrowLeft, Building2, UserPlus } from "lucide-react";
import { GSN_LOGO_URL } from "@/lib/product-images";

import {
  EMPTY_REG_FORM,
  isValidEmail,
  type LookupResult,
  type PendingKind,
  type RegForm,
  type Step,
} from "@/components/onboarding/types";
import { OnboardingStepper } from "@/components/onboarding/OnboardingStepper";
import { CnpjStep } from "@/components/onboarding/CnpjStep";
import { PasswordStep } from "@/components/onboarding/PasswordStep";
import { EmailVerifyStep } from "@/components/onboarding/EmailVerifyStep";
import { RequestEmailStep } from "@/components/onboarding/RequestEmailStep";
import { OtpStep } from "@/components/onboarding/OtpStep";
import { SetPasswordStep } from "@/components/onboarding/SetPasswordStep";
import { RegisterStep } from "@/components/onboarding/RegisterStep";
import { PendingStep } from "@/components/onboarding/PendingStep";

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
  const [contactInput, setContactInput] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const [tempToken, setTempToken] = useState("");
  // Diferencia a mensagem da tela de "pending-approval":
  // empresa nova (register) vs. cliente SAP sem e-mail (email-access).
  const [pendingKind, setPendingKind] = useState<PendingKind>("register");

  const [regForm, setRegForm] = useState<RegForm>(EMPTY_REG_FORM);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, router]);

  if (isAuthenticated) {
    return null;
  }

  const isExistingCustomer =
    !!lookupResult && lookupResult.status !== "not_found";
  const isNewCustomer = step === "register";

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
        if (res.hasEmail) {
          // Cliente já tem e-mail no SAP — confirma e segue por OTP.
          setStep("email");
        } else if (res.emailRequestStatus === "pending") {
          // Já existe solicitação de acesso em análise.
          setPendingKind("email-access");
          setStep("pending-approval");
        } else {
          // Cliente SAP sem e-mail — precisa cadastrar um e-mail de acesso.
          setStep("request-email");
        }
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
    if (!isValidEmail(emailInput)) {
      setError("Informe um e-mail valido");
      return;
    }

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

  async function handleResendOtp() {
    // Reenvia o código para o mesmo e-mail sem alterar o passo atual.
    const res = await post<{ devOtp?: string }>("/b2b/auth/verify-email", {
      cnpj: cleanCnpj(cnpj),
      email: emailInput.trim(),
    });
    if (res.devOtp) setDevOtp(res.devOtp);
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

  async function handleRequestEmailAccess(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidEmail(emailInput)) {
      setError("Informe um e-mail valido para acesso");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await post<{ ok: boolean; status: string; message: string }>(
        "/b2b/auth/request-email-access",
        {
          cnpj: cleanCnpj(cnpj),
          email: emailInput.trim(),
          contactName: contactInput.trim() || undefined,
        },
      );
      setPendingKind("email-access");
      setStep("pending-approval");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao solicitar acesso",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!regForm.razaoSocial || !isValidEmail(regForm.email)) {
      setError("Razao social e um email valido sao obrigatorios");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await post<{
        ok: boolean;
        registrationId: number;
        status: string;
        message: string;
      }>("/b2b/auth/register", {
        cnpj: cleanCnpj(cnpj),
        ...regForm,
      });

      setPendingKind("register");
      setStep("pending-approval");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cadastrar");
    } finally {
      setLoading(false);
    }
  }

  function resetFlow() {
    setStep("cnpj");
    setCnpj("");
    setEmailInput("");
    setContactInput("");
    setLookupResult(null);
    setRegForm(EMPTY_REG_FORM);
    setPassword("");
    setConfirmPassword("");
    setOtpInput("");
    setDevOtp(null);
  }

  function goBack() {
    setError("");
    setPassword("");
    setConfirmPassword("");
    setOtpInput("");
    setDevOtp(null);
    if (
      step === "password" ||
      step === "email" ||
      step === "request-email" ||
      step === "register"
    ) {
      setStep("cnpj");
      setLookupResult(null);
    } else if (step === "otp") {
      setStep("email");
    } else if (step === "set-password") {
      setStep("otp");
    }
  }

  const description: Record<Step, string> = {
    cnpj: "Informe o CNPJ da sua empresa",
    password: `Ola, ${lookupResult?.cardName ?? ""}`,
    email: "Confirme seu endereco de e-mail",
    "request-email": "Cadastre um e-mail de acesso",
    otp: "Codigo de verificacao",
    "set-password": "Crie sua senha de acesso",
    register: "Cadastro de novo cliente",
    "pending-approval":
      pendingKind === "email-access"
        ? "Solicitacao recebida!"
        : "Cadastro recebido!",
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#fdf2f2] via-white to-[#fef5f5] p-4">
      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-gsn-brand">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto">
            <img
              src={GSN_LOGO_URL}
              alt="Garrafaria Serra Negra"
              className="h-16 w-auto object-contain mx-auto"
            />
          </div>
          <div>
            <CardTitle className="text-2xl text-gsn-text">
              Portal Garrafaria Serra Negra
            </CardTitle>
            <CardDescription className="mt-1">
              {description[step]}
            </CardDescription>
          </div>

          {(isExistingCustomer || isNewCustomer) && step !== "pending-approval" && (
            <div className="flex justify-center">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                  isNewCustomer
                    ? "bg-blue-50 text-blue-700"
                    : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {isNewCustomer ? (
                  <>
                    <UserPlus className="h-3.5 w-3.5" /> Novo cliente
                  </>
                ) : (
                  <>
                    <Building2 className="h-3.5 w-3.5" /> Cliente Garrafaria
                  </>
                )}
              </span>
            </div>
          )}
        </CardHeader>

        <CardContent>
          <OnboardingStepper step={step} pendingKind={pendingKind} />

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {step !== "cnpj" && step !== "pending-approval" && (
            <button
              type="button"
              onClick={goBack}
              className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3 w-3" /> Voltar
            </button>
          )}

          {step === "cnpj" && (
            <CnpjStep
              cnpj={cnpj}
              loading={loading}
              onChange={handleCnpjChange}
              onSubmit={handleLookup}
            />
          )}

          {step === "password" && (
            <PasswordStep
              cardName={lookupResult?.cardName}
              cnpj={cnpj}
              password={password}
              showPassword={showPassword}
              loading={loading}
              onPasswordChange={setPassword}
              onToggleShowPassword={() => setShowPassword((v) => !v)}
              onSubmit={handleLogin}
              onForgotPassword={handleForgotPassword}
            />
          )}

          {step === "email" && (
            <EmailVerifyStep
              cardName={lookupResult?.cardName}
              maskedEmail={lookupResult?.maskedEmail}
              emailInput={emailInput}
              loading={loading}
              onEmailChange={setEmailInput}
              onSubmit={handleVerifyEmail}
            />
          )}

          {step === "request-email" && (
            <RequestEmailStep
              cardName={lookupResult?.cardName}
              emailInput={emailInput}
              contactInput={contactInput}
              loading={loading}
              onEmailChange={setEmailInput}
              onContactChange={setContactInput}
              onSubmit={handleRequestEmailAccess}
            />
          )}

          {step === "otp" && (
            <OtpStep
              devOtp={devOtp}
              otpInput={otpInput}
              loading={loading}
              onOtpChange={setOtpInput}
              onSubmit={handleVerifyOtp}
              onResend={handleResendOtp}
            />
          )}

          {step === "set-password" && (
            <SetPasswordStep
              password={password}
              confirmPassword={confirmPassword}
              loading={loading}
              onPasswordChange={setPassword}
              onConfirmPasswordChange={setConfirmPassword}
              onSubmit={handleSetPassword}
            />
          )}

          {step === "register" && (
            <RegisterStep
              cnpj={cnpj}
              regForm={regForm}
              loading={loading}
              onChange={(patch) => setRegForm((prev) => ({ ...prev, ...patch }))}
              onSubmit={handleRegister}
            />
          )}

          {step === "pending-approval" && (
            <PendingStep pendingKind={pendingKind} onRestart={resetFlow} />
          )}

          <div className="mt-6 text-center space-y-1">
            <p className="text-xs text-muted-foreground">
              Garrafaria Serra Negra &mdash; Sistema de Pedidos B2B
            </p>
            <p className="text-[10px] text-muted-foreground/60">
              Atendimento: (31) 99070-4765 | ecommerce@garrafariaserranegra.com.br
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
