/**
 * Criar UDFs WMS no SAP B1 via Service Layer API
 *
 * Endpoint: POST /UserFieldsMD
 *
 * Cria os 5 campos UDF necessários na tabela ORDR (Pedidos de Venda):
 *   1. U_WMS_STATUS      — Status atual do pedido no WMS
 *   2. U_WMS_ORDERID     — ID interno do pedido no WMS
 *   3. U_WMS_LAST_EVENT  — Último evento processado
 *   4. U_WMS_LAST_TS     — Timestamp da última atualização
 *   5. U_WMS_CORR_ID     — Correlation ID para rastreamento
 *
 * Uso: npm run sap:criar-udfs
 *
 * Observações:
 *   - Requer permissões de administrador no SAP B1
 *   - Se o UDF já existir, o SAP retorna erro (o script trata graciosamente)
 *   - Após criar, o Service Layer reconhece imediatamente (sem restart)
 */

import "dotenv/config";
import { SapServiceLayerClient } from "../src/serviceLayerClient.js";
import { SapHttpError } from "../src/errors.js";

const DIVIDER = "─".repeat(60);

// ============================================================================
// Definições dos UDFs WMS
// ============================================================================

interface UdfDefinition {
  /** Nome do campo (sem o prefixo U_; o SAP adiciona automaticamente) */
  Name: string;
  /** Tabela onde criar */
  TableName: string;
  /** Descrição legível */
  Description: string;
  /**
   * Tipo do campo:
   *   db_Alpha    = Alfanumérico (string)
   *   db_Numeric  = Numérico
   *   db_Date     = Data
   *   db_Memo     = Texto longo
   */
  Type: "db_Alpha" | "db_Numeric" | "db_Date" | "db_Memo";
  /** Sub-tipo (null na maioria dos casos) */
  SubType?: "st_None" | "st_Address" | "st_Phone" | "st_Time" | "st_Rate" | "st_Sum" | "st_Price" | "st_Quantity" | "st_Percentage" | "st_Measurement" | "st_Link" | "st_Image";
  /** Tamanho máximo (obrigatório para db_Alpha) */
  EditSize?: number;
  /** Valor padrão */
  DefaultValue?: string;
  /** Campo obrigatório? */
  Mandatory?: "tNO" | "tYES";
  /** Valores válidos predefinidos (opcional) */
  ValidValues?: Array<{ Value: string; Description: string }>;
}

const WMS_UDFS: UdfDefinition[] = [
  {
    Name: "WMS_STATUS",
    TableName: "ORDR",
    Description: "Status WMS do pedido",
    Type: "db_Alpha",
    SubType: "st_None",
    EditSize: 30,
    DefaultValue: "",
    Mandatory: "tNO",
    ValidValues: [
      { Value: "IMPORTADO", Description: "Importado do SAP" },
      { Value: "A_SEPARAR", Description: "Aguardando separação" },
      { Value: "EM_SEPARACAO", Description: "Em separação" },
      { Value: "SEPARADO", Description: "Separação concluída" },
      { Value: "EM_CONFERENCIA", Description: "Em conferência" },
      { Value: "CONFERIDO", Description: "Conferência concluída" },
      { Value: "EM_EXPEDICAO", Description: "Em expedição" },
      { Value: "DESPACHADO", Description: "Despachado" },
      { Value: "ERRO", Description: "Erro no processamento" },
    ],
  },
  {
    Name: "WMS_ORDERID",
    TableName: "ORDR",
    Description: "ID do pedido no WMS",
    Type: "db_Alpha",
    SubType: "st_None",
    EditSize: 50,
    DefaultValue: "",
    Mandatory: "tNO",
  },
  {
    Name: "WMS_LAST_EVENT",
    TableName: "ORDR",
    Description: "Último evento WMS registrado",
    Type: "db_Alpha",
    SubType: "st_None",
    EditSize: 100,
    DefaultValue: "",
    Mandatory: "tNO",
  },
  {
    Name: "WMS_LAST_TS",
    TableName: "ORDR",
    Description: "Timestamp última atualização WMS",
    Type: "db_Alpha",
    SubType: "st_None",
    EditSize: 30,
    DefaultValue: "",
    Mandatory: "tNO",
  },
  {
    Name: "WMS_CORR_ID",
    TableName: "ORDR",
    Description: "Correlation ID WMS",
    Type: "db_Alpha",
    SubType: "st_None",
    EditSize: 50,
    DefaultValue: "",
    Mandatory: "tNO",
  },
];

