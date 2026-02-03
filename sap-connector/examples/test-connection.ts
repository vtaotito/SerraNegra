/**
 * Script de teste de conectividade SAP B1.
 * Testa diferentes métodos de autenticação para descobrir qual funciona.
 *
 * Para rodar:
 * npm run build && node dist/sap-connector/examples/test-connection.js
 */

const SAP_URL = "https://REDACTED_SAP_HOST/b1s/v1";
const SAP_TOKEN = "REDACTED_TOKEN";

async function testMethod(name: string, headers: Record<string, string>) {
  console.log(`\n🧪 Testando: ${name}`);
  console.log(`Headers:`, JSON.stringify(headers, null, 2));

  try {
    const res = await fetch(`${SAP_URL}/Orders?$top=1`, {
      method: "GET",
      headers: {
        accept: "application/json",
        ...headers
      }
    });

    console.log(`   Status: ${res.status} ${res.statusText}`);
    const contentType = res.headers.get("content-type") ?? "";

    if (res.ok) {
      console.log(`   ✅ SUCESSO!`);
      if (contentType.includes("application/json")) {
        const data = await res.json();
        console.log(`   Resposta (primeiros 200 chars):`, JSON.stringify(data).slice(0, 200));
      }
      return true;
    } else {
      console.log(`   ❌ Falhou`);
      if (contentType.includes("application/json")) {
        const err = await res.json();
        console.log(`   Erro:`, JSON.stringify(err).slice(0, 200));
      } else {
        const text = await res.text();
        console.log(`   Erro (texto):`, text.slice(0, 200));
      }
      return false;
    }
  } catch (err) {
    console.log(`   ❌ Exceção:`, err);
    return false;
  }
}

async function decodeToken() {
  console.log(`\n🔍 Tentando decodificar token (hex -> UTF-8)...`);
  try {
    const decoded = Buffer.from(SAP_TOKEN, "hex").toString("utf8");
    console.log(`   Decodificado: ${decoded.slice(0, 100)}`);
    return decoded;
  } catch (err) {
    console.log(`   ⚠️  Não é hex válido ou contém caracteres binários.`);
    return null;
  }
}

async function testMetadata() {
  console.log(`\n🔍 Testando endpoint público $metadata (sem auth)...`);
  try {
    const res = await fetch(`${SAP_URL}/$metadata`, {
      method: "GET",
      headers: { accept: "application/xml" }
    });
    console.log(`   Status: ${res.status} ${res.statusText}`);
    if (res.ok) {
      console.log(`   ✅ Endpoint Service Layer está acessível.`);
      const xml = await res.text();
      console.log(`   Resposta (primeiros 300 chars):`, xml.slice(0, 300));
    } else {
      console.log(`   ⚠️  Endpoint não acessível ou protegido.`);
    }
  } catch (err) {
    console.log(`   ❌ Erro de rede:`, err);
  }
}

async function main() {
  console.log(`========================================`);
  console.log(`🚀 Teste de Conectividade SAP B1`);
  console.log(`========================================`);
  console.log(`URL: ${SAP_URL}`);
  console.log(`Token (primeiros 40 chars): ${SAP_TOKEN.slice(0, 40)}...`);

  // 1. Testar $metadata (público)
  await testMetadata();

  // 2. Decodificar token
  const decoded = await decodeToken();

  // 3. Testar métodos de autenticação
  const methods: Array<{ name: string; headers: Record<string, string> }> = [
    { name: "Bearer Token (Authorization header)", headers: { Authorization: `Bearer ${SAP_TOKEN}` } },
    { name: "Cookie B1SESSION", headers: { Cookie: `B1SESSION=${SAP_TOKEN}` } },
    { name: "Cookie ROUTEID", headers: { Cookie: `ROUTEID=${SAP_TOKEN}` } }
  ];

  if (decoded) {
    // Se decodificou, pode ser base64 ou outro encoding
    methods.push({ name: "Bearer Token (decoded)", headers: { Authorization: `Bearer ${decoded}` } });
  }

  let success = false;
  for (const method of methods) {
    const ok = await testMethod(method.name, method.headers);
    if (ok) {
      success = true;
      break;
    }
  }

  console.log(`\n========================================`);
  if (success) {
    console.log(`✅ MÉTODO DE AUTENTICAÇÃO IDENTIFICADO!`);
    console.log(`   Atualize o código em serviceLayerClient.ts ou use headers customizados.`);
  } else {
    console.log(`❌ NENHUM MÉTODO FUNCIONOU.`);
    console.log(`   Recomendações:`);
    console.log(`   1. Verificar se o token ainda está válido (sessões expiram)`);
    console.log(`   2. Contatar suporte da Autosky/SAP para obter credenciais corretas`);
    console.log(`   3. Verificar se há firewall/allowlist bloqueando seu IP`);
  }
  console.log(`========================================`);
}

main().catch(console.error);
