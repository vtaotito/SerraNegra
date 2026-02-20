import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createSapClient } from "../config/sap.js";
import { SapOrdersService } from "../services/sapOrdersService.js";
import { SapEntitiesService } from "../services/sapEntitiesService.js";
import { SapHttpError } from "../../../sap-connector/src/errors.js";
import { sapConfigStore } from "../config/sapConfigStore.js";
import { B2BAuthService } from "../services/b2bAuthService.js";
import { sendOtpEmail, isEmailConfigured } from "../services/emailService.js";
import jwt from "jsonwebtoken";

const B2B_JWT_SECRET =
  process.env.B2B_JWT_SECRET ??
  process.env.INTERNAL_SHARED_SECRET ??
  "b2b-secret-change-me";
const B2B_JWT_EXPIRES = "24h";
const B2B_DB_URL =
  process.env.B2B_DATABASE_URL ??
  "postgresql://wms:wms@postgres:5432/wms";

interface B2BTokenPayload {
  cardCode: string;
  cardName: string;
  cnpj: string;
  email?: string;
  type: "b2b_customer";
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

export async function registerB2BRoutes(app: FastifyInstance) {
  const authService = new B2BAuthService(B2B_DB_URL);
  await authService.init();

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
    const entSvc = getEntitiesService();
    const partners = await entSvc.listBusinessPartners(
      { limit: 1000 },
      correlationId
    );
    return partners.find((bp) => {
      const bpCnpj = normalizeCnpj(bp.FederalTaxID ?? "");
      return bpCnpj === digits && bp.CardType === "cCustomer";
    });
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

      if (!partner) {
        reply.code(200).send({ status: "not_found" });
        return;
      }

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

      reply.code(200).send({
        status: hasPass ? "has_password" : "needs_verification",
        cardCode: partner.CardCode,
        cardName: partner.CardName ?? partner.CardCode,
        maskedEmail: email ? maskEmail(email) : null,
        hasEmail: !!email,
      });
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

    if (!cnpj || !email) {
      reply.code(400).send({ error: "CNPJ e email sao obrigatorios" });
      return;
    }

    const digits = normalizeCnpj(cnpj);

    try {
      const cred = await authService.findByCnpj(digits);
      if (!cred) {
        reply.code(404).send({ error: "Cliente nao encontrado" });
        return;
      }

      const storedEmail = (cred.email ?? "").trim().toLowerCase();
      const inputEmail = email.trim().toLowerCase();

      if (storedEmail !== inputEmail) {
        reply
          .code(400)
          .send({ error: "Email nao corresponde ao cadastro" });
        return;
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

    if (password.length < 8) {
      reply
        .code(400)
        .send({ error: "Senha deve ter no minimo 8 caracteres" });
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
  // AUTH - FORGOT PASSWORD (reenvia verificacao)
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
        reply.code(404).send({ error: "Cliente nao encontrado" });
        return;
      }

      await authService.resetPassword(digits);
      reply.code(200).send({
        ok: true,
        maskedEmail: cred.email ? maskEmail(cred.email) : null,
        hasEmail: !!cred.email,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro";
      reply.code(500).send({ error: message });
    }
  });

  // DIAGNOSTICO TEMPORARIO - remover apos debug
  app.get("/b2b/debug/bp-sample", async (req, reply) => {
    const correlationId = (req as any).correlationId as string;
    try {
      const client = getSapClient();
      const q = (req.query as any).q as string | undefined;
      const path = q
        ? `/BusinessPartners('${q}')`
        : "/BusinessPartners?$top=1&$filter=CardType eq 'cCustomer'";
      const res = await client.get<any>(path, { correlationId });
      reply.code(200).send(res.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro";
      let sapDetails: string | undefined;
      if (error instanceof SapHttpError) {
        sapDetails = error.responseBodyText;
      }
      reply.code(500).send({ error: message, sapDetails });
    }
  });

  // =============================================
  // AUTH - REGISTER (novo cliente no SAP B1)
  // =============================================
  app.post("/b2b/auth/register", async (req, reply) => {
    const body = req.body as any;
    const correlationId = (req as any).correlationId as string;

    const {
      cnpj,
      razaoSocial,
      nomeFantasia,
      email,
      phone,
      address,
      city,
      state,
      zipCode,
      contactName,
    } = body;

    if (!cnpj || !razaoSocial || !email) {
      reply
        .code(400)
        .send({
          error: "CNPJ, razao social e email sao obrigatorios",
        });
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
        reply
          .code(409)
          .send({ error: "CNPJ ja cadastrado no sistema" });
        return;
      }

      const client = getSapClient();
      const cardCode = `B${digits.slice(-14)}`.slice(0, 15);

      const cnpjFormatted = digits.replace(
        /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
        "$1.$2.$3/$4-$5"
      );

      const sapBody: Record<string, unknown> = {
        CardCode: cardCode,
        CardName: razaoSocial,
        CardForeignName: nomeFantasia || undefined,
        CardType: "cCustomer",
        GroupCode: 100,
        FederalTaxID: cnpjFormatted,
        UnifiedFederalTaxID: cnpjFormatted,
        EmailAddress: email,
        Phone1: phone || undefined,
        Notes: `Cadastro via Portal B2B em ${new Date().toISOString().split("T")[0]}`,
        Valid: "tYES",
        Frozen: "tNO",
        SinglePayment: "tYES",
        CompanyPrivate: "cCompany",
        PayTermsGrpCode: -1,
        PriceListNum: 1,
        Currency: "R$",
        SalesPersonCode: 9,
        DebitorAccount: "1.1.2.01.001",
        DownPaymentClearAct: "2.1.6.02.001",
        LanguageCode: 29,
        BilltoDefault: "COB",
        ShipToDefault: "ENT",
      };

      const streetNum = address?.match(/\d+/)?.[0] || "S/N";
      const streetPrefixMatch = address?.match(/^(Rua|Av\.?|Avenida|Trav\.?|Travessa|Al\.?|Alameda|Rod\.?|Rodovia|Estr\.?|Estrada|Pra[cç]a)/i);
      const streetPrefix = body.streetType || streetPrefixMatch?.[1] || "Rua";

      const addrFields = {
        Street: address || "A definir",
        StreetNo: body.streetNumber || streetNum,
        Block: body.neighborhood || "Centro",
        City: city || "A definir",
        County: city || "A definir",
        State: state || "SP",
        ZipCode: zipCode ? zipCode.replace(/\D/g, "") : "00000000",
        Country: "BR",
        TypeOfAddress: streetPrefix,
        FederalTaxID: cnpjFormatted,
      };

      sapBody.BPAddresses = [
        { AddressType: "bo_BillTo", AddressName: "COB", ...addrFields },
        { AddressType: "bo_ShipTo", AddressName: "ENT", ...addrFields },
      ];

      sapBody.BPFiscalTaxIDCollection = [
        { Address: "COB", AddrType: "bo_BillTo", TaxId0: cnpjFormatted, TaxId1: "Isento", CNAECode: -1 },
        { Address: "ENT", AddrType: "bo_ShipTo", TaxId0: cnpjFormatted, TaxId1: "Isento", CNAECode: -1 },
      ];

      sapBody.BPBranchAssignment = [
        { BPLID: 1, DisabledForBP: "tNO" },
      ];

      sapBody.BPPaymentMethods = [
        { PaymentMethodCode: "Dinheiro", RowNumber: 0 },
      ];

      const response = await client.post<any>(
        "/BusinessPartners",
        sapBody,
        { correlationId }
      );
      const created = response.data;

      await authService.upsertCredential({
        cardCode: created.CardCode ?? cardCode,
        cnpj: digits,
        cardName: razaoSocial,
        email,
      });

      const otp = await authService.generateOtp(digits);
      const emailSent = await sendOtpEmail(email, otp, razaoSocial);

      reply.code(201).send({
        ok: true,
        cardCode: created.CardCode ?? cardCode,
        message: "Cliente cadastrado com sucesso",
        emailSent,
        maskedEmail: maskEmail(email),
        ...(!emailSent ? { devOtp: otp } : {}),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro ao cadastrar";

      let sapDetails: string | undefined;
      let sapStatus: number | undefined;
      if (error instanceof SapHttpError) {
        sapStatus = error.status;
        sapDetails = error.responseBodyText;
        req.log.error(
          { correlationId, sapStatus, sapDetails, errorMessage: message },
          "Erro SAP ao registrar B2B"
        );
      } else {
        req.log.error(
          { correlationId, errorMessage: message, errorName: error instanceof Error ? error.name : typeof error },
          "Erro register B2B"
        );
      }

      reply.code(500).send({
        error: "Erro ao cadastrar cliente",
        message,
        sapStatus,
        sapDetails,
      });
    }
  });

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
  // PEDIDOS DO CLIENTE
  // =============================================
  app.get(
    "/b2b/orders",
    { preHandler: b2bAuth },
    async (req, reply) => {
      const customer = (req as any).b2bCustomer as B2BTokenPayload;
      const correlationId = (req as any).correlationId as string;
      const query = req.query as any;
      const status = query.status as string | undefined;

      try {
        const service = getOrdersService();
        const allOrders = await service.listOrders(
          { docStatus: query.docStatus ?? "O", limit: 200 },
          correlationId
        );

        let customerOrders = allOrders.filter(
          (o) =>
            o.customerId?.toLowerCase() ===
            customer.cardCode.toLowerCase()
        );

        if (status) {
          customerOrders = customerOrders.filter(
            (o) => o.status === status
          );
        }

        reply
          .code(200)
          .send({ items: customerOrders, total: customerOrders.length });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        req.log.error(
          { error, correlationId },
          "Erro ao listar pedidos B2B"
        );
        reply
          .code(500)
          .send({ error: "Erro ao buscar pedidos", message });
      }
    }
  );

  app.get(
    "/b2b/orders/:docEntry",
    { preHandler: b2bAuth },
    async (req, reply) => {
      const customer = (req as any).b2bCustomer as B2BTokenPayload;
      const correlationId = (req as any).correlationId as string;
      const { docEntry } = req.params as any;

      try {
        const service = getOrdersService();
        const order = await service.getOrder(
          Number(docEntry),
          correlationId
        );

        if (
          order.customerId?.toLowerCase() !==
          customer.cardCode.toLowerCase()
        ) {
          reply.code(403).send({ error: "Acesso negado a este pedido" });
          return;
        }

        reply.code(200).send(order);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        reply
          .code(500)
          .send({ error: "Erro ao buscar pedido", message });
      }
    }
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
        const client = getSapClient();

        const documentLines = body.items.map(
          (item: any, idx: number) => ({
            LineNum: idx,
            ItemCode: item.sku,
            Quantity: item.quantity,
            WarehouseCode: item.warehouse ?? undefined,
          })
        );

        const sapOrder = {
          CardCode: customer.cardCode,
          DocDueDate:
            body.dueDate ??
            new Date(Date.now() + 7 * 86400000)
              .toISOString()
              .split("T")[0],
          Comments:
            body.notes ??
            `Pedido via Portal B2B - ${customer.cardName}`,
          DocumentLines: documentLines,
        };

        const response = await client.post<any>("/Orders", sapOrder, {
          correlationId,
        });
        const created = response.data;

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
          { error, correlationId },
          "Erro ao criar pedido B2B"
        );
        reply
          .code(500)
          .send({ error: "Erro ao criar pedido", message });
      }
    }
  );

  // =============================================
  // DASHBOARD RAPIDO
  // =============================================
  app.get(
    "/b2b/dashboard",
    { preHandler: b2bAuth },
    async (req, reply) => {
      const customer = (req as any).b2bCustomer as B2BTokenPayload;
      const correlationId = (req as any).correlationId as string;

      try {
        const service = getOrdersService();
        const openOrders = await service.listOrders(
          { docStatus: "O", limit: 200 },
          correlationId
        );
        const myOrders = openOrders.filter(
          (o) =>
            o.customerId?.toLowerCase() ===
            customer.cardCode.toLowerCase()
        );

        const byStatus: Record<string, number> = {};
        for (const o of myOrders) {
          byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
        }

        reply.code(200).send({
          totalOrders: myOrders.length,
          ordersByStatus: byStatus,
          recentOrders: myOrders.slice(0, 5),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro";
        reply.code(500).send({ error: message });
      }
    }
  );

  app.log.info("Rotas B2B registradas");
}
