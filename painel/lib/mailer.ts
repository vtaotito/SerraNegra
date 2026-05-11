import "server-only";

import { getSettings, clearSettingsCache } from "@/lib/settings";

/**
 * Mailer do painel — config lida dinamicamente de `panel_settings` (DB) com
 * fallback para `process.env`. Quem precisa enviar mail chama
 * `getResolvedSmtpConfig()` que sempre devolve a config mais atual.
 *
 * SMTP é opcional: quando faltam HOST/USER/PASS, os e-mails são apenas
 * logados. Em produção, configure pela tela `/integracoes` (admin).
 */

export const SMTP_KEYS = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
] as const;

export type SmtpKey = (typeof SMTP_KEYS)[number];

export const SMTP_SECRET_KEYS: ReadonlySet<SmtpKey> = new Set(["SMTP_PASS"]);

interface ResolvedSmtpConfig {
  host: string | null;
  port: number;
  secure: boolean;
  user: string | null;
  pass: string | null;
  from: string;
}

const DEFAULT_FROM = "Painel GSN <noreply@garrafariaserranegra.com.br>";

type Transporter = {
  sendMail: (opts: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text?: string;
  }) => Promise<unknown>;
};

let cachedTransporter: Transporter | null | undefined;
let cachedSig: string | null = null;

export async function getResolvedSmtpConfig(): Promise<ResolvedSmtpConfig> {
  const cfg = await getSettings([...SMTP_KEYS]);
  const port = Number(cfg.SMTP_PORT ?? 587);
  return {
    host: cfg.SMTP_HOST ?? null,
    port: Number.isFinite(port) && port > 0 ? port : 587,
    secure: Number.isFinite(port) && port === 465,
    user: cfg.SMTP_USER ?? null,
    pass: cfg.SMTP_PASS ?? null,
    from: cfg.SMTP_FROM ?? DEFAULT_FROM,
  };
}

/**
 * Invalida o transporte cacheado — chame após salvar nova config SMTP.
 */
export function invalidateMailerCache(): void {
  cachedTransporter = undefined;
  cachedSig = null;
  clearSettingsCache("SMTP_");
}

function configSignature(cfg: ResolvedSmtpConfig): string {
  return [cfg.host, cfg.port, cfg.user, cfg.pass ? "<set>" : "<empty>"].join("|");
}

async function getTransporter(): Promise<{
  transporter: Transporter | null;
  cfg: ResolvedSmtpConfig;
}> {
  const cfg = await getResolvedSmtpConfig();
  const sig = configSignature(cfg);
  if (cachedTransporter !== undefined && cachedSig === sig) {
    return { transporter: cachedTransporter, cfg };
  }

  if (!cfg.host || !cfg.user || !cfg.pass) {
    cachedTransporter = null;
    cachedSig = sig;
    return { transporter: null, cfg };
  }

  try {
    const mod = (await import("nodemailer")) as unknown as {
      createTransport: (opts: Record<string, unknown>) => Transporter;
      default?: { createTransport: (opts: Record<string, unknown>) => Transporter };
    };
    const factory = mod.createTransport ?? mod.default?.createTransport;
    if (!factory) throw new Error("nodemailer.createTransport indisponível");
    cachedTransporter = factory({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
    });
    cachedSig = sig;
    return { transporter: cachedTransporter, cfg };
  } catch (err) {
    console.error(
      "[MAILER] Falha ao iniciar nodemailer. Instale 'nodemailer' no painel para envio real.",
      err,
    );
    cachedTransporter = null;
    cachedSig = sig;
    return { transporter: null, cfg };
  }
}

export async function isMailerConfigured(): Promise<boolean> {
  const cfg = await getResolvedSmtpConfig();
  return Boolean(cfg.host && cfg.user && cfg.pass);
}

/**
 * Snapshot da configuração SMTP — usado pela tela de Integrações.
 * Nunca expõe a senha; apenas se ela está presente.
 */
export async function smtpStatus(): Promise<{
  configured: boolean;
  host: string | null;
  port: number;
  secure: boolean;
  user: string | null;
  hasPassword: boolean;
  from: string;
}> {
  const cfg = await getResolvedSmtpConfig();
  return {
    configured: Boolean(cfg.host && cfg.user && cfg.pass),
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    user: cfg.user,
    hasPassword: Boolean(cfg.pass),
    from: cfg.from,
  };
}

