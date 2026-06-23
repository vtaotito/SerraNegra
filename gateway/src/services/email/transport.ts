/**
 * Transporte de e-mail da plataforma.
 *
 * Estratégia:
 *   1. Se `RESEND_API_KEY` estiver definido, envia via API HTTP do Resend
 *      (serviço transacional — recomendado em produção).
 *   2. Caso contrário, cai para SMTP via nodemailer (`SMTP_HOST/USER/PASS`).
 *   3. Sem nenhum dos dois, apenas loga o envio (modo dev) e retorna `false`.
 */

import nodemailer from "nodemailer";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_ENDPOINT = "https://api.resend.com/emails";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

const EMAIL_FROM =
  process.env.EMAIL_FROM ??
  process.env.SMTP_FROM ??
  "Garrafaria Serra Negra <noreply@garrafariaserranegra.com.br>";

let smtpTransporter: nodemailer.Transporter | null = null;
if (!RESEND_API_KEY && SMTP_HOST && SMTP_USER && SMTP_PASS) {
  smtpTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export function isEmailConfigured(): boolean {
  return Boolean(RESEND_API_KEY) || smtpTransporter !== null;
}

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  /** Sobrescreve o remetente padrão (opcional). */
  from?: string;
  replyTo?: string;
}

/**
 * Envia um e-mail pelo provedor disponível. Retorna `true` se entregue ao
 * provedor com sucesso, `false` se não há transporte configurado ou falhou.
 */
export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  const { to, subject, html, text, from, replyTo } = params;
  const sender = from ?? EMAIL_FROM;
  const recipients = Array.isArray(to) ? to : [to];

  if (RESEND_API_KEY) {
    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          authorization: `Bearer ${RESEND_API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: sender,
          to: recipients,
          subject,
          html,
          ...(text ? { text } : {}),
          ...(replyTo ? { reply_to: replyTo } : {}),
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error(
          `[EMAIL] Resend respondeu ${res.status}: ${detail.slice(0, 300)}`,
        );
        return false;
      }
      return true;
    } catch (err) {
      console.error("[EMAIL] Falha ao enviar via Resend:", err);
      return false;
    }
  }

  if (smtpTransporter) {
    try {
      await smtpTransporter.sendMail({
        from: sender,
        to: recipients.join(", "),
        subject,
        html,
        ...(text ? { text } : {}),
        ...(replyTo ? { replyTo } : {}),
      });
      return true;
    } catch (err) {
      console.error("[EMAIL] Falha ao enviar via SMTP:", err);
      return false;
    }
  }

  console.log(
    `[EMAIL] Nenhum provedor configurado (RESEND_API_KEY/SMTP). Assunto "${subject}" para ${recipients.join(
      ", ",
    )} foi apenas logado.`,
  );
  return false;
}
