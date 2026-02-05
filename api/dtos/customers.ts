export type Customer = {
  id: string;
  customerCode: string;
  name: string;
  email?: string;
  phone?: string;
  taxId?: string;
  billingAddress?: Address;
  shippingAddress?: Address;
  type: "RETAIL" | "WHOLESALE" | "DISTRIBUTOR" | "INTERNAL";
  active: boolean;
  creditLimit?: number;
  paymentTerms?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type Address = {
  street: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city: string;
  state: string;
  zipCode: string;
  country?: string;
};

export type CustomerCreateRequest = {
  customerCode: string;
  name: string;
  email?: string;
  phone?: string;
  taxId?: string;
  billingAddress?: Address;
  shippingAddress?: Address;
  type: "RETAIL" | "WHOLESALE" | "DISTRIBUTOR" | "INTERNAL";
  creditLimit?: number;
  paymentTerms?: string;
  notes?: string;
};

export type CustomerUpdateRequest = {
  name?: string;
  email?: string;
  phone?: string;
  billingAddress?: Address;
  shippingAddress?: Address;
  active?: boolean;
  creditLimit?: number;
  paymentTerms?: string;
  notes?: string;
};

export type CustomerQuery = {
  search?: string;
  type?: string;
  active?: boolean;
  limit?: number;
  cursor?: string;
};
