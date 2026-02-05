/**
 * Script de mapeamento: descobre todos os campos disponíveis em Orders.
 * Busca 1 pedido completo (sem $select) para ver todos os campos retornados.
 *
 * Para rodar:
 * npm run sap:mapear-campos
 */

import { SapServiceLayerClient } from "../src/serviceLayerClient.js";
import { writeFileSync } from "fs";
import { join } from "path";

const config = {
  baseUrl: process.env.SAP_B1_BASE_URL ?? "https://sap-garrafariasnegra-sl.skyinone.net:50000",
  companyDb: process.env.SAP_B1_COMPANY_DB ?? "SBO_GARRAFARIA_TST",
  username: process.env.SAP_B1_USERNAME ?? "lorenzo.naves",
  password: process.env.SAP_B1_PASSWORD ?? "382105",
  timeoutMs: parseInt(process.env.SAP_B1_TIMEOUT_MS ?? "60000", 10)
};

const logger = {
  info: (msg: string) => console.log(`ℹ️  ${msg}`),
  warn: (msg: string) => console.warn(`⚠️  ${msg}`),
  error: (msg: string) => console.error(`❌ ${msg}`)
};

function analyzeStructure(obj: unknown, prefix = ""): Array<{ campo: string; tipo: string; exemplo: string }> {
  const result: Array<{ campo: string; tipo: string; exemplo: string }> = [];

  if (obj === null || obj === undefined) {
    return result;
  }

  if (typeof obj !== "object") {
    return result;
  }

  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const tipo = Array.isArray(value) ? "array" : typeof value;
    let exemplo = "";

    if (value === null) {
      exemplo = "null";
    } else if (Array.isArray(value)) {
      exemplo = `[${value.length} items]`;
      if (value.length > 0 && typeof value[0] === "object") {
        // Analisar estrutura do primeiro item do array
        const subFields = analyzeStructure(value[0], path);
        result.push(...subFields);
      }
    } else if (typeof value === "object") {
      exemplo = "{...}";
      // Analisar objeto aninhado
      const subFields = analyzeStructure(value, path);
      result.push(...subFields);
    } else {
      exemplo = String(value).slice(0, 50);
    }

    result.push({ campo: path, tipo, exemplo });
  }

  return result;
}

