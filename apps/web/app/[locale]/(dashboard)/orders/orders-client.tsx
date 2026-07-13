'use client';

import { useState, useTransition,  } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, X, Search, Trash2, AlertCircle } from 'lucide-react';
import { createManualOrder, cancelOrder, type CreateOrderPayload } from './actions';
import { formatTND } from '@/lib/format';
import { useErrorMessage } from '@/lib/api-error';
import { orderStatusClasses, type OrderStatus } from '@/lib/order-status';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
    ResponsiveModal,
    ResponsiveSheet
} from '@/components/ui/responsive-modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIsMobile } from '@/hooks/use-mobile';

// ── Types ─────────────────────────────────────────────────────────────────────

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
  status: OrderStatus;
  createdAt: string;
  shipment: ShipmentInfo | null;
}

interface PickerVariant {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  stockAvailable: number;
  productName: string;
}

interface LineItem {
  variantId: string;
  productName: string;
  variantName: string;
  sku: string | null;
  price: number;
  quantity: number;
}

// ── Algerian wilayas ──────────────────────────────────────────────────────────

const WILAYAS =
 [
  "Ariana",
  "Beja",
  "Ben Arous",
  "Bizerte",
  "Gabes",
  "Gafsa",
  "Jendouba",
  "Kairouan",
  "Kasserine",
  "Kebili",
  "Kef",
  "Mahdia",
  "Manouba",
  "Medenine",
  "Monastir",
  "Nabeul",
  "Sfax",
  "Sidi Bouzid",
  "Siliana",
  "Sousse",
  "Tataouine",
  "Tozeur",
  "Tunis",
  "Zaghouan"
]


