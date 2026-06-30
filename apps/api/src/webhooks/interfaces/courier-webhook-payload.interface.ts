import type { Courier } from '@mnadhem/database';

export type WebhookEventType =
  | 'EN_COURS'
  | 'LIVRE'
  | 'RETOURNE'
  | 'HORS_ZONE'
  | 'UNKNOWN';

export interface ICourierWebhookPayload {
  trackingNumber: string;
  event: WebhookEventType;
  courier: Courier;
  rawPayload: Record<string, unknown>;
}
