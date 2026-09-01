'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Search, Trash2, AlertCircle } from 'lucide-react';
import { createManualOrder } from '../actions';
import { formatTND } from '@/lib/format';
import { useErrorMessage } from '@/lib/api-error';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ResponsiveSheet } from '@/components/ui/responsive-modal';
import { Input } from '@/components/ui/input';
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { LineItem, PickerVariant } from './types';

// ── Governorates ──────────────────────────────────────────────────────────────

const WILAYAS = [
    'Ariana',
    'Beja',
    'Ben Arous',
    'Bizerte',
    'Gabes',
    'Gafsa',
    'Jendouba',
    'Kairouan',
    'Kasserine',
    'Kebili',
    'Kef',
    'Mahdia',
    'Manouba',
    'Medenine',
    'Monastir',
    'Nabeul',
    'Sfax',
    'Sidi Bouzid',
    'Siliana',
    'Sousse',
    'Tataouine',
    'Tozeur',
    'Tunis',
    'Zaghouan'
];

function generateRef() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${date}-${rand}`;
}

// ── Create Order side panel ───────────────────────────────────────────────────

export function CreateOrderSheet({
    variants,
    onClose
}: {
    variants: PickerVariant[];
    onClose: () => void;
}) {
    const t = useTranslations('orders');
    const tv = useTranslations('validation');
    const getError = useErrorMessage();
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [showPicker, setShowPicker] = useState(false);

    /**
     * Mirrors `CreateOrderDto`. The line items live in the form rather than in
     * their own state so "add at least one" is a field error like any other,
     * rendered next to the empty table instead of at the bottom of the panel.
     */
    const schema = useMemo(
        () =>
            z.object({
                reference: z
                    .string()
                    .trim()
                    .min(1, { message: tv('required') }),
                customerName: z
                    .string()
                    .trim()
                    .min(2, { message: tv('minLength', { count: 2 }) }),
                customerPhone: z
                    .string()
                    .trim()
                    .min(1, { message: tv('required') })
                    // Deliberately permissive: it must look like a phone number
                    // without ruling out the formats couriers actually accept.
                    .regex(/^[\d\s+()-]+$/, { message: tv('phone') })
                    .refine((v) => v.replace(/\D/g, '').length >= 8, {
                        message: tv('phone')
                    }),
                wilaya: z.string().min(1, { message: tv('selectOne') }),
                commune: z.string().trim(),
                address: z.string().trim(),
                // Only the count is validated. The rest of a line item is built
                // by the picker from data the app already holds — the user never
                // types it, so checking it here would report a bug in our own
                // code as if it were a mistake the merchant could correct.
                items: z
                    .array(z.custom<LineItem>())
                    .min(1, { message: t('addItemError') })
            }),
        [tv, t]
    );

    type OrderFormValues = z.infer<typeof schema>;

    const form = useForm<OrderFormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            reference: generateRef(),
            customerName: '',
            customerPhone: '',
            wilaya: '',
            commune: '',
            address: '',
            items: []
        }
    });

    const lineItems = form.watch('items');
    const codTotal = lineItems.reduce(
        (sum, i) => sum + i.price * i.quantity,
        0
    );

    /** Writing through `setValue` keeps the array validated on every change. */
    function setItems(next: LineItem[]) {
        form.setValue('items', next, {
            shouldValidate: form.formState.isSubmitted
        });
    }

    function addVariant(v: PickerVariant) {
        const exists = lineItems.find((i) => i.variantId === v.id);
        setItems(
            exists
                ? lineItems.map((i) =>
                      i.variantId === v.id
                          ? { ...i, quantity: i.quantity + 1 }
                          : i
                  )
                : [
                      ...lineItems,
                      {
                          variantId: v.id,
                          productName: v.productName,
                          variantName: v.name,
                          sku: v.sku,
                          price: v.price,
                          quantity: 1
                      }
                  ]
        );
        setSearch('');
        setShowPicker(false);
    }

    function updateQty(variantId: string, qty: number) {
        // Clearing the box gives NaN, and `NaN < 1` is false — so without the
        // finite check it would reach the schema and block the submit.
        if (!Number.isFinite(qty) || qty < 1) return;
        setItems(
            lineItems.map((i) =>
                i.variantId === variantId ? { ...i, quantity: qty } : i
            )
        );
    }

    function removeItem(variantId: string) {
        setItems(lineItems.filter((i) => i.variantId !== variantId));
    }

    const filteredVariants =
        search.trim().length > 0
            ? variants.filter((v) => {
                  const q = search.toLowerCase();
                  return (
                      v.productName.toLowerCase().includes(q) ||
                      v.name.toLowerCase().includes(q) ||
                      (v.sku?.toLowerCase().includes(q) ?? false)
                  );
              })
            : [];

    async function onSubmit(values: OrderFormValues) {
        setSubmitError(null);
        try {
            await createManualOrder({
                reference: values.reference,
                customerName: values.customerName,
                customerPhone: values.customerPhone,
                wilaya: values.wilaya,
                commune: values.commune || undefined,
                address: values.address || undefined,
                codAmount: codTotal,
                items: values.items.map((i) => ({
                    variantId: i.variantId,
                    quantity: i.quantity
                }))
            });
            onClose();
        } catch (err) {
            // A rejected save is the server's verdict on the whole order, not a
            // complaint about one input, so it is reported as one.
            setSubmitError(getError(err));
        }
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
            <Form {...form}>
                <form
                    id="create-order-form"
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="flex-1 overflow-y-auto px-5 py-4 space-y-5"
                >
                    {/* ── Customer ── */}
                    <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                            {t('customer')}
                        </p>
                        <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <FormField
                                    control={form.control}
                                    name="customerName"
                                    render={({ field }) => (
                                        <FormItem className="gap-1">
                                            <FormLabel>
                                                {t('fullName')}
                                            </FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="Ahmed Benali"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="customerPhone"
                                    render={({ field }) => (
                                        <FormItem className="gap-1">
                                            <FormLabel>{t('phone')}</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="0770 000 000"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="wilaya"
                                render={({ field }) => (
                                    <FormItem className="gap-1">
                                        <FormLabel>
                                            {t('wilayaLabel')}
                                        </FormLabel>
                                        <Select
                                            onValueChange={field.onChange}
                                            value={field.value}
                                        >
                                            <FormControl>
                                                <SelectTrigger className="w-full">
                                                    <SelectValue
                                                        placeholder={t(
                                                            'selectWilaya'
                                                        )}
                                                    />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {WILAYAS.map((w) => (
                                                    <SelectItem
                                                        key={w}
                                                        value={w}
                                                    >
                                                        {w}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <FormField
                                    control={form.control}
                                    name="commune"
                                    render={({ field }) => (
                                        <FormItem className="gap-1">
                                            <FormLabel>
                                                {t('commune')}
                                            </FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="Bab El Oued"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="address"
                                    render={({ field }) => (
                                        <FormItem className="gap-1">
                                            <FormLabel>
                                                {t('address')}
                                            </FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="Rue Ibn Khaldoun"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
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
                        <FormField
                            control={form.control}
                            name="items"
                            render={() => (
                                <FormItem className="gap-1">
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
                                                                    {
                                                                        item.productName
                                                                    }
                                                                </p>
                                                                <p className="text-muted-foreground">
                                                                    {
                                                                        item.variantName
                                                                    }
                                                                </p>
                                                            </TableCell>
                                                            <TableCell className="px-3 py-2 text-end text-foreground tabular-nums">
                                                                {formatTND(
                                                                    item.price
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="px-3 py-2 text-end">
                                                                <Input
                                                                    type="number"
                                                                    min="1"
                                                                    value={
                                                                        item.quantity
                                                                    }
                                                                    onChange={(
                                                                        e
                                                                    ) =>
                                                                        updateQty(
                                                                            item.variantId,
                                                                            parseInt(
                                                                                e
                                                                                    .target
                                                                                    .value,
                                                                                10
                                                                            )
                                                                        )
                                                                    }
                                                                    className="w-14 h-auto px-2 py-1 text-xs text-end"
                                                                />
                                                            </TableCell>
                                                            <TableCell className="px-3 py-2 text-end font-medium text-foreground tabular-nums">
                                                                {formatTND(
                                                                    item.price *
                                                                        item.quantity
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="px-3 py-2">
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon-xs"
                                                                    onClick={() =>
                                                                        removeItem(
                                                                            item.variantId
                                                                        )
                                                                    }
                                                                    className="text-muted-foreground hover:bg-transparent hover:text-red-500 transition-colors"
                                                                >
                                                                    <Trash2
                                                                        size={
                                                                            13
                                                                        }
                                                                    />
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    {/* ── Review ── */}
                    {lineItems.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                                {t('review')}
                            </p>
                            <div className="rounded-lg border border-border bg-muted p-4 space-y-3">
                                <FormField
                                    control={form.control}
                                    name="reference"
                                    render={({ field }) => (
                                        <FormItem className="gap-1">
                                            <FormLabel>
                                                {t('orderReference')}
                                            </FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="ORD-20260629-XXXX"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="flex items-center justify-between pt-1 border-t border-border">
                                    <span className="text-xs font-medium text-muted-foreground">
                                        {t('totalCod')}
                                    </span>
                                    <span className="text-base font-semibold text-foreground tabular-nums">
                                        {formatTND(codTotal)}
                                    </span>
                                </div>
                                <FormDescription className="text-xs">
                                    {t('codHint')}
                                </FormDescription>
                            </div>
                        </div>
                    )}

                    {submitError && (
                        <div className="flex gap-2 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 px-3 py-2 text-xs text-red-700 dark:text-red-400">
                            <AlertCircle size={14} className="shrink-0 mt-0.5" />
                            {submitError}
                        </div>
                    )}
                </form>
            </Form>

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
                    disabled={
                        form.formState.isSubmitting || lineItems.length === 0
                    }
                    className="rounded-md text-xs font-medium disabled:opacity-40 transition-colors"
                >
                    {form.formState.isSubmitting
                        ? t('creating')
                        : t('createOrder')}
                </Button>
            </div>
        </ResponsiveSheet>
    );
}
