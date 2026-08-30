import type { Courier } from '@mnadhem/database';

export type WebhookEventType =
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'RETURNED'
  | 'OUT_OF_ZONE'
  | 'UNKNOWN';

export interface ICourierWebhookPayload {
  trackingNumber: string;
  event: WebhookEventType;
  courier: Courier;
  rawPayload: Record<string, unknown>;
}
