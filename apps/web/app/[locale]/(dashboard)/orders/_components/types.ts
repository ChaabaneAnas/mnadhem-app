import type { OrderStatus } from '@/lib/order-status';

export interface ShipmentInfo {
  trackingNumber: string;
  courier: string;
  status: string;
}

export interface Order {
  id: string;
  reference: string;
  customerName: string;
  wilaya: string;
  codAmount: string | number;
  status: OrderStatus;
  createdAt: string;
  shipment: ShipmentInfo | null;
}

export interface PickerVariant {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  stockAvailable: number;
  productName: string;
}

export interface LineItem {
  variantId: string;
  productName: string;
  variantName: string;
  sku: string | null;
  price: number;
  quantity: number;
}

/** Columns the table can be sorted by. */
export type SortKey = 'createdAt' | 'codAmount' | 'customerName' | 'status';
export type SortDirection = 'asc' | 'desc';

export interface SortState {
  key: SortKey;
  direction: SortDirection;
}
