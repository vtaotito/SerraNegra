/**
 * Tipos para o catálogo do Excel "VOLUME COMERCIAL" — uso na UI do Cockpit.
 * Gerado a partir da análise do ficheiro VOLUME COMERCIAL 10.12.xlsx.
 */

export type ColumnType = "string" | "number" | "integer" | "date" | "boolean" | "null";

export interface ColumnDef {
  key: string;
  label: string;
  type: ColumnType;
  /** Indica se a coluna é usada como filtro global (ex.: vendedor, cliente, período) */
  filterable?: boolean;
  /** Indica se é chave primária ou parte da chave (para drill-through) */
  keyField?: boolean;
}

export type SheetCategory = "fact" | "dimension" | "analysis" | "summary" | "other";

export interface SheetInfo {
  id: number;
  name: string;
  /** Nome para exibição na UI (sidebar, breadcrumb) */
  displayName: string;
  category: SheetCategory;
  rowCount: number;
  columns: ColumnDef[];
  /** Primeiras linhas para preview na UI (opcional) */
  sampleRows?: unknown[][];
}

export interface ExcelCatalog {
  source: string;
  extractedAt: string;
  sheets: SheetInfo[];
}
