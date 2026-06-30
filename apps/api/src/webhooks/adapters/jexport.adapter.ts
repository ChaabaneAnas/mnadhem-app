import { Injectable } from '@nestjs/common';
import { Courier } from '@mnadhem/database';
import type { ICourierAdapter } from '../interfaces/courier-adapter.interface';
import type {
  ICourierWebhookPayload,
  WebhookEventType,
} from '../interfaces/courier-webhook-payload.interface';

const STATUS_MAP: Record<string, WebhookEventType> = {
  'en_cours': 'EN_COURS',
  'livré': 'LIVRE',
  'retourné': 'RETOURNE',
  'hors_zone': 'HORS_ZONE',
};

@Injectable()
export class JexportAdapter implements ICourierAdapter {
  normalize(rawBody: Record<string, unknown>): ICourierWebhookPayload {
    const status = String(rawBody['status'] ?? '').toLowerCase();
    const tracking = String(rawBody['colis_id'] ?? rawBody['tracking'] ?? '');

    return {
      trackingNumber: tracking,
      event: STATUS_MAP[status] ?? 'UNKNOWN',
      courier: Courier.JEXPORT,
      rawPayload: rawBody,
    };
  }

  validateSignature(
    _rawBody: Buffer,
    _signature: string,
    _secret: string,
  ): boolean {
    // TODO: implement once Jexport webhook signature spec is confirmed
    return true;
  }
}
