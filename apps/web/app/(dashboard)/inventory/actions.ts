'use server';

import { revalidatePath } from 'next/cache';
import { apiRequest } from '@/lib/api';

// ── Products ──────────────────────────────────────────────────────────────────

export async function createProduct(formData: FormData) {
  const name = (formData.get('name') as string).trim();
  const sku = (formData.get('sku') as string)?.trim() || undefined;
  const description = (formData.get('description') as string)?.trim() || undefined;
  await apiRequest('/products', { method: 'POST', body: JSON.stringify({ name, sku, description }) });
  revalidatePath('/inventory');
}

export async function updateProduct(id: string, formData: FormData) {
  const name = (formData.get('name') as string).trim();
  const sku = (formData.get('sku') as string)?.trim() || undefined;
  const description = (formData.get('description') as string)?.trim() || undefined;
  await apiRequest(`/products/${id}`, { method: 'PATCH', body: JSON.stringify({ name, sku, description }) });
  revalidatePath('/inventory');
}

export async function deleteProduct(id: string) {
  await apiRequest(`/products/${id}`, { method: 'DELETE' });
  revalidatePath('/inventory');
}

// ── Variants ──────────────────────────────────────────────────────────────────

export async function createVariant(productId: string, formData: FormData) {
  const name = (formData.get('name') as string).trim();
  const sku = (formData.get('sku') as string)?.trim() || undefined;
  const color = (formData.get('color') as string)?.trim() || undefined;
  const size = (formData.get('size') as string)?.trim() || undefined;
  const price = Number(formData.get('price'));
  const stockPhysical = Number(formData.get('stockPhysical')) || 0;
  await apiRequest(`/products/${productId}/variants`, {
    method: 'POST',
    body: JSON.stringify({ name, sku, color, size, price, stockPhysical }),
  });
  revalidatePath('/inventory');
}

export async function updateVariant(id: string, formData: FormData) {
  const name = (formData.get('name') as string).trim();
  const sku = (formData.get('sku') as string)?.trim() || undefined;
  const color = (formData.get('color') as string)?.trim() || undefined;
  const size = (formData.get('size') as string)?.trim() || undefined;
  const price = Number(formData.get('price'));
  await apiRequest(`/variants/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name, sku, color, size, price }),
  });
  revalidatePath('/inventory');
}

export async function deleteVariant(id: string) {
  await apiRequest(`/variants/${id}`, { method: 'DELETE' });
  revalidatePath('/inventory');
}

// ── Stock adjust ──────────────────────────────────────────────────────────────

export async function adjustStock(id: string, formData: FormData) {
  const physicalDelta = Number(formData.get('physicalDelta'));
  await apiRequest(`/variants/${id}/adjust`, {
    method: 'PATCH',
    body: JSON.stringify({ physicalDelta }),
  });
  revalidatePath('/inventory');
}

// ── Bulk create ───────────────────────────────────────────────────────────────

export async function bulkCreateProducts(
  rows: { name: string; sku?: string; variantName?: string; price: number; stockPhysical: number }[],
) {
  const result = await apiRequest<{ created: number; skipped: number; total: number }>(
    '/products/bulk-create',
    { method: 'POST', body: JSON.stringify({ rows }) },
  );
  revalidatePath('/inventory');
  return result;
}
