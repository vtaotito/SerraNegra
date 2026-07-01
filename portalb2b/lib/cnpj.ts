export function formatCnpj(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function cleanCnpj(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Validacao de formato do CNPJ para o portal B2B.
 *
 * Proposital: NAO valida os digitos verificadores. O SAP B1 e a fonte da
 * verdade sobre a existencia do cliente e contem cadastros com CNPJs que
 * falham no digito verificador (ex.: clientes reais migrados/cadastrados
 * manualmente). Uma validacao matematica estrita aqui impediria esses
 * clientes legitimos de sequer iniciar o login. Portanto exigimos apenas
 * 14 digitos e barramos sequencias repetidas obvias; a existencia real e
 * decidida pelo backend (/b2b/auth/lookup -> SAP).
 */
export function isValidCnpj(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return false;
  if (/^(\d)\1+$/.test(d)) return false;
  return true;
}

/**
 * Validacao completa com digitos verificadores (algoritmo oficial). Mantida
 * para casos em que a conferencia matematica seja desejada (ex.: cadastro de
 * cliente novo), sem bloquear o login de clientes ja existentes no SAP.
 */
export function isValidCnpjChecksum(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return false;
  if (/^(\d)\1+$/.test(d)) return false;

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(d[i]) * w1[i];
  let rem = sum % 11;
  const d1 = rem < 2 ? 0 : 11 - rem;
  if (parseInt(d[12]) !== d1) return false;

  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(d[i]) * w2[i];
  rem = sum % 11;
  const d2 = rem < 2 ? 0 : 11 - rem;
  return parseInt(d[13]) === d2;
}

export function maskEmail(email: string): string {
  const atIdx = email.indexOf("@");
  if (atIdx < 0) return "*".repeat(Math.min(5, email.length)) + email.slice(5);
  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx);
  const hideCount = Math.min(5, local.length);
  return "*".repeat(hideCount) + local.slice(hideCount) + domain;
}