// ============================================================================
// Config
// ============================================================================

const config = {
  baseUrl: process.env.SAP_B1_BASE_URL ?? "",
  companyDb: process.env.SAP_B1_COMPANY_DB ?? "",
  username: process.env.SAP_B1_USERNAME ?? "",
  password: process.env.SAP_B1_PASSWORD ?? "",
  timeoutMs: parseInt(process.env.SAP_B1_TIMEOUT_MS ?? "60000", 10),
};

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log("\n" + DIVIDER);
  console.log("  Criação de UDFs WMS — SAP B1 Service Layer");
  console.log(DIVIDER);
  console.log(`  Database:  ${config.companyDb}`);
  console.log(`  Servidor:  ${config.baseUrl}`);
  console.log(`  Tabela:    ORDR (Pedidos de Venda)`);
  console.log(`  UDFs:      ${WMS_UDFS.length} campos`);
  console.log(DIVIDER + "\n");

  if (!config.baseUrl || !config.companyDb || !config.username || !config.password) {
    console.error("❌ Preencha .env com as credenciais reais do SAP.");
    process.exit(1);
  }

  const client = new SapServiceLayerClient({
    baseUrl: `${config.baseUrl}/b1s/v1`,
    credentials: {
      companyDb: config.companyDb,
      username: config.username,
      password: config.password,
    },
    timeoutMs: config.timeoutMs,
    retry: { maxAttempts: 2, baseDelayMs: 1000, maxDelayMs: 5000, jitterRatio: 0.1 },
    circuitBreaker: { failureThreshold: 10, successThreshold: 2, openStateTimeoutMs: 60000 },
  });

  const correlationId = `criar-udfs-${Date.now()}`;

  try {
    // Login
    console.log("🔐 Autenticando...");
    await client.login(correlationId);
    console.log("✅ Login OK\n");

    // ── Verificar UDFs existentes ──
    console.log("🔍 Verificando UDFs existentes na tabela ORDR...\n");

    let existingUdfs: string[] = [];
    try {
      const existingRes = await client.get<{ value: Array<{ Name: string }> }>(
        "/UserFieldsMD?$filter=TableName eq 'ORDR'&$select=Name",
        { correlationId },
      );
      existingUdfs = (existingRes.data.value ?? []).map((u) => u.Name);
      console.log(`  ${existingUdfs.length} UDFs existentes na tabela ORDR`);

      // Mostrar UDFs WMS encontrados
      const wmsExisting = existingUdfs.filter((n) => n.startsWith("WMS_"));
      if (wmsExisting.length > 0) {
        console.log(`  🏷️  UDFs WMS já presentes: ${wmsExisting.join(", ")}`);
      }
    } catch {
      console.log("  ⚠️  Não foi possível listar UDFs existentes (continuando...)");
    }

    console.log();

    // ── Criar cada UDF ──
    let criados = 0;
    let jaExistiam = 0;
    let erros = 0;

    for (const udf of WMS_UDFS) {
      const fullName = `U_${udf.Name}`;
      const jaExiste = existingUdfs.includes(udf.Name);

      if (jaExiste) {
        console.log(`  ⏭️  ${fullName} — já existe, pulando`);
        jaExistiam++;
        continue;
      }

      console.log(`  ➕ Criando ${fullName}...`);

      // Montar payload
      const payload: Record<string, unknown> = {
        Name: udf.Name,
        TableName: udf.TableName,
        Description: udf.Description,
        Type: udf.Type,
        SubType: udf.SubType ?? "st_None",
        EditSize: udf.EditSize ?? 50,
        DefaultValue: udf.DefaultValue ?? "",
        Mandatory: udf.Mandatory ?? "tNO",
      };

      // Adicionar Valid Values se existirem
      if (udf.ValidValues && udf.ValidValues.length > 0) {
        payload.ValidValuesMD = udf.ValidValues;
      }

      try {
        await client.post("/UserFieldsMD", payload, { correlationId });
        console.log(`     ✅ ${fullName} criado com sucesso`);
        criados++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        
        // Extrair corpo da resposta para diagnóstico
        let bodyText = "";
        if (err instanceof SapHttpError && err.responseBodyText) {
          bodyText = err.responseBodyText;
        }

        // Verifica se é erro de "já existe"
        if (
          msg.includes("already exists") || 
          msg.includes("já existe") || 
          msg.includes("1250000") ||
          bodyText.includes("already exists") ||
          bodyText.includes("1250000")
        ) {
          console.log(`     ⏭️  ${fullName} já existe (detectado via erro)`);
          jaExistiam++;
        } else {
          console.log(`     ❌ Erro ao criar ${fullName}: ${msg.slice(0, 200)}`);
          if (bodyText) {
            // Tentar parsear JSON para mensagem mais limpa
            try {
              const parsed = JSON.parse(bodyText);
              const sapMsg = parsed?.error?.message?.value ?? bodyText.slice(0, 300);
              console.log(`     📋 Detalhe SAP: ${sapMsg}`);
            } catch {
              console.log(`     📋 Resposta SAP: ${bodyText.slice(0, 300)}`);
            }
          }
          erros++;
        }
      }
    }

    console.log();

    // ── Validar lendo um pedido ──
    console.log(DIVIDER);
    console.log("🧪 Validando — lendo UDFs de um pedido real...\n");

    try {
      const selectFields = WMS_UDFS.map((u) => `U_${u.Name}`).join(",");
      const orderRes = await client.get<{ value: Array<Record<string, unknown>> }>(
        `/Orders?$top=1&$orderby=DocEntry desc&$select=DocEntry,DocNum,${selectFields}`,
        { correlationId },
      );

      const order = orderRes.data.value?.[0];
      if (order) {
        console.log(`  Pedido: DocEntry=${order.DocEntry}, DocNum=${order.DocNum}`);
        for (const udf of WMS_UDFS) {
          const key = `U_${udf.Name}`;
          const val = order[key];
          console.log(`  ${key}: ${val === null || val === undefined ? "(vazio)" : JSON.stringify(val)}`);
        }
        console.log("\n  ✅ Leitura dos UDFs funcionando!");
      } else {
        console.log("  ⚠️  Nenhum pedido encontrado para validação");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ❌ Falha na validação: ${msg.slice(0, 150)}`);
      console.log("  💡 Se retornou 400, os UDFs podem precisar de restart do Service Layer");
    }

    // Logout
    await client.logout(correlationId);

    // ── Resumo ──
    console.log("\n" + DIVIDER);
    console.log("  RESUMO DA CRIAÇÃO");
    console.log(DIVIDER);
    console.log(`  ✅ Criados:     ${criados}`);
    console.log(`  ⏭️  Já existiam: ${jaExistiam}`);
    console.log(`  ❌ Erros:       ${erros}`);
    console.log(`  📊 Total:       ${WMS_UDFS.length} UDFs`);
    console.log(DIVIDER);

    if (erros > 0) {
      console.log("\n⚠️  Alguns UDFs não puderam ser criados. Possíveis causas:");
      console.log("  1. Usuário sem permissão de administrador");
      console.log("  2. Service Layer não permite criação de UDFs (depende da versão)");
      console.log("  3. Criar manualmente: Tools > Customization Tools > User-Defined Fields");
      console.log("  4. Ou executar o SQL: sap-connector/SQL_CREATE_UDFS.sql\n");
    } else {
      console.log("\n🎉 Todos os UDFs estão prontos!\n");
    }
  } catch (err) {
    console.error("\n❌ ERRO FATAL:", err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("ERRO:", err);
  process.exit(1);
});
