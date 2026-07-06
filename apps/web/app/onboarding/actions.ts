'use server';

import { redirect } from 'next/navigation';
import { Role, StoreType, prisma } from '@mnadhem/database';
import { auth } from '@/auth';

async function resolveSession() {
  const sess = await auth();
  if (!sess?.user?.id) redirect('/sign-in');
  return sess.user.id;
}

function parseStoreFields(formData: FormData) {
  const name = (formData.get('storeName') as string)?.trim();
  const slug = (formData.get('storeSlug') as string)
    ?.toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-');
  return { name, slug };
}

export type OnboardingTrack = 'MANUAL' | 'STOREFRONT';

/** Error redirect that keeps the user on the setup form (track) with their input intact. */
function errorUrl(error: string, track: OnboardingTrack, name?: string, slug?: string) {
  const params = new URLSearchParams({ error, track });
  if (name) params.set('storeName', name);
  if (slug) params.set('storeSlug', slug);
  return `/onboarding?${params.toString()}`;
}

async function createStore(
  userId: string,
  name: string,
  slug: string,
  storeType: StoreType,
  track: OnboardingTrack,
) {
  const taken = await prisma.tenant.findUnique({ where: { slug } });
  if (taken) redirect(errorUrl('slug_taken', track, name, slug));

  await prisma.tenant.create({
    data: { name, slug, storeType, members: { create: { userId, role: Role.OWNER } } },
  });
}

export async function createManualStore(formData: FormData) {
  const userId = await resolveSession();
  const { name, slug } = parseStoreFields(formData);
  if (!name || !slug) redirect(errorUrl('missing_fields', 'MANUAL', name, slug));
  await createStore(userId, name, slug, StoreType.MANUAL, 'MANUAL');
  redirect('/inventory');
}

export async function createStorefrontStore(formData: FormData) {
  const userId = await resolveSession();
  const { name, slug } = parseStoreFields(formData);
  if (!name || !slug) redirect(errorUrl('missing_fields', 'STOREFRONT', name, slug));
  const storeType =
    formData.get('platform') === 'WOOCOMMERCE' ? StoreType.WOOCOMMERCE : StoreType.SHOPIFY;
  await createStore(userId, name, slug, storeType, 'STOREFRONT');
  redirect('/inventory');
}
