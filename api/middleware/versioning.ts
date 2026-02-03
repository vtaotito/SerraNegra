import { WmsError } from "../../wms-core/src/errors.js";
import { ApiVersion, Middleware } from "../http.js";
import { getHeaderValue } from "../utils/headers.js";

const supportedVersions: ApiVersion[] = ["v1"];

export const createVersioningMiddleware = (): Middleware => {
  return async (req, ctx, next) => {
    const headerVersion = getHeaderValue(req.headers, "accept-version")?.toLowerCase();
    const pathMatch = req.path.match(/^\/api\/(v\d+)\//);
    const pathVersion = pathMatch?.[1];
    const resolvedVersion = (pathVersion ?? headerVersion) as ApiVersion | undefined;
    if (!resolvedVersion || !supportedVersions.includes(resolvedVersion)) {
      throw new WmsError("WMS-VAL-002", "Versao de API nao suportada.");
    }
    ctx.version = resolvedVersion;
    const response = await next(req, ctx);
    response.headers = {
      ...response.headers,
      "x-api-version": resolvedVersion
    };
    return response;
  };
};
