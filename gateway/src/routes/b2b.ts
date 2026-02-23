import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createSapClient } from "../config/sap.js";
import { SapOrdersService } from "../services/sapOrdersService.js";
import { SapEntitiesService } from "../services/sapEntitiesService.js";
import { SapHttpError } from "../../../sap-connector/src/errors.js";
import { sapConfigStore } from "../config/sapConfigStore.js";
import { B2BAuthService } from "../services/b2bAuthService.js";
import { B2BRegistrationService } from "../services/b2bRegistrationService.js";
import {
  B2BCatalogService,
  fetchAllGsnProducts,
  matchSapToGsn,
  EXCLUDED_SAP_GROUPS,
  setSapGroupNames,
  getGroupDisplayName,
  normalizeCategoryName,
  resolvePackaging,
} from "../services/b2bCatalogService.js";
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

const B2B_ADMIN_USER = process.env.B2B_ADMIN_USER ?? "admin";
const B2B_ADMIN_PASS = process.env.B2B_ADMIN_PASSWORD ?? "gsn@comercial2026";

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

  const catalogService = new B2BCatalogService(B2B_DB_URL);
  await catalogService.init();

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
        reply.code(200).send(reg);
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

        reply.code(200).send(updated);
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

        sapBody.BPAddresses = [
          { AddressType: "bo_BillTo", AddressName: "COB", ...addrFields },
          { AddressType: "bo_ShipTo", AddressName: "ENT", ...addrFields },
        ];

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

    const [sapItems, gsnProducts] = await Promise.all([
      entSvc.listItems({ limit: 5000, onlyActive: false }, correlationId),
      fetchAllGsnProducts(),
    ]);

    app.log.info(
      { correlationId, sapCount: sapItems.length, gsnCount: gsnProducts.length },
      "Catalog sync: dados carregados",
    );

    const deactivated = await catalogService.deactivateByGroupCodes(EXCLUDED_SAP_GROUPS);
    if (deactivated > 0) {
      app.log.info({ correlationId, deactivated, groups: EXCLUDED_SAP_GROUPS }, "Catalog sync: categorias excluidas desativadas no DB");
    }

    const matches = matchSapToGsn(sapItems, gsnProducts);

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

      const isSalesItem = item.SalesItem === "tYES" || !item.SalesItem;
      const match = matches.get(item.ItemCode);
      const firstImage = match?.gsn.images[0];

      const rawCategory = match?.gsn.category_name || getGroupDisplayName(groupCode);
      const categoryName = normalizeCategoryName(rawCategory);

      const productName = match?.gsn.name || item.ItemName || item.ItemCode;
      const packaging = resolvePackaging(
        item.InventoryUOM,
        item.SalesUnit,
        item.SalesPackagingUnit,
        item.SalesQtyPerPackUnit,
        item.SalesItemsPerUnit,
        productName,
      );

      const stock = item.QuantityOnStock ?? 0;
      if (stock > 0) {
        stockBySku.set(item.ItemCode, stock);
        withStock++;
      }

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

    const matchedGsnIds = new Set<string>();
    for (const [, m] of matches) matchedGsnIds.add(m.gsn.id);

    let gsnOnly = 0;
    for (const gsn of gsnProducts) {
      if (matchedGsnIds.has(gsn.id)) continue;

      const firstImage = gsn.images[0];
      const syntheticCode = `GSN-${gsn.id}`;

      const gsnCategory = normalizeCategoryName(gsn.category_name);
      const gsnPackaging = resolvePackaging(null, null, null, null, null, gsn.name);

      await catalogService.upsertProduct({
        sap_item_code: syntheticCode,
        sap_item_name: gsn.name,
        gsn_product_id: gsn.id,
        gsn_product_name: gsn.name,
        gsn_slug: gsn.slug,
        image_url: firstImage?.url ?? null,
        image_thumb_url: firstImage?.thumbUrl ?? null,
        category_name: gsnCategory,
        description_short: gsn.description_small || null,
        ean: gsn.ean || null,
        unit_of_measure: "UN",
        packaging_type: gsnPackaging.type,
        units_per_package: gsnPackaging.units,
        is_active: true,
        is_sales_item: true,
        match_score: 0,
      });
      gsnOnly++;
    }

    app.log.info(
      { correlationId, gsnOnly },
      "Catalog sync: produtos GSN sem match SAP adicionados",
    );

    if (stockBySku.size > 0) {
      await catalogService.updateStock(stockBySku);
    }

    let inventoryRows = stockBySku.size;
    if (inventoryRows === 0) {
      try {
        const sapInv = await entSvc.listInventory({ limit: 5000 }, correlationId);
        for (const row of sapInv) {
          const current = stockBySku.get(row.ItemCode) ?? 0;
          stockBySku.set(row.ItemCode, current + row.InStock);
        }
        if (stockBySku.size > 0) {
          await catalogService.updateStock(stockBySku);
          inventoryRows = stockBySku.size;
        }
      } catch (err: any) {
        app.log.warn(
          { correlationId, error: err?.message?.slice(0, 200) },
          "Catalog sync: fallback listInventory tambem falhou",
        );
      }
    }

    let notified = 0;
    try {
      const backInStock = await catalogService.listBackInStockSkus();
      for (const sku of backInStock) {
        const pending = await catalogService.getPendingNotifications(sku);
        if (pending.length === 0) continue;

        for (const n of pending) {
          try {
            const product = await catalogService.getProduct(sku);
            await sendOtpEmail(
              n.email,
              "Produto disponivel novamente - Garrafaria Serra Negra",
              `<p>Ola!</p><p>O produto <strong>${product?.sap_item_name ?? sku}</strong> esta novamente disponivel em nosso catalogo B2B.</p><p>Acesse o portal para efetuar seu pedido.</p>`,
            );
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
      const items = await catalogService.listProducts({
        search: query.search,
        category: query.category,
        inStock: query.inStock === "true" ? true : query.inStock === "false" ? false : undefined,
        page: Number(query.page) || 1,
        limit: Number(query.limit) || 24,
      });
      const pages = Math.ceil(items.total / (Number(query.limit) || 24));
      reply.send({ ...items, page: Number(query.page) || 1, pages });
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
      reply.send(product);
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

  app.log.info("Rotas B2B registradas");
}
