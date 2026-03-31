export type Customer = {
  id: number;
  card_code: string;
  card_name: string;
  card_type: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export type CustomersListParams = {
  search?: string;
  active?: boolean;
  limit?: number;
  offset?: number;
};

export type CustomersListResponse = {
  data: Customer[];
  total: number;
  limit: number;
  offset: number;
};

export type CustomerPricingItem = {
  customer_card_code: string;
  sku: string;
  description: string;
  price: number;
  currency: string;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export type CustomerPricingListResponse = {
  data: CustomerPricingItem[];
  total: number;
  limit: number;
  offset: number;
};

export type UpsertCustomerPricingRequest = {
  price: number;
  currency?: string;
  is_active?: boolean;
};

