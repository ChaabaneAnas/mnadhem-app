'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Check, ChevronDown, Copy, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { useErrorMessage } from '@/lib/api-error';
import {
  saveAramexAccount,
  testAramexAccount,
  type AramexAccountInput,
  type AramexAccountView,
} from '../actions';

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
  const [saving, startSaving] = useTransition();
  const [testing, startTesting] = useTransition();
  const [copied, setCopied] = useState(false);

  // Non-secret values are controlled from the saved account; secrets start empty.
  const [form, setForm] = useState({
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
    shipperCountryCode: account.shipperCountryCode ?? '',
  });
  const [password, setPassword] = useState('');
  const [accountPin, setAccountPin] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  function save(overrides: Partial<AramexAccountInput> = {}) {
    startSaving(async () => {
      try {
        await saveAramexAccount({
          ...form,
          ...(password ? { password } : {}),
          ...(accountPin ? { accountPin } : {}),
          ...(webhookSecret ? { webhookSecret } : {}),
          ...overrides,
        });
        setPassword('');
        setAccountPin('');
        setWebhookSecret('');
        toast({ variant: 'success', title: t('carrierSaved') });
        onSaved();
      } catch (err) {
        toast({ variant: 'destructive', title: getError(err) });
      }
    });
  }

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

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-5">
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
            onChange={(e) => save({ enabled: e.target.checked })}
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
          <span className="min-w-0 break-words">
            {account.lastTestOk ? t('testOk') : (account.lastTestError ?? t('testFailed'))}
          </span>
        </p>
      )}

      {/* Credentials */}
      <Section title={t('aramexCredentials')} hint={t('aramexCredentialsHint')}>
        <Grid>
          <Field label={t('aramexUsername')} value={form.username} onChange={set('username')} />
          <Secret
            label={t('aramexPassword')}
            value={password}
            onChange={setPassword}
            stored={account.hasPassword}
            keepHint={t('apiCredentialKeep')}
          />
          <Field
            label={t('aramexAccountNumber')}
            value={form.accountNumber}
            onChange={set('accountNumber')}
            mono
          />
          <Secret
            label={t('aramexAccountPin')}
            value={accountPin}
            onChange={setAccountPin}
            stored={account.hasAccountPin}
            keepHint={t('apiCredentialKeep')}
          />
          <Field
            label={t('aramexEntity')}
            value={form.accountEntity}
            onChange={set('accountEntity')}
            placeholder="TUN"
            mono
          />
          <Field
            label={t('aramexCountryCode')}
            value={form.accountCountryCode}
            onChange={set('accountCountryCode')}
            placeholder="TN"
            mono
          />
        </Grid>

        <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={account.testMode}
            disabled={saving}
            onChange={(e) => save({ testMode: e.target.checked })}
            className="size-4 cursor-pointer accent-green-900 dark:accent-green-500"
          />
          {t('aramexTestMode')}
        </label>
        <p className="text-xs text-muted-foreground">{t('aramexTestModeHint')}</p>
      </Section>

      {/* Shipper — required by Aramex on every shipment and pickup */}
      <Section title={t('shipperDetails')} hint={t('shipperDetailsHint')}>
        <Grid>
          <Field
            label={t('shipperCompany')}
            value={form.shipperCompany}
            onChange={set('shipperCompany')}
          />
          <Field
            label={t('shipperContactName')}
            value={form.shipperContactName}
            onChange={set('shipperContactName')}
          />
          <Field
            label={t('shipperPhone')}
            value={form.shipperPhone}
            onChange={set('shipperPhone')}
          />
          <Field
            label={t('shipperCellPhone')}
            value={form.shipperCellPhone}
            onChange={set('shipperCellPhone')}
          />
          <Field
            label={t('shipperEmail')}
            value={form.shipperEmail}
            onChange={set('shipperEmail')}
          />
          <Field
            label={t('shipperCity')}
            value={form.shipperCity}
            onChange={set('shipperCity')}
          />
        </Grid>
        <div className="mt-3">
          <Field
            label={t('shipperLine1')}
            value={form.shipperLine1}
            onChange={set('shipperLine1')}
          />
        </div>
        <Grid className="mt-3">
          <Field
            label={t('shipperStateCode')}
            value={form.shipperStateCode}
            onChange={set('shipperStateCode')}
          />
          <Field
            label={t('shipperPostCode')}
            value={form.shipperPostCode}
            onChange={set('shipperPostCode')}
          />
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
          <Secret
            label={t('webhookSecret')}
            value={webhookSecret}
            onChange={setWebhookSecret}
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
            <Field
              label={t('aramexProductGroup')}
              value={form.productGroup}
              onChange={set('productGroup')}
              placeholder="EXP"
              mono
            />
            <Field
              label={t('aramexProductType')}
              value={form.productType}
              onChange={set('productType')}
              placeholder="PPX"
              mono
            />
            <Field
              label={t('aramexCodCurrency')}
              value={form.codCurrency}
              onChange={set('codCurrency')}
              placeholder="USD"
              mono
            />
            <Field
              label={t('aramexVersion')}
              value={form.version}
              onChange={set('version')}
              placeholder="v1.0"
              mono
            />
          </Grid>
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <Button
          size="sm"
          disabled={saving}
          onClick={() => save()}
          className="rounded-md text-xs font-medium"
        >
          {saving ? tc('saving') : tc('saveChanges')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={testing || !account.id}
          onClick={test}
          className="rounded-md text-xs"
        >
          {testing ? t('testing') : t('testConnection')}
        </Button>
      </div>
    </div>
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
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {hint && <p className="mt-1 mb-3 text-xs text-muted-foreground">{hint}</p>}
      <div className={hint ? '' : 'mt-3'}>{children}</div>
    </div>
  );
}

function Grid({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${className}`}>{children}</div>;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  mono,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`text-sm ${mono ? 'font-mono' : ''}`}
      />
    </div>
  );
}

/** Always renders empty; blank on save means "keep the stored value". */
function Secret({
  label,
  value,
  onChange,
  stored,
  keepHint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  stored: boolean;
  keepHint: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="password"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={stored ? keepHint : '••••••••'}
        className="font-mono text-sm"
      />
    </div>
  );
}
