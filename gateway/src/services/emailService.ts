import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM ?? "noreply@garrafaria.com.br";

let transporter: nodemailer.Transporter | null = null;

if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export function isEmailConfigured(): boolean {
  return transporter !== null;
}

export async function sendOtpEmail(
  to: string,
  otp: string,
  customerName: string
): Promise<boolean> {
  if (!transporter) {
    console.log(`[EMAIL] SMTP nao configurado. OTP para ${to}: ${otp}`);
    return false;
  }

  try {
    await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject:
        "Codigo de verificacao - Portal B2B Garrafaria Serra Negra",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#16a34a;">Portal B2B - Garrafaria Serra Negra</h2>
          <p>Ola, <strong>${customerName}</strong>!</p>
          <p>Seu codigo de verificacao e:</p>
          <div style="background:#f0fdf4;border:2px solid #16a34a;border-radius:8px;padding:20px;text-align:center;margin:20px 0;">
            <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#16a34a;">${otp}</span>
          </div>
          <p>Este codigo e valido por <strong>15 minutos</strong>.</p>
          <p style="color:#6b7280;font-size:12px;">Se voce nao solicitou este codigo, ignore este email.</p>
        </div>
      `,
    });
    return true;
  } catch (err) {
    console.error("[EMAIL] Erro ao enviar:", err);
    return false;
  }
}
