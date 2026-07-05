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
    classes: 'bg-secondary text-muted-foreground border-border',
  },
  PROCESSING: {
    label: 'En cours',
    classes: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/60',
  },
  DELIVERED: {
    label: 'Livré',
    classes: 'bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-400 border-green-200 dark:border-green-900/60',
  },
  RETURNED: {
    label: 'Retourné',
    classes: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/60',
  },
  CANCELLED: {
    label: 'Annulé',
    classes: 'bg-muted text-muted-foreground border-border',
  },
};
