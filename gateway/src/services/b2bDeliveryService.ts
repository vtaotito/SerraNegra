import pg from "pg";

const { Pool } = pg;

export interface DeliveryDetails {
  id: number;
  cnpj: string;
  card_code: string | null;
  registration_id: number | null;
  same_as_billing: boolean;
  zip_code: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  reference: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  delivery_days: string | null;
  delivery_hours: string | null;
  vehicle_restriction: string | null;
  needs_scheduling: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Payload camelCase compartilhado com o frontend (Portal B2B / admin).
export interface DeliveryInput {
  sameAsBilling?: boolean;
  zipCode?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  reference?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  deliveryDays?: string;
  deliveryHours?: string;
  vehicleRestriction?: string;
  needsScheduling?: boolean;
  notes?: string;
}

// Serializa a linha do banco (snake_case) para o contrato camelCase da API.
export function toDeliveryDto(row: DeliveryDetails | null): Record<string, unknown> | null {
  if (!row) return null;
  return {
    sameAsBilling: row.same_as_billing,
    zipCode: row.zip_code ?? "",
    street: row.street ?? "",
    number: row.number ?? "",
    complement: row.complement ?? "",
    neighborhood: row.neighborhood ?? "",
    city: row.city ?? "",
    state: row.state ?? "",
    reference: row.reference ?? "",
    contactName: row.contact_name ?? "",
    contactPhone: row.contact_phone ?? "",
    contactEmail: row.contact_email ?? "",
    deliveryDays: row.delivery_days ?? "",
    deliveryHours: row.delivery_hours ?? "",
    vehicleRestriction: row.vehicle_restriction ?? "",
    needsScheduling: row.needs_scheduling,
    notes: row.notes ?? "",
  };
}

export class B2BDeliveryService {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS b2b_delivery_details (
        id SERIAL PRIMARY KEY,
        cnpj VARCHAR(20) UNIQUE NOT NULL,
        card_code VARCHAR(50),
        registration_id INTEGER,
        same_as_billing BOOLEAN DEFAULT FALSE,
        zip_code VARCHAR(10),
        street VARCHAR(255),
        number VARCHAR(20),
        complement VARCHAR(255),
        neighborhood VARCHAR(100),
        city VARCHAR(100),
        state VARCHAR(2),
        reference VARCHAR(255),
        contact_name VARCHAR(255),
        contact_phone VARCHAR(50),
        contact_email VARCHAR(255),
        delivery_days VARCHAR(255),
        delivery_hours VARCHAR(255),
        vehicle_restriction VARCHAR(255),
        needs_scheduling BOOLEAN DEFAULT FALSE,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  }

  async findByCnpj(cnpj: string): Promise<DeliveryDetails | null> {
    const { rows } = await this.pool.query(
      "SELECT * FROM b2b_delivery_details WHERE cnpj = $1",
      [cnpj],
    );
    return rows[0] ?? null;
  }

  async findByCardCode(cardCode: string): Promise<DeliveryDetails | null> {
    const { rows } = await this.pool.query(
      "SELECT * FROM b2b_delivery_details WHERE card_code = $1 ORDER BY updated_at DESC LIMIT 1",
      [cardCode],
    );
    return rows[0] ?? null;
  }

  // Insere ou atualiza os dados de entrega de um CNPJ (chave única).
  async upsertByCnpj(
    cnpj: string,
    data: DeliveryInput,
    opts: { cardCode?: string | null; registrationId?: number | null } = {},
  ): Promise<DeliveryDetails> {
    const { rows } = await this.pool.query(
      `INSERT INTO b2b_delivery_details
         (cnpj, card_code, registration_id, same_as_billing, zip_code, street,
          number, complement, neighborhood, city, state, reference,
          contact_name, contact_phone, contact_email, delivery_days,
          delivery_hours, vehicle_restriction, needs_scheduling, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       ON CONFLICT (cnpj) DO UPDATE SET
         card_code = COALESCE(EXCLUDED.card_code, b2b_delivery_details.card_code),
         registration_id = COALESCE(EXCLUDED.registration_id, b2b_delivery_details.registration_id),
         same_as_billing = EXCLUDED.same_as_billing,
         zip_code = EXCLUDED.zip_code,
         street = EXCLUDED.street,
         number = EXCLUDED.number,
         complement = EXCLUDED.complement,
         neighborhood = EXCLUDED.neighborhood,
         city = EXCLUDED.city,
         state = EXCLUDED.state,
         reference = EXCLUDED.reference,
         contact_name = EXCLUDED.contact_name,
         contact_phone = EXCLUDED.contact_phone,
         contact_email = EXCLUDED.contact_email,
         delivery_days = EXCLUDED.delivery_days,
         delivery_hours = EXCLUDED.delivery_hours,
         vehicle_restriction = EXCLUDED.vehicle_restriction,
         needs_scheduling = EXCLUDED.needs_scheduling,
         notes = EXCLUDED.notes,
         updated_at = NOW()
       RETURNING *`,
      [
        cnpj,
        opts.cardCode ?? null,
        opts.registrationId ?? null,
        data.sameAsBilling ?? false,
        data.zipCode ?? null,
        data.street ?? null,
        data.number ?? null,
        data.complement ?? null,
        data.neighborhood ?? null,
        data.city ?? null,
        data.state ?? null,
        data.reference ?? null,
        data.contactName ?? null,
        data.contactPhone ?? null,
        data.contactEmail ?? null,
        data.deliveryDays ?? null,
        data.deliveryHours ?? null,
        data.vehicleRestriction ?? null,
        data.needsScheduling ?? false,
        data.notes ?? null,
      ],
    );
    return rows[0];
  }

  // Vincula o CardCode do SAP ao registro de entrega após a publicação do BP.
  async attachCardCode(cnpj: string, cardCode: string): Promise<void> {
    await this.pool.query(
      `UPDATE b2b_delivery_details SET card_code = $1, updated_at = NOW()
       WHERE cnpj = $2`,
      [cardCode, cnpj],
    );
  }
}
