import { apiRequest } from '@/lib/api';
import { OrdersClient } from './orders-client';

interface ShipmentInfo {
  trackingNumber: string;
  courier: string;
  status: string;
}

interface Order {
  id: string;
  reference: string;
  customerName: string;
  wilaya: string;
  codAmount: string | number;
  status: 'PENDING_FULFILLMENT' | 'PROCESSING' | 'DELIVERED' | 'RETURNED' | 'CANCELLED';
  createdAt: string;
  shipment: ShipmentInfo | null;
}

interface Variant {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  stockAvailable: number;
  productId: string;
}

interface Product {
  id: string;
  name: string;
  variants: Variant[];
}

export default async function OrdersPage() {
  let orders: Order[] = [];
  let products: Product[] = [];
  let fetchError: string | null = null;

  try {
    [orders, products] = await Promise.all([
      apiRequest<Order[]>('/orders'),
      apiRequest<Product[]>('/products'),
    ]);
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Failed to load data';
  }

  const variants = products.flatMap((p) =>
    p.variants.map((v) => ({
      id: v.id,
      name: v.name,
      sku: v.sku,
      price: v.price,
      stockAvailable: v.stockAvailable,
      productName: p.name,
    })),
  );

  if (fetchError) {
    return (
      <div className="p-8">
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {fetchError}
        </div>
      </div>
    );
  }

  return <OrdersClient orders={orders} variants={variants} />;
}
