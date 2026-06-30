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
