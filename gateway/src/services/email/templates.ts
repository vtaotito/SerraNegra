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

/** Enviado somente após publish no SAP + criação da credencial. */
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
      ${p("Seu cadastro foi publicado e seu acesso ao Portal B2B está liberado. Faça seu primeiro acesso para criar sua senha e começar a solicitar cotações.")}
      ${renderButton({ label: "Acessar o Portal B2B", url: `${BRAND.portalUrl}/login` })}
      ${muted("No primeiro acesso, informe seu CNPJ e siga as etapas de verificação por e-mail (você também receberá um código OTP).")}
    `,
  });
  const text = `Olá, ${razaoSocial}! Seu cadastro foi publicado. Acesse ${BRAND.portalUrl}/login e faça seu primeiro acesso informando o CNPJ.`;
  return sendEmail({ to, subject: `Acesso liberado — ${BRAND.name}`, html, text });
}

export async function sendRegistrationInReviewEmail(params: {
  to: string;
  razaoSocial: string;
}): Promise<boolean> {
  const { to, razaoSocial } = params;
  const title = "Cadastro em análise";
  const html = renderLayout({
    title,
    preheader: "Nossa equipe comercial está analisando seu cadastro.",
    bodyHtml: `
      ${p(`Olá, <strong>${escapeHtml(razaoSocial)}</strong>!`)}
      ${p("Seu cadastro entrou em análise pela nossa equipe comercial. Em breve você receberá uma atualização por e-mail.")}
      ${muted("Não é necessário reenviar a solicitação.")}
    `,
  });
  const text = `Olá, ${razaoSocial}! Seu cadastro está em análise pela equipe comercial. Avisaremos por e-mail assim que houver uma atualização.`;
  return sendEmail({ to, subject: `Cadastro em análise — ${BRAND.name}`, html, text });
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

/** Aviso interno dedicado: empresa NOVA (fora do SAP) pediu cadastro. */
export async function sendInternalNewRegistrationNotification(params: {
  to: string;
  razaoSocial: string;
  cnpj: string;
  email: string;
  contactName?: string | null;
  city?: string | null;
  state?: string | null;
  panelUrl?: string;
}): Promise<boolean> {
  const { to, razaoSocial, cnpj, email, contactName, city, state, panelUrl } = params;
  const title = "Novo cadastro B2B para aprovação";
  const local =
    city || state
      ? `<br><strong>Cidade/UF:</strong> ${escapeHtml([city, state].filter(Boolean).join(" / "))}`
      : "";
  const html = renderLayout({
    title,
    preheader: `${razaoSocial} solicitou cadastro no Portal B2B.`,
    bodyHtml: `
      ${p("Uma empresa <strong>nova</strong> (ainda fora do SAP) solicitou cadastro no Portal B2B:")}
      ${p(`<strong>Razão social:</strong> ${escapeHtml(razaoSocial)}<br>
           <strong>CNPJ:</strong> ${escapeHtml(cnpj)}<br>
           <strong>E-mail:</strong> ${escapeHtml(email)}` +
        (contactName ? `<br><strong>Contato:</strong> ${escapeHtml(contactName)}` : "") +
        local)}
      ${panelUrl ? renderButton({ label: "Revisar cadastro no Painel", url: panelUrl }) : ""}
      ${muted("Defina lista de preços e vendedor antes de aprovar e publicar no SAP.")}
    `,
  });
  const text =
    `Novo cadastro B2B — ${razaoSocial} (CNPJ ${cnpj}). E-mail: ${email}.` +
    (contactName ? ` Contato: ${contactName}.` : "") +
    (panelUrl ? ` Revisar: ${panelUrl}` : "");
  return sendEmail({
    to,
    subject: `Novo cadastro B2B — ${razaoSocial}`,
    html,
    text,
  });
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

/**
 * Confirma ao cliente que o pedido foi cancelado. Serve tanto para o cancelamento
 * feito pelo próprio cliente no portal quanto pela equipe de vendas no painel.
 */
export async function sendOrderCancelledEmail(params: {
  to: string;
  cardName: string;
  docNum: number | string;
  reason?: string | null;
  byCustomer?: boolean;
}): Promise<boolean> {
  const { to, cardName, docNum, reason, byCustomer } = params;
  const title = "Pedido cancelado";
  const intro = byCustomer
    ? `Seu pedido <strong>#${escapeHtml(String(docNum))}</strong> foi <strong>cancelado</strong> conforme solicitado.`
    : `Seu pedido <strong>#${escapeHtml(String(docNum))}</strong> foi <strong>cancelado</strong>.`;
  const html = renderLayout({
    title,
    preheader: `Pedido #${docNum} cancelado.`,
    bodyHtml: `
      ${p(`Olá, <strong>${escapeHtml(cardName)}</strong>!`)}
      ${p(intro)}
      ${reason ? p(`<strong>Motivo:</strong> ${escapeHtml(reason)}`) : ""}
      ${p("Se precisar, você pode fazer um novo pedido a qualquer momento.")}
      ${renderButton({ label: "Fazer um novo pedido", url: `${BRAND.portalUrl}/catalogo` })}
    `,
  });
  const text =
    `Olá, ${cardName}! Seu pedido #${docNum} foi cancelado.` +
    (reason ? ` Motivo: ${reason}.` : "") +
    ` Faça um novo pedido em ${BRAND.portalUrl}/catalogo.`;
  return sendEmail({ to, subject: `Pedido #${docNum} cancelado — ${BRAND.name}`, html, text });
}