async function main() {
  console.log("\n========================================");
  console.log("🔍 MAPEAMENTO DE CAMPOS - Orders");
  console.log("========================================\n");

  const client = new SapServiceLayerClient({
    baseUrl: `${config.baseUrl}/b1s/v1`,
    credentials: {
      companyDb: config.companyDb,
      username: config.username,
      password: config.password
    },
    timeoutMs: config.timeoutMs,
    retry: { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 5000, jitterRatio: 0.1 },
    circuitBreaker: { failureThreshold: 10, successThreshold: 2, openStateTimeoutMs: 60000 }
  });

  const correlationId = `mapear-${Date.now()}`;

  try {
    logger.info("Autenticando...");
    await client.login(correlationId);
    console.log("✅ Login OK\n");

    // 1. Buscar 1 pedido completo (todos os campos)
    logger.info("Buscando 1 pedido completo (sem filtros)...");
    const orderRes = await client.get<{ value: Array<Record<string, unknown>> }>(
      "/Orders?$top=1",
      { correlationId }
    );

    const orders = orderRes.data.value ?? [];
    
    if (orders.length === 0) {
      logger.warn("Nenhum pedido encontrado na base.");
      process.exit(0);
    }

    const order = orders[0]!;
    console.log(`✅ Pedido encontrado: DocEntry ${order.DocEntry}\n`);

    // 2. Analisar estrutura
    logger.info("Analisando estrutura...");
    const campos = analyzeStructure(order);

    // 3. Agrupar por tipo
    const camposSimples = campos.filter(c => !c.campo.includes("."));
    const camposAninhados = campos.filter(c => c.campo.includes("."));

    console.log("\n========================================");
    console.log("📊 CAMPOS SIMPLES (nível raiz)");
    console.log("========================================\n");

    console.log("┌─────────────────────────────┬──────────┬────────────────────────────────┐");
    console.log("│ Campo                       │ Tipo     │ Exemplo                        │");
    console.log("├─────────────────────────────┼──────────┼────────────────────────────────┤");
    
    for (const campo of camposSimples.sort((a, b) => a.campo.localeCompare(b.campo))) {
      const c = campo.campo.padEnd(27).slice(0, 27);
      const t = campo.tipo.padEnd(8).slice(0, 8);
      const e = campo.exemplo.padEnd(30).slice(0, 30);
      console.log(`│ ${c} │ ${t} │ ${e} │`);
    }
    
    console.log("└─────────────────────────────┴──────────┴────────────────────────────────┘");

    if (camposAninhados.length > 0) {
      console.log("\n========================================");
      console.log("📊 CAMPOS ANINHADOS");
      console.log("========================================\n");

      console.log("┌──────────────────────────────────────────┬──────────┬──────────────┐");
      console.log("│ Campo                                    │ Tipo     │ Exemplo      │");
      console.log("├──────────────────────────────────────────┼──────────┼──────────────┤");
      
      for (const campo of camposAninhados.sort((a, b) => a.campo.localeCompare(b.campo)).slice(0, 50)) {
        const c = campo.campo.padEnd(40).slice(0, 40);
        const t = campo.tipo.padEnd(8).slice(0, 8);
        const e = campo.exemplo.padEnd(12).slice(0, 12);
        console.log(`│ ${c} │ ${t} │ ${e} │`);
      }
      
      console.log("└──────────────────────────────────────────┴──────────┴──────────────┘");
      
      if (camposAninhados.length > 50) {
        console.log(`\n... e mais ${camposAninhados.length - 50} campos aninhados`);
      }
    }

    // 4. Salvar estrutura completa em JSON
    const outputPath = join(process.cwd(), "sap-connector", "Orders-structure.json");
    writeFileSync(outputPath, JSON.stringify(order, null, 2), "utf-8");
    console.log(`\n📄 Estrutura completa salva em: sap-connector/Orders-structure.json`);

    // 5. Criar documentação Markdown
    const markdown = generateMarkdown(camposSimples, camposAninhados, order);
    const mdPath = join(process.cwd(), "sap-connector", "Orders-fields.md");
    writeFileSync(mdPath, markdown, "utf-8");
    console.log(`📄 Documentação salva em: sap-connector/Orders-fields.md`);

    // Logout
    await client.logout(correlationId);

    console.log("\n========================================");
    console.log("✅ MAPEAMENTO CONCLUÍDO");
    console.log("========================================");
    console.log(`Total de campos simples: ${camposSimples.length}`);
    console.log(`Total de campos aninhados: ${camposAninhados.length}`);
    console.log(`Total geral: ${campos.length}`);
    console.log("========================================\n");

  } catch (err) {
    logger.error(`Falha: ${err}`);
    console.error(err);
    process.exit(1);
  }
}

function generateMarkdown(
  simples: Array<{ campo: string; tipo: string; exemplo: string }>,
  aninhados: Array<{ campo: string; tipo: string; exemplo: string }>,
  order: Record<string, unknown>
): string {
  let md = `# Estrutura da Entidade Orders (SAP B1 Service Layer)

**Base**: SBO_GARRAFARIA_TST  
**Versão**: 10.0 (1000190)  
**Data**: ${new Date().toISOString().split("T")[0]}  
**Pedido analisado**: DocEntry ${order.DocEntry}

---

## Campos Simples (Nível Raiz)

| Campo | Tipo | Exemplo/Valor |
|-------|------|---------------|
`;

  for (const campo of simples.sort((a, b) => a.campo.localeCompare(b.campo))) {
    md += `| \`${campo.campo}\` | ${campo.tipo} | ${campo.exemplo} |\n`;
  }

  if (aninhados.length > 0) {
    md += `\n---

## Campos Aninhados

| Campo | Tipo | Exemplo/Valor |
|-------|------|---------------|
`;

    for (const campo of aninhados.sort((a, b) => a.campo.localeCompare(b.campo))) {
      md += `| \`${campo.campo}\` | ${campo.tipo} | ${campo.exemplo} |\n`;
    }
  }

  md += `\n---

## Campos Úteis para Integração WMS

### Identificadores
- \`DocEntry\`: Chave interna do SAP (número sequencial)
- \`DocNum\`: Número do documento (visível ao usuário)

### Cliente
- \`CardCode\`: Código do cliente

### Datas
- Verificar disponibilidade de campos de data no JSON completo

### Itens
- Verificar estrutura de linhas/itens no JSON completo

---

**Estrutura JSON completa**: \`Orders-structure.json\`
`;

  return md;
}

main().catch(console.error);
