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

async function createStore(userId: string, name: string, slug: string, storeType: StoreType) {
  const tenant = await prisma.tenant.create({ data: { name, slug, storeType } });
  await prisma.tenantMember.create({
    data: { userId, role: Role.OWNER, tenantId: tenant.id },
  });
}

export async function createManualStore(formData: FormData) {
  const userId = await resolveSession();
  const { name, slug } = parseStoreFields(formData);
  if (!name || !slug) redirect('/onboarding?error=missing_fields');
  await createStore(userId, name, slug, StoreType.MANUAL);
  redirect('/inventory');
}

export async function createStorefrontStore(formData: FormData) {
  const userId = await resolveSession();
  const { name, slug } = parseStoreFields(formData);
  if (!name || !slug) redirect('/onboarding?error=missing_fields');
  await createStore(userId, name, slug, StoreType.SHOPIFY);
  redirect('/inventory');
}
