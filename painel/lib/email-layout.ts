/**
 * Layout visual dos e-mails — espelho do template usado no gateway
 * (`gateway/src/services/email/layout.ts`). Mantém a identidade da marca
 * consistente em toda a plataforma.
 */

export const BRAND = {
  name: "Garrafaria Serra Negra",
  color: "#7f1d1d",
  logoUrl:
    "https://garrafariaserranegra.com.br/wp-content/uploads/2023/05/LOGO-GARRAFARIA-SERRA-NEGRA-40-ANOS-SITE-OFICIAL.png",
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

export function renderButton({ label, url }: { label: string; url: string }): string {
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

export function renderLayout({
  title,
  bodyHtml,
  preheader,
}: {
  title: string;
  bodyHtml: string;
  preheader?: string;
}): string {
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
                )}" height="44" style="height: 44px; width: auto; display: inline-block; filter: brightness(0) invert(1);" />
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
                <p style="margin: 0 0 6px;">${escapeHtml(BRAND.name)} — Painel</p>
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