export async function sendTestEmail(params: {
  to: string;
  triggeredBy: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const { to, triggeredBy } = params;
  const { transporter, cfg } = await getTransporter();
  if (!transporter) {
    return {
      ok: false,
      reason:
        "SMTP não configurado. Defina HOST/USER/PASS na página de Integrações.",
    };
  }

  const subject = "Teste de envio — Painel GSN";
  const sentAt = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
  const text =
    `Este é um e-mail de teste enviado pelo Painel GSN em ${sentAt}.\n` +
    `Disparado por: ${triggeredBy}.\n\n` +
    `Se você recebeu esta mensagem, sua configuração SMTP está funcionando.`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #111827;">
      <div style="padding: 20px 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h2 style="margin: 0 0 8px; color: #7f1d1d;">Painel GSN — Teste SMTP</h2>
        <p style="margin: 0 0 12px; color: #4b5563;">
          Este é um e-mail de <strong>teste</strong> disparado em
          <strong>${escapeHtml(sentAt)}</strong> por <strong>${escapeHtml(
            triggeredBy,
          )}</strong>.
        </p>
        <p style="margin: 0; color: #059669; font-weight: 600;">
          Se você recebeu esta mensagem, sua configuração SMTP está funcionando.
        </p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({ from: cfg.from, to, subject, text, html });
    return { ok: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Falha ao enviar e-mail";
    return { ok: false, reason };
  }
}

interface PasswordResetEmailParams {
  to: string;
  displayName: string;
  resetUrl: string;
  expiresAt: Date;
}

export async function sendPasswordResetEmail(
  params: PasswordResetEmailParams,
): Promise<boolean> {
  const { to, displayName, resetUrl, expiresAt } = params;
  const expiresLabel = expiresAt.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });

  const subject = "Redefinição de senha — Painel GSN";
  const text =
    `Olá, ${displayName}.\n\n` +
    `Recebemos um pedido para redefinir sua senha no Painel da Garrafaria Serra Negra.\n` +
    `Para criar uma nova senha, abra o link abaixo (válido até ${expiresLabel}):\n\n` +
    `${resetUrl}\n\n` +
    `Se você não solicitou essa redefinição, pode ignorar este e-mail — sua senha atual continua válida.`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
      <div style="padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h2 style="margin: 0 0 12px; color: #7f1d1d;">Painel Garrafaria Serra Negra</h2>
        <p style="margin: 0 0 16px;">Olá, <strong>${escapeHtml(displayName)}</strong>.</p>
        <p style="margin: 0 0 16px;">
          Recebemos um pedido para redefinir sua senha. Clique no botão abaixo para
          criar uma nova senha:
        </p>
        <p style="text-align: center; margin: 24px 0;">
          <a href="${escapeHtml(resetUrl)}"
             style="display: inline-block; padding: 12px 22px; background: #7f1d1d; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600;">
            Redefinir minha senha
          </a>
        </p>
        <p style="margin: 0 0 8px; font-size: 13px; color: #4b5563;">
          O link é válido até <strong>${escapeHtml(expiresLabel)}</strong> e só pode ser usado uma vez.
        </p>
        <p style="margin: 0 0 16px; font-size: 13px; color: #4b5563;">
          Se o botão não funcionar, copie e cole no navegador:<br>
          <span style="word-break: break-all; color: #1f2937;">${escapeHtml(resetUrl)}</span>
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="margin: 0; font-size: 12px; color: #6b7280;">
          Se você não solicitou esta redefinição, ignore este e-mail. Sua senha atual continua válida.
        </p>
      </div>
    </div>
  `;

  const { transporter, cfg } = await getTransporter();
  if (!transporter) {
    console.warn(
      `[MAILER] (fallback) Link de redefinição para ${to} (válido até ${expiresLabel}): ${resetUrl}`,
    );
    return false;
  }

  try {
    await transporter.sendMail({ from: cfg.from, to, subject, text, html });
    return true;
  } catch (err) {
    console.error("[MAILER] Falha ao enviar e-mail de reset:", err);
    console.warn(
      `[MAILER] (fallback) Link de redefinição para ${to} (válido até ${expiresLabel}): ${resetUrl}`,
    );
    return false;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
