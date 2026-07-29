import pg from "pg";

const { Pool } = pg;

export interface PendingRegistration {
  id: number;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  email: string;
  phone: string | null;
  contact_name: string | null;
  address: string | null;
  street_number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  inscricao_estadual: string | null;
  udf_bp: Record<string, unknown>;
  udf_addr: Record<string, unknown>;
  sap_config: Record<string, unknown>;
  status: "pending" | "in_review" | "approved" | "rejected" | "published";
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  published_at: string | null;
  sap_card_code: string | null;
  sap_error: string | null;
  created_at: string;
  updated_at: string;
}

const UDF_BP_DEFAULTS: Record<string, unknown> = {
  U_TX_IndFinal: "1",
  U_TX_IndIEDest: "9",
  U_TX_SN: null,
  U_TX_ProdRural: null,
  U_TX_PrestServ: null,
  U_TX_ExImp: null,
  U_TX_SitResp: null,
  U_TX_IndNat: null,
  U_TX_Pagador: null,
  U_TX_Rendimento: null,
  U_TX_DCReEmpColigada: null,
  U_TX_TpEnteGov: "-1",
  U_TX_RegraImTomRibPreto: "0",
  U_AGL_ECF_ComExp: "N",
  U_AGL_NAT_FRT: 9,
  U_AGL_CONTR_IPI: "0",
  U_AGL_TP_PN: null,
  U_AGL_LPRECO_PMC: null,
  U_AGL_IND_NAT_RET: null,
  U_nfe_RNTC: null,
  U_nfe_CPRB: "N",
  U_SX_MercadosAlcoolicos: null,
  U_SX_MercadosNaoAlcoolicos: null,
  U_SX_MercadoAlimenticio: null,
  U_SX_SuspensaoIPI: "N",
  U_HCO_GrupoEconomico: null,
  U_IV_BP_PayerID: null,
  U_IB_BoletoGeradoPor: "0",
  U_ImprimirBoleto: 1,
};

const UDF_ADDR_DEFAULTS: Record<string, unknown> = {
  U_TX_IE: "ISENTO",
  U_TX_CNPJ: null,
  U_TX_IndFinal: null,
  U_TX_IndIEDest: null,
};

const SAP_CONFIG_DEFAULTS: Record<string, unknown> = {
  GroupCode: 100,
  SalesPersonCode: 9,
  PriceListNum: 1,
  Currency: "R$",
  LanguageCode: 29,
};

export class B2BRegistrationService {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS b2b_pending_registrations (
        id SERIAL PRIMARY KEY,
        cnpj VARCHAR(20) UNIQUE NOT NULL,
        razao_social VARCHAR(255) NOT NULL,
        nome_fantasia VARCHAR(255),
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        contact_name VARCHAR(255),
        address VARCHAR(255),
        street_number VARCHAR(20),
        neighborhood VARCHAR(100),
        city VARCHAR(100),
        state VARCHAR(2),
        zip_code VARCHAR(10),
        inscricao_estadual VARCHAR(50),
        udf_bp JSONB DEFAULT '{}',
        udf_addr JSONB DEFAULT '{}',
        sap_config JSONB DEFAULT '{}',
        status VARCHAR(20) DEFAULT 'pending',
        admin_notes TEXT,
        reviewed_by VARCHAR(100),
        reviewed_at TIMESTAMPTZ,
        published_at TIMESTAMPTZ,
        sap_card_code VARCHAR(50),
        sap_error TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  }

  async create(data: {
    cnpj: string;
    razaoSocial: string;
    nomeFantasia?: string;
    email: string;
    phone?: string;
    contactName?: string;
    address?: string;
    streetNumber?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    inscricaoEstadual?: string;
  }): Promise<PendingRegistration> {
    const udfBp = { ...UDF_BP_DEFAULTS };
    const udfAddr = { ...UDF_ADDR_DEFAULTS };
    const sapConfig = { ...SAP_CONFIG_DEFAULTS };

    const formatted = data.cnpj.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      "$1.$2.$3/$4-$5",
    );
    udfAddr.U_TX_CNPJ = formatted;

