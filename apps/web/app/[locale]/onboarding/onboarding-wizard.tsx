'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, MessageCircle, Globe } from 'lucide-react';
import { createManualStore, createStorefrontStore } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Track = 'MANUAL' | 'SHOPIFY' | null;

function StoreFields({ defaultName, defaultSlug }: { defaultName?: string; defaultSlug?: string }) {
  const t = useTranslations('onboarding');
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="storeName">{t('storeName')}</Label>
        <Input
          id="storeName"
          name="storeName"
          type="text"
          required
          autoFocus
          defaultValue={defaultName}
          placeholder={t('storeNamePlaceholder')}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="storeSlug">{t('storeSlug')}</Label>
        <Input
          id="storeSlug"
          name="storeSlug"
          type="text"
          required
          defaultValue={defaultSlug}
          placeholder={t('storeSlugPlaceholder')}
        />
        <p className="text-xs text-muted-foreground">{t('slugHint')}</p>
      </div>
    </>
  );
}

function TrackSelector({ onSelect }: { onSelect: (t: Track) => void }) {
  const t = useTranslations('onboarding');
  return (
    <div className="w-full max-w-lg">
      <div className="mb-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">منظّم</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('welcome')}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* User B — Social / DM */}
        <Button
          type="button"
          variant="outline"
          onClick={() => onSelect('MANUAL')}
          className="h-auto flex flex-col items-start gap-4 rounded-xl border-border bg-card p-6 text-start whitespace-normal transition-all duration-150 hover:border-ring hover:bg-card hover:shadow-sm focus:ring-2 focus:ring-ring"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
            <MessageCircle size={20} className="text-muted-foreground" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{t('manualTitle')}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t('manualDesc')}</p>
          </div>
          <span className="inline-flex items-center rounded-full bg-green-50 dark:bg-green-950/40 px-2 py-0.5 text-xs font-medium text-green-800 dark:text-green-400 border border-green-200 dark:border-green-900/60">
            {t('manualBadge')}
          </span>
        </Button>

        {/* User A — Storefront */}
        <Button
          type="button"
          variant="outline"
          onClick={() => onSelect('SHOPIFY')}
          className="h-auto flex flex-col items-start gap-4 rounded-xl border-border bg-card p-6 text-start whitespace-normal transition-all duration-150 hover:border-ring hover:bg-card hover:shadow-sm focus:ring-2 focus:ring-ring"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
            <Globe size={20} className="text-muted-foreground" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{t('storefrontTitle')}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t('storefrontDesc')}</p>
          </div>
          <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground border border-border">
            {t('storefrontBadge')}
          </span>
        </Button>
      </div>
    </div>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  const t = useTranslations('common');
  return (
    <Button
      type="button"
      variant="link"
      onClick={onBack}
      className="mb-6 flex items-center gap-1 p-0 h-auto text-sm text-muted-foreground hover:text-foreground hover:no-underline transition-colors"
    >
      <ChevronLeft size={15} className="rtl:rotate-180" />
      {t('back')}
    </Button>
  );
}

function ManualSetupForm({
  onBack,
  initialError,
  defaultName,
  defaultSlug,
}: {
  onBack: () => void;
  initialError?: string;
  defaultName?: string;
  defaultSlug?: string;
}) {
  const t = useTranslations('onboarding');
  const tc = useTranslations('common');
  return (
    <div className="w-full max-w-sm">
      <BackButton onBack={onBack} />

      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{t('createStoreTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('createStoreDesc')}</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        {initialError && (
          <div className="mb-4 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {t.has(`errors.${initialError}`) ? t(`errors.${initialError}`) : tc('somethingWrong')}
          </div>
        )}

        <form action={createManualStore} className="space-y-4">
          <StoreFields defaultName={defaultName} defaultSlug={defaultSlug} />
          <Button
            type="submit"
            className="w-full rounded-md text-sm font-medium transition-colors"
          >
            {t('createStore')}
          </Button>
        </form>
      </div>
    </div>
  );
}

function StorefrontSetupForm({
  onBack,
  initialError,
  defaultName,
  defaultSlug,
}: {
  onBack: () => void;
  initialError?: string;
  defaultName?: string;
  defaultSlug?: string;
}) {
  const t = useTranslations('onboarding');
  const tc = useTranslations('common');
  return (
    <div className="w-full max-w-sm">
      <BackButton onBack={onBack} />

      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{t('setupStoreTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('setupStoreDesc')}</p>
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-card p-6">
          {initialError && (
            <div className="mb-4 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 px-4 py-3 text-sm text-red-700 dark:text-red-400">
              {t.has(`errors.${initialError}`) ? t(`errors.${initialError}`) : tc('somethingWrong')}
            </div>
          )}

          <form action={createStorefrontStore} className="space-y-4">
            <StoreFields defaultName={defaultName} defaultSlug={defaultSlug} />

            <div className="space-y-1.5">
              <Label htmlFor="platform">{t('platform')}</Label>
              <Select name="platform" defaultValue="SHOPIFY">
                <SelectTrigger id="platform" className="w-full">
                  <SelectValue placeholder={t('selectPlatform')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SHOPIFY">Shopify</SelectItem>
                  <SelectItem value="WOOCOMMERCE">WooCommerce</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Integration coming-soon card */}
            <div className="rounded-lg border border-border bg-muted p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-foreground">{t('syncTitle')}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t('syncDesc')}</p>
                </div>
                <span className="shrink-0 inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                  {tc('comingSoon')}
                </span>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full rounded-md text-sm font-medium transition-colors"
            >
              {t('continueToDashboard')}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function OnboardingWizard({
  initialError,
  initialTrack,
  defaultStoreName,
  defaultStoreSlug,
}: {
  initialError?: string;
  initialTrack?: 'MANUAL' | 'STOREFRONT';
  defaultStoreName?: string;
  defaultStoreSlug?: string;
}) {
  // After an error redirect, resume on the setup form the user was on.
  const [track, setTrack] = useState<Track>(
    initialTrack === 'MANUAL' ? 'MANUAL' : initialTrack === 'STOREFRONT' ? 'SHOPIFY' : null,
  );

  if (track === null) {
    return <TrackSelector onSelect={setTrack} />;
  }

  if (track === 'MANUAL') {
    return (
      <ManualSetupForm
        onBack={() => setTrack(null)}
        initialError={initialError}
        defaultName={defaultStoreName}
        defaultSlug={defaultStoreSlug}
      />
    );
  }

  return (
    <StorefrontSetupForm
      onBack={() => setTrack(null)}
      initialError={initialError}
      defaultName={defaultStoreName}
      defaultSlug={defaultStoreSlug}
    />
  );
}
