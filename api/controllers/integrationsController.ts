import { WmsError } from "../../wms-core/src/errors.js";
import {
  IntegrationEventRequest,
  IntegrationEventResponse,
  WebhookRegistrationRequest,
  WebhookRegistrationResponse
} from "../dtos/integrations.js";
import { ApiHandler } from "../http.js";
import { optionalString, requireString } from "../utils/validation.js";

export type IntegrationService = {
  registerWebhook: (input: WebhookRegistrationRequest) => Promise<WebhookRegistrationResponse>;
  listWebhooks: () => Promise<WebhookRegistrationResponse[]>;
  deleteWebhook: (id: string) => Promise<void>;
  publishEvent: (input: IntegrationEventRequest) => Promise<IntegrationEventResponse>;
};

export const createIntegrationsController = (service: IntegrationService): {
  registerWebhook: ApiHandler;
  listWebhooks: ApiHandler;
  deleteWebhook: ApiHandler;
  publishEvent: ApiHandler;
} => {
  const registerWebhook: ApiHandler = async (req) => {
    if (!req.body) {
      throw new WmsError("WMS-VAL-001", "Payload obrigatorio.");
    }
    if (typeof req.body !== "object" || req.body === null) {
      throw new WmsError("WMS-VAL-001", "Payload inválido.");
    }
    const body = req.body as unknown as WebhookRegistrationRequest;
    const payload: WebhookRegistrationRequest = {
      url: requireString(body.url, "url"),
      eventTypes: Array.isArray(body.eventTypes) ? body.eventTypes : [],
      secret: optionalString(body.secret),
      headers: (body as any).headers ?? undefined
    };
    if (payload.eventTypes.length === 0) {
      throw new WmsError("WMS-VAL-001", "eventTypes deve conter ao menos um tipo.");
    }
    const result = await service.registerWebhook(payload);
    return {
      status: 201,
      body: result
    };
  };

  const listWebhooks: ApiHandler = async () => {
    const result = await service.listWebhooks();
    return {
      status: 200,
      body: result
    };
  };

  const deleteWebhook: ApiHandler = async (req) => {
    const webhookId = req.params?.webhookId;
    if (!webhookId) {
      throw new WmsError("WMS-VAL-001", "WebhookId obrigatorio.");
    }
    await service.deleteWebhook(webhookId);
    return {
      status: 204
    };
  };

  const publishEvent: ApiHandler = async (req) => {
    if (!req.body) {
      throw new WmsError("WMS-VAL-001", "Payload obrigatorio.");
    }
    if (typeof req.body !== "object" || req.body === null) {
      throw new WmsError("WMS-VAL-001", "Payload inválido.");
    }
    const body = req.body as unknown as IntegrationEventRequest;
    const payload: IntegrationEventRequest = {
      eventType: requireString(body.eventType, "eventType"),
      resourceType: requireString(body.resourceType, "resourceType"),
      resourceId: requireString(body.resourceId, "resourceId"),
      payload: (body as any).payload ?? {},
      occurredAt: optionalString((body as any).occurredAt)
    };
    const result = await service.publishEvent(payload);
    return {
      status: 202,
      body: result
    };
  };

  return { registerWebhook, listWebhooks, deleteWebhook, publishEvent };
};
