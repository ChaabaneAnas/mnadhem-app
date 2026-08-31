'use client';

import { useTransition, useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Pencil, Trash2, SlidersHorizontal, Upload, X, AlertTriangle } from 'lucide-react';
import {
  createProduct, updateProduct, deleteProduct,
  createVariant, updateVariant, deleteVariant,
  adjustStock, bulkCreateProducts,
} from './actions';
import { useErrorMessage } from '@/lib/api-error';
import { Button } from '@/components/ui/button';
import {
    ResponsiveModal,
    ResponsiveSheet
} from '@/components/ui/responsive-modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
  variantSku: string;
  price: number;
  stockPhysical: number;
  /** Message-catalog keys under the `inventory` namespace (translated at render). */
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
    const variantSku = col('variant_sku') || col('variantsku');
    const priceRaw = col('price');
    const stockRaw = col('stock_physical') || col('stock') || col('quantity');
    const price = parseFloat(priceRaw);
    const stockPhysical = parseInt(stockRaw, 10) || 0;

    const errors: string[] = [];
    if (!name) errors.push('csvErrProductName');
    if (!priceRaw || isNaN(price) || price < 0) errors.push('csvErrPrice');

    return { rowNum: idx + 2, name, sku, variantName, variantSku, price: isNaN(price) ? 0 : price, stockPhysical, errors };
  });
}

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
      <ResponsiveModal title={title} onClose={onClose} width={width}>
          {children}
      </ResponsiveModal>
  );
}

// ── Reusable form error ───────────────────────────────────────────────────────

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 px-3 py-2 text-xs text-red-700 dark:text-red-400 mb-3">
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
  const t = useTranslations('inventory');
  const tc = useTranslations('common');
  const getError = useErrorMessage();
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
        setError(getError(err));
      }
    });
  }

  return (
    <Modal title={isEdit ? t('productModalEdit') : t('productModalAdd')} onClose={onClose}>
      <FormError message={error} />
      <form action={handleSubmit} className="space-y-3">
        <div>
          <Label className="mb-1">{t('productName')}</Label>
          <Input name="name" required defaultValue={product?.name} placeholder="Blue Tshirt" />
        </div>
        <div>
          <Label className="mb-1">{t('skuLabel')}</Label>
          <Input name="sku" defaultValue={product?.sku ?? ''} placeholder="TSH-001" />
        </div>
        <div>
          <Label className="mb-1">{t('description')}</Label>
          <Input name="description" defaultValue={product?.description ?? ''} placeholder={t('descriptionPlaceholder')} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="rounded-md border-border text-xs text-muted-foreground hover:bg-muted hover:text-muted-foreground transition-colors">
            {tc('cancel')}
          </Button>
          <Button type="submit" size="sm" disabled={pending} className="rounded-md text-xs font-medium disabled:opacity-50 transition-colors">
            {pending ? tc('saving') : isEdit ? tc('saveChanges') : t('addProductBtn')}
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
  const t = useTranslations('inventory');
  const tc = useTranslations('common');
  const getError = useErrorMessage();
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
        setError(getError(err));
      }
    });
  }

  return (
      <Modal
          title={isEdit ? t('variantModalEdit') : t('variantModalAdd')}
          onClose={onClose}
      >
          <FormError message={error} />
          <form action={handleSubmit} className="space-y-3">
              <div>
                  <Label className="mb-1">{t('variantName')}</Label>
                  <Input
                      name="name"
                      required
                      defaultValue={variant?.name}
                      placeholder="Blue / XL"
                  />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                      <Label className="mb-1">{t('color')}</Label>
                      <Input
                          name="color"
                          defaultValue={variant?.name?.split(' / ')[0] ?? ''}
                          placeholder="Blue"
                      />
                  </div>
                  <div>
                      <Label className="mb-1">{t('size')}</Label>
                      <Input
                          name="size"
                          defaultValue={variant?.name?.split(' / ')[1] ?? ''}
                          placeholder="XL"
                      />
                  </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                      <Label className="mb-1">{t('skuLabel')}</Label>
                      <Input
                          name="sku"
                          defaultValue={variant?.sku ?? ''}
                          placeholder="TSH-001-BL-XL"
                      />
                      {!isEdit && (
                          <p className="mt-1 text-xs text-muted-foreground">
                              {t('skuGenerateHint')}
                          </p>
                      )}
                  </div>
                  <div>
                      <Label className="mb-1">{t('priceLabel')}</Label>
                      <Input
                          name="price"
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          defaultValue={variant?.price ?? ''}
                          placeholder="1500"
                      />
                  </div>
              </div>
              {!isEdit && (
                  <div>
                      <Label className="mb-1">{t('initialCount')}</Label>
                      <Input
                          name="stockPhysical"
                          type="number"
                          min="0"
                          defaultValue={0}
                          placeholder="0"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                          {t('initialCountHint')}
                      </p>
                  </div>
              )}
              <div className="flex justify-end gap-2 pt-1">
                  <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onClose}
                      className="rounded-md border-border text-xs text-muted-foreground hover:bg-muted hover:text-muted-foreground transition-colors"
                  >
                      {tc('cancel')}
                  </Button>
                  <Button
                      type="submit"
                      size="sm"
                      disabled={pending}
                      className="rounded-md text-xs font-medium disabled:opacity-50 transition-colors"
                  >
                      {pending
                          ? tc('saving')
                          : isEdit
                            ? tc('saveChanges')
                            : t('addVariantBtn')}
                  </Button>
              </div>
          </form>
      </Modal>
  );
}