    const { rows } = await this.pool.query(
      `INSERT INTO b2b_pending_registrations
         (cnpj, razao_social, nome_fantasia, email, phone, contact_name,
          address, street_number, neighborhood, city, state, zip_code,
          inscricao_estadual, udf_bp, udf_addr, sap_config)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        data.cnpj,
        data.razaoSocial,
        data.nomeFantasia || null,
        data.email,
        data.phone || null,
        data.contactName || null,
        data.address || null,
        data.streetNumber || null,
        data.neighborhood || null,
        data.city || null,
        data.state || null,
        data.zipCode || null,
        data.inscricaoEstadual || null,
        JSON.stringify(udfBp),
        JSON.stringify(udfAddr),
        JSON.stringify(sapConfig),
      ],
    );
    return rows[0];
  }

  async findById(id: number): Promise<PendingRegistration | null> {
    const { rows } = await this.pool.query(
      "SELECT * FROM b2b_pending_registrations WHERE id = $1",
      [id],
    );
    return rows[0] ?? null;
  }

  async findByCnpj(cnpj: string): Promise<PendingRegistration | null> {
    const { rows } = await this.pool.query(
      "SELECT * FROM b2b_pending_registrations WHERE cnpj = $1",
      [cnpj],
    );
    return rows[0] ?? null;
  }

  async list(
    status?: string,
  ): Promise<PendingRegistration[]> {
    const where = status ? "WHERE status = $1" : "";
    const params = status ? [status] : [];
    const { rows } = await this.pool.query(
      `SELECT * FROM b2b_pending_registrations ${where} ORDER BY created_at DESC`,
      params,
    );
    return rows;
  }

  async updateFields(
    id: number,
    data: {
      udfBp?: Record<string, unknown>;
      udfAddr?: Record<string, unknown>;
      sapConfig?: Record<string, unknown>;
      adminNotes?: string;
      reviewedBy?: string;
      address?: string;
      streetNumber?: string;
      neighborhood?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      inscricaoEstadual?: string;
      phone?: string;
      contactName?: string;
    },
  ): Promise<PendingRegistration | null> {
    const reg = await this.findById(id);
    if (!reg) return null;

    const mergedUdfBp = data.udfBp
      ? { ...reg.udf_bp, ...data.udfBp }
      : reg.udf_bp;
    const mergedUdfAddr = data.udfAddr
      ? { ...reg.udf_addr, ...data.udfAddr }
      : reg.udf_addr;
    const mergedSapConfig = data.sapConfig
      ? { ...reg.sap_config, ...data.sapConfig }
      : reg.sap_config;

    const { rows } = await this.pool.query(
      `UPDATE b2b_pending_registrations SET
         udf_bp = $1, udf_addr = $2, sap_config = $3,
         admin_notes = COALESCE($4, admin_notes),
         reviewed_by = COALESCE($5, reviewed_by),
         address = COALESCE($6, address),
         street_number = COALESCE($7, street_number),
         neighborhood = COALESCE($8, neighborhood),
         city = COALESCE($9, city),
         state = COALESCE($10, state),
         zip_code = COALESCE($11, zip_code),
         inscricao_estadual = COALESCE($12, inscricao_estadual),
         phone = COALESCE($13, phone),
         contact_name = COALESCE($14, contact_name),
         updated_at = NOW()
       WHERE id = $15 RETURNING *`,
      [
        JSON.stringify(mergedUdfBp),
        JSON.stringify(mergedUdfAddr),
        JSON.stringify(mergedSapConfig),
        data.adminNotes ?? null,
        data.reviewedBy ?? null,
        data.address ?? null,
        data.streetNumber ?? null,
        data.neighborhood ?? null,
        data.city ?? null,
        data.state ?? null,
        data.zipCode ?? null,
        data.inscricaoEstadual ?? null,
        data.phone ?? null,
        data.contactName ?? null,
        id,
      ],
    );
    return rows[0] ?? null;
  }

  async setStatus(
    id: number,
    status: "in_review" | "approved" | "rejected",
    reviewedBy: string,
    notes?: string,
  ): Promise<PendingRegistration | null> {
    // in_review ← pending
    // approved / rejected ← pending | in_review | approved (re-aprovação antes do publish)
    const fromClause =
      status === "in_review"
        ? "status = 'pending'"
        : "status IN ('pending', 'in_review', 'approved')";
    const { rows } = await this.pool.query(
      `UPDATE b2b_pending_registrations SET
         status = $1, reviewed_by = $2, reviewed_at = NOW(),
         admin_notes = COALESCE($3, admin_notes), updated_at = NOW()
       WHERE id = $4 AND ${fromClause} AND status <> 'published'
       RETURNING *`,
      [status, reviewedBy, notes ?? null, id],
    );
    return rows[0] ?? null;
  }

  async markPublished(
    id: number,
    sapCardCode: string,
  ): Promise<PendingRegistration | null> {
    const { rows } = await this.pool.query(
      `UPDATE b2b_pending_registrations SET
         status = 'published', sap_card_code = $1,
         published_at = NOW(), sap_error = NULL, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [sapCardCode, id],
    );
    return rows[0] ?? null;
  }

  async markPublishError(
    id: number,
    error: string,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE b2b_pending_registrations SET
         sap_error = $1, status = 'approved', updated_at = NOW()
       WHERE id = $2`,
      [error, id],
    );
  }

  getUdfBpDefaults() {
    return { ...UDF_BP_DEFAULTS };
  }

  getUdfAddrDefaults() {
    return { ...UDF_ADDR_DEFAULTS };
  }

  getSapConfigDefaults() {
    return { ...SAP_CONFIG_DEFAULTS };
  }
}
