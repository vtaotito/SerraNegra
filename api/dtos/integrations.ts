export type WebhookRegistrationRequest = {
  url: string;
  eventTypes: string[];
  secret?: string;
  headers?: Record<string, string>;
};

export type WebhookRegistrationResponse = {
  id: string;
  url: string;
  eventTypes: string[];
  status: "ACTIVE" | "PAUSED";
  createdAt: string;
};

export type IntegrationEventRequest = {
  eventType: string;
  resourceType: string;
  resourceId: string;
  payload: Record<string, unknown>;
  occurredAt?: string;
};

export type IntegrationEventResponse = {
  eventId: string;
  enqueuedAt: string;
};
