/**
 * Layout base dos e-mails da plataforma Garrafaria Serra Negra.
 *
 * Um único template visual (cabeçalho com logo, corpo e rodapé) reutilizado
 * por todas as comunicações (OTP, recuperação de senha, cadastros, aprovações,
 * confirmação de pedido, etc.). Mantém identidade consistente em toda a
 * plataforma — gateway e painel reaproveitam o mesmo HTML.
 */

export const BRAND = {
  name: "Garrafaria Serra Negra",
  color: "#7f1d1d",
  colorHover: "#991b1b",
  logoUrl:
    "https://garrafariaserranegra.com.br/wp-content/uploads/2023/05/LOGO-GARRAFARIA-SERRA-NEGRA-40-ANOS-SITE-OFICIAL.png",
  portalUrl:
    process.env.B2B_PORTAL_URL ?? "https://garrafariaserranegra.com.br/b2b",
  supportEmail:
    process.env.EMAIL_SUPPORT ?? "comercial@garrafariaserranegra.com.br",
} as const;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface ButtonOptions {
  label: string;
  url: string;
}

/** Botão CTA centralizado, no padrão visual da marca. */
export function renderButton({ label, url }: ButtonOptions): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px auto;">
      <tr>
        <td style="border-radius: 8px; background: ${BRAND.color};">
          <a href="${escapeHtml(url)}"
             style="display: inline-block; padding: 13px 26px; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>`;
}

/** Caixa de destaque (ex.: código OTP). */
export function renderCodeBox(code: string): string {
  return `
    <div style="margin: 24px 0; padding: 20px; text-align: center; background: #fdf2f2; border: 2px solid ${BRAND.color}; border-radius: 12px;">
      <span style="font-size: 34px; font-weight: 700; letter-spacing: 10px; color: ${BRAND.color};">${escapeHtml(code)}</span>
    </div>`;
}

interface LayoutOptions {
  title: string;
  /** Conteúdo HTML do corpo (parágrafos, botões, caixas, etc.). */
  bodyHtml: string;
  /** Texto curto de pré-visualização (preheader), opcional. */
  preheader?: string;
}

/**
 * Envolve o corpo no layout padrão (header + footer). O `bodyHtml` deve conter
 * apenas o conteúdo específico de cada e-mail.
 */
export function renderLayout({ title, bodyHtml, preheader }: LayoutOptions): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin: 0; padding: 0; background: #f3f4f6;">
    ${
      preheader
        ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(
            preheader,
          )}</div>`
        : ""
    }
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f3f4f6; padding: 24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
            <tr>
              <td style="background: ${BRAND.color}; padding: 22px 28px; text-align: center;">
                <img src="${BRAND.logoUrl}" alt="${escapeHtml(
                  BRAND.name,
                )}" height="44" style="height: 44px; width: auto; display: inline-block;" />
              </td>
            </tr>
            <tr>
              <td style="padding: 32px 28px 24px; color: #111827; font-size: 15px; line-height: 1.6;">
                <h1 style="margin: 0 0 16px; font-size: 20px; color: ${BRAND.color};">${escapeHtml(
                  title,
                )}</h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding: 20px 28px; background: #fafafa; border-top: 1px solid #f0f0f0; color: #6b7280; font-size: 12px; line-height: 1.5;">
                <p style="margin: 0 0 6px;">${escapeHtml(BRAND.name)} — Portal do Cliente B2B</p>
                <p style="margin: 0;">Precisa de ajuda? Fale com a gente em
                  <a href="mailto:${BRAND.supportEmail}" style="color: ${BRAND.color}; text-decoration: none;">${escapeHtml(
                    BRAND.supportEmail,
                  )}</a>.
                </p>
                <p style="margin: 8px 0 0; color: #9ca3af;">&copy; ${year} ${escapeHtml(
                  BRAND.name,
                )}. Todos os direitos reservados.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
