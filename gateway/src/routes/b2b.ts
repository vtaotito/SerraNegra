import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createSapClient } from "../config/sap.js";
import { SapOrdersService } from "../services/sapOrdersService.js";
import { SapEntitiesService } from "../services/sapEntitiesService.js";
import { SapHttpError } from "../../../sap-connector/src/errors.js";
import { sapConfigStore } from "../config/sapConfigStore.js";
import { B2BAuthService } from "../services/b2bAuthService.js";
import { B2BRegistrationService } from "../services/b2bRegistrationService.js";
import {
  B2BDeliveryService,
  toDeliveryDto,
  type DeliveryInput,
} from "../services/b2bDeliveryService.js";
import { captureB2BLead } from "../services/rdStationService.js";
import { B2BEmailRequestService } from "../services/b2bEmailRequestService.js";
import { B2BFavoritesService } from "../services/b2bFavoritesService.js";
import { B2BOrderFollowupService } from "../services/b2bOrderFollowupService.js";
import {
  B2BOrderStatusService,
  isOrderStatus,
  type OrderStatus,
} from "../services/b2bOrderStatusService.js";
import {
  B2BPendingOrderService,
  type PendingOrderItem,
  type PendingOrderRow,
} from "../services/b2bPendingOrderService.js";
import {
  B2BOrderMessageService,
  isMessageKind,
  type RequestStatus,
} from "../services/b2bOrderMessageService.js";
import {
  B2BOrderItemNoteService,
  isItemFlag,
} from "../services/b2bOrderItemNoteService.js";
import {
  B2BCatalogService,
  fetchAllGsnProducts,
  fetchAllWooProducts,
  matchSapToGsn,
  buildFamilyImageIndex,
  familyKeyOfName,
  EXCLUDED_SAP_GROUPS,
  setSapGroupNames,
  getGroupDisplayName,
  normalizeCategoryName,
  resolvePackaging,
  toB2BCatalogItem,
  toB2BProductDetail,
  toAdminCatalogProduct,
  deriveCanonicalUrl,
  parseKeywords,
  getBaseProductName,
  parseProductAttributes,
  extractDiameter,
  type CatalogProduct,
} from "../services/b2bCatalogService.js";
import {
  SeoAiService,
  SeoAiNotConfiguredError,
  SeoAiGenerationError,
} from "../services/seoAiService.js";
import { SeoBulkGenerator } from "../services/seoBulkGenerator.js";
import { z } from "zod";
import {
  SearchConsoleService,
  GscNotConfiguredError,
  isoDaysAgo,
  type GscPageRow,
} from "../services/searchConsoleService.js";
import { computeSeoScore, type SeoScoreResult } from "../services/seoQuality.js";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  sendOtpEmail,
  isEmailConfigured,
  sendBackInStockEmail,
  sendRegistrationReceivedEmail,
  sendRegistrationApprovedEmail,
  sendRegistrationRejectedEmail,
  sendEmailAccessRequestedEmail,
  sendEmailAccessApprovedEmail,
  sendEmailAccessRejectedEmail,
  sendInternalAccessRequestNotification,
  sendOrderConfirmationEmail,
  sendNewOrderToSellerEmail,
  sendOrderInteractionEmail,
  sendOrderApprovedEmail,
  sendOrderRejectedEmail,
  sendOrderCancelledEmail,
} from "../services/emailService.js";
import jwt from "jsonwebtoken";

const B2B_JWT_SECRET =
  process.env.B2B_JWT_SECRET ??
  process.env.INTERNAL_SHARED_SECRET ??
  "b2b-secret-change-me";
const B2B_JWT_EXPIRES = "24h";
const B2B_DB_URL =
  process.env.B2B_DATABASE_URL ??
  "postgresql://wms:wms@postgres:5432/wms";

const B2B_ADMIN_USER = process.env.B2B_ADMIN_USER ?? "admin";
const B2B_ADMIN_PASS = process.env.B2B_ADMIN_PASSWORD ?? "gsn@comercial2026";

// Diretório físico dos uploads (mesmo do @fastify/static no index.ts).
const UPLOADS_DIR = process.env.UPLOADS_DIR ?? "/app/uploads";
const B2B_PORTAL_URL_RAW =
  process.env.B2B_PORTAL_URL ?? "https://garrafariaserranegra.com.br/b2b";

// Base pública das imagens enviadas. Prioriza B2B_PUBLIC_UPLOADS_BASE; senão
// deriva a ORIGEM pública de B2B_PORTAL_URL e serve via nginx em /api/uploads.
function deriveUploadsBase(): string {
  const explicit = process.env.B2B_PUBLIC_UPLOADS_BASE;
  if (explicit && explicit.trim()) return explicit.trim().replace(/\/+$/, "");
  try {
    const u = new URL(B2B_PORTAL_URL_RAW);
    return `${u.origin}/api/uploads/products`;
  } catch {
    return "/api/uploads/products";
  }
}
const B2B_PUBLIC_UPLOADS_BASE = deriveUploadsBase();
const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const IMAGE_EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Caixa interna que recebe avisos de novas solicitações de acesso/cadastro.
const EMAIL_COMMERCIAL =
  process.env.EMAIL_COMMERCIAL ??
  process.env.EMAIL_SUPPORT ??
  "comercial@garrafariaserranegra.com.br";
// URL pública do painel — usada nos links dos avisos internos.
const PAINEL_URL =
  process.env.PAINEL_URL ?? "https://painel.garrafariaserranegra.com.br";

// Depósito padrão de saída dos pedidos do Portal B2B / venda assistida.
// O SAP exige um depósito válido por linha; quando o item não traz um depósito
// explícito, usamos o depósito principal de distribuição (01.02 responde por
// ~96% das linhas históricas). Configurável por ambiente.
const B2B_DEFAULT_WAREHOUSE = process.env.B2B_DEFAULT_WAREHOUSE ?? "01.02";

// Filial/branch padrão (BPLId) exigida pelo SAP na criação do pedido.
// 1 = "GARRAFARIA SERRA NEGRA EIRELI" (matriz, dona do depósito 01.02).
const B2B_DEFAULT_BRANCH = Number(process.env.B2B_DEFAULT_BRANCH ?? "1");

// "Utilização" (campo fiscal brasileiro `Usage` por linha) obrigatório pelo
// add-on fiscal. 10 = venda/comercialização (padrão em ~95% das linhas).
const B2B_DEFAULT_USAGE = Number(process.env.B2B_DEFAULT_USAGE ?? "10");

interface B2BTokenPayload {
  cardCode: string;
  cardName: string;
  cnpj: string;
  email?: string;
  type: "b2b_customer";
}

interface B2BAdminTokenPayload {
  user: string;
  type: "b2b_admin";
}

function normalizeCnpj(raw: string): string {
  return raw.replace(/\D/g, "");
}

function maskEmail(email: string): string {
  const atIdx = email.indexOf("@");
  if (atIdx < 0) return "*".repeat(Math.min(5, email.length)) + email.slice(5);
  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx);
  const hide = Math.min(5, local.length);
  return "*".repeat(hide) + local.slice(hide) + domain;
}

function signB2BToken(payload: B2BTokenPayload): string {
  return jwt.sign(payload, B2B_JWT_SECRET, {
    expiresIn: B2B_JWT_EXPIRES,
    issuer: "wms-b2b",
  });
}

function verifyB2BToken(token: string): B2BTokenPayload {
  return jwt.verify(token, B2B_JWT_SECRET, {
    issuer: "wms-b2b",
  }) as B2BTokenPayload;
}

function signTempToken(cnpj: string): string {
  return jwt.sign({ cnpj, purpose: "set-password" }, B2B_JWT_SECRET, {
    expiresIn: "30m",
    issuer: "wms-b2b-temp",
  });
}

function verifyTempToken(token: string): { cnpj: string } {
  return jwt.verify(token, B2B_JWT_SECRET, {
    issuer: "wms-b2b-temp",
  }) as { cnpj: string };
}

function signAdminToken(user: string): string {
  return jwt.sign({ user, type: "b2b_admin" } as B2BAdminTokenPayload, B2B_JWT_SECRET, {
    expiresIn: "8h",
    issuer: "wms-b2b-admin",
  });
}

function verifyAdminToken(token: string): B2BAdminTokenPayload {
  return jwt.verify(token, B2B_JWT_SECRET, {
    issuer: "wms-b2b-admin",
  }) as B2BAdminTokenPayload;
}

async function b2bAuth(req: FastifyRequest, reply: FastifyReply) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    reply.code(401).send({ error: "Token ausente" });
    return;
  }
  try {
    const payload = verifyB2BToken(authHeader.slice(7));
    (req as any).b2bCustomer = payload;
  } catch {
    reply.code(401).send({ error: "Token invalido ou expirado" });
  }
}

async function b2bAdminAuth(req: FastifyRequest, reply: FastifyReply) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    reply.code(401).send({ error: "Token admin ausente" });
    return;
  }
  try {
    const payload = verifyAdminToken(authHeader.slice(7));
    if (payload.type !== "b2b_admin") throw new Error("Tipo invalido");
    (req as any).b2bAdmin = payload;
  } catch {
    reply.code(401).send({ error: "Token admin invalido ou expirado" });
  }
}

// Whitelist dos campos do payload `delivery` (camelCase, contrato do frontend).
function pickDeliveryInput(raw: unknown): DeliveryInput | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const str = (v: unknown): string | undefined =>
    typeof v === "string" ? v : undefined;
  const bool = (v: unknown): boolean | undefined =>
    typeof v === "boolean" ? v : undefined;
  return {
    sameAsBilling: bool(d.sameAsBilling),
    zipCode: str(d.zipCode),
    street: str(d.street),
    number: str(d.number),
    complement: str(d.complement),
    neighborhood: str(d.neighborhood),
    city: str(d.city),
    state: str(d.state),
    reference: str(d.reference),
    contactName: str(d.contactName),
    contactPhone: str(d.contactPhone),
    contactEmail: str(d.contactEmail),
    deliveryDays: str(d.deliveryDays),
    deliveryHours: str(d.deliveryHours),
    vehicleRestriction: str(d.vehicleRestriction),
    needsScheduling: bool(d.needsScheduling),
    notes: str(d.notes),
  };
}

function buildBpLevelUdfs(udfBp: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(udfBp)) {
    if (value !== null && value !== undefined && value !== "") {
      result[key] = value;
    }
  }
  return result;
}

