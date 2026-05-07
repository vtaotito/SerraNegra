import "server-only";

/**
 * Mailer simples para o painel.
 *
 * SMTP é opcional: quando as variáveis SMTP_* não estão definidas, o link de
 * redefinição é apenas logado no console do servidor (útil em dev/local).
 * Em produção, defina SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS e SMTP_FROM.
 *
 * O nodemailer é importado dinamicamente para que o build do painel não quebre
 * caso a dependência ainda não esteja instalada em ambientes de CI/lint.
 */

type Transporter = {
  sendMail: (opts: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text?: string;
  }) => Promise<unknown>;
};

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM =
  process.env.SMTP_FROM ?? "Painel GSN <noreply@garrafariaserranegra.com.br>";

let cachedTransporter: Transporter | null | undefined;
let warnedNoSmtp = false;

async function getTransporter(): Promise<Transporter | null> {
  if (cachedTransporter !== undefined) return cachedTransporter;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    if (!warnedNoSmtp) {
      console.warn(
        "[MAILER] SMTP não configurado (SMTP_HOST/SMTP_USER/SMTP_PASS). " +
          "Os e-mails serão apenas logados no servidor."
      );
      warnedNoSmtp = true;
    }
    cachedTransporter = null;
    return null;
  }

  try {
    const mod = (await import("nodemailer")) as unknown as {
      createTransport: (opts: Record<string, unknown>) => Transporter;
      default?: { createTransport: (opts: Record<string, unknown>) => Transporter };
    };
    const factory = mod.createTransport ?? mod.default?.createTransport;
    if (!factory) throw new Error("nodemailer.createTransport indisponível");
    cachedTransporter = factory({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    return cachedTransporter;
  } catch (err) {
    console.error(
      "[MAILER] Falha ao iniciar nodemailer. Instale 'nodemailer' no painel para envio real.",
      err
    );
    cachedTransporter = null;
    return null;
  }
}

export function isMailerConfigured(): boolean {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

interface PasswordResetEmailParams {
  to: string;
  displayName: string;
  resetUrl: string;
  expiresAt: Date;
}

/**
 * Envia o e-mail de redefinição de senha. Retorna true se o e-mail foi enviado
 * via SMTP, ou false se caiu no fallback de log (sem SMTP / falha de envio).
 */
export async function sendPasswordResetEmail(
  params: PasswordResetEmailParams
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

  const transporter = await getTransporter();
  if (!transporter) {
    console.warn(
      `[MAILER] (fallback) Link de redefinição para ${to} (válido até ${expiresLabel}): ${resetUrl}`
    );
    return false;
  }

  try {
    await transporter.sendMail({ from: SMTP_FROM, to, subject, text, html });
    return true;
  } catch (err) {
    console.error("[MAILER] Falha ao enviar e-mail de reset:", err);
    console.warn(
      `[MAILER] (fallback) Link de redefinição para ${to} (válido até ${expiresLabel}): ${resetUrl}`
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
