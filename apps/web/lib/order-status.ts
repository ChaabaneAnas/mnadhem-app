export type OrderStatus =
  | 'PENDING_FULFILLMENT'
  | 'READY_FOR_SHIPMENT'
  | 'PICKUP_REQUESTED'
  | 'PROCESSING'
  | 'DELIVERED'
  | 'RETURNED'
  | 'CANCELLED';

/**
 * Pipeline order, used for the filter tabs and for sorting by status. Sorting
 * on the translated label would order rows differently in each language, and
 * alphabetically in none of them usefully — a merchant sorting by status wants
 * the fulfillment sequence.
 */
export const ORDER_STATUS_SEQUENCE: OrderStatus[] = [
  'PENDING_FULFILLMENT',
  'READY_FOR_SHIPMENT',
  'PICKUP_REQUESTED',
  'PROCESSING',
  'DELIVERED',
  'RETURNED',
  'CANCELLED',
];

/** Position in the pipeline, for comparators. */
export function orderStatusRank(status: OrderStatus): number {
  const index = ORDER_STATUS_SEQUENCE.indexOf(status);
  return index === -1 ? ORDER_STATUS_SEQUENCE.length : index;
}

/**
 * Tailwind badge classes per order status. Labels are translated at render
 * time via the `orderStatus` message namespace (e.g. `t('orderStatus.' + s)`).
 *
 * The two fulfillment stages read as "in the merchant's hands but progressing":
 * neutral slate for not-yet-started, blue while the parcel is packed and
 * waiting, then the existing amber once a courier is involved.
 */
export const ORDER_STATUS_CLASSES: Record<OrderStatus, string> = {
  PENDING_FULFILLMENT: 'bg-secondary text-muted-foreground border-border',
  READY_FOR_SHIPMENT:
    'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/60',
  PICKUP_REQUESTED:
    'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/60',
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

/** An AWB can be requested only while the order has no label yet. */
export function canGenerateAwb(status: OrderStatus): boolean {
  return status === 'PENDING_FULFILLMENT';
}

/** A pickup can be requested only once a label exists. Spec section 4.D. */
export function canRequestPickup(status: OrderStatus): boolean {
  return status === 'READY_FOR_SHIPMENT';
}

/** Labels stay printable after collection — reprints are routine. */
export function canPrintLabel(status: OrderStatus): boolean {
  return (
    status === 'READY_FOR_SHIPMENT' ||
    status === 'PICKUP_REQUESTED' ||
    status === 'PROCESSING'
  );
}

/** Cancellable while the parcel is still with the merchant. */
export function canCancel(status: OrderStatus): boolean {
  return status === 'PENDING_FULFILLMENT' || status === 'READY_FOR_SHIPMENT';
}

/** Tracking only means something once a courier is carrying the parcel. */
export function canTrack(status: OrderStatus): boolean {
  return status === 'PICKUP_REQUESTED' || status === 'PROCESSING';
}