/* ─────────────────────── Cotações B2B ─────────────────────── */

export async function sendQuotationCreatedEmail(params: {
  to: string;
  cardName: string;
  docNum: number | string;
}): Promise<boolean> {
  const { to, cardName, docNum } = params;
  const title = "Cotação recebida";
  const html = renderLayout({
    title,
    preheader: `Cotação #${docNum} recebida.`,
    bodyHtml: `
      ${p(`Olá, <strong>${escapeHtml(cardName)}</strong>!`)}
      ${p(`Recebemos sua solicitação de cotação <strong>#${escapeHtml(String(docNum))}</strong>. Nossa equipe comercial vai revisar e, após a aprovação, o pedido será gerado.`)}
      ${renderButton({ label: "Acompanhar cotações e pedidos", url: `${BRAND.portalUrl}/pedidos` })}
    `,
  });
  const text = `Olá, ${cardName}! Recebemos sua cotação #${docNum}. Acompanhe em ${BRAND.portalUrl}/pedidos.`;
  return sendEmail({ to, subject: `Cotação #${docNum} recebida — ${BRAND.name}`, html, text });
}

export async function sendNewQuotationToSellerEmail(params: {
  to: string;
  sellerName?: string | null;
  cardName: string;
  docNum: number | string;
  panelUrl?: string;
}): Promise<boolean> {
  const { to, sellerName, cardName, docNum, panelUrl } = params;
  const title = "Nova cotação pelo Portal B2B";
  const html = renderLayout({
    title,
    preheader: `${cardName} solicitou a cotação #${docNum}.`,
    bodyHtml: `
      ${p(`Olá${sellerName ? `, <strong>${escapeHtml(sellerName)}</strong>` : ""}!`)}
      ${p(`O cliente <strong>${escapeHtml(cardName)}</strong> solicitou uma nova cotação pelo Portal B2B:`)}
      ${p(`<strong>Cotação:</strong> #${escapeHtml(String(docNum))}`)}
      ${panelUrl ? renderButton({ label: "Revisar cotação no Painel", url: panelUrl }) : ""}
    `,
  });
  const text =
    `Nova cotação B2B — ${cardName}, cotação #${docNum}.` +
    (panelUrl ? ` Revisar: ${panelUrl}` : "");
  return sendEmail({ to, subject: `Nova cotação #${docNum} — ${cardName}`, html, text });
}

export async function sendQuotationConvertedEmail(params: {
  to: string;
  cardName: string;
  quotationDocNum: number | string;
  orderDocNum: number | string;
}): Promise<boolean> {
  const { to, cardName, quotationDocNum, orderDocNum } = params;
  const title = "Cotação aprovada — pedido gerado";
  const html = renderLayout({
    title,
    preheader: `Pedido #${orderDocNum} gerado a partir da cotação #${quotationDocNum}.`,
    bodyHtml: `
      ${p(`Olá, <strong>${escapeHtml(cardName)}</strong>!`)}
      ${p(`Sua cotação <strong>#${escapeHtml(String(quotationDocNum))}</strong> foi aprovada e geramos o pedido <strong>#${escapeHtml(String(orderDocNum))}</strong>.`)}
      ${renderButton({ label: "Acompanhar meu pedido", url: `${BRAND.portalUrl}/pedidos` })}
    `,
  });
  const text = `Olá, ${cardName}! Cotação #${quotationDocNum} aprovada. Pedido #${orderDocNum} gerado. Acompanhe em ${BRAND.portalUrl}/pedidos.`;
  return sendEmail({
    to,
    subject: `Pedido #${orderDocNum} gerado — ${BRAND.name}`,
    html,
    text,
  });
}

export async function sendQuotationRejectedEmail(params: {
  to: string;
  cardName: string;
  docNum: number | string;
  reason?: string | null;
}): Promise<boolean> {
  const { to, cardName, docNum, reason } = params;
  const title = "Sobre a sua cotação";
  const html = renderLayout({
    title,
    preheader: `Atualização sobre a cotação #${docNum}.`,
    bodyHtml: `
      ${p(`Olá, <strong>${escapeHtml(cardName)}</strong>!`)}
      ${p(`Não foi possível aprovar a cotação <strong>#${escapeHtml(String(docNum))}</strong> no momento.`)}
      ${reason ? p(`<strong>Motivo:</strong> ${escapeHtml(reason)}`) : ""}
      ${renderButton({ label: "Solicitar nova cotação", url: `${BRAND.portalUrl}/catalogo` })}
    `,
  });
  const text =
    `Olá, ${cardName}! Cotação #${docNum} não foi aprovada.` +
    (reason ? ` Motivo: ${reason}.` : "") +
    ` Solicite nova cotação em ${BRAND.portalUrl}/catalogo.`;
  return sendEmail({ to, subject: `Sobre a cotação #${docNum} — ${BRAND.name}`, html, text });
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