// ── Adjust Stock modal ────────────────────────────────────────────────────────

function AdjustStockModal({ variant, onClose }: { variant: Variant; onClose: () => void }) {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');
  const getError = useErrorMessage();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await adjustStock(variant.id, formData);
        onClose();
      } catch (err) {
        setError(getError(err));
      }
    });
  }

  return (
    <Modal title={t('adjustTitle')} onClose={onClose}>
      <p className="text-xs text-muted-foreground mb-3">
        {t('currentCount', { name: variant.name, count: variant.stockPhysical })}
      </p>
      <FormError message={error} />
      <form action={handleSubmit} className="space-y-3">
        <div>
          <Label className="mb-1">{t('adjustment')}</Label>
          <Input
            name="physicalDelta"
            type="number"
            required
            placeholder={t('adjustmentPlaceholder')}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {t('adjustmentHint')}
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="rounded-md border-border text-xs text-muted-foreground hover:bg-muted hover:text-muted-foreground transition-colors">
            {tc('cancel')}
          </Button>
          <Button type="submit" size="sm" disabled={pending} className="rounded-md text-xs font-medium disabled:opacity-50 transition-colors">
            {pending ? t('applying') : t('applyAdjustment')}
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
  const t = useTranslations('inventory');
  const tc = useTranslations('common');
  const getError = useErrorMessage();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    startTransition(async () => {
      try {
        await onConfirm();
        onClose();
      } catch (err) {
        setError(getError(err));
      }
    });
  }

  return (
      <Modal title={t('archiveTitle')} onClose={onClose}>
          <p className="text-sm text-muted-foreground mb-4">
              {t('archiveConfirm', { label })}
          </p>
          <FormError message={error} />
          <div className="flex justify-end gap-2">
              <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  className="hidden sm:block rounded-md border-border text-xs text-muted-foreground hover:bg-muted hover:text-muted-foreground transition-colors"
              >
                  {tc('cancel')}
              </Button>
              <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleConfirm}
                  disabled={pending}
                  className="rounded-md bg-red-600 text-xs font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                  {pending ? t('archiving') : t('archive')}
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
  const t = useTranslations('inventory');
  const tc = useTranslations('common');
  const platform = storeType === 'WOOCOMMERCE' ? 'WooCommerce' : 'Shopify';
  return (
    <Modal title={t('syncTitle')} onClose={onClose}>
      <div className="flex gap-3 mb-4">
        <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
        <p className="text-sm text-muted-foreground">
          {t('syncWarning', { label, platform })}
        </p>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose} className="rounded-md border-border text-xs text-muted-foreground hover:bg-muted hover:text-muted-foreground transition-colors">
          {tc('cancel')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => { onProceed(); onClose(); }}
          className="rounded-md border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 text-xs font-medium text-amber-800 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/60 hover:text-amber-800 dark:hover:text-amber-400 transition-colors"
        >
          {t('proceedAnyway')}
        </Button>
      </div>
    </Modal>
  );
}