export async function registerB2BRoutes(app: FastifyInstance) {
  const authService = new B2BAuthService(B2B_DB_URL);
  await authService.init();

  const registrationService = new B2BRegistrationService(B2B_DB_URL);
  await registrationService.init();

  const deliveryService = new B2BDeliveryService(B2B_DB_URL);
  await deliveryService.init();

  const emailRequestService = new B2BEmailRequestService(B2B_DB_URL);
  await emailRequestService.init();

  const orderFollowupService = new B2BOrderFollowupService(B2B_DB_URL);
  await orderFollowupService.init();

  const orderStatusService = new B2BOrderStatusService(B2B_DB_URL);
  await orderStatusService.init();

  const pendingOrderService = new B2BPendingOrderService(B2B_DB_URL);
  await pendingOrderService.init();

  const orderMessageService = new B2BOrderMessageService(B2B_DB_URL);
  await orderMessageService.init();

  const orderItemNoteService = new B2BOrderItemNoteService(B2B_DB_URL);
  await orderItemNoteService.init();

  const favoritesService = new B2BFavoritesService(B2B_DB_URL);
  await favoritesService.init();

  // Rótulos legíveis dos estágios do funil e-commerce (para a timeline).
  const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
    novo: "Novo",
    em_analise: "Em análise",
    separacao: "Em separação",
    faturado: "Faturado",
    enviado: "Enviado",
    entregue: "Entregue",
    cancelado: "Cancelado",
  };

  // Status efetivo do pedido no funil e-commerce, do ponto de vista do cliente:
  // o status gerido pela equipe de vendas tem prioridade; sem ele, deriva-se do
  // SAP (cancelado / fechado=faturado / aberto=novo).
  function deriveFunnelStatus(
    row: { doc_status?: string | null; cancelled?: unknown },
    funnel?: OrderStatus | null,
  ): OrderStatus {
    if (row.cancelled === "Y" || row.cancelled === true) return "cancelado";
    if (funnel) return funnel;
    return row.doc_status === "C" ? "faturado" : "novo";
  }

  // Etapas do funil em que o pedido já foi (ou está sendo) faturado e, portanto,
  // não pode mais ser cancelado.
  const NON_CANCELLABLE_FUNNEL: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
    "faturado",
    "enviado",
    "entregue",
    "cancelado",
  ]);

  /**
   * Regra de negócio do cancelamento de um pedido já existente no SAP: só é
   * permitido enquanto NÃO foi faturado. Bloqueia se o funil e-commerce estiver
   * em faturado/enviado/entregue, se o documento SAP estiver fechado
   * (doc_status = 'C', normalmente copiado para NF) ou se já estiver cancelado.
   */
  function isSapOrderCancellable(
    row: { doc_status?: string | null; cancelled?: unknown },
    funnel?: OrderStatus | null,
  ): boolean {
    if (row.cancelled === "Y" || row.cancelled === true) return false;
    if (row.doc_status === "C") return false;
    const effective = deriveFunnelStatus(row, funnel);
    return !NON_CANCELLABLE_FUNNEL.has(effective);
  }

  // DTO camelCase consumido pelo Portal B2B (lista/dashboard de pedidos).
  function mapCustomerOrder(row: any, funnel?: OrderStatus | null) {
    return {
      docEntry: Number(row.doc_entry),
      docNum: Number(row.doc_num),
      createdAt: row.doc_date,
      dueDate: row.doc_due_date ?? null,
      cardCode: row.card_code,
      cardName: row.card_name ?? null,
      docTotal: row.doc_total != null ? Number(row.doc_total) : null,
      currency: row.doc_currency ?? "BRL",
      sapStatus: row.doc_status ?? null,
      cancelled: row.cancelled === "Y" || row.cancelled === true,
      status: deriveFunnelStatus(row, funnel),
      itemCount: Number(row.num_lines ?? 0),
      totalQuantity: Number(row.total_quantity ?? 0),
      comments: row.comments ?? null,
      pending: false,
      // O portal usa isso para exibir/ocultar o botão "Cancelar pedido".
      canCancel: isSapOrderCancellable(row, funnel),
    };
  }

  // DTO de um pedido AGUARDANDO confirmação do vendedor (ainda não existe no
  // SAP). Reaproveita o mesmo formato do mapCustomerOrder para a lista/dashboard
  // do portal, marcando `pending: true` e status sintético "aguardando".
  function mapPendingOrder(row: PendingOrderRow) {
    // `rejeitado` (recusa da equipe) e `cancelado` (cancelamento do cliente)
    // ambos aparecem para o cliente como estado terminal "cancelado".
    const terminated = row.status === "rejeitado" || row.status === "cancelado";
    return {
      docEntry: -Number(row.id), // sintético (negativo) — não há doc no SAP
      docNum: Number(row.id),
      createdAt: row.created_at,
      dueDate: row.due_date ?? null,
      cardCode: row.card_code,
      cardName: row.card_name ?? null,
      docTotal: null,
      currency: "BRL",
      sapStatus: null,
      cancelled: terminated,
      status: terminated ? "cancelado" : "aguardando",
      itemCount: Array.isArray(row.items) ? row.items.length : 0,
      totalQuantity: Number(row.total_quantity ?? 0),
      comments: row.notes ?? null,
      pending: true,
      pendingId: Number(row.id),
      rejectReason: row.reject_reason ?? null,
      // Permite ao portal habilitar o botão "Cancelar" apenas enquanto pendente.
      canCancel: row.status === "pendente",
    };
  }

  const catalogService = new B2BCatalogService(B2B_DB_URL);
  await catalogService.init();

  // IA de SEO (OpenAI) e Search Console (GSC) — ambos degradam graciosamente
  // sem credenciais (isConfigured() = false).
  const seoAiService = new SeoAiService();
  const searchConsoleService = new SearchConsoleService(B2B_DB_URL);
  await searchConsoleService.init();

  // Seed test credential
  try {
    const testCnpj = "45825180000189";
    const existing = await authService.findByCnpj(testCnpj);
    if (!existing) {
      await authService.upsertCredential({
        cardCode: "C10867",
        cnpj: testCnpj,
        cardName: "VTAO TITO TECH ME LTDA",
        email: "vitor@titotech.com.br",
      });
    }
    const hasPass = await authService.hasPassword(testCnpj);
    if (!hasPass) {
      await authService.setPassword(testCnpj, "@VWTito1985!");
    }
    app.log.info("B2B seed: credencial de teste pronta (CNPJ 45825180000189)");
  } catch (err: any) {
    app.log.warn({ error: err?.message }, "B2B seed: falha ao criar credencial de teste");
  }

  let sapOrdersService: SapOrdersService | null = null;
  let sapEntitiesService: SapEntitiesService | null = null;

  function getSapClient() {
    const logger = {
      debug: (msg: string, meta?: Record<string, unknown>) =>
        app.log.debug(meta, msg),
      info: (msg: string, meta?: Record<string, unknown>) =>
        app.log.info(meta, msg),
      warn: (msg: string, meta?: Record<string, unknown>) =>
        app.log.warn(meta, msg),
      error: (msg: string, meta?: Record<string, unknown>) =>
        app.log.error(meta, msg),
    };
    const storedClient = sapConfigStore.getClient(logger);
    if (storedClient) return storedClient;
    return createSapClient(logger);
  }

  function getOrdersService() {
    if (!sapOrdersService)
      sapOrdersService = new SapOrdersService(getSapClient());
    return sapOrdersService;
  }

  function getEntitiesService() {
    if (!sapEntitiesService)
      sapEntitiesService = new SapEntitiesService(getSapClient());
    return sapEntitiesService;
  }

  async function findPartnerByCnpj(cnpj: string, correlationId: string) {
    const digits = normalizeCnpj(cnpj);
    const client = getSapClient();

    const localReg = await registrationService.findByCnpj(digits);
    if (localReg?.status === "published" && localReg.sap_card_code) {
      app.log.info(
        { correlationId, cardCode: localReg.sap_card_code },
        "findPartnerByCnpj: CardCode encontrado via registro local",
      );
      try {
        const res = await client.get<any>(
          `/BusinessPartners('${localReg.sap_card_code}')`,
          { correlationId },
        );
        if (res.data?.CardCode) return res.data;
      } catch (err: any) {
        app.log.warn(
          { correlationId, cardCode: localReg.sap_card_code, error: err?.message?.slice(0, 200) },
          "findPartnerByCnpj: erro ao buscar BP por CardCode",
        );
      }
    }

    const expandUrls = [
      `/BusinessPartners?$filter=CardType eq 'cCustomer'&$select=CardCode,CardName,CardType,Phone1,EmailAddress,Valid,Frozen,BPFiscalTaxIDCollection&$top=5000`,
      `/BusinessPartners?$filter=CardType eq 'cCustomer'&$select=CardCode,CardName,CardType,BPFiscalTaxIDCollection&$top=5000`,
      `/BusinessPartners?$filter=CardType eq 'cCustomer'&$top=500`,
    ];

    for (let i = 0; i < expandUrls.length; i++) {
      try {
        const res = await client.get<{ value: any[] }>(expandUrls[i], { correlationId });
        const bps = res.data.value ?? [];
        app.log.info(
          { correlationId, candidate: i + 1, totalBPs: bps.length },
          "findPartnerByCnpj: BPs carregados com fiscal collection",
        );
        for (const bp of bps) {
          const taxIds: any[] = bp.BPFiscalTaxIDCollection ?? [];
          const hasCnpj = taxIds.some((t: any) => {
            const t0 = normalizeCnpj(t.TaxId0 ?? "");
            const t4 = normalizeCnpj(t.TaxId4 ?? "");
            return t0 === digits || t4 === digits;
          });
          if (hasCnpj) {
            app.log.info(
              { correlationId, cardCode: bp.CardCode },
              "findPartnerByCnpj: BP encontrado via BPFiscalTaxIDCollection",
            );
            return bp;
          }
        }
        break;
      } catch (err: any) {
        app.log.warn(
          { correlationId, candidate: i + 1, error: err?.message?.slice(0, 200) },
          "findPartnerByCnpj: candidato falhou",
        );
        continue;
      }
    }

    app.log.warn({ correlationId, cnpj: digits }, "findPartnerByCnpj: CNPJ nao encontrado");
    return undefined;
  }

  /**
   * Resolve um UnitPrice de FALLBACK por SKU para a criação do pedido no SAP.
   *
   * O catálogo do portal não carrega preço; ao criar o pedido deixamos o SAP
   * precificar normalmente (lista de preços do cliente + preços especiais/
   * descontos negociados — tudo isso só é aplicado quando NÃO enviamos UnitPrice).
   *
   * Porém alguns itens não têm preço cadastrado em nenhuma lista (Price 0), o que
   * gera pedidos com total R$ 0. Para esses casos — e somente eles — informamos um
   * UnitPrice de fallback para o total não vir zerado. Estratégia por item:
   *   - Se a lista de preços do cliente já tem preço > 0  -> NÃO retorna nada
   *     (deixa o SAP aplicar lista + preços especiais do cliente).
   *   - Caso a lista do cliente esteja zerada, usa, nesta ordem:
   *       1) último preço positivo que ESTE cliente já pagou pelo item (histórico)
   *       2) maior preço positivo em qualquer lista de preços do item
   *       3) último preço positivo praticado para o item (qualquer cliente)
   *
   * Falhas são tolerantes: nunca bloqueiam a criação do pedido.
   */
  async function resolveUnitPrices(
    cardCode: string,
    skus: string[],
    correlationId: string,
  ): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    const uniqueSkus = [...new Set(skus.filter(Boolean))];
    if (uniqueSkus.length === 0) return out;
    const client = getSapClient();

    let priceList = 1;
    try {
      const bp = await client.get<{ PriceListNum?: number }>(
        `/BusinessPartners('${cardCode}')?$select=PriceListNum`,
        { correlationId },
      );
      if (bp.data?.PriceListNum != null) priceList = Number(bp.data.PriceListNum);
    } catch (err) {
      app.log.warn(
        { err, correlationId, cardCode },
        "resolveUnitPrices: falha ao obter PriceListNum do BP (usando lista 1)",
      );
    }

    // Último preço positivo praticado para o item no histórico de pedidos.
    const lastSoldPrice = async (
      sku: string,
      customerOnly: boolean,
    ): Promise<number> => {
      try {
        const params = customerOnly ? [sku, cardCode] : [sku];
        const filter = customerOnly ? "AND o.card_code = $2" : "";
        const { rows } = await ordersPool.query(
          `SELECT l.price FROM sap_sales_order_lines l
           JOIN sap_sales_orders o ON o.doc_entry = l.doc_entry
           WHERE l.item_code = $1 AND l.price > 0 ${filter}
           ORDER BY o.doc_date DESC NULLS LAST, o.doc_entry DESC
           LIMIT 1`,
          params,
        );
        return Number(rows[0]?.price ?? 0) || 0;
      } catch (err) {
        app.log.warn(
          { err, correlationId, sku },
          "resolveUnitPrices: falha ao consultar histórico de preço",
        );
        return 0;
      }
    };

    for (const sku of uniqueSkus) {
      try {
        const res = await client.get<{
          ItemPrices?: Array<{ PriceList?: number; Price?: number }>;
        }>(`/Items('${sku}')?$select=ItemCode,ItemPrices`, { correlationId });
        const prices = res.data?.ItemPrices ?? [];
        const customerListPrice =
          prices.find((p) => p.PriceList === priceList && (p.Price ?? 0) > 0)
            ?.Price ?? 0;

        // Lista do cliente já precifica o item: deixa o SAP resolver (preserva
        // preços especiais e descontos negociados).
        if (customerListPrice > 0) continue;

        const customerHist = await lastSoldPrice(sku, true);
        const anyListPrice =
          prices
            .map((p) => p.Price ?? 0)
            .filter((v) => v > 0)
            .sort((a, b) => b - a)[0] ?? 0;
        const globalHist =
          customerHist > 0 || anyListPrice > 0
            ? 0
            : await lastSoldPrice(sku, false);

        const fallback = customerHist || anyListPrice || globalHist;
        if (fallback > 0) out.set(sku, Number(fallback));
      } catch (err) {
        app.log.warn(
          { err, correlationId, sku },
          "resolveUnitPrices: falha ao obter preço do item",
        );
      }
    }
    return out;
  }

  // =============================================
  // AUTH - LOOKUP (busca por CNPJ)
  // =============================================
  app.post("/b2b/auth/lookup", async (req, reply) => {
    const { cnpj } = req.body as any;
    const correlationId = (req as any).correlationId as string;

    if (!cnpj || normalizeCnpj(cnpj).length !== 14) {
      reply.code(400).send({ error: "CNPJ invalido" });
      return;
    }

    const digits = normalizeCnpj(cnpj);

    try {
      const partner = await findPartnerByCnpj(digits, correlationId);

      if (partner) {
        if (partner.Valid === "tNO" || partner.Frozen === "tYES") {
          reply.code(403).send({ error: "Cliente inativo ou bloqueado" });
          return;
        }

        const email = partner.EmailAddress ?? "";
        await authService.upsertCredential({
          cardCode: partner.CardCode,
          cnpj: digits,
          cardName: partner.CardName ?? partner.CardCode,
          email,
        });

        const hasPass = await authService.hasPassword(digits);
        const pendingReq = !email
          ? await emailRequestService.findPendingByCnpj(digits)
          : null;

        reply.code(200).send({
          status: hasPass ? "has_password" : "needs_verification",
          cardCode: partner.CardCode,
          cardName: partner.CardName ?? partner.CardCode,
          maskedEmail: email ? maskEmail(email) : null,
          hasEmail: !!email,
          emailRequestStatus: pendingReq ? "pending" : "none",
        });
        return;
      }

      const localCred = await authService.findByCnpj(digits);
      if (localCred) {
        const hasPass = await authService.hasPassword(digits);
        const pendingReq = !localCred.email
          ? await emailRequestService.findPendingByCnpj(digits)
          : null;
        reply.code(200).send({
          status: hasPass ? "has_password" : "needs_verification",
          cardCode: localCred.card_code,
          cardName: localCred.card_name,
          maskedEmail: localCred.email ? maskEmail(localCred.email) : null,
          hasEmail: !!localCred.email,
          emailRequestStatus: pendingReq ? "pending" : "none",
        });
        return;
      }

      reply.code(200).send({ status: "not_found" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro ao buscar CNPJ";
      req.log.error({ error, correlationId }, "Erro no lookup B2B");
      reply.code(500).send({ error: "Erro ao buscar CNPJ", message });
    }
  });

  // =============================================
  // AUTH - VERIFY EMAIL (confirma email e envia OTP)
  // =============================================
  app.post("/b2b/auth/verify-email", async (req, reply) => {
    const { cnpj, email } = req.body as any;
    const correlationId = (req as any).correlationId as string;

    if (!cnpj) {
      reply.code(400).send({ error: "CNPJ e obrigatorio" });
      return;
    }

    const digits = normalizeCnpj(cnpj);

    try {
      const cred = await authService.findByCnpj(digits);
      if (!cred) {
        reply.code(404).send({ error: "Cliente nao encontrado" });
        return;
      }

      if (!cred.email) {
        reply.code(400).send({ error: "Nenhum email cadastrado para este CNPJ" });
        return;
      }

      if (email) {
        const storedEmail = (cred.email ?? "").trim().toLowerCase();
        const inputEmail = email.trim().toLowerCase();
        if (storedEmail !== inputEmail) {
          reply.code(400).send({ error: "Email nao corresponde ao cadastro" });
          return;
        }
      }

      const otp = await authService.generateOtp(digits);
      const emailSent = await sendOtpEmail(
        cred.email,
        otp,
        cred.card_name
      );

      reply.code(200).send({
        ok: true,
        emailSent,
        maskedEmail: maskEmail(cred.email),
        ...(!emailSent ? { devOtp: otp } : {}),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro";
      req.log.error({ error, correlationId }, "Erro verify-email B2B");
      reply.code(500).send({ error: message });
    }
  });

  // =============================================
  // AUTH - VERIFY OTP
  // =============================================
  app.post("/b2b/auth/verify-otp", async (req, reply) => {
    const { cnpj, otp } = req.body as any;

    if (!cnpj || !otp) {
      reply.code(400).send({ error: "CNPJ e codigo sao obrigatorios" });
      return;
    }

    const digits = normalizeCnpj(cnpj);

    try {
      const valid = await authService.verifyOtp(digits, otp);
      if (!valid) {
        reply
          .code(400)
          .send({ error: "Codigo invalido ou expirado" });
        return;
      }

      const tempToken = signTempToken(digits);
      reply.code(200).send({ ok: true, tempToken });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro";
      reply.code(500).send({ error: message });
    }
  });

  // =============================================
  // AUTH - SET PASSWORD (apos verificacao OTP)
  // =============================================
  app.post("/b2b/auth/set-password", async (req, reply) => {
    const { cnpj, tempToken, password } = req.body as any;

    if (!cnpj || !tempToken || !password) {
      reply
        .code(400)
        .send({ error: "CNPJ, token temporario e senha sao obrigatorios" });
      return;
    }

    if (password.length < 6) {
      reply
        .code(400)
        .send({ error: "Senha deve ter no minimo 6 caracteres" });
      return;
    }

    const digits = normalizeCnpj(cnpj);

    try {
      const decoded = verifyTempToken(tempToken);
      if (decoded.cnpj !== digits) {
        reply.code(403).send({ error: "Token nao corresponde ao CNPJ" });
        return;
      }

      await authService.setPassword(digits, password);

      const cred = await authService.findByCnpj(digits);
      if (!cred) {
        reply.code(404).send({ error: "Credencial nao encontrada" });
        return;
      }

      const token = signB2BToken({
        cardCode: cred.card_code,
        cardName: cred.card_name,
        cnpj: digits,
        email: cred.email,
        type: "b2b_customer",
      });

      reply.code(200).send({
        ok: true,
        token,
        customer: {
          cardCode: cred.card_code,
          cardName: cred.card_name,
          cnpj: digits,
          email: cred.email,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro";
      reply.code(500).send({ error: message });
    }
  });

  // =============================================
  // AUTH - LOGIN (CNPJ + senha)
  // =============================================
  app.post("/b2b/auth/login", async (req, reply) => {
    const { cnpj, password } = req.body as any;
    const correlationId = (req as any).correlationId as string;

    if (!cnpj || !password) {
      reply.code(400).send({ error: "CNPJ e senha sao obrigatorios" });
      return;
    }

    const digits = normalizeCnpj(cnpj);

    try {
      const valid = await authService.verifyPassword(digits, password);
      if (!valid) {
        reply.code(401).send({ error: "CNPJ ou senha incorretos" });
        return;
      }

      const cred = await authService.findByCnpj(digits);
      if (!cred) {
        reply.code(401).send({ error: "Credencial nao encontrada" });
        return;
      }

      const token = signB2BToken({
        cardCode: cred.card_code,
        cardName: cred.card_name,
        cnpj: digits,
        email: cred.email,
        type: "b2b_customer",
      });

      reply.code(200).send({
        token,
        customer: {
          cardCode: cred.card_code,
          cardName: cred.card_name,
          cnpj: digits,
          email: cred.email,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro";
      req.log.error({ error, correlationId }, "Erro login B2B");
      reply.code(500).send({ error: "Erro ao autenticar", message });
    }
  });

  // =============================================
  // AUTH - FORGOT PASSWORD (envia OTP para redefinir)
  // =============================================
  app.post("/b2b/auth/forgot-password", async (req, reply) => {
    const { cnpj } = req.body as any;

    if (!cnpj) {
      reply.code(400).send({ error: "CNPJ e obrigatorio" });
      return;
    }

    const digits = normalizeCnpj(cnpj);

    try {
      const cred = await authService.findByCnpj(digits);
      if (!cred) {
        reply.code(200).send({
          ok: true,
          message: "Se o CNPJ estiver cadastrado, um codigo sera enviado por email.",
        });
        return;
      }

      if (!cred.email) {
        reply.code(200).send({
          ok: true,
          message: "Nenhum email cadastrado para este CNPJ. Entre em contato com o suporte.",
        });
        return;
      }

      const otp = await authService.generateOtp(digits);
      const emailSent = await sendOtpEmail(
        cred.email,
        otp,
        cred.card_name,
      );

      if (!emailSent) {
        app.log.warn({ cnpj: digits, email: cred.email, otp }, "forgot-password: email nao enviado, OTP logado");
      }

      reply.code(200).send({
        ok: true,
        message: "Codigo de verificacao enviado para o email cadastrado.",
        maskedEmail: maskEmail(cred.email),
        hasEmail: true,
        emailSent,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro";
      reply.code(500).send({ error: message });
    }
  });

  // =============================================
  // AUTH - REGISTER (salva localmente para aprovacao)
  // =============================================
  app.post("/b2b/auth/register", async (req, reply) => {
    const body = req.body as any;
    const correlationId = (req as any).correlationId as string;

    const { cnpj, razaoSocial, email } = body;

    if (!cnpj || !razaoSocial || !email) {
      reply.code(400).send({ error: "CNPJ, razao social e email sao obrigatorios" });
      return;
    }

    const digits = normalizeCnpj(cnpj);
    if (digits.length !== 14) {
      reply.code(400).send({ error: "CNPJ invalido" });
      return;
    }

    try {
      const existing = await findPartnerByCnpj(digits, correlationId);
      if (existing) {
        reply.code(409).send({ error: "CNPJ ja cadastrado no sistema" });
        return;
      }

      const alreadyPending = await registrationService.findByCnpj(digits);
      if (alreadyPending) {
        reply.code(409).send({
          error: "Cadastro ja em analise pela equipe comercial",
          status: alreadyPending.status,
        });
        return;
      }

      const reg = await registrationService.create({
        cnpj: digits,
        razaoSocial: body.razaoSocial,
        nomeFantasia: body.nomeFantasia,
        email: body.email,
        phone: body.phone,
        contactName: body.contactName,
        address: body.address,
        streetNumber: body.streetNumber,
        neighborhood: body.neighborhood,
        city: body.city,
        state: body.state,
        zipCode: body.zipCode,
        inscricaoEstadual: body.inscricaoEstadual,
      });

      // Persiste os dados de entrega (opcionais) vinculados ao mesmo cadastro.
      const deliveryInput = pickDeliveryInput(body.delivery);
      if (deliveryInput) {
        await deliveryService
          .upsertByCnpj(digits, deliveryInput, { registrationId: reg.id })
          .catch((err) => {
            req.log.warn(
              { correlationId, error: err?.message },
              "register B2B: falha ao gravar dados de entrega",
            );
          });
      }

      // Captura do lead no RDStation (conversão + tag de origem) — fire-and-forget:
      // nunca bloqueia nem falha o cadastro; erros são apenas logados.
      void captureB2BLead(
        {
          email: body.email,
          name: body.contactName || body.razaoSocial,
          companyName: body.razaoSocial,
          cnpj: digits,
          city: body.city,
          state: body.state,
          phone: body.phone,
        },
        req.log,
      ).catch((err) => {
        req.log.warn(
          { correlationId, error: err?.message },
          "register B2B: falha na captura de lead no RDStation",
        );
      });

      // Confirmação ao cliente + aviso interno ao comercial (best-effort).
      await sendRegistrationReceivedEmail({
        to: body.email,
        razaoSocial: body.razaoSocial,
      }).catch(() => undefined);
      await sendInternalAccessRequestNotification({
        to: EMAIL_COMMERCIAL,
        cardName: body.razaoSocial,
        cnpj: digits,
        requestedEmail: body.email,
        contactName: body.contactName ?? null,
        panelUrl: `${PAINEL_URL}/b2b-acessos`,
      }).catch(() => undefined);

      reply.code(201).send({
        ok: true,
        message: "Cadastro recebido! A equipe comercial analisara seus dados em breve.",
        registrationId: reg.id,
        status: "pending",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao cadastrar";
      req.log.error({ correlationId, errorMessage: message }, "Erro register B2B");
      reply.code(500).send({ error: "Erro ao cadastrar cliente", message });
    }
  });

  // =============================================
  // AUTH - REQUEST EMAIL ACCESS (cliente SAP sem e-mail)
  // =============================================
  app.post("/b2b/auth/request-email-access", async (req, reply) => {
    const { cnpj, email, contactName } = req.body as any;
    const correlationId = (req as any).correlationId as string;

    if (!cnpj || !email) {
      reply.code(400).send({ error: "CNPJ e e-mail sao obrigatorios" });
      return;
    }

    const digits = normalizeCnpj(cnpj);
    if (digits.length !== 14) {
      reply.code(400).send({ error: "CNPJ invalido" });
      return;
    }

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email) || email.length > 255) {
      reply.code(400).send({ error: "E-mail invalido" });
      return;
    }

    try {
      const cred = await authService.findByCnpj(digits);
      if (!cred) {
        // Garante que o cliente exista no SAP antes de aceitar a solicitacao.
        const partner = await findPartnerByCnpj(digits, correlationId);
        if (!partner) {
          reply.code(404).send({
            error: "CNPJ nao encontrado. Solicite o cadastro da sua empresa.",
          });
          return;
        }
        if (partner.EmailAddress) {
          reply.code(400).send({
            error: "Este CNPJ ja possui e-mail cadastrado. Use o primeiro acesso.",
          });
          return;
        }
        await authService.upsertCredential({
          cardCode: partner.CardCode,
          cnpj: digits,
          cardName: partner.CardName ?? partner.CardCode,
          email: "",
        });
      } else if (cred.email) {
        reply.code(400).send({
          error: "Este CNPJ ja possui e-mail cadastrado. Use o primeiro acesso.",
        });
        return;
      }

      const existingPending = await emailRequestService.findPendingByCnpj(digits);
      if (existingPending) {
        reply.code(409).send({
          error: "Ja existe uma solicitacao de acesso em analise para este CNPJ.",
          status: "pending",
        });
        return;
      }

      const credAfter = await authService.findByCnpj(digits);
      const cardName = credAfter?.card_name ?? "Cliente";

      const request = await emailRequestService.create({
        cnpj: digits,
        cardCode: credAfter?.card_code ?? null,
        cardName,
        requestedEmail: email.trim(),
        contactName: contactName?.trim() || null,
      });

      // Confirmacao ao cliente + aviso interno ao comercial (best-effort).
      await sendEmailAccessRequestedEmail({ to: email.trim(), cardName });
      await sendInternalAccessRequestNotification({
        to: EMAIL_COMMERCIAL,
        cardName,
        cnpj: digits,
        requestedEmail: email.trim(),
        contactName: contactName?.trim() || null,
        panelUrl: `${PAINEL_URL}/b2b-acessos`,
      }).catch(() => undefined);

      reply.code(201).send({
        ok: true,
        message:
          "Solicitacao recebida! A Garrafaria Serra Negra vai analisar e liberar seu acesso em breve.",
        requestId: request.id,
        status: "pending",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro";
      req.log.error({ correlationId, errorMessage: message }, "Erro request-email-access B2B");
      reply.code(500).send({ error: "Erro ao registrar solicitacao", message });
    }
  });

  // =============================================
  // ADMIN - LOGIN
  // =============================================
  app.post("/b2b/admin/login", async (req, reply) => {
    const { user, password } = req.body as any;

    if (!user || !password) {
      reply.code(400).send({ error: "Usuario e senha sao obrigatorios" });
      return;
    }

    if (user !== B2B_ADMIN_USER || password !== B2B_ADMIN_PASS) {
      reply.code(401).send({ error: "Credenciais invalidas" });
      return;
    }

    const token = signAdminToken(user);
    reply.code(200).send({ token, user });
  });

  // =============================================
  // ADMIN - CREDENCIAIS (acessos ao portal)
  // =============================================
  app.get(
    "/b2b/admin/credentials",
    { preHandler: b2bAdminAuth },
    async (_req, reply) => {
      try {
        const items = await authService.listCredentials();
        reply.code(200).send({ items, total: items.length });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        reply.code(500).send({ error: message });
      }
    },
  );

  // Reset: limpa a senha — o cliente refaz o primeiro acesso via OTP
  app.post(
    "/b2b/admin/credentials/:cnpj/reset",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const cnpj = normalizeCnpj((req.params as any).cnpj ?? "");
      const admin = (req as any).b2bAdmin as B2BAdminTokenPayload;
      try {
        const cred = await authService.findByCnpj(cnpj);
        if (!cred) {
          reply.code(404).send({ error: "Credencial nao encontrada" });
          return;
        }
        await authService.resetPassword(cnpj);
        req.log.info(
          { cnpj, cardCode: cred.card_code, admin: admin?.user },
          "B2B admin: senha resetada (cliente devera refazer primeiro acesso)",
        );
        reply.code(200).send({
          ok: true,
          message: "Senha removida. O cliente deve refazer o primeiro acesso com verificacao por e-mail.",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        reply.code(500).send({ error: message });
      }
    },
  );

  // Define uma senha temporaria manualmente
  app.post(
    "/b2b/admin/credentials/:cnpj/set-password",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const cnpj = normalizeCnpj((req.params as any).cnpj ?? "");
      const { password } = (req.body ?? {}) as { password?: string };
      const admin = (req as any).b2bAdmin as B2BAdminTokenPayload;
      if (!password || password.length < 6) {
        reply.code(400).send({ error: "Senha deve ter no minimo 6 caracteres" });
        return;
      }
      try {
        const cred = await authService.findByCnpj(cnpj);
        if (!cred) {
          reply.code(404).send({ error: "Credencial nao encontrada" });
          return;
        }
        await authService.setPassword(cnpj, password);
        req.log.info(
          { cnpj, cardCode: cred.card_code, admin: admin?.user },
          "B2B admin: senha temporaria definida",
        );
        reply.code(200).send({ ok: true, message: "Senha temporaria definida com sucesso." });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        reply.code(500).send({ error: message });
      }
    },
  );

  // Atualiza/remove o e-mail cadastrado da credencial
  app.patch(
    "/b2b/admin/credentials/:cnpj/email",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const cnpj = normalizeCnpj((req.params as any).cnpj ?? "");
      const admin = (req as any).b2bAdmin as B2BAdminTokenPayload;
      const rawEmail = (req.body ?? {}) as { email?: string | null };
      const email = typeof rawEmail.email === "string" ? rawEmail.email.trim() : null;

      if (email) {
        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRe.test(email) || email.length > 255) {
          reply.code(400).send({ error: "E-mail inválido" });
          return;
        }
      }

      try {
        const cred = await authService.findByCnpj(cnpj);
        if (!cred) {
          reply.code(404).send({ error: "Credencial nao encontrada" });
          return;
        }
        await authService.updateEmail(cnpj, email && email.length > 0 ? email : null);
        req.log.info(
          { cnpj, cardCode: cred.card_code, admin: admin?.user, removed: !email },
          email
            ? "B2B admin: e-mail da credencial atualizado"
            : "B2B admin: e-mail da credencial removido",
        );
        reply.code(200).send({
          ok: true,
          message: email
            ? "E-mail atualizado. A verificação foi reiniciada e o cliente confirmará no próximo acesso."
            : "E-mail removido da credencial.",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        reply.code(500).send({ error: message });
      }
    },
  );

  // =============================================
  // ADMIN - SOLICITACOES DE ACESSO POR E-MAIL
  // =============================================
  app.get(
    "/b2b/admin/email-requests",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const status = (req.query as any).status as string | undefined;
      try {
        const items = await emailRequestService.list(status);
        reply.code(200).send({ items, total: items.length });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        reply.code(500).send({ error: message });
      }
    },
  );

  app.post(
    "/b2b/admin/email-requests/:id/approve",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const { id } = req.params as any;
      const admin = (req as any).b2bAdmin as B2BAdminTokenPayload;
      const { notes } = (req.body as any) ?? {};

      try {
        const reqRow = await emailRequestService.findById(Number(id));
        if (!reqRow) {
          reply.code(404).send({ error: "Solicitacao nao encontrada" });
          return;
        }
        if (reqRow.status !== "pending") {
          reply.code(400).send({ error: `Solicitacao ja processada (${reqRow.status})` });
          return;
        }

        const cnpj = normalizeCnpj(reqRow.cnpj);
        const cred = await authService.findByCnpj(cnpj);
        if (!cred) {
          reply.code(404).send({ error: "Credencial nao encontrada para o CNPJ" });
          return;
        }

        // Grava o e-mail aprovado na credencial (sem write-back no SAP).
        await authService.updateEmail(cnpj, reqRow.requested_email);
        const updated = await emailRequestService.setStatus(
          Number(id), "approved", admin.user, notes,
        );

        const emailSent = await sendEmailAccessApprovedEmail({
          to: reqRow.requested_email,
          cardName: reqRow.card_name ?? cred.card_name ?? "Cliente",
          cnpj,
        });

        req.log.info(
          { id, cnpj, admin: admin?.user },
          "B2B admin: solicitacao de acesso por e-mail aprovada",
        );
        reply.code(200).send({ ok: true, request: updated, emailSent });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        reply.code(500).send({ error: message });
      }
    },
  );

  app.post(
    "/b2b/admin/email-requests/:id/reject",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const { id } = req.params as any;
      const admin = (req as any).b2bAdmin as B2BAdminTokenPayload;
      const { notes } = (req.body as any) ?? {};

      try {
        const reqRow = await emailRequestService.findById(Number(id));
        if (!reqRow) {
          reply.code(404).send({ error: "Solicitacao nao encontrada" });
          return;
        }
        const updated = await emailRequestService.setStatus(
          Number(id), "rejected", admin.user, notes,
        );
        if (!updated) {
          reply.code(400).send({ error: "Solicitacao nao encontrada ou ja processada" });
          return;
        }

        const emailSent = await sendEmailAccessRejectedEmail({
          to: reqRow.requested_email,
          cardName: reqRow.card_name ?? "Cliente",
          reason: notes ?? null,
        });

        req.log.info(
          { id, admin: admin?.user },
          "B2B admin: solicitacao de acesso por e-mail rejeitada",
        );
        reply.code(200).send({ ok: true, request: updated, emailSent });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        reply.code(500).send({ error: message });
      }
    },
  );

  // =============================================
  // ADMIN - FOLLOW-UPS DE PEDIDOS (vendedores)
  // =============================================
  app.get(
    "/b2b/admin/orders/:docEntry/followups",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const docEntry = Number((req.params as any).docEntry);
      if (!Number.isFinite(docEntry)) {
        reply.code(400).send({ error: "docEntry invalido" });
        return;
      }
      try {
        const items = await orderFollowupService.listByOrder(docEntry);
        reply.code(200).send({ items, total: items.length });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        reply.code(500).send({ error: message });
      }
    },
  );

  app.post(
    "/b2b/admin/orders/:docEntry/followups",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const docEntry = Number((req.params as any).docEntry);
      const body = (req.body ?? {}) as {
        note?: string;
        statusTag?: string;
        cardCode?: string;
        createdBy?: string;
      };
      if (!Number.isFinite(docEntry)) {
        reply.code(400).send({ error: "docEntry invalido" });
        return;
      }
      if (!body.note || !body.note.trim()) {
        reply.code(400).send({ error: "A anotacao e obrigatoria" });
        return;
      }
      try {
        const created = await orderFollowupService.create({
          docEntry,
          cardCode: body.cardCode ?? null,
          statusTag: body.statusTag ?? null,
          note: body.note.trim(),
          createdBy: body.createdBy ?? null,
        });
        reply.code(201).send({ ok: true, followup: created });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        reply.code(500).send({ error: message });
      }
    },
  );

  // Contagem de anotacoes para varios pedidos (badges na lista)
  app.get(
    "/b2b/admin/orders/followups/counts",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const raw = (req.query as any).docEntries as string | undefined;
      const docEntries = (raw ?? "")
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n));
      try {
        const counts = await orderFollowupService.countByOrders(docEntries);
        reply.code(200).send({ counts });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        reply.code(500).send({ error: message });
      }
    },
  );

  // =============================================
  // ADMIN - STATUS DO FUNIL E-COMMERCE (Portal B2B)
  // =============================================

  // Mapa doc_entry -> status para um conjunto de pedidos (colunas/KPIs).
  app.get(
    "/b2b/admin/orders/status",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const raw = (req.query as any).docEntries as string | undefined;
      const docEntries = (raw ?? "")
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n));
      try {
        // `map`: doc_entry -> status (compat). `detail`: doc_entry -> { status,
        // confirmed } para distinguir pedidos "a confirmar" no painel.
        const detail = await orderStatusService.getManyDetailed(docEntries);
        const map: Record<number, string> = {};
        for (const [k, v] of Object.entries(detail)) map[Number(k)] = v.status;
        reply.code(200).send({ map, detail });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        reply.code(500).send({ error: message });
      }
    },
  );

  // Confirma um pedido (estado operacional LOCAL — não altera o SAP). Marca o
  // pedido como conferido pela equipe e o coloca no funil de acompanhamento.
  app.post(
    "/b2b/admin/orders/:docEntry/confirm",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const admin = (req as any).b2bAdmin as { user?: string } | undefined;
      const docEntry = Number((req.params as any).docEntry);
      const body = (req.body ?? {}) as { cardCode?: string; confirmedBy?: string };
      if (!Number.isFinite(docEntry)) {
        reply.code(400).send({ error: "docEntry invalido" });
        return;
      }
      try {
        const confirmedBy = body.confirmedBy ?? admin?.user ?? null;
        const row = await orderStatusService.confirm({
          docEntry,
          cardCode: body.cardCode ?? null,
          by: confirmedBy,
        });
        // Auditoria na timeline do pedido.
        await orderFollowupService
          .create({
            docEntry,
            cardCode: body.cardCode ?? null,
            statusTag: "Confirmado",
            note: "Pedido confirmado pela equipe de vendas.",
            createdBy: confirmedBy,
          })
          .catch(() => undefined);
        reply.code(200).send({ ok: true, status: row });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        reply.code(500).send({ error: message });
      }
    },
  );

  // Atualiza o estágio do funil de um pedido (move no pipeline).
  app.put(
    "/b2b/admin/orders/:docEntry/status",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const admin = (req as any).b2bAdmin as { user?: string } | undefined;
      const docEntry = Number((req.params as any).docEntry);
      const body = (req.body ?? {}) as {
        status?: string;
        cardCode?: string;
        updatedBy?: string;
      };
      if (!Number.isFinite(docEntry)) {
        reply.code(400).send({ error: "docEntry invalido" });
        return;
      }
      if (!isOrderStatus(body.status)) {
        reply.code(400).send({ error: "status invalido" });
        return;
      }
      try {
        const updatedBy = body.updatedBy ?? admin?.user ?? null;
        const row = await orderStatusService.set({
          docEntry,
          status: body.status,
          cardCode: body.cardCode ?? null,
          updatedBy,
        });
        // Registra a mudança na timeline operacional do pedido (auditoria).
        await orderFollowupService.create({
          docEntry,
          cardCode: body.cardCode ?? null,
          statusTag: ORDER_STATUS_LABELS[body.status],
          note: `Status do pedido alterado para “${ORDER_STATUS_LABELS[body.status]}”.`,
          createdBy: updatedBy,
        });
        reply.code(200).send({ ok: true, status: row });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        reply.code(500).send({ error: message });
      }
    },
  );

  // Vendedor cancela um pedido já no SAP (enquanto não faturado). Cancela no ERP,
  // move o funil para "cancelado" e notifica o cliente.
  app.post(
    "/b2b/admin/orders/:docEntry/cancel",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const admin = (req as any).b2bAdmin as { user?: string } | undefined;
      const correlationId = (req as any).correlationId as string;
      const docEntry = Number((req.params as any).docEntry);
      const body = (req.body ?? {}) as { reason?: string };
      if (!Number.isFinite(docEntry)) {
        reply.code(400).send({ error: "docEntry inválido" });
        return;
      }
      try {
        const reason = body.reason?.trim() || null;
        const seller = admin?.user ?? "Equipe de vendas";
        const result = await cancelSapOrderDoc({
          docEntry,
          reason,
          by: seller,
          actor: "seller",
          correlationId,
        });
        if (!result.ok) {
          reply.code(result.code).send({ error: result.error });
          return;
        }

        // Notifica o cliente sobre o cancelamento (se houver e-mail cadastrado).
        try {
          const cred = result.cardCode
            ? await authService.findByCardCode(result.cardCode)
            : null;
          if (cred?.email) {
            await sendOrderCancelledEmail({
              to: cred.email,
              cardName: result.cardName ?? cred.card_name ?? result.cardCode,
              docNum: result.docNum ?? docEntry,
              reason,
              byCustomer: false,
            }).catch(() => undefined);
          }
        } catch {
          /* notificação é best-effort */
        }

        reply.code(200).send({ ok: true, docEntry, docNum: result.docNum });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Erro ao cancelar pedido";
        req.log.error({ error, correlationId, docEntry }, "Erro ao cancelar pedido (painel)");
        reply.code(500).send({ error: "Erro ao cancelar pedido", message });
      }
    },
  );

  // ── Conversa do pedido (visão do vendedor) ──────────────────────────
  app.get(
    "/b2b/admin/orders/:docEntry/messages",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const docEntry = Number((req.params as any).docEntry);
      if (!Number.isFinite(docEntry)) {
        reply.code(400).send({ error: "docEntry invalido" });
        return;
      }
      try {
        const rows = await orderMessageService.listByOrder(docEntry);
        reply.code(200).send({ messages: rows.map(mapMessage) });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        reply.code(500).send({ error: message });
      }
    },
  );

  // Vendedor responde no fio do pedido.
  app.post(
    "/b2b/admin/orders/:docEntry/messages",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const admin = (req as any).b2bAdmin as { user?: string } | undefined;
      const docEntry = Number((req.params as any).docEntry);
      const body = (req.body ?? {}) as { body?: string; authorName?: string };
      const text = (body.body ?? "").trim();
      if (!Number.isFinite(docEntry)) {
        reply.code(400).send({ error: "docEntry invalido" });
        return;
      }
      if (!text) {
        reply.code(400).send({ error: "Mensagem vazia" });
        return;
      }
      try {
        const ownerRes = await ordersPool.query(
          "SELECT card_code FROM sap_sales_orders WHERE doc_entry = $1",
          [docEntry],
        );
        const cardCode = ownerRes.rows[0]?.card_code ?? "";
        const row = await orderMessageService.create({
          docEntry,
          cardCode,
          authorType: "seller",
          authorName: body.authorName ?? admin?.user ?? "Equipe de vendas",
          kind: "message",
          body: text,
        });
        reply.code(201).send({ ok: true, message: mapMessage(row) });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        reply.code(500).send({ error: message });
      }
    },
  );

  // Resolve/recusa uma solicitação (alteração/cancelamento) do cliente.
  app.post(
    "/b2b/admin/orders/:docEntry/requests/:id/resolve",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const admin = (req as any).b2bAdmin as { user?: string } | undefined;
      const id = Number((req.params as any).id);
      const body = (req.body ?? {}) as { status?: string; note?: string };
      const status = body.status;
      if (!Number.isFinite(id)) {
        reply.code(400).send({ error: "id invalido" });
        return;
      }
      if (status !== "resolvido" && status !== "recusado") {
        reply.code(400).send({ error: "status invalido (resolvido|recusado)" });
        return;
      }
      try {
        const row = await orderMessageService.resolveRequest(id, {
          status: status as RequestStatus,
          note: body.note ?? null,
          by: admin?.user ?? null,
        });
        if (!row) {
          reply.code(404).send({ error: "Solicitacao nao encontrada" });
          return;
        }
        reply.code(200).send({ ok: true, message: mapMessage(row) });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        reply.code(500).send({ error: message });
      }
    },
  );

  // Resumo de interações por pedido (badges na lista de pedidos do painel).
  app.get(
    "/b2b/admin/orders/messages/summary",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const raw = (req.query as any).docEntries as string | undefined;
      const docEntries = (raw ?? "")
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n));
      try {
        const map = await orderMessageService.summary(docEntries);
        reply.code(200).send({ map });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        reply.code(500).send({ error: message });
      }
    },
  );

  // ── Sinalizações por item (vendedor) ────────────────────────────────
  app.get(
    "/b2b/admin/orders/:docEntry/item-notes",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const docEntry = Number((req.params as any).docEntry);
      if (!Number.isFinite(docEntry)) {
        reply.code(400).send({ error: "docEntry invalido" });
        return;
      }
      try {
        const rows = await orderItemNoteService.listByOrder(docEntry);
        reply.code(200).send({ items: rows });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        reply.code(500).send({ error: message });
      }
    },
  );

  app.post(
    "/b2b/admin/orders/:docEntry/item-notes",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const admin = (req as any).b2bAdmin as { user?: string } | undefined;
      const docEntry = Number((req.params as any).docEntry);
      const body = (req.body ?? {}) as { sku?: string; flag?: string; note?: string };
      if (!Number.isFinite(docEntry)) {
        reply.code(400).send({ error: "docEntry invalido" });
        return;
      }
      if (!body.sku || !isItemFlag(body.flag)) {
        reply.code(400).send({ error: "sku e flag (falta|substituicao|observacao) obrigatorios" });
        return;
      }
      try {
        const row = await orderItemNoteService.create({
          docEntry,
          sku: body.sku,
          flag: body.flag,
          note: body.note ?? null,
          createdBy: admin?.user ?? null,
        });
        reply.code(201).send({ ok: true, item: row });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        reply.code(500).send({ error: message });
      }
    },
  );

  app.delete(
    "/b2b/admin/orders/:docEntry/item-notes/:id",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const id = Number((req.params as any).id);
      if (!Number.isFinite(id)) {
        reply.code(400).send({ error: "id invalido" });
        return;
      }
      try {
        await orderItemNoteService.remove(id);
        reply.code(200).send({ ok: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        reply.code(500).send({ error: message });
      }
    },
  );

  // =============================================
  // ADMIN - PEDIDOS PENDENTES (confirmação manual do vendedor)
  // =============================================

  // Lista pedidos do portal aguardando confirmação (ou já confirmados/recusados).
  app.get(
    "/b2b/admin/pending-orders",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const query = req.query as Record<string, string>;
      const status = query.status as
        | "pendente"
        | "confirmado"
        | "rejeitado"
        | undefined;
      try {
        const items = await pendingOrderService.list({
          status:
            status === "pendente" ||
            status === "confirmado" ||
            status === "rejeitado"
              ? status
              : undefined,
          cardCode: query.cardCode || undefined,
        });
        const pendingCount = await pendingOrderService.countByStatus("pendente");
        reply.code(200).send({ items, total: items.length, pendingCount });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        reply.code(500).send({ error: message });
      }
    },
  );

  // Confirma o pedido pendente → cria o documento no SAP e inicia o funil.
  app.post(
    "/b2b/admin/pending-orders/:id/confirm",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const admin = (req as any).b2bAdmin as { user?: string } | undefined;
      const correlationId = (req as any).correlationId as string;
      const id = Number((req.params as any).id);
      if (!Number.isFinite(id)) {
        reply.code(400).send({ error: "id inválido" });
        return;
      }

      try {
        const pending = await pendingOrderService.get(id);
        if (!pending) {
          reply.code(404).send({ error: "Pedido pendente não encontrado" });
          return;
        }
        if (pending.status !== "pendente") {
          reply.code(409).send({
            error: `Pedido já foi ${pending.status === "confirmado" ? "confirmado" : "recusado"}`,
          });
          return;
        }

        const items = Array.isArray(pending.items) ? pending.items : [];
        const validItems = items.filter(
          (it) => it.sku && Number(it.quantity) > 0,
        );
        if (validItems.length === 0) {
          reply.code(400).send({ error: "Pedido sem itens válidos" });
          return;
        }

        const client = getSapClient();
        const seller = admin?.user ?? "Equipe de vendas";
        const baseComment = `Pedido via Portal B2B (confirmado por ${seller}) - ${pending.card_name ?? pending.card_code}`;
        const comments = pending.notes?.trim()
          ? `${baseComment} | Obs: ${pending.notes.trim()}`
          : baseComment;

        const priceMap = await resolveUnitPrices(
          pending.card_code,
          validItems.map((i) => i.sku),
          correlationId,
        );

        const sapOrder = {
          CardCode: pending.card_code,
          DocDueDate:
            pending.due_date ??
            new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
          Comments: comments,
          BPL_IDAssignedToInvoice: B2B_DEFAULT_BRANCH,
          DocumentLines: validItems.map((item, idx) => {
            const unitPrice = priceMap.get(item.sku);
            return {
              LineNum: idx,
              ItemCode: item.sku,
              Quantity: Number(item.quantity),
              WarehouseCode: item.warehouse ?? B2B_DEFAULT_WAREHOUSE,
              Usage: B2B_DEFAULT_USAGE,
              ...(unitPrice && unitPrice > 0 ? { UnitPrice: unitPrice } : {}),
            };
          }),
        };

        const response = await client.post<any>("/Orders", sapOrder, {
          correlationId,
        });
        const created = response.data;

        const row = await pendingOrderService.markConfirmed(id, {
          sapDocEntry: Number(created.DocEntry),
          sapDocNum: created.DocNum != null ? Number(created.DocNum) : null,
          reviewedBy: seller,
        });

        // Inicia o funil e já marca como confirmado (o vendedor acabou de
        // confirmar este pedido) para não reaparecer em "a confirmar".
        if (created.DocEntry != null) {
          await orderStatusService
            .confirm({
              docEntry: Number(created.DocEntry),
              cardCode: pending.card_code,
              by: seller,
            })
            .catch((err) =>
              req.log.warn({ err }, "Falha ao iniciar status do pedido confirmado"),
            );
        }

        // Avisa o cliente que o pedido foi confirmado e está em processamento.
        if (pending.created_by) {
          await sendOrderApprovedEmail({
            to: pending.created_by,
            cardName: pending.card_name ?? pending.card_code,
            docNum: created.DocNum ?? created.DocEntry,
          }).catch(() => undefined);
        }

        reply.code(200).send({
          ok: true,
          docEntry: created.DocEntry,
          docNum: created.DocNum,
          pending: row,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Erro ao confirmar pedido";
        req.log.error({ error, correlationId }, "Erro ao confirmar pedido B2B");
        reply.code(500).send({ error: "Erro ao confirmar pedido", message });
      }
    },
  );

  // Recusa o pedido pendente (não cria nada no SAP) e avisa o cliente.
  app.post(
    "/b2b/admin/pending-orders/:id/reject",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const admin = (req as any).b2bAdmin as { user?: string } | undefined;
      const id = Number((req.params as any).id);
      const body = (req.body ?? {}) as { reason?: string };
      if (!Number.isFinite(id)) {
        reply.code(400).send({ error: "id inválido" });
        return;
      }

      try {
        const pending = await pendingOrderService.get(id);
        if (!pending) {
          reply.code(404).send({ error: "Pedido pendente não encontrado" });
          return;
        }
        if (pending.status !== "pendente") {
          reply.code(409).send({
            error: `Pedido já foi ${pending.status === "confirmado" ? "confirmado" : "recusado"}`,
          });
          return;
        }

        const row = await pendingOrderService.markRejected(id, {
          reason: body.reason?.trim() || null,
          reviewedBy: admin?.user ?? null,
        });

        if (pending.created_by) {
          await sendOrderRejectedEmail({
            to: pending.created_by,
            cardName: pending.card_name ?? pending.card_code,
            reason: body.reason?.trim() || null,
          }).catch(() => undefined);
        }

        reply.code(200).send({ ok: true, pending: row });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Erro ao recusar pedido";
        reply.code(500).send({ error: "Erro ao recusar pedido", message });
      }
    },
  );

  // =============================================
  // ADMIN - VENDA ASSISTIDA (catálogo + criação de pedido)
  // =============================================

  // Catálogo para a equipe de vendas montar o pedido (mesmo acervo do portal).
  app.get(
    "/b2b/admin/catalog",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const query = req.query as Record<string, string>;
      const limit = Math.min(Number(query.limit) || 30, 100);
      const page = Number(query.page) || 1;
      try {
        const result = await catalogService.listProducts({
          search: query.search,
          category: query.category,
          inStock:
            query.inStock === "true"
              ? true
              : query.inStock === "false"
                ? false
                : undefined,
          page,
          limit,
        });
        reply.code(200).send({
          items: result.items.map(toB2BCatalogItem),
          total: result.total,
          page,
          pages: Math.ceil(result.total / limit),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        reply.code(500).send({ error: "Erro ao listar catálogo", message });
      }
    },
  );

  // Criação de pedido em nome do cliente (venda assistida pelo vendedor).
  app.post(
    "/b2b/admin/orders",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const admin = (req as any).b2bAdmin as { user?: string } | undefined;
      const correlationId = (req as any).correlationId as string;
      const body = (req.body ?? {}) as {
        cardCode?: string;
        cardName?: string;
        items?: { sku?: string; quantity?: number; warehouse?: string }[];
        notes?: string;
        dueDate?: string;
        createdBy?: string;
      };

      const cardCode = (body.cardCode ?? "").trim();
      const items = Array.isArray(body.items) ? body.items : [];
      if (!cardCode) {
        reply.code(400).send({ error: "Campo 'cardCode' é obrigatório" });
        return;
      }
      const validItems = items.filter(
        (i) => i.sku && Number(i.quantity) > 0,
      );
      if (validItems.length === 0) {
        reply
          .code(400)
          .send({ error: "Inclua ao menos um item com quantidade válida" });
        return;
      }

      try {
        const client = getSapClient();
        const seller = body.createdBy ?? admin?.user ?? "Equipe de vendas";
        const cardName = (body.cardName ?? "").trim() || cardCode;

        const priceMap = await resolveUnitPrices(
          cardCode,
          validItems.map((i) => i.sku ?? ""),
          correlationId,
        );

        const documentLines = validItems.map((item, idx) => {
          const unitPrice = priceMap.get(item.sku ?? "");
          return {
            LineNum: idx,
            ItemCode: item.sku,
            Quantity: Number(item.quantity),
            WarehouseCode: item.warehouse ?? B2B_DEFAULT_WAREHOUSE,
            Usage: B2B_DEFAULT_USAGE,
            ...(unitPrice && unitPrice > 0 ? { UnitPrice: unitPrice } : {}),
          };
        });

        // Mantém o marcador do canal (Portal B2B) para o pedido entrar no mesmo
        // funil de gestão, sinalizando que foi uma venda assistida pela equipe.
        const baseComment = `Pedido via Portal B2B (venda assistida por ${seller}) - ${cardName}`;
        const comments = body.notes?.trim()
          ? `${baseComment} | Obs: ${body.notes.trim()}`
          : baseComment;

        const sapOrder = {
          CardCode: cardCode,
          DocDueDate:
            body.dueDate ??
            new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
          Comments: comments,
          BPL_IDAssignedToInvoice: B2B_DEFAULT_BRANCH,
          DocumentLines: documentLines,
        };

        const response = await client.post<any>("/Orders", sapOrder, {
          correlationId,
        });
        const created = response.data;

        if (created.DocEntry != null) {
          // Venda assistida já nasce confirmada (foi a equipe que criou).
          await orderStatusService
            .confirm({
              docEntry: Number(created.DocEntry),
              cardCode,
              by: seller,
            })
            .catch((err) =>
              req.log.warn({ err }, "Falha ao iniciar status do pedido assistido"),
            );
          // Registra a origem na timeline do pedido (auditoria).
          await orderFollowupService
            .create({
              docEntry: Number(created.DocEntry),
              cardCode,
              statusTag: "Novo",
              note: `Pedido criado por venda assistida no painel por ${seller}.`,
              createdBy: seller,
            })
            .catch(() => undefined);
        }

        // Alerta operacional ao comercial (best-effort).
        await sendNewOrderToSellerEmail({
          to: EMAIL_COMMERCIAL,
          cardName,
          docNum: created.DocNum ?? created.DocEntry,
          orderUrl: `${PAINEL_URL}/pedidos?docEntry=${created.DocEntry}`,
        }).catch(() => undefined);

        req.log.info(
          { docEntry: created.DocEntry, cardCode, seller },
          "Pedido criado via venda assistida",
        );
        reply.code(201).send({
          ok: true,
          message: "Pedido criado com sucesso",
          docEntry: created.DocEntry,
          docNum: created.DocNum,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Erro ao criar pedido";
        req.log.error(
          { error, correlationId, cardCode },
          "Erro ao criar pedido assistido",
        );
        reply.code(500).send({ error: "Erro ao criar pedido", message });
      }
    },
  );

  // =============================================
  // ADMIN - LISTAR REGISTROS PENDENTES
  // =============================================
  app.get(
    "/b2b/admin/registrations",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const status = (req.query as any).status as string | undefined;
      try {
        const items = await registrationService.list(status);
        reply.code(200).send({ items, total: items.length });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        reply.code(500).send({ error: message });
      }
    },
  );

  // =============================================
  // ADMIN - DETALHE DE REGISTRO
  // =============================================
  app.get(
    "/b2b/admin/registrations/:id",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const { id } = req.params as any;
      try {
        const reg = await registrationService.findById(Number(id));
        if (!reg) {
          reply.code(404).send({ error: "Registro nao encontrado" });
          return;
        }
        const deliveryRow = await deliveryService
          .findByCnpj(normalizeCnpj(reg.cnpj))
          .catch(() => null);
        reply.code(200).send({ ...reg, delivery: toDeliveryDto(deliveryRow) });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        reply.code(500).send({ error: message });
      }
    },
  );

  // =============================================
  // ADMIN - METADADOS UDFs (campos disponiveis)
  // =============================================
  app.get(
    "/b2b/admin/udf-metadata",
    { preHandler: b2bAdminAuth },
    async (_req, reply) => {
      reply.code(200).send({
        udfBp: {
          label: "UDFs do Parceiro de Negocios",
          fields: {
            U_TX_IndFinal: { label: "Indicador Consumidor Final", type: "select", options: ["0","1"], default: "1" },
            U_TX_IndIEDest: { label: "Indicador IE Destinatario", type: "select", options: ["1","2","9"], default: "9" },
            U_TX_SN: { label: "Simples Nacional", type: "text" },
            U_TX_ProdRural: { label: "Produtor Rural", type: "text" },
            U_TX_PrestServ: { label: "Prestador de Servico", type: "text" },
            U_TX_ExImp: { label: "Exportador/Importador", type: "text" },
            U_TX_SitResp: { label: "Situacao Responsavel", type: "text" },
            U_TX_IndNat: { label: "Indicador Natureza", type: "text" },
            U_TX_Pagador: { label: "Pagador", type: "text" },
            U_TX_Rendimento: { label: "Rendimento", type: "text" },
            U_TX_DCReEmpColigada: { label: "DC RE Empresa Coligada", type: "text" },
            U_TX_TpEnteGov: { label: "Tipo Ente Governamental", type: "text", default: "-1" },
            U_TX_RegraImTomRibPreto: { label: "Regra Imposto Tomador Rib.Preto", type: "text", default: "0" },
            U_AGL_ECF_ComExp: { label: "ECF Com Exportacao", type: "select", options: ["S","N"], default: "N" },
            U_AGL_NAT_FRT: { label: "Natureza Frete", type: "number", default: 9 },
            U_AGL_CONTR_IPI: { label: "Contribuinte IPI", type: "select", options: ["0","1"], default: "0" },
            U_AGL_TP_PN: { label: "Tipo PN (Agilitas)", type: "text" },
            U_AGL_LPRECO_PMC: { label: "Lista Preco PMC", type: "text" },
            U_AGL_IND_NAT_RET: { label: "Indicador Natureza Retencao", type: "text" },
            U_nfe_RNTC: { label: "RNTC", type: "text" },
            U_nfe_CPRB: { label: "CPRB", type: "select", options: ["S","N"], default: "N" },
            U_SX_MercadosAlcoolicos: { label: "Mercados Alcoolicos", type: "text" },
            U_SX_MercadosNaoAlcoolicos: { label: "Mercados Nao Alcoolicos", type: "text" },
            U_SX_MercadoAlimenticio: { label: "Mercado Alimenticio", type: "text" },
            U_SX_SuspensaoIPI: { label: "Suspensao IPI", type: "select", options: ["S","N"], default: "N" },
            U_HCO_GrupoEconomico: { label: "Grupo Economico", type: "text" },
            U_IV_BP_PayerID: { label: "Payer ID", type: "text" },
            U_IB_BoletoGeradoPor: { label: "Boleto Gerado Por", type: "text", default: "0" },
            U_ImprimirBoleto: { label: "Imprimir Boleto", type: "number", default: 1 },
          },
        },
        udfAddr: {
          label: "UDFs do Endereco",
          fields: {
            U_TX_IE: { label: "Inscricao Estadual", type: "text", default: "ISENTO" },
            U_TX_CNPJ: { label: "CNPJ (endereco)", type: "text" },
            U_TX_IndFinal: { label: "Ind. Consumidor Final (end.)", type: "select", options: ["0","1"] },
            U_TX_IndIEDest: { label: "Ind. IE Destinatario (end.)", type: "select", options: ["1","2","9"] },
          },
        },
        sapConfig: {
          label: "Configuracoes SAP",
          fields: {
            ibgeCode: { label: "Codigo Municipio (SAP OCNT)", type: "text", default: "" },
            GroupCode: { label: "Grupo de PN", type: "number", default: 100 },
            SalesPersonCode: { label: "Vendedor", type: "number", default: 9 },
            PriceListNum: { label: "Lista de Precos", type: "number", default: 1 },
            Currency: { label: "Moeda", type: "text", default: "R$" },
            LanguageCode: { label: "Idioma", type: "number", default: 29 },
          },
        },
      });
    },
  );

  // =============================================
  // ADMIN - ATUALIZAR UDFs e dados do registro
  // =============================================
  app.patch(
    "/b2b/admin/registrations/:id",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const { id } = req.params as any;
      const admin = (req as any).b2bAdmin as B2BAdminTokenPayload;
      const body = req.body as any;

      try {
        const updated = await registrationService.updateFields(Number(id), {
          udfBp: body.udfBp,
          udfAddr: body.udfAddr,
          sapConfig: body.sapConfig,
          adminNotes: body.adminNotes,
          reviewedBy: admin.user,
          address: body.address,
          streetNumber: body.streetNumber,
          neighborhood: body.neighborhood,
          city: body.city,
          state: body.state,
          zipCode: body.zipCode,
          inscricaoEstadual: body.inscricaoEstadual,
          phone: body.phone,
          contactName: body.contactName,
        });

        if (!updated) {
          reply.code(404).send({ error: "Registro nao encontrado" });
          return;
        }

        // Edição opcional dos dados de entrega pelo admin.
        const deliveryInput = pickDeliveryInput(body.delivery);
        let deliveryRow = await deliveryService
          .findByCnpj(normalizeCnpj(updated.cnpj))
          .catch(() => null);
        if (deliveryInput) {
          deliveryRow = await deliveryService.upsertByCnpj(
            normalizeCnpj(updated.cnpj),
            deliveryInput,
            {
              cardCode: updated.sap_card_code ?? null,
              registrationId: updated.id,
            },
          );
        }

        reply.code(200).send({ ...updated, delivery: toDeliveryDto(deliveryRow) });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        reply.code(500).send({ error: message });
      }
    },
  );

  // =============================================
  // ADMIN - APROVAR REGISTRO
  // =============================================
  app.post(
    "/b2b/admin/registrations/:id/approve",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const { id } = req.params as any;
      const admin = (req as any).b2bAdmin as B2BAdminTokenPayload;
      const { notes } = (req.body as any) ?? {};

      try {
        const updated = await registrationService.setStatus(
          Number(id), "approved", admin.user, notes,
        );
        if (!updated) {
          reply.code(400).send({ error: "Registro nao encontrado ou ja processado" });
          return;
        }
        await sendRegistrationApprovedEmail({
          to: updated.email,
          razaoSocial: updated.razao_social,
        }).catch(() => undefined);
        reply.code(200).send(updated);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        reply.code(500).send({ error: message });
      }
    },
  );

  // =============================================
  // ADMIN - REJEITAR REGISTRO
  // =============================================
  app.post(
    "/b2b/admin/registrations/:id/reject",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const { id } = req.params as any;
      const admin = (req as any).b2bAdmin as B2BAdminTokenPayload;
      const { notes } = (req.body as any) ?? {};

      try {
        const updated = await registrationService.setStatus(
          Number(id), "rejected", admin.user, notes,
        );
        if (!updated) {
          reply.code(400).send({ error: "Registro nao encontrado ou ja processado" });
          return;
        }
        await sendRegistrationRejectedEmail({
          to: updated.email,
          razaoSocial: updated.razao_social,
          reason: notes ?? null,
        }).catch(() => undefined);
        reply.code(200).send(updated);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        reply.code(500).send({ error: message });
      }
    },
  );

  // =============================================
  // ADMIN - PUBLICAR NO SAP B1
  // =============================================
  app.post(
    "/b2b/admin/registrations/:id/publish",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const { id } = req.params as any;
      const correlationId = (req as any).correlationId as string;

      try {
        const reg = await registrationService.findById(Number(id));
        if (!reg) {
          reply.code(404).send({ error: "Registro nao encontrado" });
          return;
        }
        if (reg.status !== "approved") {
          reply.code(400).send({ error: `Registro deve estar aprovado (atual: ${reg.status})` });
          return;
        }

        const digits = normalizeCnpj(reg.cnpj);
        const existing = await findPartnerByCnpj(digits, correlationId);
        if (existing) {
          await registrationService.markPublished(Number(id), existing.CardCode);
          await deliveryService
            .attachCardCode(digits, existing.CardCode)
            .catch(() => undefined);
          reply.code(200).send({
            ok: true,
            message: "BP ja existia no SAP",
            cardCode: existing.CardCode,
          });
          return;
        }

        const client = getSapClient();
        const cardCode = `B${digits.slice(-14)}`.slice(0, 15);
        const cnpjFormatted = digits.replace(
          /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
          "$1.$2.$3/$4-$5",
        );

        const cfg = reg.sap_config ?? {};
        const udfBp = reg.udf_bp ?? {};
        const udfAddr = reg.udf_addr ?? {};

        // Dados de entrega salvos (opcionais) — enriquecem ShipTo/ContactEmployees.
        const delivery = await deliveryService
          .findByCnpj(digits)
          .catch(() => null);

        const sapBody: Record<string, unknown> = {
          CardCode: cardCode,
          CardName: reg.razao_social,
          CardForeignName: reg.nome_fantasia || undefined,
          CardType: "cCustomer",
          GroupCode: cfg.GroupCode ?? 100,
          FederalTaxID: cnpjFormatted,
          UnifiedFederalTaxID: cnpjFormatted,
          EmailAddress: reg.email,
          Phone1: reg.phone || undefined,
          Notes: `Cadastro via Portal B2B em ${new Date().toISOString().split("T")[0]}`,
          Valid: "tYES",
          Frozen: "tNO",
          SinglePayment: "tYES",
          CompanyPrivate: "cCompany",
          PayTermsGrpCode: -1,
          PriceListNum: cfg.PriceListNum ?? 1,
          Currency: cfg.Currency ?? "R$",
          SalesPersonCode: cfg.SalesPersonCode ?? 9,
          DebitorAccount: "1.1.2.01.001",
          DownPaymentClearAct: "2.1.6.02.001",
          LanguageCode: cfg.LanguageCode ?? 29,
          BilltoDefault: "COB",
          ShipToDefault: "ENT",
          Series: 70,
          Password: cnpjFormatted,
          VatLiable: "vLiable",
        };

        const streetNum = reg.address?.match(/\d+/)?.[0] || "S/N";
        const streetPrefixMatch = reg.address?.match(
          /^(Rua|Av\.?|Avenida|Trav\.?|Travessa|Al\.?|Alameda|Rod\.?|Rodovia|Estr\.?|Estrada|Pra[cç]a)/i,
        );
        const streetPrefix = streetPrefixMatch?.[1] || "Rua";

        const addrFields = {
          Street: reg.address || "A definir",
          StreetNo: reg.street_number || streetNum,
          Block: reg.neighborhood || "Centro",
          City: reg.city || "A definir",
          County: (cfg.ibgeCode as string) || reg.city || "A definir",
          State: reg.state || "SP",
          ZipCode: reg.zip_code ? reg.zip_code.replace(/\D/g, "") : "00000000",
          Country: "BR",
          TypeOfAddress: streetPrefix.toUpperCase(),
          FederalTaxID: cnpjFormatted,
          U_TX_CNPJ: (udfAddr.U_TX_CNPJ as string) || cnpjFormatted,
          U_TX_IE: (udfAddr.U_TX_IE as string) || reg.inscricao_estadual || "ISENTO",
          U_TX_IndFinal: (udfAddr.U_TX_IndFinal as string) || "1",
          U_TX_IndIEDest: (udfAddr.U_TX_IndIEDest as string) || "9",
        };

        // Endereço de entrega (ENT / bo_ShipTo): usa os dados de entrega quando
        // informados e distintos do faturamento; caso contrário replica o COB.
        const hasDistinctDelivery =
          delivery && delivery.same_as_billing === false;
        const deliveryNotesParts = [
          delivery?.delivery_days ? `Dias: ${delivery.delivery_days}` : null,
          delivery?.delivery_hours ? `Horario: ${delivery.delivery_hours}` : null,
          delivery?.vehicle_restriction
            ? `Restricao veiculo: ${delivery.vehicle_restriction}`
            : null,
          delivery?.needs_scheduling ? "Requer agendamento" : null,
          delivery?.reference ? `Ref: ${delivery.reference}` : null,
          delivery?.notes ? delivery.notes : null,
        ].filter(Boolean);
        const shipToFields = hasDistinctDelivery
          ? {
              ...addrFields,
              Street: delivery!.street || addrFields.Street,
              StreetNo: delivery!.number || addrFields.StreetNo,
              Block: delivery!.neighborhood || addrFields.Block,
              City: delivery!.city || addrFields.City,
              County: delivery!.city || addrFields.County,
              State: delivery!.state || addrFields.State,
              ZipCode: delivery!.zip_code
                ? delivery!.zip_code.replace(/\D/g, "")
                : addrFields.ZipCode,
            }
          : addrFields;

        sapBody.BPAddresses = [
          { AddressType: "bo_BillTo", AddressName: "COB", ...addrFields },
          { AddressType: "bo_ShipTo", AddressName: "ENT", ...shipToFields },
        ];

        // Contato de entrega vira ContactEmployee do BP (hoje não vai ao SAP).
        const contactName = delivery?.contact_name || reg.contact_name;
        if (contactName) {
          sapBody.ContactEmployees = [
            {
              Name: contactName.slice(0, 90),
              ...(delivery?.contact_phone
                ? { Phone1: delivery.contact_phone }
                : reg.phone
                  ? { Phone1: reg.phone }
                  : {}),
              ...(delivery?.contact_email
                ? { E_Mail: delivery.contact_email }
                : reg.email
                  ? { E_Mail: reg.email }
                  : {}),
              ...(deliveryNotesParts.length > 0
                ? { Remarks: deliveryNotesParts.join(" | ").slice(0, 100) }
                : {}),
              Active: "tYES",
            },
          ];
        }

        const ie = (udfAddr.U_TX_IE as string) || reg.inscricao_estadual || "Isento";
        sapBody.BPFiscalTaxIDCollection = [
          { Address: "", CNAECode: -1, TaxId0: "", TaxId1: ie, TaxId4: cnpjFormatted, TaxId12: `${cardCode}/COB`, AddrType: "bo_ShipTo" },
          { Address: "COB", CNAECode: -1, TaxId0: cnpjFormatted, TaxId1: ie, AddrType: "bo_BillTo" },
          { Address: "ENT", CNAECode: -1, TaxId0: cnpjFormatted, TaxId1: ie, TaxId12: `${cardCode}/COB`, AddrType: "bo_ShipTo" },
        ];

        sapBody.BPBranchAssignment = [{ BPLID: 1, DisabledForBP: "tNO" }];
        sapBody.BPPaymentMethods = [{ PaymentMethodCode: "Dinheiro", RowNumber: 0 }];

        Object.assign(sapBody, buildBpLevelUdfs(udfBp));

        const response = await client.post<any>("/BusinessPartners", sapBody, { correlationId });
        const created = response.data;
        const finalCardCode = created.CardCode ?? cardCode;

        await registrationService.markPublished(Number(id), finalCardCode);

        // Vincula o CardCode aos dados de entrega (se existirem).
        await deliveryService
          .attachCardCode(digits, finalCardCode)
          .catch(() => undefined);

        await authService.upsertCredential({
          cardCode: finalCardCode,
          cnpj: digits,
          cardName: reg.razao_social,
          email: reg.email,
        });

        const otp = await authService.generateOtp(digits);
        const emailSent = await sendOtpEmail(reg.email, otp, reg.razao_social);

        reply.code(201).send({
          ok: true,
          message: "BP criado no SAP com sucesso",
          cardCode: finalCardCode,
          emailSent,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro ao publicar";
        let sapDetails: string | undefined;
        let sapStatus: number | undefined;
        if (error instanceof SapHttpError) {
          sapStatus = error.status;
          sapDetails = error.responseBodyText;
        }
        req.log.error({ correlationId, sapStatus, sapDetails, errorMessage: message }, "Erro publicar BP no SAP");

        await registrationService.markPublishError(Number(id), sapDetails ?? message);

        reply.code(500).send({
          error: "Erro ao publicar no SAP",
          message,
          sapStatus,
          sapDetails,
        });
      }
    },
  );

  // =============================================
  // AUTH - ME
  // =============================================
  app.get(
    "/b2b/auth/me",
    { preHandler: b2bAuth },
    async (req, reply) => {
      const customer = (req as any).b2bCustomer as B2BTokenPayload;
      reply.code(200).send({
        cardCode: customer.cardCode,
        cardName: customer.cardName,
        cnpj: customer.cnpj,
        email: customer.email,
      });
    }
  );

  // =============================================
  // DADOS DE ENTREGA (cliente autenticado)
  // =============================================
  app.get(
    "/b2b/delivery",
    { preHandler: b2bAuth },
    async (req, reply) => {
      const customer = (req as any).b2bCustomer as B2BTokenPayload;
      try {
        const cnpj = normalizeCnpj(customer.cnpj);
        let row = await deliveryService.findByCnpj(cnpj);
        // Fallback por CardCode (ex.: CNPJ do token divergente do salvo).
        if (!row && customer.cardCode) {
          row = await deliveryService.findByCardCode(customer.cardCode);
        }
        reply.code(200).send({ delivery: toDeliveryDto(row) });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        reply.code(500).send({ error: "Erro ao buscar dados de entrega", message });
      }
    },
  );

  app.put(
    "/b2b/delivery",
    { preHandler: b2bAuth },
    async (req, reply) => {
      const customer = (req as any).b2bCustomer as B2BTokenPayload;
      const input = pickDeliveryInput(req.body);
      if (!input) {
        reply.code(400).send({ error: "Corpo invalido: objeto de entrega esperado" });
        return;
      }
      try {
        const cnpj = normalizeCnpj(customer.cnpj);
        const saved = await deliveryService.upsertByCnpj(cnpj, input, {
          cardCode: customer.cardCode ?? null,
        });
        reply.code(200).send({ ok: true, delivery: toDeliveryDto(saved) });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        reply.code(500).send({ error: "Erro ao salvar dados de entrega", message });
      }
    },
  );

  // =============================================
  // CATALOGO DE PRODUTOS
  // =============================================
  app.get(
    "/b2b/products",
    { preHandler: b2bAuth },
    async (req, reply) => {
      const correlationId = (req as any).correlationId as string;
      const query = req.query as any;
      const search = (query.search as string)?.toLowerCase();
      const limit = query.limit ? Number(query.limit) : 100;

      try {
        const entSvc = getEntitiesService();
        const items = await entSvc.listItems(
          { limit: 500, onlyActive: true },
          correlationId
        );

        const salesItems = items.filter(
          (i) => i.SalesItem === "tYES" || !i.SalesItem
        );

        let filtered = salesItems;
        if (search) {
          filtered = salesItems.filter(
            (i) =>
              i.ItemCode?.toLowerCase().includes(search) ||
              i.ItemName?.toLowerCase().includes(search) ||
              i.BarCode?.toLowerCase().includes(search)
          );
        }

        const result = filtered.slice(0, limit).map((item) => ({
          sku: item.ItemCode,
          name: item.ItemName ?? item.ItemCode,
          ean: item.BarCode ?? null,
          unit: item.InventoryUOM ?? "UN",
          group: item.ItemsGroupCode ?? null,
          active: item.Valid === "tYES" && item.Frozen !== "tYES",
        }));

        reply.code(200).send({ items: result, total: result.length });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        req.log.error(
          { error, correlationId },
          "Erro ao listar produtos B2B"
        );
        reply
          .code(500)
          .send({ error: "Erro ao buscar produtos", message });
      }
    }
  );

  app.get(
    "/b2b/products/:sku/stock",
    { preHandler: b2bAuth },
    async (req, reply) => {
      const correlationId = (req as any).correlationId as string;
      const { sku } = req.params as any;

      try {
        const entSvc = getEntitiesService();
        const inventory = await entSvc.listInventory(
          { limit: 1000 },
          correlationId
        );
        const itemStock = inventory.filter((i) => i.ItemCode === sku);

        const totalOnHand = itemStock.reduce(
          (sum, i) => sum + i.InStock,
          0
        );
        const totalCommitted = itemStock.reduce(
          (sum, i) => sum + i.Committed,
          0
        );
        const available = totalOnHand - totalCommitted;

        reply.code(200).send({
          sku,
          totalOnHand,
          totalCommitted,
          available: available > 0 ? available : 0,
          warehouses: itemStock.map((w) => ({
            code: w.WarehouseCode,
            onHand: w.InStock,
            committed: w.Committed,
          })),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        reply
          .code(500)
          .send({ error: "Erro ao buscar estoque", message });
      }
    }
  );

  // =============================================
  // PEDIDOS DO CLIENTE (consulta Postgres local)
  // =============================================
  const ordersPool = new (await import("pg")).default.Pool({ connectionString: B2B_DB_URL });

  app.get(
    "/b2b/orders",
    { preHandler: b2bAuth },
    async (req, reply) => {
      const customer = (req as any).b2bCustomer as B2BTokenPayload;
      const query = req.query as any;

      try {
        const conditions = ["card_code = $1"];
        const params: unknown[] = [customer.cardCode];
        let idx = 2;

        if (query.docStatus) {
          conditions.push(`doc_status = $${idx}`);
          params.push(query.docStatus);
          idx++;
        }

        const where = conditions.join(" AND ");
        const countRes = await ordersPool.query(
          `SELECT COUNT(*) AS cnt FROM sap_sales_orders WHERE ${where}`,
          params,
        );
        const total = Number(countRes.rows[0]?.cnt ?? 0);

        const dataRes = await ordersPool.query(
          `SELECT doc_entry, doc_num, doc_date, doc_due_date, card_code, card_name,
                  doc_total, doc_currency, doc_status, cancelled, comments,
                  num_lines, total_quantity
           FROM sap_sales_orders WHERE ${where}
           ORDER BY doc_date DESC, doc_entry DESC
           LIMIT 200`,
          params,
        );

        // Enriquece com o estágio do funil e-commerce gerido pela equipe de vendas.
        const docEntries = dataRes.rows.map((r: any) => Number(r.doc_entry));
        const funnelMap = await orderStatusService.getMany(docEntries);

        const sapItems = dataRes.rows.map((r: any) =>
          mapCustomerOrder(r, funnelMap[Number(r.doc_entry)]),
        );

        // Pedidos aguardando confirmação do vendedor (ainda não estão no SAP):
        // entram no topo da lista para o cliente acompanhar o andamento.
        const pendingRows = await pendingOrderService
          .listPendingForCustomer(customer.cardCode)
          .catch(() => [] as PendingOrderRow[]);
        const pendingItems = pendingRows.map(mapPendingOrder);

        let items = [...pendingItems, ...sapItems];

        // Filtro opcional por estágio (?status=aguardando|novo|...).
        if (query.status) {
          items = items.filter((o) => o.status === query.status);
        }

        reply.code(200).send({ items, total: total + pendingItems.length });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        req.log.error({ error }, "Erro ao listar pedidos B2B");
        reply.code(500).send({ error: "Erro ao buscar pedidos", message });
      }
    }
  );

  app.get(
    "/b2b/orders/:docEntry",
    { preHandler: b2bAuth },
    async (req, reply) => {
      const customer = (req as any).b2bCustomer as B2BTokenPayload;
      const { docEntry } = req.params as any;

      try {
        const orderRes = await ordersPool.query(
          `SELECT doc_entry, doc_num, doc_date, doc_due_date, card_code, card_name,
                  doc_total, doc_currency, doc_status, cancelled, comments,
                  num_lines, total_quantity, raw_json
           FROM sap_sales_orders WHERE doc_entry = $1`,
          [Number(docEntry)],
        );

        if (orderRes.rows.length === 0) {
          reply.code(404).send({ error: "Pedido nao encontrado" });
          return;
        }

        const row = orderRes.rows[0];
        if (row.card_code?.toLowerCase() !== customer.cardCode.toLowerCase()) {
          reply.code(403).send({ error: "Acesso negado a este pedido" });
          return;
        }

        const linesRes = await ordersPool.query(
          `SELECT line_num AS "LineNum", item_code AS "ItemCode", item_description AS "ItemDescription",
                  quantity AS "Quantity", price AS "Price", unit_price AS "UnitPrice",
                  line_total AS "LineTotal", warehouse_code AS "WarehouseCode",
                  discount_percent AS "DiscountPercent"
           FROM sap_sales_order_lines WHERE doc_entry = $1
           ORDER BY line_num`,
          [Number(docEntry)],
        );

        const rawJson = row.raw_json ?? {};
        const funnelRow = await orderStatusService.get(Number(docEntry));

        const lines = linesRes.rows.map((l: any) => ({
          ...l,
          Quantity: Number(l.Quantity),
          Price: Number(l.Price),
          UnitPrice: Number(l.UnitPrice),
          LineTotal: Number(l.LineTotal),
          DiscountPercent: Number(l.DiscountPercent),
        }));

        // Enriquece cada item com dados do catálogo (imagem, slug, estoque) e
        // com as sinalizações da equipe de vendas (item em falta etc.).
        const skus = lines.map((l: any) => l.ItemCode).filter(Boolean);
        const [catalogMap, itemNotes] = await Promise.all([
          catalogService.getManyBySkus(skus).catch(() => ({})),
          orderItemNoteService.listByOrder(Number(docEntry)).catch(() => []),
        ]);
        const notesBySku = new Map<string, any[]>();
        for (const n of itemNotes) {
          const arr = notesBySku.get(n.sku) ?? [];
          arr.push({
            id: n.id,
            flag: n.flag,
            note: n.note,
            createdBy: n.created_by,
            createdAt: n.created_at,
          });
          notesBySku.set(n.sku, arr);
        }

        // Itens em formato camelCase para o portal.
        const items = lines.map((l: any) => {
          const cat = (catalogMap as Record<string, any>)[l.ItemCode] ?? null;
          return {
            sku: l.ItemCode,
            description: l.ItemDescription ?? cat?.name ?? l.ItemCode,
            quantity: l.Quantity,
            unitPrice: l.UnitPrice || l.Price,
            lineTotal: l.LineTotal,
            warehouse: l.WarehouseCode ?? null,
            unit: cat?.unitOfMeasure ?? "UN",
            imageUrl: cat?.imageUrl ?? null,
            thumbUrl: cat?.thumbUrl ?? null,
            slug: cat?.slug ?? null,
            inCatalog: cat?.isActive ?? false,
            isInStock: cat?.isInStock ?? false,
            flags: notesBySku.get(l.ItemCode) ?? [],
          };
        });

        const shipAddress =
          [rawJson.Address, rawJson.Address2].filter(Boolean).join(" - ") ||
          null;

        reply.code(200).send({
          // DTO camelCase consumido pelo portal
          ...mapCustomerOrder(row, funnelRow?.status ?? null),
          customerId: row.card_code,
          updatedAt: funnelRow?.updated_at ?? row.doc_date,
          shipToAddress: shipAddress,
          paymentMethod: rawJson.PaymentMethod ?? rawJson.PayToCode ?? null,
          items,
          // Campos legados (compatibilidade)
          doc_entry: row.doc_entry,
          doc_num: row.doc_num,
          doc_date: row.doc_date,
          doc_due_date: row.doc_due_date,
          card_code: row.card_code,
          card_name: row.card_name,
          doc_total: Number(row.doc_total),
          doc_currency: row.doc_currency,
          doc_status: row.doc_status,
          cancelled: row.cancelled,
          comments: row.comments,
          num_lines: row.num_lines,
          total_quantity: Number(row.total_quantity),
          lines,
          payment_method: rawJson.PaymentMethod ?? rawJson.PayToCode ?? null,
          ship_to_code: rawJson.ShipToCode ?? null,
          address: rawJson.Address ?? null,
          address2: rawJson.Address2 ?? null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        reply.code(500).send({ error: "Erro ao buscar pedido", message });
      }
    }
  );

  // Verifica se o pedido pertence ao cliente autenticado (por card_code).
  async function assertOrderOwnership(
    docEntry: number,
    cardCode: string,
  ): Promise<boolean> {
    const res = await ordersPool.query(
      "SELECT card_code FROM sap_sales_orders WHERE doc_entry = $1",
      [docEntry],
    );
    const owner = res.rows[0]?.card_code;
    return (
      owner != null && owner.toLowerCase() === cardCode.toLowerCase()
    );
  }

  type CancelOrderResult =
    | { ok: true; docNum: number | null; cardName: string | null; cardCode: string }
    | { ok: false; code: 404 | 409 | 500; error: string };

  /**
   * Cancela um pedido de venda já existente no SAP (Service Layer
   * `POST /Orders(DocEntry)/Cancel`), aplicando a regra de "faturado não cancela"
   * e refletindo o cancelamento no estado local (funil e-commerce + flag no
   * espelho `sap_sales_orders`) e na timeline. Reutilizado pelo portal (cliente)
   * e pelo painel (vendedor).
   */
  async function cancelSapOrderDoc(params: {
    docEntry: number;
    reason?: string | null;
    by: string | null;
    actor: "customer" | "seller";
    correlationId: string;
    /** Quando informado, exige que o pedido pertença a este cliente. */
    requireCardCode?: string | null;
  }): Promise<CancelOrderResult> {
    const { docEntry, reason, by, actor, correlationId } = params;

    const orderRes = await ordersPool.query(
      `SELECT doc_entry, doc_num, card_code, card_name, doc_status, cancelled
       FROM sap_sales_orders WHERE doc_entry = $1`,
      [docEntry],
    );
    const row = orderRes.rows[0];
    if (!row) return { ok: false, code: 404, error: "Pedido não encontrado" };

    if (
      params.requireCardCode &&
      row.card_code?.toLowerCase() !== params.requireCardCode.toLowerCase()
    ) {
      return { ok: false, code: 404, error: "Pedido não encontrado" };
    }

    const funnelRow = await orderStatusService.get(docEntry).catch(() => null);
    if (row.cancelled === "Y") {
      return { ok: false, code: 409, error: "Pedido já está cancelado" };
    }
    if (!isSapOrderCancellable(row, funnelRow?.status ?? null)) {
      return {
        ok: false,
        code: 409,
        error: "Pedido já faturado não pode ser cancelado",
      };
    }

    // Cancela no SAP. Se o SAP recusar (ex.: já copiado para NF/entrega), o erro
    // é propagado como 409 para dar um feedback claro ao usuário.
    try {
      const client = getSapClient();
      // A ação Cancel do Service Layer não recebe corpo. Enviar `null` faria o
      // cliente serializar a string "null" e o SAP rejeita (400 "Bad request
      // content."). Por isso passamos `undefined` (sem corpo/content-type).
      await client.post<any>(`/Orders(${docEntry})/Cancel`, undefined, {
        correlationId,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Falha ao cancelar no SAP";
      app.log.error(
        { error, correlationId, docEntry },
        "Falha ao cancelar pedido no SAP",
      );
      return {
        ok: false,
        code: 409,
        error: `Não foi possível cancelar o pedido no SAP: ${message}`,
      };
    }

    // Reflete o cancelamento no espelho local (a sincronização diária confirma).
    await ordersPool
      .query(
        "UPDATE sap_sales_orders SET cancelled = 'Y' WHERE doc_entry = $1",
        [docEntry],
      )
      .catch(() => undefined);

    await orderStatusService
      .set({
        docEntry,
        status: "cancelado",
        cardCode: row.card_code ?? null,
        updatedBy: by,
      })
      .catch((err) =>
        app.log.warn({ err, docEntry }, "Falha ao mover funil para cancelado"),
      );

    const who =
      actor === "customer" ? "pelo cliente (portal)" : "pela equipe de vendas";
    await orderFollowupService
      .create({
        docEntry,
        cardCode: row.card_code ?? null,
        statusTag: "Cancelado",
        note:
          `Pedido cancelado ${who}.` + (reason ? ` Motivo: ${reason}` : ""),
        createdBy: by,
      })
      .catch(() => undefined);

    return {
      ok: true,
      docNum: row.doc_num != null ? Number(row.doc_num) : null,
      cardName: row.card_name ?? null,
      cardCode: row.card_code,
    };
  }

  function mapMessage(m: any) {
    return {
      id: m.id,
      docEntry: Number(m.doc_entry),
      authorType: m.author_type,
      authorName: m.author_name,
      kind: m.kind,
      body: m.body,
      status: m.status,
      resolutionNote: m.resolution_note,
      resolvedBy: m.resolved_by,
      resolvedAt: m.resolved_at,
      createdAt: m.created_at,
    };
  }

  // Fio de mensagens do pedido (visão do cliente).
  app.get(
    "/b2b/orders/:docEntry/messages",
    { preHandler: b2bAuth },
    async (req, reply) => {
      const customer = (req as any).b2bCustomer as B2BTokenPayload;
      const docEntry = Number((req.params as any).docEntry);
      if (!Number.isFinite(docEntry)) {
        reply.code(400).send({ error: "docEntry invalido" });
        return;
      }
      try {
        if (!(await assertOrderOwnership(docEntry, customer.cardCode))) {
          reply.code(403).send({ error: "Acesso negado a este pedido" });
          return;
        }
        const rows = await orderMessageService.listByOrder(docEntry);
        reply.code(200).send({ messages: rows.map(mapMessage) });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        reply.code(500).send({ error: message });
      }
    },
  );

  // Cliente envia mensagem ou solicitação (alteração/cancelamento).
  app.post(
    "/b2b/orders/:docEntry/messages",
    { preHandler: b2bAuth },
    async (req, reply) => {
      const customer = (req as any).b2bCustomer as B2BTokenPayload;
      const docEntry = Number((req.params as any).docEntry);
      const body = (req.body ?? {}) as { kind?: string; body?: string };
      const text = (body.body ?? "").trim();
      if (!Number.isFinite(docEntry)) {
        reply.code(400).send({ error: "docEntry invalido" });
        return;
      }
      if (!text) {
        reply.code(400).send({ error: "Mensagem vazia" });
        return;
      }
      const kind = isMessageKind(body.kind) ? body.kind : "message";
      try {
        if (!(await assertOrderOwnership(docEntry, customer.cardCode))) {
          reply.code(403).send({ error: "Acesso negado a este pedido" });
          return;
        }
        const row = await orderMessageService.create({
          docEntry,
          cardCode: customer.cardCode,
          authorType: "customer",
          authorName: customer.cardName ?? customer.cardCode,
          kind,
          body: text,
        });
        // Notifica a equipe de vendas sobre a nova interação do cliente.
        await sendOrderInteractionEmail({
          to: EMAIL_COMMERCIAL,
          cardName: customer.cardName ?? customer.cardCode,
          docNum: docEntry,
          kind,
          body: text,
          orderUrl: `${PAINEL_URL}/pedidos?docEntry=${docEntry}`,
        }).catch(() => undefined);
        reply.code(201).send({ ok: true, message: mapMessage(row) });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        reply.code(500).send({ error: message });
      }
    },
  );

  // Cliente cancela um pedido já no SAP (enquanto não faturado). Cancela de fato
  // no ERP e avisa a equipe de vendas.
  app.post(
    "/b2b/orders/:docEntry/cancel",
    { preHandler: b2bAuth },
    async (req, reply) => {
      const customer = (req as any).b2bCustomer as B2BTokenPayload;
      const correlationId = (req as any).correlationId as string;
      const docEntry = Number((req.params as any).docEntry);
      const body = (req.body ?? {}) as { reason?: string };
      if (!Number.isFinite(docEntry)) {
        reply.code(400).send({ error: "docEntry inválido" });
        return;
      }
      try {
        const reason = body.reason?.trim() || null;
        const result = await cancelSapOrderDoc({
          docEntry,
          reason,
          by: customer.cardName ?? customer.cardCode,
          actor: "customer",
          correlationId,
          requireCardCode: customer.cardCode,
        });
        if (!result.ok) {
          reply.code(result.code).send({ error: result.error });
          return;
        }

        // Confirma ao cliente e avisa a equipe de vendas.
        if (customer.email) {
          await sendOrderCancelledEmail({
            to: customer.email,
            cardName: result.cardName ?? customer.cardName ?? customer.cardCode,
            docNum: result.docNum ?? docEntry,
            reason,
            byCustomer: true,
          }).catch(() => undefined);
        }
        await sendOrderInteractionEmail({
          to: EMAIL_COMMERCIAL,
          cardName: result.cardName ?? customer.cardName ?? customer.cardCode,
          docNum: result.docNum ?? docEntry,
          kind: "cancel_request",
          body: `Pedido cancelado pelo cliente no portal.${reason ? ` Motivo: ${reason}` : ""}`,
          orderUrl: `${PAINEL_URL}/pedidos?docEntry=${docEntry}`,
        }).catch(() => undefined);

        reply.code(200).send({ ok: true, docEntry, docNum: result.docNum });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Erro ao cancelar pedido";
        req.log.error({ error, correlationId, docEntry }, "Erro ao cancelar pedido B2B");
        reply.code(500).send({ error: "Erro ao cancelar pedido", message });
      }
    },
  );

  // Cliente cancela um pedido do portal que ainda aguarda confirmação (pendente,
  // não existe no SAP). Não há nada a cancelar no ERP.
  app.post(
    "/b2b/pending-orders/:id/cancel",
    { preHandler: b2bAuth },
    async (req, reply) => {
      const customer = (req as any).b2bCustomer as B2BTokenPayload;
      const id = Number((req.params as any).id);
      const body = (req.body ?? {}) as { reason?: string };
      if (!Number.isFinite(id)) {
        reply.code(400).send({ error: "id inválido" });
        return;
      }
      try {
        const pending = await pendingOrderService.get(id);
        if (
          !pending ||
          pending.card_code?.toLowerCase() !== customer.cardCode.toLowerCase()
        ) {
          reply.code(404).send({ error: "Pedido não encontrado" });
          return;
        }
        if (pending.status !== "pendente") {
          reply.code(409).send({
            error:
              pending.status === "confirmado"
                ? "Pedido já confirmado — solicite o cancelamento pelo pedido."
                : "Pedido não está mais pendente",
          });
          return;
        }

        const row = await pendingOrderService.markCancelled(id, {
          reason: body.reason?.trim() || null,
          cancelledBy: customer.cardName ?? customer.cardCode,
        });
        if (!row) {
          reply.code(409).send({ error: "Pedido não está mais pendente" });
          return;
        }

        // Avisa a equipe de vendas que o cliente desistiu da solicitação.
        await sendOrderInteractionEmail({
          to: EMAIL_COMMERCIAL,
          cardName: customer.cardName ?? customer.cardCode,
          docNum: `S${id}`,
          kind: "cancel_request",
          body: `Solicitação de pedido cancelada pelo cliente antes da confirmação.${body.reason?.trim() ? ` Motivo: ${body.reason.trim()}` : ""}`,
          orderUrl: `${PAINEL_URL}/pedidos`,
        }).catch(() => undefined);

        reply.code(200).send({ ok: true, pending: row });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Erro ao cancelar pedido";
        reply.code(500).send({ error: "Erro ao cancelar pedido", message });
      }
    },
  );

  app.post(
    "/b2b/orders",
    { preHandler: b2bAuth },
    async (req, reply) => {
      const customer = (req as any).b2bCustomer as B2BTokenPayload;
      const correlationId = (req as any).correlationId as string;
      const body = req.body as any;

      if (
        !body?.items ||
        !Array.isArray(body.items) ||
        body.items.length === 0
      ) {
        reply.code(400).send({
          error: "Campo 'items' e obrigatorio (array de {sku, quantity})",
        });
        return;
      }

      try {
        // Pedidos do portal NÃO vão direto ao SAP: ficam pendentes de
        // confirmação manual do vendedor pelo painel. Só após a confirmação o
        // documento é criado no SAP (ver POST /b2b/admin/pending-orders/:id/confirm).
        const items: PendingOrderItem[] = body.items
          .filter((it: any) => it?.sku && Number(it?.quantity) > 0)
          .map((it: any) => ({
            sku: String(it.sku),
            name: typeof it.name === "string" ? it.name : null,
            quantity: Number(it.quantity),
            warehouse: it.warehouse ?? null,
          }));

        if (items.length === 0) {
          reply.code(400).send({
            error: "Inclua ao menos um item com quantidade válida",
          });
          return;
        }

        const pending = await pendingOrderService.create({
          cardCode: customer.cardCode,
          cardName: customer.cardName,
          items,
          notes: body.notes ?? null,
          dueDate: body.dueDate ?? null,
          origin: "portal",
          createdBy: customer.email ?? null,
        });

        // Confirmação ao cliente (recebido / aguardando) + alerta ao comercial.
        if (customer.email) {
          await sendOrderConfirmationEmail({
            to: customer.email,
            cardName: customer.cardName,
            docNum: pending.id,
          }).catch(() => undefined);
        }
        await sendNewOrderToSellerEmail({
          to: EMAIL_COMMERCIAL,
          cardName: customer.cardName,
          docNum: pending.id,
          orderUrl: `${PAINEL_URL}/pedidos`,
        }).catch(() => undefined);

        reply.code(201).send({
          ok: true,
          pending: true,
          message: "Pedido enviado. Aguardando confirmação da equipe de vendas.",
          pendingId: pending.id,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Erro ao registrar pedido";
        req.log.error(
          { error, correlationId },
          "Erro ao registrar pedido pendente B2B"
        );
        reply
          .code(500)
          .send({ error: "Erro ao registrar pedido", message });
      }
    }
  );

  // =============================================
  // DASHBOARD RAPIDO (Postgres local)
  // =============================================
  app.get(
    "/b2b/dashboard",
    { preHandler: b2bAuth },
    async (req, reply) => {
      const customer = (req as any).b2bCustomer as B2BTokenPayload;

      try {
        // Todos os pedidos do cliente + estágio do funil (LEFT JOIN), para
        // KPIs por etapa do funil e-commerce.
        const allRes = await ordersPool.query(
          `SELECT o.doc_entry, o.doc_status, o.cancelled, s.status AS funnel_status
           FROM sap_sales_orders o
           LEFT JOIN b2b_order_status s ON s.doc_entry = o.doc_entry
           WHERE o.card_code = $1`,
          [customer.cardCode],
        );
        const totalOrders = allRes.rows.length;

        const ordersByStatus: Record<string, number> = {};
        for (const r of allRes.rows) {
          const st = deriveFunnelStatus(
            r,
            isOrderStatus(r.funnel_status) ? r.funnel_status : null,
          );
          ordersByStatus[st] = (ordersByStatus[st] ?? 0) + 1;
        }

        const recentRes = await ordersPool.query(
          `SELECT o.doc_entry, o.doc_num, o.doc_date, o.doc_due_date, o.card_code, o.card_name,
                  o.doc_total, o.doc_currency, o.doc_status, o.cancelled, o.comments,
                  o.num_lines, o.total_quantity, s.status AS funnel_status
           FROM sap_sales_orders o
           LEFT JOIN b2b_order_status s ON s.doc_entry = o.doc_entry
           WHERE o.card_code = $1
           ORDER BY o.doc_date DESC, o.doc_entry DESC LIMIT 5`,
          [customer.cardCode],
        );

        // Pedidos aguardando confirmação contam no funil e aparecem em recentes.
        const pendingRows = await pendingOrderService
          .listPendingForCustomer(customer.cardCode)
          .catch(() => [] as PendingOrderRow[]);
        const pendingItems = pendingRows.map(mapPendingOrder);
        for (const p of pendingItems) {
          ordersByStatus[p.status] = (ordersByStatus[p.status] ?? 0) + 1;
        }

        const recentSap = recentRes.rows.map((r: any) =>
          mapCustomerOrder(
            r,
            isOrderStatus(r.funnel_status) ? r.funnel_status : null,
          ),
        );
        const recentOrders = [...pendingItems, ...recentSap].slice(0, 5);

        reply.code(200).send({
          totalOrders: totalOrders + pendingItems.length,
          ordersByStatus,
          recentOrders,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        reply.code(500).send({ error: message });
      }
    }
  );

  // =============================================
  // CATALOG SYNC (reusable function)
  // =============================================

  async function runCatalogSync(correlationId: string) {
    app.log.info({ correlationId }, "Catalog sync: iniciando");

    const entSvc = getEntitiesService();

    let sapGroups: { Number: number; GroupName: string }[] = [];
    try {
      sapGroups = await entSvc.listItemGroups(correlationId);
      setSapGroupNames(sapGroups);
      app.log.info({ correlationId, groups: sapGroups.length }, "Catalog sync: grupos carregados");
    } catch (err: any) {
      app.log.warn({ correlationId, error: err?.message?.slice(0, 200) }, "Catalog sync: falha ao buscar grupos");
    }

    const [sapItems, gsnProducts, wooProducts] = await Promise.all([
      entSvc.listItems({ limit: 5000, onlyActive: false }, correlationId),
      fetchAllGsnProducts(),
      fetchAllWooProducts(),
    ]);

    // gsnonline (loja B2C oficial) primeiro: as imagens do catalogo devem vir de
    // gsnonline.com.br, entao ele tem prioridade em empates de match e no indice
    // de imagem por familia. O WooCommerce entra como complemento (produtos que
    // por acaso nao existam no gsnonline).
    const webProducts = [...gsnProducts, ...wooProducts];

    app.log.info(
      {
        correlationId,
        sapCount: sapItems.length,
        gsnCount: gsnProducts.length,
        wooCount: wooProducts.length,
      },
      "Catalog sync: dados carregados",
    );

    const deactivated = await catalogService.deactivateByGroupCodes(EXCLUDED_SAP_GROUPS);
    if (deactivated > 0) {
      app.log.info({ correlationId, deactivated, groups: EXCLUDED_SAP_GROUPS }, "Catalog sync: categorias excluidas desativadas no DB");
    }

    const matches = matchSapToGsn(sapItems, webProducts);

    // Índice de imagens por FAMÍLIA (nome sem litragem + grupo físico). Usado
    // como fallback para variantes sem match direto: ex.: "Burdeos 500 ml" e as
    // demais embalagens/fechos herdam a foto de "Garrafa Burdeos 750 ml".
    const familyImageIndex = buildFamilyImageIndex(webProducts);

    // Fontes dedicadas SÓ ao gsnonline (loja B2C oficial) para a IMAGEM: a foto
    // do produto deve vir prioritariamente do gsnonline (TCDN), usando o Woo
    // apenas quando o gsnonline nao tem a imagem. O match combinado acima costuma
    // ser vencido pelo Woo por SCORE (produtos gsnonline muitas vezes tem ean=""),
    // por isso resolvemos a imagem com estes indices proprios do gsnonline.
    const gsnMatches = matchSapToGsn(sapItems, gsnProducts);
    const gsnFamilyIndex = buildFamilyImageIndex(gsnProducts);

    const eanMatches = [...matches.values()].filter((m) => m.score === 100).length;
    const fuzzyMatches = [...matches.values()].filter((m) => m.score < 100).length;
    app.log.info(
      { correlationId, totalMatches: matches.size, eanMatches, fuzzyMatches },
      "Catalog sync: matching SAP↔GSN concluido",
    );

    let upserted = 0;
    let skipped = 0;
    let withStock = 0;
    const stockBySku = new Map<string, number>();

    // Estoque DISPONÍVEL por SKU (on_hand - committed), somado por depósito —
    // exatamente a base usada pela Gestão de Compras/Estoque do painel
    // (inventory_stock). Preferimos a SQLQuery enriquecida; caímos para o
    // $expand por depósito e, por fim, para os campos agregados do próprio item.
    const availBySku = new Map<string, number>();
    try {
      let invRows: { ItemCode: string; InStock: number; Committed: number }[] =
        await entSvc.listInventoryEnriched(correlationId);
      if (!invRows || invRows.length === 0) {
        invRows = await entSvc.listInventory({ limit: 5000 }, correlationId);
      }
      for (const r of invRows) {
        const avail = Math.max((r.InStock ?? 0) - (r.Committed ?? 0), 0);
        availBySku.set(r.ItemCode, (availBySku.get(r.ItemCode) ?? 0) + avail);
      }
      app.log.info(
        { correlationId, skusComEstoque: availBySku.size },
        "Catalog sync: disponibilidade (on_hand - committed) carregada",
      );
    } catch (err: any) {
      app.log.warn(
        { correlationId, error: err?.message?.slice(0, 200) },
        "Catalog sync: falha ao carregar disponibilidade; usando campos agregados do item",
      );
    }

    for (const item of sapItems) {
      const groupCode = item.ItemsGroupCode ?? null;
      const isExcludedGroup = groupCode != null && EXCLUDED_SAP_GROUPS.includes(groupCode);

      if (isExcludedGroup) {
        skipped++;
        await catalogService.upsertProduct({
          sap_item_code: item.ItemCode,
          sap_item_name: item.ItemName ?? item.ItemCode,
          category_name: getGroupDisplayName(groupCode),
          sap_group_code: groupCode,
          unit_of_measure: item.InventoryUOM ?? "UN",
          is_active: false,
          is_sales_item: false,
          match_score: 0,
        });
        continue;
      }

    const isSalesItem = item.SalesItem === "tYES";
    const match = matches.get(item.ItemCode);
    // Imagem com prioridade gsnonline > woo. Pega a PRIMEIRA fonte com url:
    //   a) match direto gsnonline (mesmo produto/volume na loja B2C oficial)
    //   b) fallback por FAMÍLIA no gsnonline (ignora litragem/embalagem/fecho)
    //   c) match direto combinado (pode ser Woo) — complemento
    //   d) fallback por FAMÍLIA combinado (pode ser Woo) — complemento
    const famKey = familyKeyOfName(item.ItemName ?? "");
    const gsnMatch = gsnMatches.get(item.ItemCode);
    let firstImage = gsnMatch?.gsn.images[0];
    if (!firstImage?.url && famKey) firstImage = gsnFamilyIndex.get(famKey);
    if (!firstImage?.url) firstImage = match?.gsn.images[0];
    if (!firstImage?.url && famKey) firstImage = familyImageIndex.get(famKey);

      // Categoria sempre do grupo do SAP (fonte de verdade) — evita categorias
      // erradas vindas de um match fraco no site. So cai para a categoria do
      // site quando o grupo SAP nao tem nome resolvido.
      const groupCategory = getGroupDisplayName(groupCode);
      const rawCategory = groupCategory || match?.gsn.category_name;
      const categoryName = normalizeCategoryName(rawCategory);

      // A embalagem SEMPRE vem do NOME DO ITEM NO SAP: e o unico lugar que traz
      // o sufixo "- PALETE C/ 4.693 UND" / "- CAIXA C/ 24 UND" / "- UND". O nome
      // de marketing do GSN (match.gsn.name) nao tem esse sufixo, entao usa-lo
      // aqui gravava "Unidade" e preservava um units_per_package antigo/errado.
      const packaging = resolvePackaging(
        item.InventoryUOM,
        item.SalesUnit,
        item.SalesPackagingUnit,
        item.SalesQtyPerPackUnit,
        item.SalesItemsPerUnit,
        item.ItemName || item.ItemCode,
      );

      // Disponível na unidade nativa da variante (nº de caixas/fardos/und).
      // Sempre registramos (inclusive 0) para que itens que zeraram o estoque
      // deixem de aparecer como disponíveis no catálogo.
      const stock = availBySku.has(item.ItemCode)
        ? (availBySku.get(item.ItemCode) as number)
        : Math.max(
            (item.QuantityOnStock ?? 0) - (item.QuantityOrderedByCustomers ?? 0),
            0,
          );
      stockBySku.set(item.ItemCode, stock);
      if (stock > 0) withStock++;

      if (upserted < 3) {
        app.log.info({
          correlationId,
          code: item.ItemCode,
          name: item.ItemName,
          stock,
          uom: item.InventoryUOM,
          salesUnit: item.SalesUnit,
          salesPack: item.SalesPackagingUnit,
          qtyPerPack: item.SalesQtyPerPackUnit,
          itemsPerUnit: item.SalesItemsPerUnit,
          group: groupCode,
          resolvedPack: packaging,
        }, "Catalog sync: sample item SAP");
      }

      await catalogService.upsertProduct({
        sap_item_code: item.ItemCode,
        sap_item_name: item.ItemName ?? item.ItemCode,
        gsn_product_id: match?.gsn.id ?? null,
        gsn_product_name: match?.gsn.name ?? null,
        gsn_slug: match?.gsn.slug ?? null,
        image_url: firstImage?.url ?? null,
        image_thumb_url: firstImage?.thumbUrl ?? null,
        category_name: categoryName,
        sap_group_code: groupCode,
        description_short: match?.gsn.description_small ?? null,
        ean: item.BarCode ?? match?.gsn.ean ?? null,
        unit_of_measure: item.InventoryUOM ?? "UN",
        packaging_type: packaging.type,
        units_per_package: packaging.units,
        is_active: (item.Valid === "tYES" || !item.Valid) && item.Frozen !== "tYES",
        is_sales_item: isSalesItem,
        match_score: match?.score ?? 0,
      });
      upserted++;
    }

    // Produtos do site sem item correspondente no SAP nao podem ser pedidos
    // (precisam de ItemCode do SAP). Garantimos que nenhum produto sintetico
    // GSN-* fique ativo no catalogo.
    const gsnOnly = await catalogService.deactivateSyntheticProducts();
    if (gsnOnly > 0) {
      app.log.info(
        { correlationId, deactivatedSynthetic: gsnOnly },
        "Catalog sync: produtos sinteticos GSN-* desativados",
      );
    }

    if (stockBySku.size > 0) {
      await catalogService.updateStock(stockBySku);
    }

    const inventoryRows = withStock;

    let notified = 0;
    try {
      const backInStock = await catalogService.listBackInStockSkus();
      for (const sku of backInStock) {
        const pending = await catalogService.getPendingNotifications(sku);
        if (pending.length === 0) continue;

        for (const n of pending) {
          try {
            const product = await catalogService.getProduct(sku);
            await sendBackInStockEmail({
              to: n.email,
              productName: product?.sap_item_name ?? sku,
            });
          } catch {
            // email delivery failure - continue
          }
        }
        await catalogService.markNotified(pending.map((n) => n.id));
        notified += pending.length;
      }
    } catch (err: any) {
      app.log.warn({ correlationId, error: err?.message?.slice(0, 200) }, "Catalog sync: falha ao enviar notificacoes");
    }

    app.log.info(
      { correlationId, upserted, skipped, gsnOnly, withStock, matched: matches.size, inventoryRows, notified },
      "Catalog sync: concluido",
    );

    return { upserted, skipped, gsnOnly, withStock, matched: matches.size, gsnProducts: gsnProducts.length, inventoryRows, notified };
  }

  // =============================================
  // SCHEDULED SYNC (every 4 hours)
  // =============================================

  const SYNC_INTERVAL_MS = 4 * 60 * 60 * 1000;
  let syncTimer: ReturnType<typeof setTimeout> | null = null;

  async function scheduledSync() {
    try {
      await runCatalogSync(`auto-sync-${Date.now()}`);
    } catch (err: any) {
      app.log.error({ error: err?.message }, "Scheduled catalog sync failed");
    }
    syncTimer = setTimeout(scheduledSync, SYNC_INTERVAL_MS);
  }

  setTimeout(scheduledSync, 30_000);

  // =============================================
  // CATALOG ROUTES (B2B customer auth)
  // =============================================

  app.get(
    "/b2b/catalog",
    { preHandler: b2bAuth },
    async (req, reply) => {
      const query = req.query as Record<string, string>;
      const limit = Number(query.limit) || 24;
      const result = await catalogService.listProducts({
        search: query.search,
        category: query.category,
        inStock: query.inStock === "true" ? true : query.inStock === "false" ? false : undefined,
        page: Number(query.page) || 1,
        limit,
        // Catálogo público: só produtos com pedido de venda nos últimos 12 meses.
        onlyRecentlySold: true,
      });
      const pages = Math.ceil(result.total / limit);
      reply.send({
        items: result.items.map(toB2BCatalogItem),
        total: result.total,
        page: Number(query.page) || 1,
        pages,
      });
    },
  );

  // Catálogo UNIFICADO: agrupa as variações de embalagem (UND/CAIXA/FARDO...)
  // de um mesmo produto em um único item, com categoria (grupo), atributos e a
  // lista de embalagens — espelha o catálogo do painel da garrafaria.
  app.get(
    "/b2b/catalog/unified",
    { preHandler: b2bAuth },
    async (req, reply) => {
      const query = req.query as Record<string, string>;
      const limit = Number(query.limit) || 24;
      const page = Number(query.page) || 1;
      const result = await catalogService.listUnifiedProducts({
        search: query.search,
        category: query.category,
        inStock:
          query.inStock === "true"
            ? true
            : query.inStock === "false"
              ? false
              : undefined,
        page,
        limit,
      });
      const pages = Math.ceil(result.total / limit);
      reply.send({
        items: result.items,
        total: result.total,
        page,
        pages,
        categories: result.categories,
      });
    },
  );

  app.get(
    "/b2b/catalog/unified/:sku",
    { preHandler: b2bAuth },
    async (req, reply) => {
      const { sku } = req.params as { sku: string };
      const product = await catalogService.getUnifiedProductBySku(sku);
      if (!product) {
        reply.code(404).send({ error: "Produto nao encontrado" });
        return;
      }
      reply.send(product);
    },
  );

  app.get(
    "/b2b/catalog/categories",
    { preHandler: b2bAuth },
    async (_req, reply) => {
      const categories = await catalogService.getCategories();
      reply.send({ categories });
    },
  );

  app.get(
    "/b2b/catalog/:sku",
    { preHandler: b2bAuth },
    async (req, reply) => {
      const { sku } = req.params as { sku: string };
      const product = await catalogService.getProduct(sku);
      if (!product) {
        reply.code(404).send({ error: "Produto nao encontrado" });
        return;
      }
      reply.send(toB2BProductDetail(product));
    },
  );

  app.post(
    "/b2b/catalog/:sku/notify",
    { preHandler: b2bAuth },
    async (req, reply) => {
      const { sku } = req.params as { sku: string };
      const customer = (req as any).b2bCustomer;
      const { email } = req.body as { email?: string };

      const product = await catalogService.getProduct(sku);
      if (!product) {
        reply.code(404).send({ error: "Produto nao encontrado" });
        return;
      }

      await catalogService.requestNotification(
        sku,
        customer.cnpj ?? "",
        email ?? customer.email ?? "",
      );
      reply.send({ ok: true, message: "Voce sera notificado quando o produto estiver disponivel" });
    },
  );

  // =============================================
  // PRODUTOS FREQUENTES DO CLIENTE
  // =============================================
  app.get(
    "/b2b/catalog/frequent",
    { preHandler: b2bAuth },
    async (req, reply) => {
      const customer = (req as any).b2bCustomer as B2BTokenPayload;

      try {
        const result = await ordersPool.query(
          `SELECT l.item_code,
                  MAX(l.item_description) AS item_description,
                  COUNT(DISTINCT o.doc_entry) AS order_count,
                  SUM(l.quantity)::numeric AS total_qty,
                  MAX(o.doc_date) AS last_ordered
           FROM sap_sales_order_lines l
           JOIN sap_sales_orders o ON o.doc_entry = l.doc_entry
           WHERE o.card_code = $1
           GROUP BY l.item_code
           ORDER BY order_count DESC, total_qty DESC
           LIMIT 20`,
          [customer.cardCode],
        );

        const items = [];
        for (const row of result.rows) {
          const product = await catalogService.getProduct(row.item_code);
          items.push({
            sku: row.item_code,
            name: product?.sap_item_name ?? row.item_description,
            orderCount: Number(row.order_count),
            totalQty: Number(row.total_qty),
            lastOrdered: row.last_ordered,
            imageUrl: product?.image_url ?? null,
            imageThumbUrl: product?.image_thumb_url ?? null,
            inStock: product?.is_in_stock ?? false,
            stockQuantity: Number(product?.total_stock ?? 0),
            category: product?.category_name ?? null,
            unitOfMeasure: product?.unit_of_measure ?? "UN",
            price: 0,
          });
        }

        reply.send({ items });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        reply.code(500).send({ error: message });
      }
    },
  );

  // =============================================
  // FAVORITOS DO CLIENTE
  // =============================================
  // Lista os produtos favoritos do cliente, enriquecidos pelo catálogo.
  // Mesmo formato de item usado por /b2b/catalog/frequent.
  app.get(
    "/b2b/favorites",
    { preHandler: b2bAuth },
    async (req, reply) => {
      const customer = (req as any).b2bCustomer as B2BTokenPayload;
      try {
        const skus = await favoritesService.listSkus(customer.cardCode);
        const items = [];
        for (const sku of skus) {
          const product = await catalogService.getProduct(sku);
          items.push({
            sku,
            name: product?.sap_item_name ?? sku,
            imageUrl: product?.image_url ?? null,
            imageThumbUrl: product?.image_thumb_url ?? null,
            inStock: product?.is_in_stock ?? false,
            stockQuantity: Number(product?.total_stock ?? 0),
            category: product?.category_name ?? null,
            unitOfMeasure: product?.unit_of_measure ?? "UN",
            price: 0,
          });
        }
        reply.send({ items });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        reply.code(500).send({ error: message });
      }
    },
  );

  app.post(
    "/b2b/favorites",
    { preHandler: b2bAuth },
    async (req, reply) => {
      const customer = (req as any).b2bCustomer as B2BTokenPayload;
      const body = (req.body ?? {}) as { sku?: unknown };
      const sku = typeof body.sku === "string" ? body.sku.trim() : "";
      if (!sku) {
        reply.code(400).send({ error: "SKU obrigatório" });
        return;
      }
      try {
        await favoritesService.add(customer.cardCode, customer.cnpj ?? null, sku);
        reply.send({ ok: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        reply.code(500).send({ error: message });
      }
    },
  );

  app.delete(
    "/b2b/favorites/:sku",
    { preHandler: b2bAuth },
    async (req, reply) => {
      const customer = (req as any).b2bCustomer as B2BTokenPayload;
      const { sku } = req.params as { sku: string };
      if (!sku) {
        reply.code(400).send({ error: "SKU obrigatório" });
        return;
      }
      try {
        await favoritesService.remove(customer.cardCode, sku);
        reply.send({ ok: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        reply.code(500).send({ error: message });
      }
    },
  );

  // =============================================
  // ADMIN CATALOG ROUTES
  // =============================================

  app.post(
    "/b2b/admin/sync/catalog",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const correlationId = (req as any).correlationId as string;
      try {
        const result = await runCatalogSync(correlationId);
        reply.send({ ok: true, ...result, timestamp: new Date().toISOString() });
      } catch (err: any) {
        app.log.error({ correlationId, error: err?.message }, "Admin catalog sync failed");
        reply.code(500).send({ error: err?.message ?? "Erro ao sincronizar catalogo" });
      }
    },
  );

  app.get(
    "/b2b/admin/catalog/matches",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const query = req.query as Record<string, string>;
      const matches = await catalogService.listMatches(query.unconfirmed === "true");
      reply.send({ matches, total: matches.length });
    },
  );

  app.get(
    "/b2b/admin/catalog/stats",
    { preHandler: b2bAdminAuth },
    async (_req, reply) => {
      const dbUrl = B2B_DB_URL;
      const pg2 = new (await import("pg")).default.Pool({ connectionString: dbUrl });
      try {
        const totalRes = await pg2.query("SELECT COUNT(*) AS cnt FROM b2b_catalog_products");
        const activeRes = await pg2.query("SELECT COUNT(*) AS cnt FROM b2b_catalog_products WHERE is_active = TRUE AND is_sales_item = TRUE");
        const inStockRes = await pg2.query("SELECT COUNT(*) AS cnt FROM b2b_catalog_products WHERE is_in_stock = TRUE");
        const withImageRes = await pg2.query("SELECT COUNT(*) AS cnt FROM b2b_catalog_products WHERE image_url IS NOT NULL");
        const gsnOnlyRes = await pg2.query("SELECT COUNT(*) AS cnt FROM b2b_catalog_products WHERE sap_item_code LIKE 'GSN-%'");
        const sapOnlyRes = await pg2.query("SELECT COUNT(*) AS cnt FROM b2b_catalog_products WHERE sap_item_code NOT LIKE 'GSN-%'");
        const matchedRes = await pg2.query("SELECT COUNT(*) AS cnt FROM b2b_catalog_products WHERE gsn_product_id IS NOT NULL AND sap_item_code NOT LIKE 'GSN-%'");
        const noImageSapRes = await pg2.query("SELECT sap_item_code, sap_item_name, match_score FROM b2b_catalog_products WHERE image_url IS NULL AND sap_item_code NOT LIKE 'GSN-%' AND is_active = TRUE AND is_sales_item = TRUE ORDER BY sap_item_name LIMIT 30");
        const catRes = await pg2.query("SELECT category_name, sap_group_code, COUNT(*) AS cnt, SUM(CASE WHEN is_sales_item THEN 1 ELSE 0 END) AS sales_cnt FROM b2b_catalog_products WHERE is_active = TRUE GROUP BY category_name, sap_group_code ORDER BY cnt DESC");
        const sampleRes = await pg2.query("SELECT sap_item_code, sap_item_name, gsn_product_id, gsn_product_name, image_url IS NOT NULL AS has_image, match_score, category_name, packaging_type, units_per_package, total_stock, is_in_stock, is_active, is_sales_item FROM b2b_catalog_products ORDER BY sap_item_code LIMIT 50");

        reply.send({
          total: Number(totalRes.rows[0].cnt),
          active_sales: Number(activeRes.rows[0].cnt),
          in_stock: Number(inStockRes.rows[0].cnt),
          with_image: Number(withImageRes.rows[0].cnt),
          sap_matched_gsn: Number(matchedRes.rows[0].cnt),
          gsn_only: Number(gsnOnlyRes.rows[0].cnt),
          sap_only: Number(sapOnlyRes.rows[0].cnt),
          sap_no_image: noImageSapRes.rows,
          categories: catRes.rows,
          sample: sampleRes.rows,
        });
      } finally {
        await pg2.end();
      }
    },
  );

  app.patch(
    "/b2b/admin/catalog/matches/:id",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const body = req.body as {
        gsn_product_id?: string;
        image_url?: string;
        image_thumb_url?: string;
      };
      await catalogService.confirmMatch(
        Number(id),
        body.gsn_product_id,
        body.image_url,
        body.image_thumb_url,
      );
      reply.send({ ok: true });
    },
  );

  // =============================================
  // ADMIN — GESTÃO DE CATÁLOGO (produtos, imagem, SEO, categorias)
  // =============================================

  // Visão geral (KPIs).
  app.get(
    "/b2b/admin/catalog/overview",
    { preHandler: b2bAdminAuth },
    async (_req, reply) => {
      try {
        const data = await catalogService.getAdminOverview();
        reply.send({ ok: true, data });
      } catch (err: any) {
        reply.code(500).send({ ok: false, error: err?.message ?? "Erro ao carregar visão geral" });
      }
    },
  );

  // Lista paginada de produtos com filtros.
  app.get(
    "/b2b/admin/catalog/products",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const q = req.query as Record<string, string>;
      const page = Math.max(1, Number(q.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
      try {
        const { items, total } = await catalogService.listAdminProducts({
          search: q.search?.trim() || undefined,
          category: q.category?.trim() || undefined,
          visibility:
            q.visibility === "hidden" ? "hidden" : q.visibility === "visible" ? "visible" : undefined,
          locked: q.locked === "true" ? true : q.locked === "false" ? false : undefined,
          noImage: q.noImage === "true" ? true : q.noImage === "false" ? false : undefined,
          sort:
            q.sort === "category" ? "category" : q.sort === "updated" ? "updated" : "name",
          order: q.order === "desc" ? "desc" : "asc",
          page,
          limit,
        });
        reply.send({
          ok: true,
          data: items.map(toAdminCatalogProduct),
          total,
          page,
          pages: Math.max(1, Math.ceil(total / limit)),
        });
      } catch (err: any) {
        reply.code(500).send({ ok: false, error: err?.message ?? "Erro ao listar produtos" });
      }
    },
  );

  // Detalhe de um produto.
  app.get(
    "/b2b/admin/catalog/products/:sku",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const { sku } = req.params as { sku: string };
      const product = await catalogService.getProduct(sku);
      if (!product) {
        reply.code(404).send({ ok: false, error: "Produto não encontrado" });
        return;
      }
      reply.send({ ok: true, data: toAdminCatalogProduct(product) });
    },
  );

  // Edição de conteúdo/SEO/visibilidade.
  app.patch(
    "/b2b/admin/catalog/products/:sku",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const { sku } = req.params as { sku: string };
      const admin = (req as any).b2bAdmin as B2BAdminTokenPayload;
      const body = (req.body ?? {}) as Record<string, unknown>;

      const patch: Parameters<typeof catalogService.updateAdminProduct>[1] = {};
      const asStr = (v: unknown): string | null =>
        v === null ? null : typeof v === "string" ? v : String(v);

      if ("description_short" in body) patch.description_short = asStr(body.description_short);
      if ("seo_title" in body) patch.seo_title = asStr(body.seo_title);
      if ("seo_description" in body) patch.seo_description = asStr(body.seo_description);
      if ("seo_slug" in body) patch.seo_slug = asStr(body.seo_slug);
      // Keywords: aceita array (aplicado da IA) ou string "a, b, c".
      if ("seo_keywords" in body) {
        const kw = body.seo_keywords;
        patch.seo_keywords = Array.isArray(kw)
          ? kw.map((k) => String(k).trim()).filter(Boolean).join(", ")
          : asStr(kw);
      }
      // Atributos: aceita array de {name,value} (serializado em JSON) ou string.
      if ("seo_attributes" in body) {
        const at = body.seo_attributes;
        patch.seo_attributes =
          at == null ? null : typeof at === "string" ? at : JSON.stringify(at);
      }
      if ("og_image_url" in body) patch.og_image_url = asStr(body.og_image_url);
      if ("image_url" in body) patch.image_url = asStr(body.image_url);
      if ("admin_hidden" in body) patch.admin_hidden = body.admin_hidden === true || body.admin_hidden === "true";

      if (Object.keys(patch).length === 0) {
        reply.code(400).send({ ok: false, error: "Nenhum campo para atualizar" });
        return;
      }

      try {
        const updated = await catalogService.updateAdminProduct(sku, patch, admin.user);
        if (!updated) {
          reply.code(404).send({ ok: false, error: "Produto não encontrado" });
          return;
        }
        reply.send({ ok: true, data: toAdminCatalogProduct(updated) });
      } catch (err: any) {
        reply.code(500).send({ ok: false, error: err?.message ?? "Erro ao atualizar produto" });
      }
    },
  );

  // Upload de imagem (multipart). Salva em UPLOADS_DIR/products e trava o conteúdo.
  app.post(
    "/b2b/admin/catalog/products/:sku/image",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const { sku } = req.params as { sku: string };
      const admin = (req as any).b2bAdmin as B2BAdminTokenPayload;

      const product = await catalogService.getProduct(sku);
      if (!product) {
        reply.code(404).send({ ok: false, error: "Produto não encontrado" });
        return;
      }

      let file;
      try {
        file = await (req as any).file();
      } catch (err: any) {
        reply.code(400).send({ ok: false, error: "Falha ao ler o arquivo enviado" });
        return;
      }
      if (!file) {
        reply.code(400).send({ ok: false, error: "Nenhum arquivo enviado (campo 'file')" });
        return;
      }
      if (!ALLOWED_IMAGE_MIME.has(file.mimetype)) {
        reply.code(415).send({ ok: false, error: "Tipo inválido. Use JPG, PNG ou WEBP." });
        return;
      }

      let buffer: Buffer;
      try {
        buffer = await file.toBuffer();
      } catch (err: any) {
        // @fastify/multipart lança quando excede o limite de 8MB.
        reply.code(413).send({ ok: false, error: "Arquivo muito grande (máx. 8MB)" });
        return;
      }

      const ext = IMAGE_EXT_BY_MIME[file.mimetype] ?? "jpg";
      const safeSku = sku.replace(/[^a-zA-Z0-9_-]/g, "");
      const filename = `${safeSku}-${randomUUID()}.${ext}`;
      const destDir = path.join(UPLOADS_DIR, "products");

      try {
        await mkdir(destDir, { recursive: true });
        await writeFile(path.join(destDir, filename), buffer);
      } catch (err: any) {
        req.log.error({ error: err?.message }, "Falha ao salvar upload de imagem");
        reply.code(500).send({ ok: false, error: "Falha ao salvar a imagem" });
        return;
      }

      const publicUrl = `${B2B_PUBLIC_UPLOADS_BASE}/${filename}`;
      const updated = await catalogService.setProductImage(sku, publicUrl, publicUrl, admin.user);
      reply.send({
        ok: true,
        data: updated ? toAdminCatalogProduct(updated) : null,
        imageUrl: publicUrl,
      });
    },
  );

  // Destravar produto (volta a seguir o sync).
  app.post(
    "/b2b/admin/catalog/products/:sku/unlock",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const { sku } = req.params as { sku: string };
      const admin = (req as any).b2bAdmin as B2BAdminTokenPayload;
      const updated = await catalogService.unlockProduct(sku, admin.user);
      if (!updated) {
        reply.code(404).send({ ok: false, error: "Produto não encontrado" });
        return;
      }
      reply.send({ ok: true, data: toAdminCatalogProduct(updated) });
    },
  );

  // Categorias com visibilidade + contagem.
  app.get(
    "/b2b/admin/catalog/categories",
    { preHandler: b2bAdminAuth },
    async (_req, reply) => {
      try {
        const categories = await catalogService.listCategorySettings();
        reply.send({ ok: true, data: categories });
      } catch (err: any) {
        reply.code(500).send({ ok: false, error: err?.message ?? "Erro ao listar categorias" });
      }
    },
  );

  // Upsert de visibilidade de categoria.
  app.patch(
    "/b2b/admin/catalog/categories",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const admin = (req as any).b2bAdmin as B2BAdminTokenPayload;
      const body = (req.body ?? {}) as Record<string, unknown>;
      const name = typeof body.category_name === "string" ? body.category_name.trim() : "";
      if (!name) {
        reply.code(400).send({ ok: false, error: "category_name é obrigatório" });
        return;
      }
      const asStr = (v: unknown): string | null =>
        v === null ? null : typeof v === "string" ? v : String(v);
      try {
        // Campos de SEO (opcionais) — upsert independente da visibilidade.
        const seoPatch: Parameters<typeof catalogService.updateCategorySeo>[1] = {};
        if ("seo_title" in body) seoPatch.seo_title = asStr(body.seo_title);
        if ("seo_description" in body) seoPatch.seo_description = asStr(body.seo_description);
        if ("intro_text" in body) seoPatch.intro_text = asStr(body.intro_text);
        if ("seo_keywords" in body) {
          const kw = body.seo_keywords;
          seoPatch.seo_keywords = Array.isArray(kw)
            ? kw.map((k) => String(k).trim()).filter(Boolean).join(", ")
            : asStr(kw);
        }
        if (Object.keys(seoPatch).length > 0) {
          await catalogService.updateCategorySeo(name, seoPatch, admin.user);
        }

        // Visibilidade (opcional; só altera quando is_visible foi enviado).
        if ("is_visible" in body) {
          const isVisible = body.is_visible === true || body.is_visible === "true";
          await catalogService.upsertCategorySetting(name, isVisible, admin.user);
        }

        reply.send({ ok: true });
      } catch (err: any) {
        reply.code(500).send({ ok: false, error: err?.message ?? "Erro ao atualizar categoria" });
      }
    },
  );

  // =============================================
  // SEO — IA (OpenAI) + Ranqueamento (Google Search Console)
  // =============================================

  const SEO_METRICS_WINDOW_DAYS = Number(process.env.GSC_WINDOW_DAYS ?? "28");

  // Entrada da IA a partir do produto. Os atributos (cor/fechamento/capacidade)
  // vêm do NOME-BASE do card — que preserva cor, fechamento e diâmetro — e não do
  // nome-de-modelo (que os removeria, mandando campos nulos para a IA). O diâmetro
  // é extraído do mesmo nome-base para que o SEO diferencie boca/gargalo.
  function buildProductSeoInput(p: CatalogProduct) {
    const baseName = getBaseProductName(p.sap_item_name) || p.sap_item_name;
    const attrs = parseProductAttributes(baseName);
    const diameter = extractDiameter(baseName);
    return {
      name: baseName,
      category: p.category_name,
      color: attrs.color,
      closure: attrs.closure,
      capacity: attrs.capacity,
      diameter,
      currentDescription: p.description_short,
      ean: p.ean,
      packagingType: p.packaging_type,
      unitsPerPack: p.units_per_package,
    };
  }

  // Entrada do score determinístico a partir do produto.
  function buildScoreInput(p: CatalogProduct) {
    return {
      name: p.sap_item_name,
      seoTitle: p.seo_title,
      seoDescription: p.seo_description,
      seoSlug: p.seo_slug,
      description: p.description_short,
      imageUrl: p.image_url,
      ogImageUrl: p.og_image_url,
      keywords: parseKeywords(p.seo_keywords),
    };
  }

  // Agrega várias linhas de página do GSC em uma métrica única (posição média
  // ponderada por impressões).
  function aggregatePages(rows: GscPageRow[]): {
    position: number | null;
    clicks: number;
    impressions: number;
    ctr: number;
  } {
    if (rows.length === 0) return { position: null, clicks: 0, impressions: 0, ctr: 0 };
    let clicks = 0;
    let impressions = 0;
    let weightedPos = 0;
    for (const r of rows) {
      clicks += r.clicks;
      impressions += r.impressions;
      weightedPos += r.position * (r.impressions || 1);
    }
    const totalWeight = rows.reduce((s, r) => s + (r.impressions || 1), 0);
    const ctr = impressions > 0 ? clicks / impressions : 0;
    const position = totalWeight > 0 ? weightedPos / totalWeight : null;
    return { position, clicks, impressions, ctr };
  }

  // Páginas do GSC que correspondem ao slug de origem do produto.
  function matchPagesForSlug(pageRows: GscPageRow[], slug: string | null): GscPageRow[] {
    if (!slug) return [];
    const clean = slug.trim().replace(/^\/+|\/+$/g, "").toLowerCase();
    if (!clean) return [];
    const last = clean.split("/").pop() as string;
    let matches = pageRows.filter((r) => r.page.toLowerCase().includes(`/${clean}`));
    if (matches.length === 0 && last !== clean) {
      matches = pageRows.filter((r) => r.page.toLowerCase().includes(`/${last}`));
    }
    return matches;
  }

  // Busca no GSC e persiste as métricas de todos os produtos e categorias.
  async function refreshSeoMetrics(): Promise<{ periodStart: string; periodEnd: string }> {
    const periodStart = isoDaysAgo(SEO_METRICS_WINDOW_DAYS);
    const periodEnd = isoDaysAgo(1);
    const pageRows = await searchConsoleService.queryPages(periodStart, periodEnd);
    const products = await catalogService.listAllActiveProducts();

    // Métricas por produto.
    const byCategory = new Map<string, GscPageRow[]>();
    for (const p of products) {
      const matched = matchPagesForSlug(pageRows, p.gsn_slug);
      const agg = aggregatePages(matched);
      const canonical = deriveCanonicalUrl(p.gsn_product_id, p.gsn_slug);
      await searchConsoleService.saveMetric({
        scope: "product",
        ref_key: p.sap_item_code,
        url: canonical,
        period_start: periodStart,
        period_end: periodEnd,
        position: agg.position,
        clicks: agg.clicks,
        impressions: agg.impressions,
        ctr: agg.ctr,
      });
      if (p.category_name && matched.length > 0) {
        const arr = byCategory.get(p.category_name) ?? [];
        arr.push(...matched);
        byCategory.set(p.category_name, arr);
      }
    }

    // Métricas agregadas por categoria (dedup de páginas).
    for (const [category, rows] of byCategory) {
      const uniq = Array.from(new Map(rows.map((r) => [r.page, r])).values());
      const agg = aggregatePages(uniq);
      await searchConsoleService.saveMetric({
        scope: "category",
        ref_key: category,
        url: null,
        period_start: periodStart,
        period_end: periodEnd,
        position: agg.position,
        clicks: agg.clicks,
        impressions: agg.impressions,
        ctr: agg.ctr,
      });
    }

    return { periodStart, periodEnd };
  }

  // Status de configuração (para a UI mostrar estados "não configurado").
  app.get(
    "/b2b/admin/catalog/seo/config",
    { preHandler: b2bAdminAuth },
    async (_req, reply) => {
      reply.send({
        ok: true,
        data: {
          openaiConfigured: seoAiService.isConfigured(),
          openaiModel: seoAiService.getModel(),
          gscConfigured: searchConsoleService.isConfigured(),
          gscSiteUrl: searchConsoleService.getSiteUrl(),
          windowDays: SEO_METRICS_WINDOW_DAYS,
        },
      });
    },
  );

  // Gerador de SEO em massa (job em memória, singleton por processo).
  const seoBulkGenerator = new SeoBulkGenerator(
    catalogService,
    seoAiService,
    buildProductSeoInput,
    "ia-bulk",
    app.log,
  );

  const bulkGenerateSchema = z.object({
    scope: z.enum(["visible", "all"]).optional(),
    onlyMissing: z.boolean().optional(),
    force: z.boolean().optional(),
  });

  // Dispara a geração de SEO em massa. Retorna imediatamente com o snapshot.
  app.post(
    "/b2b/admin/catalog/seo/bulk-generate",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const parsed = bulkGenerateSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        reply.code(400).send({ ok: false, error: "Parâmetros inválidos", issues: parsed.error.issues });
        return;
      }
      if (seoBulkGenerator.isRunning()) {
        reply.code(409).send({
          ok: false,
          error: "Já existe uma geração de SEO em andamento.",
          code: "JOB_RUNNING",
          data: seoBulkGenerator.getStatus(),
        });
        return;
      }
      try {
        const snapshot = await seoBulkGenerator.start(parsed.data);
        reply.send({ ok: true, data: snapshot });
      } catch (err: any) {
        if (err instanceof SeoAiNotConfiguredError) {
          reply.code(503).send({ ok: false, error: err.message, code: "AI_NOT_CONFIGURED" });
          return;
        }
        reply.code(500).send({ ok: false, error: err?.message ?? "Erro ao iniciar a geração em massa" });
      }
    },
  );

  // Status/progresso do job de geração em massa.
  app.get(
    "/b2b/admin/catalog/seo/bulk-generate/status",
    { preHandler: b2bAdminAuth },
    async (_req, reply) => {
      reply.send({ ok: true, data: seoBulkGenerator.getStatus() });
    },
  );

  // Cancelamento cooperativo do job em andamento.
  app.post(
    "/b2b/admin/catalog/seo/bulk-generate/cancel",
    { preHandler: b2bAdminAuth },
    async (_req, reply) => {
      const cancelled = seoBulkGenerator.requestCancel();
      if (!cancelled) {
        reply.code(409).send({ ok: false, error: "Nenhuma geração em andamento para cancelar." });
        return;
      }
      reply.send({ ok: true, data: seoBulkGenerator.getStatus() });
    },
  );

  // Sugestão de SEO por IA — PRODUTO (não salva; a UI revisa e aplica).
  app.post(
    "/b2b/admin/catalog/products/:sku/seo/suggest",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const { sku } = req.params as { sku: string };
      const product = await catalogService.getProduct(sku);
      if (!product) {
        reply.code(404).send({ ok: false, error: "Produto não encontrado" });
        return;
      }
      try {
        const suggestion = await seoAiService.suggestProductSeo(buildProductSeoInput(product));
        reply.send({ ok: true, data: suggestion });
      } catch (err: any) {
        if (err instanceof SeoAiNotConfiguredError) {
          reply.code(503).send({ ok: false, error: err.message, code: "AI_NOT_CONFIGURED" });
          return;
        }
        if (err instanceof SeoAiGenerationError) {
          reply.code(502).send({ ok: false, error: err.message });
          return;
        }
        reply.code(500).send({ ok: false, error: err?.message ?? "Erro ao gerar sugestão" });
      }
    },
  );

  // Sugestão de SEO por IA — CATEGORIA.
  app.post(
    "/b2b/admin/catalog/categories/:name/seo/suggest",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const { name } = req.params as { name: string };
      const categoryName = decodeURIComponent(name);
      try {
        const [samples, categories] = await Promise.all([
          catalogService.getCategorySampleProducts(categoryName),
          catalogService.listCategorySettings(),
        ]);
        const cat = categories.find((c) => c.category_name === categoryName);
        const suggestion = await seoAiService.suggestCategorySeo({
          name: categoryName,
          sampleProducts: samples,
          productCount: cat?.product_count ?? samples.length,
        });
        reply.send({ ok: true, data: suggestion });
      } catch (err: any) {
        if (err instanceof SeoAiNotConfiguredError) {
          reply.code(503).send({ ok: false, error: err.message, code: "AI_NOT_CONFIGURED" });
          return;
        }
        if (err instanceof SeoAiGenerationError) {
          reply.code(502).send({ ok: false, error: err.message });
          return;
        }
        reply.code(500).send({ ok: false, error: err?.message ?? "Erro ao gerar sugestão" });
      }
    },
  );

  // Score de qualidade de SEO de um produto (determinístico).
  app.get(
    "/b2b/admin/catalog/products/:sku/seo/score",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const { sku } = req.params as { sku: string };
      const product = await catalogService.getProduct(sku);
      if (!product) {
        reply.code(404).send({ ok: false, error: "Produto não encontrado" });
        return;
      }
      reply.send({ ok: true, data: computeSeoScore(buildScoreInput(product)) });
    },
  );

  // Métricas GSC de um produto (do cache; ?refresh=1 força fetch).
  app.get(
    "/b2b/admin/catalog/products/:sku/seo/metrics",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const { sku } = req.params as { sku: string };
      const q = req.query as Record<string, string>;
      const product = await catalogService.getProduct(sku);
      if (!product) {
        reply.code(404).send({ ok: false, error: "Produto não encontrado" });
        return;
      }
      const canonical = deriveCanonicalUrl(product.gsn_product_id, product.gsn_slug);
      if (!searchConsoleService.isConfigured()) {
        reply.code(503).send({
          ok: false,
          error: "Google Search Console não configurado.",
          code: "GSC_NOT_CONFIGURED",
          data: { canonicalUrl: canonical, hasPublicUrl: !!canonical },
        });
        return;
      }
      try {
        if (q.refresh === "1") await refreshSeoMetrics();
        const metric = await searchConsoleService.getLatestMetric("product", sku);
        const history = await searchConsoleService.getMetricHistory("product", sku);
        let queries: Awaited<ReturnType<typeof searchConsoleService.queryQueriesForPage>> = [];
        if (canonical) {
          try {
            queries = await searchConsoleService.queryQueriesForPage(
              canonical,
              isoDaysAgo(SEO_METRICS_WINDOW_DAYS),
              isoDaysAgo(1),
            );
          } catch {
            /* queries são opcionais */
          }
        }
        reply.send({
          ok: true,
          data: { canonicalUrl: canonical, hasPublicUrl: !!canonical, metric, history, queries },
        });
      } catch (err: any) {
        if (err instanceof GscNotConfiguredError) {
          reply.code(503).send({ ok: false, error: err.message, code: "GSC_NOT_CONFIGURED" });
          return;
        }
        reply.code(502).send({ ok: false, error: err?.message ?? "Erro ao consultar o GSC" });
      }
    },
  );

  // Métricas GSC de uma categoria (do cache; ?refresh=1 força fetch).
  app.get(
    "/b2b/admin/catalog/categories/:name/seo/metrics",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const { name } = req.params as { name: string };
      const categoryName = decodeURIComponent(name);
      const q = req.query as Record<string, string>;
      if (!searchConsoleService.isConfigured()) {
        reply.code(503).send({
          ok: false,
          error: "Google Search Console não configurado.",
          code: "GSC_NOT_CONFIGURED",
        });
        return;
      }
      try {
        if (q.refresh === "1") await refreshSeoMetrics();
        const metric = await searchConsoleService.getLatestMetric("category", categoryName);
        const history = await searchConsoleService.getMetricHistory("category", categoryName);
        reply.send({ ok: true, data: { metric, history } });
      } catch (err: any) {
        if (err instanceof GscNotConfiguredError) {
          reply.code(503).send({ ok: false, error: err.message, code: "GSC_NOT_CONFIGURED" });
          return;
        }
        reply.code(502).send({ ok: false, error: err?.message ?? "Erro ao consultar o GSC" });
      }
    },
  );

  // Refresh manual das métricas GSC (persiste snapshot).
  app.post(
    "/b2b/admin/catalog/seo/metrics/refresh",
    { preHandler: b2bAdminAuth },
    async (_req, reply) => {
      if (!searchConsoleService.isConfigured()) {
        reply.code(503).send({
          ok: false,
          error: "Google Search Console não configurado.",
          code: "GSC_NOT_CONFIGURED",
        });
        return;
      }
      try {
        const period = await refreshSeoMetrics();
        reply.send({ ok: true, data: period });
      } catch (err: any) {
        if (err instanceof GscNotConfiguredError) {
          reply.code(503).send({ ok: false, error: err.message, code: "GSC_NOT_CONFIGURED" });
          return;
        }
        reply.code(502).send({ ok: false, error: err?.message ?? "Erro ao atualizar métricas" });
      }
    },
  );

  // Dashboard agregado de SEO: produtos com score + métricas resumidas.
  app.get(
    "/b2b/admin/catalog/seo/dashboard",
    { preHandler: b2bAdminAuth },
    async (req, reply) => {
      const q = req.query as Record<string, string>;
      try {
        const products = await catalogService.listAllActiveProducts();
        const gscConfigured = searchConsoleService.isConfigured();
        const metricsMap = gscConfigured
          ? await searchConsoleService.getLatestMetrics("product")
          : new Map();

        const gradeDist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
        let scoreSum = 0;
        let withPublicUrl = 0;
        let posSum = 0;
        let posCount = 0;
        let clicksSum = 0;
        let impressionsSum = 0;
        let fetchedAt: string | null = null;

        const rows = products.map((p) => {
          const score: SeoScoreResult = computeSeoScore(buildScoreInput(p));
          scoreSum += score.score;
          gradeDist[score.grade] = (gradeDist[score.grade] ?? 0) + 1;
          const canonical = deriveCanonicalUrl(p.gsn_product_id, p.gsn_slug);
          if (canonical) withPublicUrl++;
          const metric = metricsMap.get(p.sap_item_code) ?? null;
          if (metric) {
            if (metric.position != null && metric.impressions > 0) {
              posSum += metric.position;
              posCount++;
            }
            clicksSum += metric.clicks;
            impressionsSum += metric.impressions;
            if (metric.fetched_at && (!fetchedAt || metric.fetched_at > fetchedAt)) {
              fetchedAt = metric.fetched_at;
            }
          }
          return {
            sku: p.sap_item_code,
            name: p.sap_item_name,
            category: p.category_name,
            imageUrl: p.image_url,
            canonicalUrl: canonical,
            hasPublicUrl: !!canonical,
            score: score.score,
            grade: score.grade,
            position: metric?.position ?? null,
            clicks: metric?.clicks ?? 0,
            impressions: metric?.impressions ?? 0,
            ctr: metric?.ctr ?? 0,
          };
        });

        // Filtro opcional por categoria (para a tabela).
        const filtered = q.category ? rows.filter((r) => r.category === q.category) : rows;

        reply.send({
          ok: true,
          data: {
            config: {
              openaiConfigured: seoAiService.isConfigured(),
              gscConfigured,
              gscSiteUrl: searchConsoleService.getSiteUrl(),
            },
            summary: {
              totalProducts: products.length,
              withPublicUrl,
              withoutPublicUrl: products.length - withPublicUrl,
              avgScore: products.length ? Math.round(scoreSum / products.length) : 0,
              gradeDistribution: gradeDist,
              avgPosition: posCount ? Number((posSum / posCount).toFixed(1)) : null,
              totalClicks: clicksSum,
              totalImpressions: impressionsSum,
              avgCtr: impressionsSum > 0 ? clicksSum / impressionsSum : null,
              metricsFetchedAt: fetchedAt,
            },
            products: filtered,
          },
        });
      } catch (err: any) {
        reply.code(500).send({ ok: false, error: err?.message ?? "Erro ao montar o dashboard de SEO" });
      }
    },
  );

  app.log.info("Rotas B2B registradas");
}
