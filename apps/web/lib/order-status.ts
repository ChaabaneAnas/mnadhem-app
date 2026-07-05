export type OrderStatus =
  | 'PENDING_FULFILLMENT'
  | 'PROCESSING'
  | 'DELIVERED'
  | 'RETURNED'
  | 'CANCELLED';

/** Badge label + Tailwind classes for each order status (French labels). */
export const ORDER_STATUS: Record<OrderStatus, { label: string; classes: string }> = {
  PENDING_FULFILLMENT: {
    label: 'En attente',
    classes: 'bg-slate-100 text-slate-600 border-slate-200',
  },
  PROCESSING: {
    label: 'En cours',
    classes: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  DELIVERED: {
    label: 'Livré',
    classes: 'bg-green-50 text-green-800 border-green-200',
  },
  RETURNED: {
    label: 'Retourné',
    classes: 'bg-red-50 text-red-700 border-red-200',
  },
  CANCELLED: {
    label: 'Annulé',
    classes: 'bg-slate-50 text-slate-400 border-slate-100',
  },
};
