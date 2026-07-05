'use client';

import { useTransition, useState, useRef } from 'react';
import { Plus, Pencil, Trash2, SlidersHorizontal, Upload, X, AlertTriangle } from 'lucide-react';
import {
  createProduct, updateProduct, deleteProduct,
  createVariant, updateVariant, deleteVariant,
  adjustStock, bulkCreateProducts,
} from './actions';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

// ── Types ─────────────────────────────────────────────────────────────────────

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

interface CsvRow {
  rowNum: number;
  name: string;
  sku: string;
  variantName: string;
  price: number;
  stockPhysical: number;
  errors: string[];
}

// ── CSV parser ────────────────────────────────────────────────────────────────

function parseCSV(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const firstLine = lines[0]!;
  const sep = firstLine.includes(';') ? ';' : ',';
  const headers = firstLine.split(sep).map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));

  return lines.slice(1).map((line, idx) => {
    const vals = line.split(sep).map((v) => v.trim().replace(/^"|"$/g, ''));
    const col = (key: string) => vals[headers.indexOf(key)] ?? '';

    const name = col('name') || col('product_name');
    const sku = col('sku') || col('product_sku');
    const variantName = col('variant_name') || col('variant');
    const priceRaw = col('price');
    const stockRaw = col('stock_physical') || col('stock') || col('quantity');
    const price = parseFloat(priceRaw);
    const stockPhysical = parseInt(stockRaw, 10) || 0;

    const errors: string[] = [];
    if (!name) errors.push('Product name required');
    if (!priceRaw || isNaN(price) || price < 0) errors.push('Valid price required');

    return { rowNum: idx + 2, name, sku, variantName, price: isNaN(price) ? 0 : price, stockPhysical, errors };
  });
}

// ── Shared field styles ───────────────────────────────────────────────────────

const INPUT = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:opacity-50';
const LABEL = 'block text-xs font-medium text-slate-600 mb-1';

// ── Modal overlay ─────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
  width = 'max-w-md',
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent showCloseButton={false} className={`bg-white border-slate-200 shadow-lg p-0 gap-0 ${width} max-h-[90vh] overflow-y-auto`}>
        <DialogHeader className="flex-row items-center justify-between space-y-0 px-5 py-4 border-b border-slate-100">
          <DialogTitle className="text-sm font-semibold text-slate-900">{title}</DialogTitle>
          <Button variant="ghost" size="icon-sm" onClick={onClose} className="text-slate-400 hover:bg-transparent hover:text-slate-700 transition-colors">
            <X size={16} />
          </Button>
        </DialogHeader>
        <div className="px-5 py-4">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

// ── Reusable form error ───────────────────────────────────────────────────────

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 mb-3">
      {message}
    </div>
  );
}

// ── Add / Edit Product modal ──────────────────────────────────────────────────

