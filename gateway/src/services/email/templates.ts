/**
 * Templates tipados de e-mail da plataforma — todos usam o layout visual
 * único (`renderLayout`) e o transporte unificado (`sendEmail`).
 */

import { sendEmail } from "./transport.js";
import {
  renderLayout,
  renderButton,
  renderCodeBox,
  escapeHtml,
  BRAND,
} from "./layout.js";

function p(text: string): string {
  return `<p style="margin: 0 0 14px;">${text}</p>`;
}

function muted(text: string): string {
  return `<p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;">${text}</p>`;
}

/* ─────────────────────── OTP / primeiro acesso ─────────────────────── */

export async function sendOtpEmail(
  to: string,
  otp: string,
  customerName: string,
): Promise<boolean> {
  const title = "Seu código de verificação";
  const html = renderLayout({
    title,
    preheader: `Código de verificação: ${otp}`,
    bodyHtml: `
      ${p(`Olá, <strong>${escapeHtml(customerName)}</strong>!`)}
      ${p("Use o código abaixo para concluir seu acesso ao Portal B2B:")}
      ${renderCodeBox(otp)}
      ${muted("Este código é válido por <strong>15 minutos</strong>.")}
      ${muted("Se você não solicitou este código, ignore este e-mail.")}
    `,
  });
  const text = `Olá, ${customerName}! Seu código de verificação é: ${otp} (válido por 15 minutos).`;
  return sendEmail({ to, subject: `${otp} é o seu código — ${BRAND.name}`, html, text });
}

/* ─────────────────────── Recuperação de senha (link) ─────────────────────── */

export async function sendPasswordResetEmail(params: {
  to: string;
  displayName: string;
  resetUrl: string;
  expiresLabel: string;
}): Promise<boolean> {
  const { to, displayName, resetUrl, expiresLabel } = params;
  const title = "Redefinição de senha";
  const html = renderLayout({
    title,
    preheader: "Crie uma nova senha de acesso.",
    bodyHtml: `
      ${p(`Olá, <strong>${escapeHtml(displayName)}</strong>.`)}
      ${p("Recebemos um pedido para redefinir sua senha. Clique no botão abaixo para criar uma nova:")}
      ${renderButton({ label: "Redefinir minha senha", url: resetUrl })}
      ${muted(`O link é válido até <strong>${escapeHtml(expiresLabel)}</strong> e só pode ser usado uma vez.`)}
      ${muted(`Se o botão não funcionar, copie e cole no navegador:<br><span style="word-break: break-all; color: #1f2937;">${escapeHtml(resetUrl)}</span>`)}
      ${muted("Se você não solicitou esta redefinição, ignore este e-mail — sua senha atual continua válida.")}
    `,
  });
  const text =
    `Olá, ${displayName}. Para redefinir sua senha, acesse: ${resetUrl} ` +
    `(válido até ${expiresLabel}). Se não solicitou, ignore este e-mail.`;
  return sendEmail({ to, subject: `Redefinição de senha — ${BRAND.name}`, html, text });
}

/* ─────────────────────── Cadastro de empresa nova ─────────────────────── */

export async function sendRegistrationReceivedEmail(params: {
  to: string;
  razaoSocial: string;
}): Promise<boolean> {
  const { to, razaoSocial } = params;
  const title = "Recebemos seu cadastro";
  const html = renderLayout({
    title,
    preheader: "Seu cadastro está em análise.",
    bodyHtml: `
      ${p(`Olá, <strong>${escapeHtml(razaoSocial)}</strong>!`)}
      ${p("Recebemos sua solicitação de cadastro no Portal B2B. Nossa equipe comercial vai analisar seus dados e, assim que aprovado, você receberá um e-mail com as instruções para o primeiro acesso.")}
      ${muted("Esse processo costuma levar pouco tempo. Agradecemos pela preferência!")}
    `,
  });
  const text = `Olá, ${razaoSocial}! Recebemos seu cadastro no Portal B2B. Em breve nossa equipe comercial fará a análise e enviaremos as instruções de acesso.`;
  return sendEmail({ to, subject: `Cadastro recebido — ${BRAND.name}`, html, text });
}

export async function sendRegistrationApprovedEmail(params: {
  to: string;
  razaoSocial: string;
}): Promise<boolean> {
  const { to, razaoSocial } = params;
  const title = "Cadastro aprovado — bem-vindo(a)!";
  const html = renderLayout({
    title,
    preheader: "Seu acesso ao Portal B2B foi liberado.",
    bodyHtml: `
      ${p(`Olá, <strong>${escapeHtml(razaoSocial)}</strong>!`)}
      ${p("Seu cadastro foi aprovado e seu acesso ao Portal B2B está liberado. Faça seu primeiro acesso para criar sua senha e começar a comprar.")}
      ${renderButton({ label: "Acessar o Portal B2B", url: `${BRAND.portalUrl}/login` })}
      ${muted("No primeiro acesso, informe seu CNPJ e siga as etapas de verificação por e-mail.")}
    `,
  });
  const text = `Olá, ${razaoSocial}! Seu cadastro foi aprovado. Acesse ${BRAND.portalUrl}/login e faça seu primeiro acesso informando o CNPJ.`;
  return sendEmail({ to, subject: `Cadastro aprovado — ${BRAND.name}`, html, text });
}

