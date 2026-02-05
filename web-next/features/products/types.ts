export type Product = {
  id: string;
  sku: string;
  description: string;
  ean?: string | null;
  category?: string | null;
  unit_of_measure: string;
  is_active: boolean;

  sap_item_code?: string | null;
  sap_item_name?: string | null;

  weight_kg?: number | null;
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;

  created_at: string;
  updated_at: string;
};

export type ProductsListParams = {
  search?: string;
  categoryId?: string;
  active?: boolean;
  limit?: number;
  cursor?: string;
};

export type ProductsListResponse = {
  data: Product[];
  nextCursor?: string;
};
