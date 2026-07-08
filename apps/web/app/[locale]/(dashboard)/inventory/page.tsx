import { auth } from '@/auth';
import { apiRequest } from '@/lib/api';
import { InventoryClient } from './inventory-client';

interface Variant {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  stockPhysical: number;
  stockReserved: number;
  stockAvailable: number;
}

interface Product {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  variants: Variant[];
}

interface Tenant {
  id: string;
  storeType: 'MANUAL' | 'SHOPIFY' | 'WOOCOMMERCE';
}

export default async function InventoryPage() {
  const session = await auth();
  const activeTenantId = session?.user?.activeTenantId;

  const [products, tenants] = await Promise.all([
    apiRequest<Product[]>('/products').catch((): Product[] => []),
    apiRequest<Tenant[]>('/tenants/my').catch((): Tenant[] => []),
  ]);

  const storeType =
    tenants.find((t) => t.id === activeTenantId)?.storeType ?? 'MANUAL';

  return <InventoryClient products={products} storeType={storeType} />;
}
