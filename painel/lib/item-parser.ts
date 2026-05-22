// ---------------------------------------------------------------------------
// Helpers para extrair informações do nome de produto SAP
// (mesma regra usada em /catalogo e /business-intelligence/pedidos).
//
// Exemplos de descrição reconhecidos:
//   "TAMPA PLASTICA ROSCA 28MM - UND"            -> embalaQty = 1
//   "GARRAFA NACIONAL 600ML AMB - CAIXA C/12"    -> embalaQty = 12
//   "ROLHA CONICA 100UN - FARDO C/1.000"         -> embalaQty = 1000
// ---------------------------------------------------------------------------

const UND_RX = "(?:UND|UNID)";

/**
 * Retorna o número de unidades por embalagem.
 * Retorna 1 quando a descrição vem como UND/UNID ou não contém indicação.
 */
export function getEmbalaQty(itemDescription?: string | null): number {
  const d = (itemDescription ?? "").trim();
  if (!d) return 1;

  // Caso "subnome - <embalagem>"
  const dashIdx = d.lastIndexOf(" - ");
  if (dashIdx > 0) {
    const packPart = d.slice(dashIdx + 3).trim();
    const m =
      packPart.match(new RegExp(`^(CAIXA|FARDO|PALETE)\\s+C\\s*/\\s*([\\d.,]+)\\s*${UND_RX}?\\s*$`, "i")) ??
      packPart.match(new RegExp(`^(CAIXA|FARDO|PALETE)\\s+(\\d+)\\s*${UND_RX}\\s*$`, "i"));
    if (m) {
      return parseInt(m[2].replace(/\./g, "").replace(",", "."), 10) || 1;
    }
    if (new RegExp(`^${UND_RX}$`, "i").test(packPart.replace(/-/g, "").trim())) {
      return 1;
    }
    return 1;
  }

  // Caso "...- UND"
  if (new RegExp(`[-–]\\s*${UND_RX}\\s*$`, "i").test(d)) {
    return 1;
  }

  // Caso inline "...CAIXA C/24" no final
  const m2 =
    d.match(new RegExp(`\\s+(CAIXA|FARDO|PALETE)\\s+C\\s*/\\s*([\\d.,]+)\\s*${UND_RX}?\\s*$`, "i")) ??
    d.match(new RegExp(`\\s+(CAIXA|FARDO|PALETE)\\s+(\\d+)\\s*${UND_RX}\\s*$`, "i"));
  if (m2) {
    return parseInt(m2[2].replace(/\./g, "").replace(",", "."), 10) || 1;
  }

  return 1;
}

/** Total de unidades (qty × embalaQty) para uma linha de pedido. */
export function getLineUnits(line: {
  Quantity?: number | string;
  ItemDescription?: string | null;
}): number {
  const qty = Number(line.Quantity) || 0;
  return qty * getEmbalaQty(line.ItemDescription);
}