function generateRef() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${date}-${rand}`;
}

// ── Modal overlay ─────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
      <ResponsiveModal title={title} onClose={onClose}>
          {children}
      </ResponsiveModal>
  );
}

// ── Cancel confirm modal ──────────────────────────────────────────────────────

function CancelModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const t = useTranslations('orders');
  const getError = useErrorMessage();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCancel() {
    startTransition(async () => {
      try {
        await cancelOrder(order.id);
        onClose();
      } catch (err) {
        setError(getError(err));
      }
    });
  }

  return (
    <Modal title={t('cancelTitle')} onClose={onClose}>
      <p className="text-sm text-muted-foreground mb-4">
        {t('cancelConfirm', { reference: order.reference })}
      </p>
      {error && (
        <div className="mb-3 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 px-3 py-2 text-xs text-red-700 dark:text-red-400">{error}</div>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose} className="rounded-md border-border text-xs text-muted-foreground hover:bg-muted hover:text-muted-foreground transition-colors">
          {t('keepOrder')}
        </Button>
        <Button type="button" variant="destructive" size="sm" onClick={handleCancel} disabled={pending} className="rounded-md bg-red-600 text-xs font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">
          {pending ? t('cancelling') : t('cancel')}
        </Button>
      </div>
    </Modal>
  );
}

// ── Create Order side panel ───────────────────────────────────────────────────

function CreateOrderSheet({
  variants,
  onClose,
}: {
  variants: PickerVariant[];
  onClose: () => void;
}) {
  const t = useTranslations('orders');
  const getError = useErrorMessage();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState(generateRef);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [search, setSearch] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const isMobile = useIsMobile();

  const filteredVariants = search.trim().length > 0
    ? variants.filter((v) => {
        const q = search.toLowerCase();
        return (
          v.productName.toLowerCase().includes(q) ||
          v.name.toLowerCase().includes(q) ||
          (v.sku?.toLowerCase().includes(q) ?? false)
        );
      })
    : [];

  const codTotal = lineItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

  function addVariant(v: PickerVariant) {
    setLineItems((prev) => {
      const exists = prev.find((i) => i.variantId === v.id);
      if (exists) return prev.map((i) => i.variantId === v.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { variantId: v.id, productName: v.productName, variantName: v.name, sku: v.sku, price: v.price, quantity: 1 }];
    });
    setSearch('');
    setShowPicker(false);
  }

  function updateQty(variantId: string, qty: number) {
    if (qty < 1) return;
    setLineItems((prev) => prev.map((i) => i.variantId === variantId ? { ...i, quantity: qty } : i));
  }

  function removeItem(variantId: string) {
    setLineItems((prev) => prev.filter((i) => i.variantId !== variantId));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lineItems.length === 0) { setError(t('addItemError')); return; }
    setError(null);

    const form = e.currentTarget;
    const fd = new FormData(form);

    const payload: CreateOrderPayload = {
      reference,
      customerName: fd.get('customerName') as string,
      customerPhone: fd.get('customerPhone') as string,
      wilaya: fd.get('wilaya') as string,
      commune: (fd.get('commune') as string) || undefined,
      address: (fd.get('address') as string) || undefined,
      codAmount: codTotal,
      items: lineItems.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
    };

    startTransition(async () => {
      try {
        await createManualOrder(payload);
        onClose();
      } catch (err) {
        setError(getError(err));
      }
    });
  }

  return (
      <ResponsiveSheet title={t('newOrder')} onClose={onClose}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <span className="text-sm font-semibold text-foreground">
                  {t('newOrder')}
              </span>

              <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onClose}
                  className="hidden sm:block text-muted-foreground hover:bg-transparent hover:text-foreground transition-colors"
              >
                  <X size={16} />
              </Button>
          </div>

          {/* Body */}
          <form
              id="create-order-form"
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto px-5 py-4 space-y-5"
          >
              {/* ── Customer ── */}
              <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                      {t('customer')}
                  </p>
                  <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                              <Label className="mb-1">{t('fullName')}</Label>
                              <Input
                                  name="customerName"
                                  required
                                  placeholder="Ahmed Benali"
                              />
                          </div>
                          <div>
                              <Label className="mb-1">{t('phone')}</Label>
                              <Input
                                  name="customerPhone"
                                  required
                                  placeholder="0770 000 000"
                              />
                          </div>
                      </div>
                      <div>
                          <Label className="mb-1">{t('wilayaLabel')}</Label>
                          <Select name="wilaya" required>
                              <SelectTrigger className="w-full">
                                  <SelectValue
                                      placeholder={t('selectWilaya')}
                                  />
                              </SelectTrigger>
                              <SelectContent>
                                  {WILAYAS.map((w) => (
                                      <SelectItem key={w} value={w}>
                                          {w}
                                      </SelectItem>
                                  ))}
                              </SelectContent>
                          </Select>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                              <Label className="mb-1">{t('commune')}</Label>
                              <Input name="commune" placeholder="Bab El Oued" />
                          </div>
                          <div>
                              <Label className="mb-1">{t('address')}</Label>
                              <Input
                                  name="address"
                                  placeholder="Rue Ibn Khaldoun"
                              />
                          </div>
                      </div>
                  </div>
              </div>

              {/* ── Items ── */}
              <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                      {t('items')}
                  </p>

                  {/* Variant search */}
                  <div className="relative mb-3">
                      <Search
                          size={13}
                          className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10"
                      />
                      <Input
                          value={search}
                          onChange={(e) => {
                              setSearch(e.target.value);
                              setShowPicker(true);
                          }}
                          onFocus={() => setShowPicker(true)}
                          className="ps-8 pe-3"
                          placeholder={t('searchProducts')}
                      />
                      {showPicker && filteredVariants.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                              {filteredVariants.map((v) => (
                                  <Button
                                      key={v.id}
                                      type="button"
                                      variant="ghost"
                                      onClick={() => addVariant(v)}
                                      className="h-auto w-full flex items-center justify-between whitespace-normal rounded-none px-3 py-2.5 hover:bg-muted transition-colors text-start border-b border-border last:border-0"
                                  >
                                      <div>
                                          <p className="text-xs font-medium text-foreground">
                                              {v.productName}
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                              {v.name}
                                              {v.sku && (
                                                  <span className="ms-1 font-mono text-muted-foreground">
                                                      {v.sku}
                                                  </span>
                                              )}
                                          </p>
                                      </div>
                                      <div className="text-end shrink-0 ms-3">
                                          <p className="text-xs font-medium text-foreground">
                                              {formatTND(v.price)}
                                          </p>
                                          <p
                                              className={`text-xs ${v.stockAvailable > 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                                          >
                                              {t('ready', {
                                                  count: v.stockAvailable
                                              })}
                                          </p>
                                      </div>
                                  </Button>
                              ))}
                          </div>
                      )}
                  </div>

                  {/* Line items */}
                  {lineItems.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">
                          {t('noItems')}
                      </p>
                  ) : (
                      <div className="rounded-lg border border-border overflow-hidden">
                          <Table className="text-xs">
                              <TableHeader>
                                  <TableRow className="bg-muted hover:bg-muted">
                                      <TableHead className="px-3 py-2 text-start font-medium text-muted-foreground h-auto">
                                          {t('colItem')}
                                      </TableHead>
                                      <TableHead className="px-3 py-2 text-end font-medium text-muted-foreground h-auto">
                                          {t('colPrice')}
                                      </TableHead>
                                      <TableHead className="px-3 py-2 text-end font-medium text-muted-foreground h-auto">
                                          {t('colQty')}
                                      </TableHead>
                                      <TableHead className="px-3 py-2 text-end font-medium text-muted-foreground h-auto">
                                          {t('colTotal')}
                                      </TableHead>
                                      <TableHead className="px-3 py-2 w-8 h-auto" />
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {lineItems.map((item) => (
                                      <TableRow
                                          key={item.variantId}
                                          className="border-t border-border"
                                      >
                                          <TableCell className="px-3 py-2 whitespace-normal">
                                              <p className="font-medium text-foreground">
                                                  {item.productName}
                                              </p>
                                              <p className="text-muted-foreground">
                                                  {item.variantName}
                                              </p>
                                          </TableCell>
                                          <TableCell className="px-3 py-2 text-end text-foreground tabular-nums">
                                              {formatTND(item.price)}
                                          </TableCell>
                                          <TableCell className="px-3 py-2 text-end">
                                              <Input
                                                  type="number"
                                                  min="1"
                                                  value={item.quantity}
                                                  onChange={(e) =>
                                                      updateQty(
                                                          item.variantId,
                                                          parseInt(
                                                              e.target.value,
                                                              10
                                                          )
                                                      )
                                                  }
                                                  className="w-14 h-auto px-2 py-1 text-xs text-end"
                                              />
                                          </TableCell>
                                          <TableCell className="px-3 py-2 text-end font-medium text-foreground tabular-nums">
                                              {formatTND(
                                                  item.price * item.quantity
                                              )}
                                          </TableCell>
                                          <TableCell className="px-3 py-2">
                                              <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="icon-xs"
                                                  onClick={() =>
                                                      removeItem(item.variantId)
                                                  }
                                                  className="text-muted-foreground hover:bg-transparent hover:text-red-500 transition-colors"
                                              >
                                                  <Trash2 size={13} />
                                              </Button>
                                          </TableCell>
                                      </TableRow>
                                  ))}
                              </TableBody>
                          </Table>
                      </div>
                  )}
              </div>

              {/* ── Review ── */}
              {lineItems.length > 0 && (
                  <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                          {t('review')}
                      </p>
                      <div className="rounded-lg border border-border bg-muted p-4 space-y-3">
                          <div>
                              <Label className="mb-1">
                                  {t('orderReference')}
                              </Label>
                              <Input
                                  value={reference}
                                  onChange={(e) => setReference(e.target.value)}
                                  placeholder="ORD-20260629-XXXX"
                              />
                          </div>
                          <div className="flex items-center justify-between pt-1 border-t border-border">
                              <span className="text-xs font-medium text-muted-foreground">
                                  {t('totalCod')}
                              </span>
                              <span className="text-base font-semibold text-foreground tabular-nums">
                                  {formatTND(codTotal)}
                              </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                              {t('codHint')}
                          </p>
                      </div>
                  </div>
              )}

              {error && (
                  <div className="flex gap-2 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 px-3 py-2 text-xs text-red-700 dark:text-red-400">
                      <AlertCircle size={14} className="shrink-0 mt-0.5" />
                      {error}
                  </div>
              )}
          </form>

          {/* Footer */}
          <div className="shrink-0 px-5 py-4 border-t border-border flex justify-end gap-2">
              <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  className="rounded-md border-border text-xs text-muted-foreground hover:bg-muted hover:text-muted-foreground transition-colors"
              >
                  {t('cancel')}
              </Button>
              <Button
                  type="submit"
                  size="sm"
                  form="create-order-form"
                  disabled={pending || lineItems.length === 0}
                  className="rounded-md text-xs font-medium disabled:opacity-40 transition-colors"
              >
                  {pending ? t('creating') : t('createOrder')}
              </Button>
          </div>
      </ResponsiveSheet>
  );
}

