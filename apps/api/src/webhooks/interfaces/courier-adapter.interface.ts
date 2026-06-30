import type { ICourierWebhookPayload } from './courier-webhook-payload.interface';

export interface ICourierAdapter {
  /**
   * Map a raw courier payload to the normalized internal format.
   * Field names vary per courier — each adapter owns this mapping.
   */
  normalize(rawBody: Record<string, unknown>): ICourierWebhookPayload;

  /**
   * Validate the HMAC / token signature sent by the courier.
   * Returns true if valid. Stub returns true until real docs are available.
   */
  validateSignature(rawBody: Buffer, signature: string, secret: string): boolean;
}
