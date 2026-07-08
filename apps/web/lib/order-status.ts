export type OrderStatus =
  | 'PENDING_FULFILLMENT'
  | 'PROCESSING'
  | 'DELIVERED'
  | 'RETURNED'
  | 'CANCELLED';

/**
 * Tailwind badge classes per order status. Labels are translated at render
 * time via the `orderStatus` message namespace (e.g. `t('orderStatus.' + s)`).
 */
export const ORDER_STATUS_CLASSES: Record<OrderStatus, string> = {
  PENDING_FULFILLMENT: 'bg-secondary text-muted-foreground border-border',
  PROCESSING:
    'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/60',
  DELIVERED:
    'bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-400 border-green-200 dark:border-green-900/60',
  RETURNED:
    'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/60',
  CANCELLED: 'bg-muted text-muted-foreground border-border',
};

/** Returns the badge classes for a status, falling back to the pending style. */
export function orderStatusClasses(status: OrderStatus): string {
  return ORDER_STATUS_CLASSES[status] ?? ORDER_STATUS_CLASSES.PENDING_FULFILLMENT;
}
