import { callImperiumSoap } from "../src/services/imperium/soapClient.js";
import { buildEmptyBody } from "../src/services/imperium/builders.js";
import { xmlString } from "../src/services/imperium/xml.js";
import { parseEstoqueResponse } from "../src/services/imperium/xml.js";

function brief(label: string, r: Awaited<ReturnType<typeof callImperiumSoap>>) {
  console.log(
    JSON.stringify({
      label,
      ok: r.ok,
      status: r.statusCode,
      fault: r.fault,
      durationMs: r.durationMs,
      preview: r.bodyXml.slice(0, 900).replace(/\s+/g, " "),
    }),
  );
}

const listar = await callImperiumSoap("produto", "listar", buildEmptyBody());
brief("produto.listar", listar);

const buscar = await callImperiumSoap(
  "produto",
  "buscar",
  `
         ${xmlString("idProduto", "AR00000001")}
         ${xmlString("grade", "UNICA")}`,
);
brief("produto.buscar AR00000001", buscar);

console.log(
  JSON.stringify({
    listarStockTags: {
      armazenado: (listar.bodyXml.match(/estoqueArmazenado/g) ?? []).length,
      disponivel: (listar.bodyXml.match(/estoqueDisponivel/g) ?? []).length,
      parsed: parseEstoqueResponse(listar.bodyXml).slice(0, 5),
    },
  }),
);
