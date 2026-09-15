import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { loadImperiumConfig } from "../src/services/imperium/config.js";
import { probeImperiumWsdl } from "../src/services/imperium/soapClient.js";
import { callImperiumSoap } from "../src/services/imperium/soapClient.js";
import { buildEmptyBody, buildListCargasXml } from "../src/services/imperium/builders.js";
import { formatBrDate } from "../src/services/imperium/xml.js";

describe("Imperium homolog smoke", () => {
  const cfg = loadImperiumConfig();

  it("WSDL de expedição responde com Basic Auth", async (t) => {
    if (!cfg.configured) {
      t.skip("IMPERIUM_* não configurado");
      return;
    }
    const probe = await probeImperiumWsdl("expedicao");
    assert.equal(probe.ok, true, probe.message);
    assert.ok(probe.statusCode >= 200 && probe.statusCode < 300);
  });

  it("produto.listar e expedicao.listCargas falam com o host de teste", async (t) => {
    if (!cfg.configured) {
      t.skip("IMPERIUM_* não configurado");
      return;
    }
    const listar = await callImperiumSoap("produto", "listar", buildEmptyBody());
    assert.ok(listar.statusCode > 0, "sem resposta HTTP");
    assert.ok(
      listar.statusCode < 500 || listar.fault,
      `listar inesperado: HTTP ${listar.statusCode} ${listar.fault ?? ""}`,
    );

    const hoje = new Date();
    const ini = new Date(hoje.getTime() - 3 * 86400000);
    const cargas = await callImperiumSoap(
      "expedicao",
      "listCargas",
      buildListCargasXml(formatBrDate(ini), formatBrDate(hoje)),
    );
    assert.ok(cargas.statusCode > 0);
    assert.ok(cargas.statusCode < 500 || cargas.fault, `listCargas HTTP ${cargas.statusCode}`);
  });
});