// ── Bulk Import panel ─────────────────────────────────────────────────────────

function BulkImportPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');
  const getError = useErrorMessage();
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ createdProducts: number; createdVariants: number; skipped: number } | null>(null);
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
            variantSku: r.variantSku || undefined,
            price: r.price,
            stockPhysical: r.stockPhysical,
          })),
        );
        setResult(res);
        setRows([]);
        if (fileRef.current) fileRef.current.value = '';
      } catch (err) {
        setError(getError(err));
      }
    });
  }

  return (
      <ResponsiveSheet
          title={t('bulkTitle')}
          onClose={onClose}
          className="overflow-hidden"
      >
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <span className="text-sm font-semibold text-foreground">
                  {t('bulkTitle')}
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

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Template info */}
              <div className="rounded-lg bg-muted border border-border p-4">
                  <p className="text-xs font-medium text-foreground mb-2">
                      {t('expectedFormat')}
                  </p>
                  <code className="block text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-card border border-border rounded p-2">
                      {`name,sku,variant_name,variant_sku,price,stock_physical\nBlue Tshirt,TSH-001,Blue / M,TSH-001-BL-M,1500,10\nBlue Tshirt,TSH-001,Blue / L,,1500,5`}
                  </code>
                  <p className="mt-2 text-xs text-muted-foreground">
                      {t('bulkHint', {
                          name: 'name',
                          price: 'price',
                          sku: 'sku',
                          variantSku: 'variant_sku'
                      })}
                  </p>
              </div>

              {/* File input */}
              <div>
                  <Label className="mb-1">{t('uploadLabel')}</Label>
                  <Input
                      ref={fileRef}
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleFile}
                      className="border-none shadow-none pt-1.5 text-xs text-muted-foreground file:me-3 file:rounded-md file:bg-secondary file:px-3 file:text-xs file:font-medium file:text-foreground hover:file:bg-secondary/80 transition-colors"
                  />
              </div>

              {/* Success banner */}
              {result && (
                  <div className="rounded-md bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900/60 px-4 py-3 text-sm text-green-800 dark:text-green-400">
                      {t('importComplete', {
                          products: result.createdProducts,
                          variants: result.createdVariants,
                          skipped: result.skipped
                      })}
                  </div>
              )}

              <FormError message={error} />

              {/* Preview table */}
              {rows.length > 0 && (
                  <div>
                      <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-foreground">
                              {t('rowsParsed', { count: rows.length })}
                          </p>
                          {errorCount > 0 && (
                              <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                                  {t('rowsWithErrors', { count: errorCount })}
                              </span>
                          )}
                      </div>
                      <div className="rounded-lg border border-border overflow-x-auto">
                          <table className="w-full text-xs">
                              <thead>
                                  <tr className="bg-muted">
                                      {[
                                          t('colHash'),
                                          t('colName'),
                                          t('colSku'),
                                          t('colVariantSku'),
                                          t('priceHeader'),
                                          t('colInWarehouse'),
                                          ''
                                      ].map((h, i) => (
                                          <th
                                              key={i}
                                              className="px-3 py-2 text-start font-medium text-muted-foreground"
                                          >
                                              {h}
                                          </th>
                                      ))}
                                  </tr>
                              </thead>
                              <tbody>
                                  {rows.map((row) => (
                                      <tr
                                          key={row.rowNum}
                                          className={
                                              row.errors.length > 0
                                                  ? 'bg-red-50 dark:bg-red-950/30'
                                                  : 'bg-card'
                                          }
                                      >
                                          <td className="px-3 py-2 text-muted-foreground">
                                              {row.rowNum}
                                          </td>
                                          <td className="px-3 py-2 text-foreground">
                                              {row.name || (
                                                  <span className="text-red-500">
                                                      —
                                                  </span>
                                              )}
                                          </td>
                                          <td className="px-3 py-2 text-muted-foreground font-mono">
                                              {row.sku || '—'}
                                          </td>
                                          <td className="px-3 py-2 text-muted-foreground font-mono">
                                              {row.variantSku || '—'}
                                          </td>
                                          <td className="px-3 py-2 text-foreground">
                                              {row.price > 0 ? (
                                                  row.price
                                              ) : (
                                                  <span className="text-red-500">
                                                      —
                                                  </span>
                                              )}
                                          </td>
                                          <td className="px-3 py-2 text-foreground">
                                              {row.stockPhysical}
                                          </td>
                                          <td className="px-3 py-2">
                                              {row.errors.length > 0 && (
                                                  <span className="text-red-500">
                                                      {row.errors
                                                          .map((c) => t(c))
                                                          .join(', ')}
                                                  </span>
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
          <div className="shrink-0 px-5 py-4 border-t border-border flex justify-end gap-2">
              <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  className=" rounded-md border-border text-xs text-muted-foreground hover:bg-muted hover:text-muted-foreground transition-colors"
              >
                  {tc('close')}
              </Button>
              <Button
                  type="button"
                  size="sm"
                  onClick={handleImport}
                  disabled={validRows.length === 0 || pending}
                  className="rounded-md text-xs font-medium disabled:opacity-40 transition-colors"
              >
                  {pending
                      ? t('importing')
                      : t('importBtn', { count: validRows.length })}
              </Button>
          </div>
      </ResponsiveSheet>
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
  const t = useTranslations('inventory');
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
          <div className="p-4 sm:p-6 lg:p-8">
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                      <h1 className="text-xl font-semibold text-foreground">
                          {t('title')}
                      </h1>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                          {t('summary', {
                              products: products.length,
                              variants: totalVariants
                          })}
                          {lowStock > 0 && (
                              <span className="ms-2 text-red-600 dark:text-red-400 font-medium">
                                  {t('outOfStock', { count: lowStock })}
                              </span>
                          )}
                      </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                      <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setBulkImportOpen(true)}
                          className="flex items-center gap-1.5 rounded-md border-border bg-card text-xs font-medium text-muted-foreground hover:bg-muted hover:text-muted-foreground transition-colors"
                      >
                          <Upload size={13} />
                          {t('bulkImport')}
                      </Button>
                      <Button
                          size="sm"
                          onClick={() => setAddProduct(true)}
                          className="flex items-center gap-1.5 rounded-md text-xs font-medium transition-colors"
                      >
                          <Plus size={13} />
                          {t('addProduct')}
                      </Button>
                  </div>
              </div>

              {/* ── Empty state ──────────────────────────────────────────────────── */}
              {products.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-card p-16 text-center">
                      <p className="text-sm font-medium text-foreground">
                          {t('emptyTitle')}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                          {t('emptyDesc')}
                      </p>
                      <Button
                          size="sm"
                          onClick={() => setAddProduct(true)}
                          className="mt-4 inline-flex items-center gap-1.5 rounded-md text-xs font-medium transition-colors"
                      >
                          <Plus size={13} />
                          {t('addFirstProduct')}
                      </Button>
                  </div>
              ) : (
                  /* ── Inventory table ──────────────────────────────────────────────── */
                  <>
                      <div className="hidden sm:block rounded-lg border border-border bg-card overflow-x-auto">
                          <table className="w-full text-sm">
                              <thead>
                                  <tr className="bg-muted border-b border-border">
                                      <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                          {t('colProductVariant')}
                                      </th>
                                      <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                          {t('colSku')}
                                      </th>
                                      <th className="px-4 py-3 text-end text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                          {t('colInWarehouse')}
                                      </th>
                                      <th className="px-4 py-3 text-end text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                          {t('colCommitted')}
                                      </th>
                                      <th className="px-4 py-3 text-end text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                          {t('colReadyToSell')}
                                      </th>
                                      <th className="px-4 py-3 w-28" />
                                  </tr>
                              </thead>
                              <tbody>
                                  {products.map((product) => (
                                      <>
                                          {/* Product row */}
                                          <tr
                                              key={`p-${product.id}`}
                                              className="border-b border-border bg-muted/60"
                                          >
                                              <td
                                                  colSpan={5}
                                                  className="px-4 py-2.5"
                                              >
                                                  <span className="text-sm font-medium text-foreground">
                                                      {product.name}
                                                  </span>
                                                  {product.sku && (
                                                      <span className="ms-2 text-xs text-muted-foreground font-mono">
                                                          {product.sku}
                                                      </span>
                                                  )}
                                              </td>
                                              <td className="px-4 py-2.5">
                                                  <div className="flex items-center justify-end gap-1">
                                                      <Button
                                                          variant="ghost"
                                                          size="icon-xs"
                                                          title={t(
                                                              'addVariant'
                                                          )}
                                                          onClick={() =>
                                                              setAddVariantFor(
                                                                  product
                                                              )
                                                          }
                                                          className="rounded text-muted-foreground hover:text-green-800 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/40 transition-colors"
                                                      >
                                                          <Plus size={13} />
                                                      </Button>
                                                      <Button
                                                          variant="ghost"
                                                          size="icon-xs"
                                                          title={t(
                                                              'editProduct'
                                                          )}
                                                          onClick={() =>
                                                              guarded(
                                                                  product.name,
                                                                  () =>
                                                                      setEditingProduct(
                                                                          product
                                                                      )
                                                              )
                                                          }
                                                          className="rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                                                      >
                                                          <Pencil size={13} />
                                                      </Button>
                                                      <Button
                                                          variant="ghost"
                                                          size="icon-xs"
                                                          title={t(
                                                              'archiveProduct'
                                                          )}
                                                          onClick={() =>
                                                              guarded(
                                                                  product.name,
                                                                  () =>
                                                                      setDeletingProduct(
                                                                          product
                                                                      )
                                                              )
                                                          }
                                                          className="rounded text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                                                      >
                                                          <Trash2 size={13} />
                                                      </Button>
                                                  </div>
                                              </td>
                                          </tr>

                                          {/* Variant rows */}
                                          {product.variants.map((variant) => (
                                              <tr
                                                  key={variant.id}
                                                  className="border-b border-border hover:bg-muted/50"
                                              >
                                                  <td className="ps-8 pe-4 py-2.5 text-sm text-muted-foreground">
                                                      {variant.name}
                                                  </td>
                                                  <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">
                                                      {variant.sku ?? '—'}
                                                  </td>
                                                  <td className="px-4 py-2.5 text-end text-sm text-foreground tabular-nums">
                                                      {variant.stockPhysical}
                                                  </td>
                                                  <td className="px-4 py-2.5 text-end text-sm text-foreground tabular-nums">
                                                      {variant.stockReserved}
                                                  </td>
                                                  <td className="px-4 py-2.5 text-end">
                                                      <span
                                                          className={`tabular-nums text-sm font-medium ${variant.stockAvailable > 0 ? 'text-green-800 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                                                      >
                                                          {
                                                              variant.stockAvailable
                                                          }
                                                      </span>
                                                  </td>
                                                  <td className="px-4 py-2.5">
                                                      <div className="flex items-center justify-end gap-1">
                                                          <Button
                                                              variant="ghost"
                                                              size="icon-xs"
                                                              title={t(
                                                                  'adjustStock'
                                                              )}
                                                              onClick={() =>
                                                                  setAdjustingVariant(
                                                                      variant
                                                                  )
                                                              }
                                                              className="rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                                                          >
                                                              <SlidersHorizontal
                                                                  size={13}
                                                              />
                                                          </Button>
                                                          <Button
                                                              variant="ghost"
                                                              size="icon-xs"
                                                              title={t(
                                                                  'editVariant'
                                                              )}
                                                              onClick={() =>
                                                                  guarded(
                                                                      variant.name,
                                                                      () =>
                                                                          setEditingVariant(
                                                                              {
                                                                                  variant,
                                                                                  productId:
                                                                                      product.id
                                                                              }
                                                                          )
                                                                  )
                                                              }
                                                              className="rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                                                          >
                                                              <Pencil
                                                                  size={13}
                                                              />
                                                          </Button>
                                                          <Button
                                                              variant="ghost"
                                                              size="icon-xs"
                                                              title={t(
                                                                  'archiveVariant'
                                                              )}
                                                              onClick={() =>
                                                                  guarded(
                                                                      variant.name,
                                                                      () =>
                                                                          setDeletingVariant(
                                                                              variant
                                                                          )
                                                                  )
                                                              }
                                                              className="rounded text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                                                          >
                                                              <Trash2
                                                                  size={13}
                                                              />
                                                          </Button>
                                                      </div>
                                                  </td>
                                              </tr>
                                          ))}

                                          {product.variants.length === 0 && (
                                              <tr key={`empty-${product.id}`}>
                                                  <td
                                                      colSpan={6}
                                                      className="ps-8 px-4 py-2.5 text-xs text-muted-foreground italic border-b border-border"
                                                  >
                                                      {t('noVariants')}{' '}
                                                      <Button
                                                          variant="link"
                                                          onClick={() =>
                                                              setAddVariantFor(
                                                                  product
                                                              )
                                                          }
                                                          className="h-auto p-0 text-xs text-muted-foreground underline hover:text-foreground"
                                                      >
                                                          {t('addOne')}
                                                      </Button>
                                                  </td>
                                              </tr>
                                          )}
                                      </>
                                  ))}
                              </tbody>
                          </table>
                      </div>

                      {/* ── Phone card list (below sm) ─────────────────────────────────── */}
                      <div className="sm:hidden space-y-5">
                          {products.map((product) => (
                              <div
                                  key={`card-${product.id}`}
                                  className="rounded-lg border border-border bg-card overflow-hidden"
                              >
                                  {/* Product header */}
                                  <div className="flex items-start justify-between gap-2 bg-muted/60 border-b border-border px-4 py-3">
                                      <div className="min-w-0">
                                          <p className="text-sm font-medium text-foreground wrap-break-words">
                                              {product.name}
                                          </p>
                                          {product.sku && (
                                              <p className="mt-0.5 text-xs text-muted-foreground font-mono break-all">
                                                  {product.sku}
                                              </p>
                                          )}
                                      </div>
                                      <div className="flex shrink-0 items-center gap-1">
                                          <Button
                                              variant="ghost"
                                              size="icon-sm"
                                              title={t('addVariant')}
                                              onClick={() =>
                                                  setAddVariantFor(product)
                                              }
                                              className="rounded text-muted-foreground hover:text-green-800 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/40 transition-colors"
                                          >
                                              <Plus size={15} />
                                          </Button>
                                          <Button
                                              variant="ghost"
                                              size="icon-sm"
                                              title={t('editProduct')}
                                              onClick={() =>
                                                  guarded(product.name, () =>
                                                      setEditingProduct(product)
                                                  )
                                              }
                                              className="rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                                          >
                                              <Pencil size={15} />
                                          </Button>
                                          <Button
                                              variant="ghost"
                                              size="icon-sm"
                                              title={t('archiveProduct')}
                                              onClick={() =>
                                                  guarded(product.name, () =>
                                                      setDeletingProduct(
                                                          product
                                                      )
                                                  )
                                              }
                                              className="rounded text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                                          >
                                              <Trash2 size={15} />
                                          </Button>
                                      </div>
                                  </div>

                                  {/* Variant cards */}
                                  {product.variants.length === 0 ? (
                                      <div className="px-4 py-3 text-xs text-muted-foreground italic">
                                          {t('noVariants')}{' '}
                                          <Button
                                              variant="link"
                                              onClick={() =>
                                                  setAddVariantFor(product)
                                              }
                                              className="h-auto p-0 text-xs text-muted-foreground underline hover:text-foreground"
                                          >
                                              {t('addOne')}
                                          </Button>
                                      </div>
                                  ) : (
                                      <div className="divide-y divide-border">
                                          {product.variants.map((variant) => (
                                              <div
                                                  key={variant.id}
                                                  className="px-4 py-3"
                                              >
                                                  <div className="flex items-start justify-between gap-2">
                                                      <p className="text-sm font-medium text-foreground break-words">
                                                          {variant.name}
                                                      </p>
                                                      <div className="flex shrink-0 items-center gap-1">
                                                          <Button
                                                              variant="ghost"
                                                              size="icon-sm"
                                                              title={t(
                                                                  'adjustStock'
                                                              )}
                                                              onClick={() =>
                                                                  setAdjustingVariant(
                                                                      variant
                                                                  )
                                                              }
                                                              className="rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                                                          >
                                                              <SlidersHorizontal
                                                                  size={15}
                                                              />
                                                          </Button>
                                                          <Button
                                                              variant="ghost"
                                                              size="icon-sm"
                                                              title={t(
                                                                  'editVariant'
                                                              )}
                                                              onClick={() =>
                                                                  guarded(
                                                                      variant.name,
                                                                      () =>
                                                                          setEditingVariant(
                                                                              {
                                                                                  variant,
                                                                                  productId:
                                                                                      product.id
                                                                              }
                                                                          )
                                                                  )
                                                              }
                                                              className="rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                                                          >
                                                              <Pencil
                                                                  size={15}
                                                              />
                                                          </Button>
                                                          <Button
                                                              variant="ghost"
                                                              size="icon-sm"
                                                              title={t(
                                                                  'archiveVariant'
                                                              )}
                                                              onClick={() =>
                                                                  guarded(
                                                                      variant.name,
                                                                      () =>
                                                                          setDeletingVariant(
                                                                              variant
                                                                          )
                                                                  )
                                                              }
                                                              className="rounded text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                                                          >
                                                              <Trash2
                                                                  size={15}
                                                              />
                                                          </Button>
                                                      </div>
                                                  </div>
                                                  <dl className="mt-2 space-y-1">
                                                      <div className="flex items-center justify-between gap-2">
                                                          <dt className="text-xs text-muted-foreground">
                                                              {t('colSku')}
                                                          </dt>
                                                          <dd className="text-xs text-muted-foreground font-mono break-all text-end">
                                                              {variant.sku ??
                                                                  '—'}
                                                          </dd>
                                                      </div>
                                                      <div className="flex items-center justify-between gap-2">
                                                          <dt className="text-xs text-muted-foreground">
                                                              {t(
                                                                  'colInWarehouse'
                                                              )}
                                                          </dt>
                                                          <dd className="text-sm text-foreground tabular-nums">
                                                              {
                                                                  variant.stockPhysical
                                                              }
                                                          </dd>
                                                      </div>
                                                      <div className="flex items-center justify-between gap-2">
                                                          <dt className="text-xs text-muted-foreground">
                                                              {t(
                                                                  'colCommitted'
                                                              )}
                                                          </dt>
                                                          <dd className="text-sm text-foreground tabular-nums">
                                                              {
                                                                  variant.stockReserved
                                                              }
                                                          </dd>
                                                      </div>
                                                      <div className="flex items-center justify-between gap-2">
                                                          <dt className="text-xs text-muted-foreground">
                                                              {t(
                                                                  'colReadyToSell'
                                                              )}
                                                          </dt>
                                                          <dd
                                                              className={`tabular-nums text-sm font-medium ${variant.stockAvailable > 0 ? 'text-green-800 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                                                          >
                                                              {
                                                                  variant.stockAvailable
                                                              }
                                                          </dd>
                                                      </div>
                                                  </dl>
                                              </div>
                                          ))}
                                      </div>
                                  )}
                              </div>
                          ))}
                      </div>
                  </>
              )}
          </div>

          {/* ── Modals ──────────────────────────────────────────────────────────── */}

          {addProduct && <ProductModal onClose={() => setAddProduct(false)} />}

          {editingProduct && (
              <ProductModal
                  product={editingProduct}
                  onClose={() => setEditingProduct(null)}
              />
          )}

          {deletingProduct && (
              <DeleteModal
                  label={deletingProduct.name}
                  onConfirm={() => deleteProduct(deletingProduct.id)}
                  onClose={() => setDeletingProduct(null)}
              />
          )}

          {addVariantFor && (
              <VariantModal
                  productId={addVariantFor.id}
                  onClose={() => setAddVariantFor(null)}
              />
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
              <AdjustStockModal
                  variant={adjustingVariant}
                  onClose={() => setAdjustingVariant(null)}
              />
          )}

          {syncWarning && (
              <SyncWarningModal
                  storeType={storeType}
                  label={syncWarning.label}
                  onProceed={syncWarning.action}
                  onClose={() => setSyncWarning(null)}
              />
          )}

          {bulkImportOpen && (
              <BulkImportPanel onClose={() => setBulkImportOpen(false)} />
          )}
      </>
  );
}