// ── Main client component ─────────────────────────────────────────────────────

export function OrdersClient({
  orders,
  variants,
}: {
  orders: Order[];
  variants: PickerVariant[];
}) {
  const t = useTranslations('orders');
  const ts = useTranslations('orderStatus');
  const [createOpen, setCreateOpen] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);

  const columns = [
    { key: 'colReference', label: t('colReference') },
    { key: 'colCustomer', label: t('colCustomer') },
    { key: 'colWilaya', label: t('colWilaya') },
    { key: 'colCodAmount', label: t('colCodAmount') },
    { key: 'colCourier', label: t('colCourier') },
    { key: 'colStatus', label: t('colStatus') },
    { key: 'colActions', label: '' },
  ];

  return (
      <>
          <div className="p-4 sm:p-6 lg:p-8">
              {/* Toolbar */}
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                      <h1 className="text-xl font-semibold text-foreground">
                          {t('title')}
                      </h1>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                          {t('count', { count: orders.length })}
                      </p>
                  </div>
                  <Button
                      size="sm"
                      onClick={() => setCreateOpen(true)}
                      className="flex items-center gap-1.5 rounded-md text-xs font-medium transition-colors"
                  >
                      <Plus size={13} />
                      {t('newOrder')}
                  </Button>
              </div>

              {/* Empty state */}
              {orders.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-card p-16 text-center">
                      <p className="text-sm font-medium text-foreground">
                          {t('emptyTitle')}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                          {t('emptyDesc')}
                      </p>
                      <Button
                          size="sm"
                          onClick={() => setCreateOpen(true)}
                          className="mt-4 inline-flex items-center gap-1.5 rounded-md text-xs font-medium transition-colors"
                      >
                          <Plus size={13} />
                          {t('createFirst')}
                      </Button>
                  </div>
              ) : (
                  /* Orders table */
                  <>
                      <div className="hidden sm:block rounded-lg border border-border bg-card overflow-x-auto">
                          <Table className="text-sm">
                              <TableHeader>
                                  <TableRow className="bg-muted border-b border-border hover:bg-muted">
                                      {columns.map((col) => (
                                          <TableHead
                                              key={col.key}
                                              className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wide last:w-20 h-auto"
                                          >
                                              {col.label}
                                          </TableHead>
                                      ))}
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {orders.map((order) => {
                                      return (
                                          <TableRow
                                              key={order.id}
                                              className="border-b border-border hover:bg-muted/50"
                                          >
                                              <TableCell className="px-4 py-3 font-mono text-xs text-foreground">
                                                  {order.reference}
                                              </TableCell>
                                              <TableCell className="px-4 py-3 text-sm text-foreground">
                                                  {order.customerName}
                                              </TableCell>
                                              <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                                                  {order.wilaya}
                                              </TableCell>
                                              <TableCell className="px-4 py-3 text-sm text-foreground tabular-nums">
                                                  {formatTND(order.codAmount)}
                                              </TableCell>
                                              <TableCell className="px-4 py-3 text-xs text-muted-foreground">
                                                  {order.shipment?.courier ??
                                                      '—'}
                                              </TableCell>
                                              <TableCell className="px-4 py-3">
                                                  <span
                                                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${orderStatusClasses(order.status)}`}
                                                  >
                                                      {ts(order.status)}
                                                  </span>
                                              </TableCell>
                                              <TableCell className="px-4 py-3 text-end">
                                                  {order.status ===
                                                      'PENDING_FULFILLMENT' && (
                                                      <Button
                                                          variant="link"
                                                          onClick={() =>
                                                              setCancellingOrder(
                                                                  order
                                                              )
                                                          }
                                                          className="h-auto p-0 text-xs text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:no-underline transition-colors"
                                                      >
                                                          {t('cancel')}
                                                      </Button>
                                                  )}
                                              </TableCell>
                                          </TableRow>
                                      );
                                  })}
                              </TableBody>
                          </Table>
                      </div>

                      {/* Phone card list (below sm) */}
                      <div className="sm:hidden space-y-3">
                          {orders.map((order) => (
                              <div
                                  key={order.id}
                                  className="rounded-lg border border-border bg-card p-4"
                              >
                                  <div className="flex items-start justify-between gap-2">
                                      <span className="font-mono text-xs text-foreground break-all">
                                          {order.reference}
                                      </span>
                                      <span
                                          className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium ${orderStatusClasses(order.status)}`}
                                      >
                                          {ts(order.status)}
                                      </span>
                                  </div>
                                  <dl className="mt-3 space-y-1.5">
                                      <div className="flex items-center justify-between gap-2">
                                          <dt className="text-xs text-muted-foreground">
                                              {t('colCustomer')}
                                          </dt>
                                          <dd className="text-sm text-foreground text-end break-words">
                                              {order.customerName}
                                          </dd>
                                      </div>
                                      <div className="flex items-center justify-between gap-2">
                                          <dt className="text-xs text-muted-foreground">
                                              {t('colWilaya')}
                                          </dt>
                                          <dd className="text-sm text-muted-foreground text-end">
                                              {order.wilaya}
                                          </dd>
                                      </div>
                                      <div className="flex items-center justify-between gap-2">
                                          <dt className="text-xs text-muted-foreground">
                                              {t('colCodAmount')}
                                          </dt>
                                          <dd className="text-sm text-foreground tabular-nums text-end">
                                              {formatTND(order.codAmount)}
                                          </dd>
                                      </div>
                                      <div className="flex items-center justify-between gap-2">
                                          <dt className="text-xs text-muted-foreground">
                                              {t('colCourier')}
                                          </dt>
                                          <dd className="text-xs text-muted-foreground text-end">
                                              {order.shipment?.courier ?? '—'}
                                          </dd>
                                      </div>
                                  </dl>
                                  {order.status === 'PENDING_FULFILLMENT' && (
                                      <div className="mt-3 flex justify-end border-t border-border pt-3">
                                          <Button
                                              variant="link"
                                              onClick={() =>
                                                  setCancellingOrder(order)
                                              }
                                              className="h-auto p-0 text-xs text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:no-underline transition-colors"
                                          >
                                              {t('cancel')}
                                          </Button>
                                      </div>
                                  )}
                              </div>
                          ))}
                      </div>
                  </>
              )}
          </div>

          {/* Modals */}
          {cancellingOrder && (
              <CancelModal
                  order={cancellingOrder}
                  onClose={() => setCancellingOrder(null)}
              />
          )}
          {createOpen && (
              <CreateOrderSheet
                  variants={variants}
                  onClose={() => setCreateOpen(false)}
              />
          )}
      </>
  );
}
