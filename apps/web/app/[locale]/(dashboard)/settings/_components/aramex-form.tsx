'use client';

import { useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useForm, type Control, type FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, Check, ChevronDown, Copy, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { toast } from '@/hooks/use-toast';
import { useErrorMessage } from '@/lib/api-error';
import {
  saveAramexAccount,
  testAramexAccount,
  type AramexAccountInput,
  type AramexAccountView,
} from '../actions';

/**
 * Mirrors `UpdateAramexAccountDto`. Blank is legal everywhere: the merchant
 * collects these values from Aramex over time, and the backend treats a blank
 * coded field as "not supplied" rather than "set to empty" — so a half-filled
 * form saves. Only a value that is present but the wrong shape is rejected.
 *
 * Secrets always render empty and blank means "keep the stored value", which is
 * why they carry no constraint of their own.
 */
function useAramexSchema() {
  const tv = useTranslations('validation');
  const te = useTranslations('errors');

  return useMemo(() => {
    /** Blank, or exactly `length` characters. */
    const code = (length: number, message: string) =>
      z
        .string()
        .trim()
        .refine((v) => v.length === 0 || v.length === length, { message });

    /** Blank, or at most `max` characters. */
    const shortCode = (max: number, message: string) =>
      z
        .string()
        .trim()
        .refine((v) => v.length === 0 || v.length <= max, { message });

    return z.object({
      username: z.string().trim(),
      accountNumber: z.string().trim(),
      accountEntity: shortCode(3, te('ARAMEX_ENTITY_INVALID')),
      accountCountryCode: code(2, te('ARAMEX_COUNTRY_INVALID')),
      version: shortCode(4, te('ARAMEX_VERSION_INVALID')),
      productGroup: shortCode(3, te('ARAMEX_PRODUCT_GROUP_INVALID')),
      productType: shortCode(3, te('ARAMEX_PRODUCT_TYPE_INVALID')),
      codCurrency: code(3, te('ARAMEX_CURRENCY_INVALID')),
      shipperCompany: z.string().trim(),
      shipperContactName: z.string().trim(),
      shipperPhone: z.string().trim(),
      shipperCellPhone: z.string().trim(),
      // Aramex rejects a shipment without a usable consignee email (REQ24), so
      // a malformed one is worth catching here rather than at label time.
      shipperEmail: z
        .string()
        .trim()
        .refine((v) => v.length === 0 || z.string().email().safeParse(v).success, {
          message: tv('email'),
        }),
      shipperLine1: z.string().trim(),
      shipperCity: z.string().trim(),
      shipperStateCode: z.string().trim(),
      shipperPostCode: z.string().trim(),
      password: z.string(),
      accountPin: z.string(),
      webhookSecret: z.string(),
    });
  }, [tv, te]);
}

type AramexFormValues = z.infer<ReturnType<typeof useAramexSchema>>;

/**
 * Aramex credentials, shipper identity and shipping defaults.
 *
 * Secret fields always render empty — the API returns only whether one is
 * stored, never the value — so leaving one blank means "keep what is saved".
 * That is the same contract Shopify and the WooCommerce shipping plugins use.
 */
export function AramexForm({
  account,
  onSaved,
}: {
  account: AramexAccountView;
  onSaved: () => void;
}) {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const getError = useErrorMessage();
  const [testing, startTesting] = useTransition();
  const [copied, setCopied] = useState(false);

  const schema = useAramexSchema();
  const form = useForm<AramexFormValues>({
    resolver: zodResolver(schema),
    // Non-secret values are controlled from the saved account; secrets start empty.
    defaultValues: {
      username: account.username ?? '',
      accountNumber: account.accountNumber ?? '',
      accountEntity: account.accountEntity ?? '',
      accountCountryCode: account.accountCountryCode ?? '',
      version: account.version,
      productGroup: account.productGroup,
      productType: account.productType,
      codCurrency: account.codCurrency,
      shipperCompany: account.shipperCompany ?? '',
      shipperContactName: account.shipperContactName ?? '',
      shipperPhone: account.shipperPhone ?? '',
      shipperCellPhone: account.shipperCellPhone ?? '',
      shipperEmail: account.shipperEmail ?? '',
      shipperLine1: account.shipperLine1 ?? '',
      shipperCity: account.shipperCity ?? '',
      shipperStateCode: account.shipperStateCode ?? '',
      shipperPostCode: account.shipperPostCode ?? '',
      password: '',
      accountPin: '',
      webhookSecret: '',
    },
  });

  async function persist(values: AramexFormValues, overrides: Partial<AramexAccountInput>) {
    const { password, accountPin, webhookSecret, ...rest } = values;
    try {
      await saveAramexAccount({
        ...rest,
        // Omitted rather than sent blank, so the stored secret survives.
        ...(password ? { password } : {}),
        ...(accountPin ? { accountPin } : {}),
        ...(webhookSecret ? { webhookSecret } : {}),
        ...overrides,
      });
      form.resetField('password');
      form.resetField('accountPin');
      form.resetField('webhookSecret');
      toast({ variant: 'success', title: t('carrierSaved') });
      onSaved();
    } catch (err) {
      // A rejected save is the server's verdict on the account as a whole, not
      // a complaint about one input.
      toast({ variant: 'destructive', title: getError(err) });
    }
  }

  /**
   * The two switches save immediately, so they go through the same validated
   * submit as the button — a toggle cannot smuggle an invalid field past the
   * schema on its way to the server.
   */
  const saveWith = (overrides: Partial<AramexAccountInput> = {}) =>
    form.handleSubmit((values) => persist(values, overrides))();

  function test() {
    startTesting(async () => {
      try {
        const result = await testAramexAccount();
        toast({
          variant: result.lastTestOk ? 'success' : 'destructive',
          title: result.lastTestOk ? t('testOk') : t('testFailed'),
          description: result.lastTestError ?? undefined,
        });
        onSaved();
      } catch (err) {
        toast({ variant: 'destructive', title: getError(err) });
      }
    });
  }

  function copyWebhookUrl() {
    void navigator.clipboard
      .writeText(`${window.location.origin}${account.webhookPath}`)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
  }

  const saving = form.formState.isSubmitting;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => persist(values, {}))}
        className="space-y-4 rounded-lg border border-border bg-card p-5"
      >
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Aramex</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {account.enabled ? t('carrierEnabled') : t('carrierDisabled')}
            </p>
          </div>
          <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={account.enabled}
              disabled={saving}
              onChange={(e) => void saveWith({ enabled: e.target.checked })}
              className="size-4 cursor-pointer accent-green-900 dark:accent-green-500"
            />
            {t('carrierEnabled')}
          </label>
        </div>

        {account.lastTestedAt && (
          <p
            className={`flex items-center gap-1.5 text-xs ${
              account.lastTestOk
                ? 'text-green-700 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {account.lastTestOk ? <Check size={12} /> : <X size={12} />}
            <span className="min-w-0 wrap-break-words">
              {account.lastTestOk ? t('testOk') : (account.lastTestError ?? t('testFailed'))}
            </span>
          </p>
        )}

        {/* Credentials */}
        <Section title={t('aramexCredentials')} hint={t('aramexCredentialsHint')}>
          <Grid>
            <TextField control={form.control} name="username" label={t('aramexUsername')} />
            <SecretField
              control={form.control}
              name="password"
              label={t('aramexPassword')}
              stored={account.hasPassword}
              keepHint={t('apiCredentialKeep')}
            />
            <TextField
              control={form.control}
              name="accountNumber"
              label={t('aramexAccountNumber')}
              mono
            />
            <SecretField
              control={form.control}
              name="accountPin"
              label={t('aramexAccountPin')}
              stored={account.hasAccountPin}
              keepHint={t('apiCredentialKeep')}
            />
            <TextField
              control={form.control}
              name="accountEntity"
              label={t('aramexEntity')}
              placeholder="TUN"
              mono
            />
            <TextField
              control={form.control}
              name="accountCountryCode"
              label={t('aramexCountryCode')}
              placeholder="TN"
              mono
            />
          </Grid>

          <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={account.testMode}
              disabled={saving}
              onChange={(e) => void saveWith({ testMode: e.target.checked })}
              className="size-4 cursor-pointer accent-green-900 dark:accent-green-500"
            />
            {t('aramexTestMode')}
          </label>
          <p className="text-xs text-muted-foreground">{t('aramexTestModeHint')}</p>
        </Section>

        {/* Shipper — required by Aramex on every shipment and pickup */}
        <Section title={t('shipperDetails')} hint={t('shipperDetailsHint')}>
          <Grid>
            <TextField control={form.control} name="shipperCompany" label={t('shipperCompany')} />
            <TextField
              control={form.control}
              name="shipperContactName"
              label={t('shipperContactName')}
            />
            <TextField control={form.control} name="shipperPhone" label={t('shipperPhone')} />
            <TextField
              control={form.control}
              name="shipperCellPhone"
              label={t('shipperCellPhone')}
            />
            <TextField control={form.control} name="shipperEmail" label={t('shipperEmail')} />
            <TextField control={form.control} name="shipperCity" label={t('shipperCity')} />
          </Grid>
          <div className="mt-3">
            <TextField control={form.control} name="shipperLine1" label={t('shipperLine1')} />
          </div>
          <Grid className="mt-3">
            <TextField
              control={form.control}
              name="shipperStateCode"
              label={t('shipperStateCode')}
            />
            <TextField control={form.control} name="shipperPostCode" label={t('shipperPostCode')} />
          </Grid>
        </Section>

        {/* Webhook */}
        <Section title={t('webhookUrl')} hint={t('webhookUrlDesc')}>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted px-2.5 py-2 font-mono text-xs text-muted-foreground">
              {account.webhookPath}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copyWebhookUrl}
              className="shrink-0 gap-1.5 rounded-md text-xs"
            >
              <Copy size={12} />
              {copied ? t('copied') : t('copy')}
            </Button>
          </div>
          <div className="mt-3">
            <SecretField
              control={form.control}
              name="webhookSecret"
              label={t('webhookSecret')}
              stored={account.hasWebhookSecret}
              keepHint={t('apiCredentialKeep')}
            />
          </div>
        </Section>

        {/* Shipping defaults — the values Aramex has to tell you */}
        <details className="rounded-md border border-border">
          <summary className="flex cursor-pointer items-center gap-1.5 px-3 py-2 text-xs font-medium text-foreground">
            <ChevronDown size={13} />
            {t('shippingDefaults')}
          </summary>
          <div className="space-y-3 border-t border-border p-3">
            <p className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
              <AlertTriangle size={14} className="mt-px shrink-0" />
              {t('shippingDefaultsWarning')}
            </p>
            <Grid>
              <TextField
                control={form.control}
                name="productGroup"
                label={t('aramexProductGroup')}
                placeholder="EXP"
                mono
              />
              <TextField
                control={form.control}
                name="productType"
                label={t('aramexProductType')}
                placeholder="PPX"
                mono
              />
              <TextField
                control={form.control}
                name="codCurrency"
                label={t('aramexCodCurrency')}
                placeholder="USD"
                mono
              />
              <TextField
                control={form.control}
                name="version"
                label={t('aramexVersion')}
                placeholder="v1"
                mono
              />
            </Grid>
          </div>
        </details>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button type="submit" size="sm" disabled={saving} className="rounded-md text-xs font-medium">
            {saving ? tc('saving') : tc('saveChanges')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={testing || !account.id}
            onClick={test}
            className="rounded-md text-xs"
          >
            {testing ? t('testing') : t('testConnection')}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// ── Small presentational helpers ──────────────────────────────────────────────

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-border pt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {hint && <p className="mt-1 mb-3 text-xs text-muted-foreground">{hint}</p>}
      <div className={hint ? '' : 'mt-3'}>{children}</div>
    </div>
  );
}

function Grid({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${className}`}>{children}</div>;
}

function TextField({
  control,
  name,
  label,
  placeholder,
  mono,
}: {
  control: Control<AramexFormValues>;
  name: FieldPath<AramexFormValues>;
  label: string;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="gap-1.5">
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              placeholder={placeholder}
              className={`text-sm ${mono ? 'font-mono' : ''}`}
              {...field}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** Always renders empty; blank on save means "keep the stored value". */
function SecretField({
  control,
  name,
  label,
  stored,
  keepHint,
}: {
  control: Control<AramexFormValues>;
  name: FieldPath<AramexFormValues>;
  label: string;
  stored: boolean;
  keepHint: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="gap-1.5">
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type="password"
              autoComplete="off"
              placeholder={stored ? keepHint : '••••••••'}
              className="font-mono text-sm"
              {...field}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
