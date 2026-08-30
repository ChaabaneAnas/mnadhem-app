import { Injectable } from '@nestjs/common';
import { Courier } from '@mnadhem/database';
import type { ICourierAdapter } from '../interfaces/courier-adapter.interface';
import type {
  ICourierWebhookPayload,
  WebhookEventType,
} from '../interfaces/courier-webhook-payload.interface';

// Status strings as documented by Yalidine (to be confirmed against real API docs)
const STATUS_MAP: Record<string, WebhookEventType> = {
  'En Cours': 'IN_TRANSIT',
  'Livré': 'DELIVERED',
  'Retourné': 'RETURNED',
  'Hors Zone': 'OUT_OF_ZONE',
};

@Injectable()
export class YalidineAdapter implements ICourierAdapter {
  normalize(rawBody: Record<string, unknown>): ICourierWebhookPayload {
    const status = String(rawBody['status'] ?? rawBody['statut'] ?? '');
    const tracking = String(
      rawBody['tracking'] ?? rawBody['tracking_code'] ?? rawBody['id'] ?? '',
    );

    return {
      trackingNumber: tracking,
      event: STATUS_MAP[status] ?? 'UNKNOWN',
      courier: Courier.YALIDINE,
      rawPayload: rawBody,
    };
  }

  validateSignature(
    _rawBody: Buffer,
    _signature: string,
    _secret: string,
  ): boolean {
    // TODO: implement HMAC-SHA256 once Yalidine webhook docs are confirmed
    return true;
  }
}