export async function sendRegistrationRejectedEmail(params: {
  to: string;
  razaoSocial: string;
  reason?: string | null;
}): Promise<boolean> {
  const { to, razaoSocial, reason } = params;
  const title = "Sobre o seu cadastro";
  const html = renderLayout({
    title,
    preheader: "Atualização sobre seu cadastro.",
    bodyHtml: `
      ${p(`Olá, <strong>${escapeHtml(razaoSocial)}</strong>.`)}
      ${p("Não foi possível concluir a aprovação do seu cadastro no momento.")}
      ${reason ? p(`Motivo: ${escapeHtml(reason)}`) : ""}
      ${muted(`Para mais informações, fale com nossa equipe comercial em <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.color};">${escapeHtml(BRAND.supportEmail)}</a>.`)}
    `,
  });
  const text =
    `Olá, ${razaoSocial}. Não foi possível concluir a aprovação do seu cadastro.` +
    (reason ? ` Motivo: ${reason}.` : "") +
    ` Fale com a gente em ${BRAND.supportEmail}.`;
  return sendEmail({ to, subject: `Sobre o seu cadastro — ${BRAND.name}`, html, text });
}

/* ─────────────────────── Acesso por e-mail (cliente SAP sem e-mail) ─────────────────────── */

export async function sendEmailAccessRequestedEmail(params: {
  to: string;
  cardName: string;
}): Promise<boolean> {
  const { to, cardName } = params;
  const title = "Recebemos sua solicitação de acesso";
  const html = renderLayout({
    title,
    preheader: "Sua solicitação de acesso está em análise.",
    bodyHtml: `
      ${p(`Olá, <strong>${escapeHtml(cardName)}</strong>!`)}
      ${p("Recebemos sua solicitação para cadastrar este e-mail como acesso ao Portal B2B. Nossa equipe vai validar e, assim que aprovado, você receberá um e-mail para concluir o primeiro acesso.")}
      ${muted("Você não precisa fazer mais nada agora — avisaremos por aqui.")}
    `,
  });
  const text = `Olá, ${cardName}! Recebemos sua solicitação de acesso ao Portal B2B. Avisaremos por e-mail assim que for aprovada.`;
  return sendEmail({ to, subject: `Solicitação de acesso recebida — ${BRAND.name}`, html, text });
}

export async function sendEmailAccessApprovedEmail(params: {
  to: string;
  cardName: string;
  cnpj?: string;
}): Promise<boolean> {
  const { to, cardName } = params;
  const title = "Acesso liberado — faça seu primeiro acesso";
  const html = renderLayout({
    title,
    preheader: "Seu e-mail de acesso foi aprovado.",
    bodyHtml: `
      ${p(`Olá, <strong>${escapeHtml(cardName)}</strong>!`)}
      ${p("Seu e-mail foi aprovado como acesso ao Portal B2B. Agora é só fazer o primeiro acesso: informe seu CNPJ, confirme este e-mail e crie sua senha.")}
      ${renderButton({ label: "Fazer primeiro acesso", url: `${BRAND.portalUrl}/login` })}
      ${muted("Por segurança, enviaremos um código de verificação para este e-mail durante o primeiro acesso.")}
    `,
  });
  const text = `Olá, ${cardName}! Seu e-mail foi aprovado. Acesse ${BRAND.portalUrl}/login, informe o CNPJ, confirme o e-mail e crie sua senha.`;
  return sendEmail({ to, subject: `Acesso liberado — ${BRAND.name}`, html, text });
}

export async function sendEmailAccessRejectedEmail(params: {
  to: string;
  cardName: string;
  reason?: string | null;
}): Promise<boolean> {
  const { to, cardName, reason } = params;
  const title = "Sobre sua solicitação de acesso";
  const html = renderLayout({
    title,
    preheader: "Atualização sobre sua solicitação de acesso.",
    bodyHtml: `
      ${p(`Olá, <strong>${escapeHtml(cardName)}</strong>.`)}
      ${p("Não foi possível aprovar este e-mail como acesso ao Portal B2B no momento.")}
      ${reason ? p(`Motivo: ${escapeHtml(reason)}`) : ""}
      ${muted(`Para mais informações, fale com nossa equipe comercial em <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.color};">${escapeHtml(BRAND.supportEmail)}</a>.`)}
    `,
  });
  const text =
    `Olá, ${cardName}. Não foi possível aprovar sua solicitação de acesso.` +
    (reason ? ` Motivo: ${reason}.` : "") +
    ` Fale com a gente em ${BRAND.supportEmail}.`;
  return sendEmail({ to, subject: `Sobre sua solicitação de acesso — ${BRAND.name}`, html, text });
}

/* ─────────────────────── Avisos internos (equipe comercial) ─────────────────────── */

export async function sendInternalAccessRequestNotification(params: {
  to: string;
  cardName: string;
  cnpj: string;
  requestedEmail: string;
  contactName?: string | null;
  panelUrl?: string;
}): Promise<boolean> {
  const { to, cardName, cnpj, requestedEmail, contactName, panelUrl } = params;
  const title = "Nova solicitação de acesso B2B";
  const html = renderLayout({
    title,
    preheader: `${cardName} solicitou acesso ao portal.`,
    bodyHtml: `
      ${p("Uma empresa já cadastrada no SAP (sem e-mail) solicitou acesso ao Portal B2B:")}
      ${p(`<strong>Empresa:</strong> ${escapeHtml(cardName)}<br>
           <strong>CNPJ:</strong> ${escapeHtml(cnpj)}<br>
           <strong>E-mail solicitado:</strong> ${escapeHtml(requestedEmail)}` +
        (contactName ? `<br><strong>Contato:</strong> ${escapeHtml(contactName)}` : ""))}
      ${panelUrl ? renderButton({ label: "Revisar em B2B Acessos", url: panelUrl }) : ""}
    `,
  });
  const text =
    `Nova solicitação de acesso B2B — ${cardName} (CNPJ ${cnpj}). ` +
    `E-mail solicitado: ${requestedEmail}.` +
    (contactName ? ` Contato: ${contactName}.` : "") +
    (panelUrl ? ` Revisar: ${panelUrl}` : "");
  return sendEmail({ to, subject: `Nova solicitação de acesso — ${cardName}`, html, text });
}

/* ─────────────────────── Pedidos ─────────────────────── */

export async function sendOrderConfirmationEmail(params: {
  to: string;
  cardName: string;
  docNum: number | string;
}): Promise<boolean> {
  const { to, cardName, docNum } = params;
  const title = "Pedido recebido";
  const html = renderLayout({
    title,
    preheader: `Pedido #${docNum} recebido.`,
    bodyHtml: `
      ${p(`Olá, <strong>${escapeHtml(cardName)}</strong>!`)}
      ${p(`Recebemos seu pedido <strong>#${escapeHtml(String(docNum))}</strong> pelo Portal B2B. Em breve nossa equipe dará andamento.`)}
      ${renderButton({ label: "Acompanhar meus pedidos", url: `${BRAND.portalUrl}/pedidos` })}
    `,
  });
  const text = `Olá, ${cardName}! Recebemos seu pedido #${docNum} pelo Portal B2B. Acompanhe em ${BRAND.portalUrl}/pedidos.`;
  return sendEmail({ to, subject: `Pedido #${docNum} recebido — ${BRAND.name}`, html, text });
}

export async function sendNewOrderToSellerEmail(params: {
  to: string;
  sellerName?: string | null;
  cardName: string;
  docNum: number | string;
  docTotal?: string;
  orderUrl?: string;
}): Promise<boolean> {
  const { to, sellerName, cardName, docNum, docTotal, orderUrl } = params;
  const title = "Novo pedido pelo Portal B2B";
  const html = renderLayout({
    title,
    preheader: `${cardName} fez o pedido #${docNum}.`,
    bodyHtml: `
      ${p(`Olá${sellerName ? `, <strong>${escapeHtml(sellerName)}</strong>` : ""}!`)}
      ${p(`O cliente <strong>${escapeHtml(cardName)}</strong> realizou um novo pedido pelo Portal B2B:`)}
      ${p(`<strong>Pedido:</strong> #${escapeHtml(String(docNum))}` +
        (docTotal ? `<br><strong>Valor:</strong> ${escapeHtml(docTotal)}` : ""))}
      ${orderUrl ? renderButton({ label: "Acompanhar pedido", url: orderUrl }) : ""}
    `,
  });
  const text =
    `Novo pedido pelo Portal B2B — ${cardName}, pedido #${docNum}.` +
    (docTotal ? ` Valor: ${docTotal}.` : "") +
    (orderUrl ? ` Acompanhe: ${orderUrl}` : "");
  return sendEmail({ to, subject: `Novo pedido #${docNum} — ${cardName}`, html, text });
}

/**
 * Notifica o comercial sobre uma nova interação do cliente em um pedido:
 * mensagem livre ou solicitação de alteração/cancelamento.
 */
export async function sendOrderInteractionEmail(params: {
  to: string;
  cardName: string;
  docNum: number | string;
  kind: "message" | "change_request" | "cancel_request";
  body: string;
  orderUrl?: string;
}): Promise<boolean> {
  const { to, cardName, docNum, kind, body, orderUrl } = params;
  const label =
    kind === "cancel_request"
      ? "Solicitação de cancelamento"
      : kind === "change_request"
        ? "Solicitação de alteração"
        : "Nova mensagem";
  const title = `${label} — Pedido #${docNum}`;
  const html = renderLayout({
    title,
    preheader: `${cardName}: ${label.toLowerCase()} no pedido #${docNum}.`,
    bodyHtml: `
      ${p(`O cliente <strong>${escapeHtml(cardName)}</strong> registrou: <strong>${escapeHtml(label.toLowerCase())}</strong> no pedido <strong>#${escapeHtml(String(docNum))}</strong>.`)}
      ${p(`<em>"${escapeHtml(body)}"</em>`)}
      ${orderUrl ? renderButton({ label: "Abrir pedido no painel", url: orderUrl }) : ""}
    `,
  });
  const text =
    `${label} — Pedido #${docNum} (${cardName}): ${body}` +
    (orderUrl ? ` — ${orderUrl}` : "");
  return sendEmail({ to, subject: title, html, text });
}

export async function sendOrderApprovedEmail(params: {
  to: string;
  cardName: string;
  docNum: number | string;
}): Promise<boolean> {
  const { to, cardName, docNum } = params;
  const title = "Pedido confirmado";
  const html = renderLayout({
    title,
    preheader: `Pedido #${docNum} confirmado e em processamento.`,
    bodyHtml: `
      ${p(`Olá, <strong>${escapeHtml(cardName)}</strong>!`)}
      ${p(`Seu pedido <strong>#${escapeHtml(String(docNum))}</strong> foi <strong>confirmado</strong> pela nossa equipe e já está em processamento.`)}
      ${renderButton({ label: "Acompanhar meus pedidos", url: `${BRAND.portalUrl}/pedidos` })}
    `,
  });
  const text = `Olá, ${cardName}! Seu pedido #${docNum} foi confirmado pela nossa equipe e está em processamento. Acompanhe em ${BRAND.portalUrl}/pedidos.`;
  return sendEmail({ to, subject: `Pedido #${docNum} confirmado — ${BRAND.name}`, html, text });
}

export async function sendOrderRejectedEmail(params: {
  to: string;
  cardName: string;
  reason?: string | null;
}): Promise<boolean> {
  const { to, cardName, reason } = params;
  const title = "Sobre o seu pedido";
  const html = renderLayout({
    title,
    preheader: `Atualização sobre o seu pedido no Portal B2B.`,
    bodyHtml: `
      ${p(`Olá, <strong>${escapeHtml(cardName)}</strong>!`)}
      ${p(`Infelizmente não foi possível dar andamento ao seu pedido feito pelo Portal B2B.`)}
      ${reason ? p(`<strong>Motivo:</strong> ${escapeHtml(reason)}`) : ""}
      ${p("Nossa equipe comercial pode ajudar a ajustar o pedido. Em caso de dúvidas, entre em contato conosco.")}
      ${renderButton({ label: "Fazer um novo pedido", url: `${BRAND.portalUrl}/catalogo` })}
    `,
  });
  const text =
    `Olá, ${cardName}! Não foi possível dar andamento ao seu pedido feito pelo Portal B2B.` +
    (reason ? ` Motivo: ${reason}.` : "") +
    ` Faça um novo pedido em ${BRAND.portalUrl}/catalogo.`;
  return sendEmail({ to, subject: `Atualização sobre o seu pedido — ${BRAND.name}`, html, text });
}

/* ─────────────────────── Catálogo ─────────────────────── */

export async function sendBackInStockEmail(params: {
  to: string;
  productName: string;
}): Promise<boolean> {
  const { to, productName } = params;
  const title = "Produto disponível novamente";
  const html = renderLayout({
    title,
    preheader: `${productName} voltou ao estoque.`,
    bodyHtml: `
      ${p("Boas notícias!")}
      ${p(`O produto <strong>${escapeHtml(productName)}</strong> está novamente disponível em nosso catálogo B2B.`)}
      ${renderButton({ label: "Ver no catálogo", url: `${BRAND.portalUrl}/catalogo` })}
    `,
  });
  const text = `O produto ${productName} está disponível novamente no catálogo B2B. Acesse ${BRAND.portalUrl}/catalogo.`;
  return sendEmail({ to, subject: `${productName} está disponível novamente — ${BRAND.name}`, html, text });
}
