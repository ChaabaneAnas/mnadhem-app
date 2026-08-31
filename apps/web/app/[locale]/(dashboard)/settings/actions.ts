'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { apiRequest } from '@/lib/api';

/**
 * Replaces the client-side `fetch('/api/settings/tenant')` hop this page used
 * to make. Every other page in the app talks to the API through a server
 * action, and going through one means backend error codes reach the client
 * intact instead of being flattened into a 500.
 */

/** Secrets are represented by a boolean; the API never returns their values. */
export interface AramexAccountView {
  /** Null before anything has been saved. */
  id: string | null;
  enabled: boolean;
  testMode: boolean;

  username: string | null;
  hasPassword: boolean;
  accountNumber: string | null;
  hasAccountPin: boolean;
  accountEntity: string | null;
  accountCountryCode: string | null;
  version: string;

  productGroup: string;
  productType: string;
  codCurrency: string;

  shipperCompany: string | null;
  shipperContactName: string | null;
  shipperPhone: string | null;
  shipperCellPhone: string | null;
  shipperEmail: string | null;
  shipperLine1: string | null;
  shipperCity: string | null;
  shipperStateCode: string | null;
  shipperPostCode: string | null;
  shipperCountryCode: string | null;

  hasWebhookSecret: boolean;
  webhookPath: string;

  lastTestedAt: string | null;
  lastTestOk: boolean | null;
  lastTestError: string | null;
}

/** Omitted secrets keep their stored value — the form never receives them. */
export type AramexAccountInput = Partial<
  Omit<
    AramexAccountView,
    | 'id'
    | 'hasPassword'
    | 'hasAccountPin'
    | 'hasWebhookSecret'
    | 'webhookPath'
    | 'lastTestedAt'
    | 'lastTestOk'
    | 'lastTestError'
  >
> & {
  password?: string;
  accountPin?: string;
  webhookSecret?: string;
};

export async function getAramexAccount(): Promise<AramexAccountView> {
  return apiRequest<AramexAccountView>('/couriers/aramex');
}

export async function saveAramexAccount(
  data: AramexAccountInput,
): Promise<AramexAccountView> {
  const result = await apiRequest<AramexAccountView>('/couriers/aramex', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  revalidatePath('/settings');
  return result;
}

/** Runs a real authenticated call against Aramex and records the outcome. */
export async function testAramexAccount(): Promise<AramexAccountView> {
  const result = await apiRequest<AramexAccountView>('/couriers/aramex/test', {
    method: 'POST',
  });
  revalidatePath('/settings');
  return result;
}

// ── Store details ───────────────────────────────────────────────────────────

/**
 * `PATCH /tenants/:id` takes the id in the path rather than reading the JWT's
 * activeTenantId, so the session is resolved here — the same thing the
 * /api/settings/tenant route handler this replaces was doing.
 */
export async function updateStore(data: { name?: string; slug?: string }): Promise<void> {
  const session = await auth();
  const tenantId = session?.user?.activeTenantId;
  if (!tenantId) throw new Error('TENANT_NOT_FOUND');

  await apiRequest(`/tenants/${tenantId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  revalidatePath('/settings');
}
