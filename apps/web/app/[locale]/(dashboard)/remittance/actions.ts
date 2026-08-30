'use server';

import { revalidatePath } from 'next/cache';
import { apiRequest } from '@/lib/api';

export interface RemitResult {
  remitted: number;
  skipped: number;
}

/** Records one courier settlement covering many parcels. */
export async function remitShipments(shipmentIds: string[]): Promise<RemitResult> {
  const result = await apiRequest<RemitResult>('/shipments/remit', {
    method: 'POST',
    body: JSON.stringify({ shipmentIds }),
  });
  // The dashboard KPI reads the same figure, so both views go stale together.
  revalidatePath('/remittance');
  revalidatePath('/dashboard');
  return result;
}

/** Marks a single parcel paid, or with `remitted: false` undoes that. */
export async function setShipmentRemitted(id: string, remitted: boolean) {
  await apiRequest(`/shipments/${id}/remit`, {
    method: 'PATCH',
    body: JSON.stringify({ remitted }),
  });
  revalidatePath('/remittance');
  revalidatePath('/dashboard');
}