function ProductModal({
  product,
  onClose,
}: {
  product?: Product;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!product;

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        if (isEdit) await updateProduct(product.id, formData);
        else await createProduct(formData);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      }
    });
  }

  return (
    <Modal title={isEdit ? 'Edit product' : 'Add product'} onClose={onClose}>
      <FormError message={error} />
      <form action={handleSubmit} className="space-y-3">
        <div>
          <label className={LABEL}>Product name *</label>
          <input name="name" required defaultValue={product?.name} className={INPUT} placeholder="Blue Tshirt" />
        </div>
        <div>
          <label className={LABEL}>SKU</label>
          <input name="sku" defaultValue={product?.sku ?? ''} className={INPUT} placeholder="TSH-001" />
        </div>
        <div>
          <label className={LABEL}>Description</label>
          <input name="description" defaultValue={product?.description ?? ''} className={INPUT} placeholder="Optional notes" />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="rounded-md border-slate-200 text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-600 transition-colors">
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={pending} className="rounded-md text-xs font-medium disabled:opacity-50 transition-colors">
            {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Add product'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Add / Edit Variant modal ──────────────────────────────────────────────────

function VariantModal({
  productId,
  variant,
  onClose,
}: {
  productId: string;
  variant?: Variant;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!variant;

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        if (isEdit) await updateVariant(variant.id, formData);
        else await createVariant(productId, formData);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      }
    });
  }

  return (
    <Modal title={isEdit ? 'Edit variant' : 'Add variant'} onClose={onClose}>
      <FormError message={error} />
      <form action={handleSubmit} className="space-y-3">
        <div>
          <label className={LABEL}>Variant name * (e.g. "Blue / XL")</label>
          <input name="name" required defaultValue={variant?.name} className={INPUT} placeholder="Blue / XL" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Color</label>
            <input name="color" defaultValue={variant?.name?.split(' / ')[0] ?? ''} className={INPUT} placeholder="Blue" />
          </div>
          <div>
            <label className={LABEL}>Size</label>
            <input name="size" defaultValue={variant?.name?.split(' / ')[1] ?? ''} className={INPUT} placeholder="XL" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>SKU</label>
            <input name="sku" defaultValue={variant?.sku ?? ''} className={INPUT} placeholder="TSH-001-BL-XL" />
          </div>
          <div>
            <label className={LABEL}>Price (DZD) *</label>
            <input name="price" type="number" min="0" step="0.01" required defaultValue={variant?.price ?? ''} className={INPUT} placeholder="1500" />
          </div>
        </div>
        {!isEdit && (
          <div>
            <label className={LABEL}>Initial warehouse count</label>
            <input name="stockPhysical" type="number" min="0" defaultValue={0} className={INPUT} placeholder="0" />
            <p className="mt-1 text-xs text-slate-400">How many units are in your warehouse right now?</p>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="rounded-md border-slate-200 text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-600 transition-colors">
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={pending} className="rounded-md text-xs font-medium disabled:opacity-50 transition-colors">
            {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Add variant'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Adjust Stock modal ────────────────────────────────────────────────────────

function AdjustStockModal({ variant, onClose }: { variant: Variant; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await adjustStock(variant.id, formData);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      }
    });
  }

  return (
    <Modal title="Adjust warehouse count" onClose={onClose}>
      <p className="text-xs text-slate-500 mb-3">
        Current count for <span className="font-medium text-slate-700">{variant.name}</span>:{' '}
        <span className="font-semibold text-slate-900">{variant.stockPhysical}</span> in warehouse
      </p>
      <FormError message={error} />
      <form action={handleSubmit} className="space-y-3">
        <div>
          <label className={LABEL}>Adjustment (+/−)</label>
          <input
            name="physicalDelta"
            type="number"
            required
            className={INPUT}
            placeholder="e.g. +10 to add, -3 to remove"
          />
          <p className="mt-1 text-xs text-slate-400">
            Use a positive number to add units (restock), negative to remove (damage / loss).
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="rounded-md border-slate-200 text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-600 transition-colors">
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={pending} className="rounded-md text-xs font-medium disabled:opacity-50 transition-colors">
            {pending ? 'Applying…' : 'Apply adjustment'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Delete confirm modal ──────────────────────────────────────────────────────

function DeleteModal({
  label,
  onConfirm,
  onClose,
}: {
  label: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    startTransition(async () => {
      try {
        await onConfirm();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      }
    });
  }

  return (
    <Modal title="Archive item" onClose={onClose}>
      <p className="text-sm text-slate-600 mb-4">
        Archive <span className="font-medium text-slate-900">{label}</span>? It will no longer appear
        in your inventory. This action can be undone by contacting support.
      </p>
      <FormError message={error} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose} className="rounded-md border-slate-200 text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-600 transition-colors">
          Cancel
        </Button>
        <Button type="button" variant="destructive" size="sm" onClick={handleConfirm} disabled={pending} className="rounded-md bg-red-600 text-xs font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">
          {pending ? 'Archiving…' : 'Archive'}
        </Button>
      </div>
    </Modal>
  );
}

// ── Sync-warning modal (User A guardrail) ─────────────────────────────────────

function SyncWarningModal({
  storeType,
  label,
  onProceed,
  onClose,
}: {
  storeType: string;
  label: string;
  onProceed: () => void;
  onClose: () => void;
}) {
  const platform = storeType === 'WOOCOMMERCE' ? 'WooCommerce' : 'Shopify';
  return (
    <Modal title="Heads up — this item is synced" onClose={onClose}>
      <div className="flex gap-3 mb-4">
        <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
        <p className="text-sm text-slate-600">
          <span className="font-medium text-slate-900">{label}</span> is connected to your{' '}
          <span className="font-medium">{platform}</span> storefront. Editing it here may break
          your store&apos;s automation. We recommend making changes inside{' '}
          <span className="font-medium">{platform}</span> instead.
        </p>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose} className="rounded-md border-slate-200 text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-600 transition-colors">
          Cancel
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => { onProceed(); onClose(); }}
          className="rounded-md border-amber-300 bg-amber-50 text-xs font-medium text-amber-800 hover:bg-amber-100 hover:text-amber-800 transition-colors"
        >
          Proceed anyway
        </Button>
      </div>
    </Modal>
  );
}

// ── Bulk Import panel ─────────────────────────────────────────────────────────

function BulkImportPanel({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setRows(parseCSV(ev.target?.result as string));
    };
    reader.readAsText(file);
  }

  const validRows = rows.filter((r) => r.errors.length === 0);
  const errorCount = rows.filter((r) => r.errors.length > 0).length;

  function handleImport() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await bulkCreateProducts(
          validRows.map((r) => ({
            name: r.name,
            sku: r.sku || undefined,
            variantName: r.variantName || undefined,
            price: r.price,
            stockPhysical: r.stockPhysical,
          })),
        );
        setResult(res);
        setRows([]);
        if (fileRef.current) fileRef.current.value = '';
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Import failed');
      }
    });
  }

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full max-w-lg bg-white border-slate-200 flex flex-col h-full p-0 gap-0 overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <SheetTitle className="text-sm font-semibold text-slate-900">Bulk import products</SheetTitle>
          <Button variant="ghost" size="icon-sm" onClick={onClose} className="text-slate-400 hover:bg-transparent hover:text-slate-700 transition-colors">
            <X size={16} />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Template info */}
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
            <p className="text-xs font-medium text-slate-700 mb-2">Expected CSV format</p>
            <code className="block text-xs text-slate-500 whitespace-pre-wrap font-mono bg-white border border-slate-200 rounded p-2">
              {`name,sku,variant_name,price,stock_physical\nBlue Tshirt,TSH-001,Blue / M,1500,10\nBlue Tshirt,TSH-001,Blue / L,1500,5`}
            </code>
            <p className="mt-2 text-xs text-slate-400">
              Columns <span className="font-mono">name</span> and{' '}
              <span className="font-mono">price</span> are required. Others are optional.
              Semicolons also accepted.
            </p>
          </div>

          {/* File input */}
          <div>
            <label className={LABEL}>Upload CSV or Excel (saved as CSV)</label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFile}
              className="w-full text-xs text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-200 transition-colors"
            />
          </div>

          {/* Success banner */}
          {result && (
            <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
              Import complete — <strong>{result.created}</strong> products created,{' '}
              <strong>{result.skipped}</strong> skipped (existing SKUs).
            </div>
          )}

          <FormError message={error} />

          {/* Preview table */}
          {rows.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-slate-700">{rows.length} rows parsed</p>
                {errorCount > 0 && (
                  <span className="text-xs text-red-600 font-medium">{errorCount} with errors (will be skipped)</span>
                )}
              </div>
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50">
                      {['#', 'Name', 'SKU', 'Price', 'In Warehouse', ''].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-medium text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.rowNum}
                        className={row.errors.length > 0 ? 'bg-red-50' : 'bg-white'}
                      >
                        <td className="px-3 py-2 text-slate-400">{row.rowNum}</td>
                        <td className="px-3 py-2 text-slate-700">{row.name || <span className="text-red-500">—</span>}</td>
                        <td className="px-3 py-2 text-slate-400 font-mono">{row.sku || '—'}</td>
                        <td className="px-3 py-2 text-slate-700">{row.price > 0 ? row.price : <span className="text-red-500">—</span>}</td>
                        <td className="px-3 py-2 text-slate-700">{row.stockPhysical}</td>
                        <td className="px-3 py-2">
                          {row.errors.length > 0 && (
                            <span className="text-red-500">{row.errors.join(', ')}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="rounded-md border-slate-200 text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-600 transition-colors">
            Close
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleImport}
            disabled={validRows.length === 0 || pending}
            className="rounded-md text-xs font-medium disabled:opacity-40 transition-colors"
          >
            {pending ? 'Importing…' : `Import ${validRows.length} product${validRows.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Main client component ─────────────────────────────────────────────────────

export function InventoryClient({
  products,
  storeType,
}: {
  products: Product[];
  storeType: string;
}) {
  // Modal state
  const [addProduct, setAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [addVariantFor, setAddVariantFor] = useState<Product | null>(null);
  const [editingVariant, setEditingVariant] = useState<{ variant: Variant; productId: string } | null>(null);
  const [deletingVariant, setDeletingVariant] = useState<Variant | null>(null);
  const [adjustingVariant, setAdjustingVariant] = useState<Variant | null>(null);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [syncWarning, setSyncWarning] = useState<{ label: string; action: () => void } | null>(null);

  // Guard for User A sync-connected stores
  function guarded(label: string, action: () => void) {
    if (storeType !== 'MANUAL') setSyncWarning({ label, action });
    else action();
  }

  const totalVariants = products.reduce((s, p) => s + p.variants.length, 0);
  const lowStock = products.reduce((s, p) => s + p.variants.filter((v) => v.stockAvailable === 0).length, 0);

  return (
    <>
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="p-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Inventory</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {products.length} product{products.length !== 1 ? 's' : ''} · {totalVariants} variant{totalVariants !== 1 ? 's' : ''}
              {lowStock > 0 && (
                <span className="ml-2 text-red-600 font-medium">{lowStock} out of stock</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkImportOpen(true)}
              className="flex items-center gap-1.5 rounded-md border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-600 transition-colors"
            >
              <Upload size={13} />
              Bulk import
            </Button>
            <Button
              size="sm"
              onClick={() => setAddProduct(true)}
              className="flex items-center gap-1.5 rounded-md text-xs font-medium transition-colors"
            >
              <Plus size={13} />
              Add product
            </Button>
          </div>
        </div>

        {/* ── Empty state ──────────────────────────────────────────────────── */}
        {products.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white p-16 text-center">
            <p className="text-sm font-medium text-slate-700">Your inventory is empty</p>
            <p className="mt-1 text-xs text-slate-400">
              Add your first product to start tracking stock and fulfilling orders.
            </p>
            <Button
              size="sm"
              onClick={() => setAddProduct(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-md text-xs font-medium transition-colors"
            >
              <Plus size={13} />
              Add your first product
            </Button>
          </div>
        ) : (
          /* ── Inventory table ──────────────────────────────────────────────── */
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Product / Variant</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">SKU</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">In Warehouse</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">Committed / Packed</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">Ready to Sell</th>
                  <th className="px-4 py-3 w-28" />
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <>
                    {/* Product row */}
                    <tr key={`p-${product.id}`} className="border-b border-slate-100 bg-slate-50/60">
                      <td colSpan={5} className="px-4 py-2.5">
                        <span className="text-sm font-medium text-slate-800">{product.name}</span>
                        {product.sku && <span className="ml-2 text-xs text-slate-400 font-mono">{product.sku}</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            title="Add variant"
                            onClick={() => setAddVariantFor(product)}
                            className="rounded text-slate-400 hover:text-green-800 hover:bg-green-50 transition-colors"
                          >
                            <Plus size={13} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            title="Edit product"
                            onClick={() => guarded(product.name, () => setEditingProduct(product))}
                            className="rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                          >
                            <Pencil size={13} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            title="Archive product"
                            onClick={() => guarded(product.name, () => setDeletingProduct(product))}
                            className="rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </td>
                    </tr>

                    {/* Variant rows */}
                    {product.variants.map((variant) => (
                      <tr key={variant.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="pl-8 pr-4 py-2.5 text-sm text-slate-600">{variant.name}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-400 font-mono">{variant.sku ?? '—'}</td>
                        <td className="px-4 py-2.5 text-right text-sm text-slate-700 tabular-nums">{variant.stockPhysical}</td>
                        <td className="px-4 py-2.5 text-right text-sm text-slate-700 tabular-nums">{variant.stockReserved}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={`tabular-nums text-sm font-medium ${variant.stockAvailable > 0 ? 'text-green-800' : 'text-red-600'}`}>
                            {variant.stockAvailable}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              title="Adjust stock"
                              onClick={() => setAdjustingVariant(variant)}
                              className="rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            >
                              <SlidersHorizontal size={13} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              title="Edit variant"
                              onClick={() => guarded(variant.name, () => setEditingVariant({ variant, productId: product.id }))}
                              className="rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            >
                              <Pencil size={13} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              title="Archive variant"
                              onClick={() => guarded(variant.name, () => setDeletingVariant(variant))}
                              className="rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 size={13} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {product.variants.length === 0 && (
                      <tr key={`empty-${product.id}`}>
                        <td colSpan={6} className="pl-8 px-4 py-2.5 text-xs text-slate-400 italic border-b border-slate-100">
                          No variants — <Button variant="link" onClick={() => setAddVariantFor(product)} className="h-auto p-0 text-xs text-slate-400 underline hover:text-slate-600">add one</Button>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}

      {addProduct && <ProductModal onClose={() => setAddProduct(false)} />}

      {editingProduct && (
        <ProductModal product={editingProduct} onClose={() => setEditingProduct(null)} />
      )}

      {deletingProduct && (
        <DeleteModal
          label={deletingProduct.name}
          onConfirm={() => deleteProduct(deletingProduct.id)}
          onClose={() => setDeletingProduct(null)}
        />
      )}

      {addVariantFor && (
        <VariantModal productId={addVariantFor.id} onClose={() => setAddVariantFor(null)} />
      )}

      {editingVariant && (
        <VariantModal
          productId={editingVariant.productId}
          variant={editingVariant.variant}
          onClose={() => setEditingVariant(null)}
        />
      )}

      {deletingVariant && (
        <DeleteModal
          label={deletingVariant.name}
          onConfirm={() => deleteVariant(deletingVariant.id)}
          onClose={() => setDeletingVariant(null)}
        />
      )}

      {adjustingVariant && (
        <AdjustStockModal variant={adjustingVariant} onClose={() => setAdjustingVariant(null)} />
      )}

      {syncWarning && (
        <SyncWarningModal
          storeType={storeType}
          label={syncWarning.label}
          onProceed={syncWarning.action}
          onClose={() => setSyncWarning(null)}
        />
      )}

      {bulkImportOpen && <BulkImportPanel onClose={() => setBulkImportOpen(false)} />}
    </>
  );
}
