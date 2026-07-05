'use client';

import { useState, useTransition,  } from 'react';
import { Plus, X, Search, Trash2, AlertCircle } from 'lucide-react';
import { createManualOrder, cancelOrder, type CreateOrderPayload } from './actions';
import { formatTND } from '@/lib/format';
import { ORDER_STATUS, type OrderStatus } from '@/lib/order-status';

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

const WILAYAS = [
  'Adrar', 'Chlef', 'Laghouat', 'Oum El Bouaghi', 'Batna', 'Béjaïa', 'Biskra',
  'Béchar', 'Blida', 'Bouira', 'Tamanrasset', 'Tébessa', 'Tlemcen', 'Tiaret',
  'Tizi Ouzou', 'Alger', 'Djelfa', 'Jijel', 'Sétif', 'Saïda', 'Skikda',
  'Sidi Bel Abbès', 'Annaba', 'Guelma', 'Constantine', 'Médéa', 'Mostaganem',
  "M'Sila", 'Mascara', 'Ouargla', 'Oran', 'El Bayadh', 'Illizi',
  'Bordj Bou Arréridj', 'Boumerdès', 'El Tarf', 'Tindouf', 'Tissemsilt',
  'El Oued', 'Khenchela', 'Souk Ahras', 'Tipaza', 'Mila', 'Aïn Defla',
  'Naâma', 'Aïn Témouchent', 'Ghardaïa', 'Relizane', 'Timimoun',
  'Bordj Badji Mokhtar', 'Ouled Djellal', 'Béni Abbès', 'In Salah',
  'In Guezzam', 'Touggourt', 'Djanet', "El M'Ghair", 'El Meniaa',
];

// ── Shared styles ─────────────────────────────────────────────────────────────

const INPUT =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:opacity-50';
const LABEL = 'block text-xs font-medium text-slate-600 mb-1';


