'use server';

import { revalidatePath } from 'next/cache';
import { apiRequest } from '@/lib/api';

export interface CreateOrderPayload {
  reference: string;
  customerName: string;
  customerPhone: string;
  wilaya: string;
  commune?: string;
  address?: string;
  codAmount: number;
  items: { variantId: string; quantity: number }[];
}

export async function createManualOrder(data: CreateOrderPayload) {
  await apiRequest('/orders/manual', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  revalidatePath('/orders');
}

export async function cancelOrder(id: string) {
  await apiRequest(`/orders/${id}/cancel`, { method: 'PATCH' });
  revalidatePath('/orders');
}

// ── Fulfillment ─────────────────────────────────────────────────────────────

export interface SkippedOrder {
  orderId: string;
  reference: string;
  /** Stable backend code; translated client-side via the `errors` namespace. */
  reason: string;
}

/**
 * Every fulfillment action reports what it could not do rather than failing
 * whole. The caller must surface `skipped` — spec section 4.D requires telling
 * the merchant which orders were left behind and why.
 */
export interface FulfillmentResult {
  succeeded: number;
  skipped: SkippedOrder[];
}

export interface PrintLabelsResult extends FulfillmentResult {
  pdfBase64: string | null;
}

export async function generateAwbs(orderIds: string[]): Promise<FulfillmentResult> {
  const result = await apiRequest<FulfillmentResult>('/orders/awb', {
    method: 'POST',
    body: JSON.stringify({ orderIds }),
  });
  revalidatePath('/orders');
  return result;
}

export async function requestPickups(orderIds: string[]): Promise<FulfillmentResult> {
  const result = await apiRequest<FulfillmentResult>('/orders/pickup', {
    method: 'POST',
    body: JSON.stringify({ orderIds }),
  });
  revalidatePath('/orders');
  return result;
}

/**
 * Returns the merged label PDF base64-encoded rather than as a stream: a server
 * action's return value is serialized, so binary cannot be forwarded. The client
 * turns it back into a Blob to hand the browser a download.
 *
 * No `revalidatePath` — printing changes nothing.
 */
export async function printLabels(orderIds: string[]): Promise<PrintLabelsResult> {
  return apiRequest<PrintLabelsResult>('/orders/labels/print', {
    method: 'POST',
    body: JSON.stringify({ orderIds }),
  });
}

/** Carrier tracking page for one order, or null when the carrier offers none. */
export async function getTrackingUrl(id: string): Promise<{ url: string | null }> {
  return apiRequest<{ url: string | null }>(`/orders/${id}/tracking`);
}
