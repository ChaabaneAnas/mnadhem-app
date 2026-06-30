import { Injectable } from '@nestjs/common';
import { Courier } from '@mnadhem/database';
import type { ICourierAdapter } from '../interfaces/courier-adapter.interface';
import type {
  ICourierWebhookPayload,
  WebhookEventType,
} from '../interfaces/courier-webhook-payload.interface';

const STATUS_MAP: Record<string, WebhookEventType> = {
  'IN_TRANSIT': 'EN_COURS',
  'DELIVERED': 'LIVRE',
  'RETURNED': 'RETOURNE',
  'OUT_OF_ZONE': 'HORS_ZONE',
};

@Injectable()
export class AramexAdapter implements ICourierAdapter {
  normalize(rawBody: Record<string, unknown>): ICourierWebhookPayload {
    const status = String(rawBody['Status'] ?? rawBody['status'] ?? '');
    const tracking = String(
      rawBody['WaybillNumber'] ?? rawBody['tracking_number'] ?? '',
    );

    return {
      trackingNumber: tracking,
      event: STATUS_MAP[status] ?? 'UNKNOWN',
      courier: Courier.ARAMEX,
      rawPayload: rawBody,
    };
  }

  validateSignature(
    _rawBody: Buffer,
    _signature: string,
    _secret: string,
  ): boolean {
    // TODO: implement once Aramex webhook signature spec is confirmed
    return true;
  }
}