function generateRef() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${date}-${rand}`;
}

// ── Modal overlay ─────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-lg border border-slate-200 shadow-lg w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

// ── Cancel confirm modal ──────────────────────────────────────────────────────

function CancelModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCancel() {
    startTransition(async () => {
      try {
        await cancelOrder(order.id);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to cancel order');
      }
    });
  }

  return (
    <Modal title="Cancel order" onClose={onClose}>
      <p className="text-sm text-slate-600 mb-4">
        Cancel order <span className="font-mono font-medium text-slate-900">{order.reference}</span>?
        Stock reserved for this order will be released back to &ldquo;Ready to Sell.&rdquo;
      </p>
      {error && (
        <div className="mb-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</div>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-md border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors">
          Keep order
        </button>
        <button type="button" onClick={handleCancel} disabled={pending} className="px-3 py-1.5 rounded-md bg-red-600 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
          {pending ? 'Cancelling…' : 'Cancel order'}
        </button>
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
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState(generateRef);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [search, setSearch] = useState('');
  const [showPicker, setShowPicker] = useState(false);

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
    if (lineItems.length === 0) { setError('Add at least one item to the order.'); return; }
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
        setError(err instanceof Error ? err.message : 'Failed to create order');
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <button className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-lg bg-white border-l border-slate-200 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-sm font-semibold text-slate-900">New order</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form id="create-order-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* ── Customer ── */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Customer</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Full name *</label>
                  <input name="customerName" required className={INPUT} placeholder="Ahmed Benali" />
                </div>
                <div>
                  <label className={LABEL}>Phone *</label>
                  <input name="customerPhone" required className={INPUT} placeholder="0770 000 000" />
                </div>
              </div>
              <div>
                <label className={LABEL}>Wilaya *</label>
                <select name="wilaya" required className={INPUT}>
                  <option value="">— select wilaya —</option>
                  {WILAYAS.map((w) => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Commune</label>
                  <input name="commune" className={INPUT} placeholder="Bab El Oued" />
                </div>
                <div>
                  <label className={LABEL}>Address</label>
                  <input name="address" className={INPUT} placeholder="Rue Ibn Khaldoun" />
                </div>
              </div>
            </div>
          </div>

          {/* ── Items ── */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Items</p>

            {/* Variant search */}
            <div className="relative mb-3">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setShowPicker(true); }}
                onFocus={() => setShowPicker(true)}
                className="w-full rounded-md border border-slate-300 bg-white pl-8 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                placeholder="Search by product name or SKU…"
              />
              {showPicker && filteredVariants.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                  {filteredVariants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => addVariant(v)}
                      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 transition-colors text-left border-b border-slate-100 last:border-0"
                    >
                      <div>
                        <p className="text-xs font-medium text-slate-800">{v.productName}</p>
                        <p className="text-xs text-slate-500">{v.name}{v.sku && <span className="ml-1 font-mono text-slate-400">{v.sku}</span>}</p>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="text-xs font-medium text-slate-700">{formatTND(v.price)}</p>
                        <p className={`text-xs ${v.stockAvailable > 0 ? 'text-green-700' : 'text-red-600'}`}>
                          {v.stockAvailable} ready
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Line items */}
            {lineItems.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-lg">
                No items yet — search above to add products.
              </p>
            ) : (
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-3 py-2 text-left font-medium text-slate-500">Item</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-500">Price</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-500">Qty</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-500">Total</th>
                      <th className="px-3 py-2 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item) => (
                      <tr key={item.variantId} className="border-t border-slate-100">
                        <td className="px-3 py-2">
                          <p className="font-medium text-slate-800">{item.productName}</p>
                          <p className="text-slate-500">{item.variantName}</p>
                        </td>
                        <td className="px-3 py-2 text-right text-slate-700 tabular-nums">{formatTND(item.price)}</td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateQty(item.variantId, parseInt(e.target.value, 10))}
                            className="w-14 rounded border border-slate-300 px-2 py-1 text-xs text-right text-slate-900 focus:border-slate-500 focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-slate-800 tabular-nums">
                          {formatTND(item.price * item.quantity)}
                        </td>
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => removeItem(item.variantId)} className="text-slate-300 hover:text-red-500 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Review ── */}
          {lineItems.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Review</p>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div>
                  <label className={LABEL}>Order reference</label>
                  <input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className={INPUT}
                    placeholder="ORD-20260629-XXXX"
                  />
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                  <span className="text-xs font-medium text-slate-600">Total COD amount</span>
                  <span className="text-base font-semibold text-slate-900 tabular-nums">{formatTND(codTotal)}</span>
                </div>
                <p className="text-xs text-slate-400">
                  This amount will be collected from the customer upon delivery.
                  Stock will be reserved immediately after creating this order.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="shrink-0 px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-md border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button
            type="submit"
            form="create-order-form"
            disabled={pending || lineItems.length === 0}
            className="px-4 py-1.5 rounded-md bg-green-900 text-xs font-medium text-white hover:bg-green-800 disabled:opacity-40 transition-colors"
          >
            {pending ? 'Creating…' : 'Create order'}
          </button>
        </div>
      </div>
    </div>
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
  const [createOpen, setCreateOpen] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);

  return (
    <>
      <div className="p-8">
        {/* Toolbar */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Orders</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {orders.length} order{orders.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 rounded-md bg-green-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800 transition-colors"
          >
            <Plus size={13} />
            New order
          </button>
        </div>

        {/* Empty state */}
        {orders.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white p-16 text-center">
            <p className="text-sm font-medium text-slate-700">No orders yet</p>
            <p className="mt-1 text-xs text-slate-400">
              Create your first order to start tracking your COD pipeline and reserve stock.
            </p>
            <button
              onClick={() => setCreateOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-green-900 px-4 py-2 text-xs font-medium text-white hover:bg-green-800 transition-colors"
            >
              <Plus size={13} />
              Create first order
            </button>
          </div>
        ) : (
          /* Orders table */
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Reference', 'Customer', 'Wilaya', 'COD Amount', 'Courier', 'Status', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide last:w-20">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const cfg = ORDER_STATUS[order.status] ?? ORDER_STATUS.PENDING_FULFILLMENT;
                  return (
                    <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">{order.reference}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{order.customerName}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{order.wilaya}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 tabular-nums">{formatTND(order.codAmount)}</td>
                      <td className="px-4 py-3 text-xs text-slate-400">{order.shipment?.courier ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.classes}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {order.status === 'PENDING_FULFILLMENT' && (
                          <button
                            onClick={() => setCancellingOrder(order)}
                            className="text-xs text-slate-400 hover:text-red-600 transition-colors"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {cancellingOrder && (
        <CancelModal order={cancellingOrder} onClose={() => setCancellingOrder(null)} />
      )}
      {createOpen && (
        <CreateOrderSheet variants={variants} onClose={() => setCreateOpen(false)} />
      )}
    </>
  );
}
