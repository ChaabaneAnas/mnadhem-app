'use client';

import { useState } from 'react';
import { ChevronLeft, MessageCircle, Globe } from 'lucide-react';
import { createManualStore, createStorefrontStore } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Track = 'MANUAL' | 'SHOPIFY' | null;

const ERROR_MESSAGES: Record<string, string> = {
  missing_fields: 'Please fill in all fields.',
};

function StoreFields() {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="storeName">
          Store name
        </Label>
        <Input
          id="storeName"
          name="storeName"
          type="text"
          required
          autoFocus
          placeholder="My Store"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="storeSlug">
          Store slug
        </Label>
        <Input
          id="storeSlug"
          name="storeSlug"
          type="text"
          required
          placeholder="my-store"
        />
        <p className="text-xs text-muted-foreground">Lowercase letters, numbers, and hyphens only.</p>
      </div>
    </>
  );
}

function TrackSelector({ onSelect }: { onSelect: (t: Track) => void }) {
  return (
    <div className="w-full max-w-lg">
      <div className="mb-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">منظّم</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Welcome. First, tell us how you capture orders.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* User B — Social / DM */}
        <Button
          type="button"
          variant="outline"
          onClick={() => onSelect('MANUAL')}
          className="h-auto flex flex-col items-start gap-4 rounded-xl border-border bg-card p-6 text-left whitespace-normal transition-all duration-150 hover:border-ring hover:bg-card hover:shadow-sm focus:ring-2 focus:ring-ring"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
            <MessageCircle size={20} className="text-muted-foreground" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Social / DM-driven</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              I take orders via Instagram, Facebook, or phone calls. Mnadhem is my order book.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-green-50 dark:bg-green-950/40 px-2 py-0.5 text-xs font-medium text-green-800 dark:text-green-400 border border-green-200 dark:border-green-900/60">
            Most common
          </span>
        </Button>

        {/* User A — Storefront */}
        <Button
          type="button"
          variant="outline"
          onClick={() => onSelect('SHOPIFY')}
          className="h-auto flex flex-col items-start gap-4 rounded-xl border-border bg-card p-6 text-left whitespace-normal transition-all duration-150 hover:border-ring hover:bg-card hover:shadow-sm focus:ring-2 focus:ring-ring"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
            <Globe size={20} className="text-muted-foreground" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">I have a website</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              I sell via Shopify, WooCommerce, or a custom storefront and want automatic sync.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground border border-border">
            Storefront
          </span>
        </Button>
      </div>
    </div>
  );
}

function ManualSetupForm({
  onBack,
  initialError,
}: {
  onBack: () => void;
  initialError?: string;
}) {
  return (
    <div className="w-full max-w-sm">
      <Button
        type="button"
        variant="link"
        onClick={onBack}
        className="mb-6 flex items-center gap-1 p-0 h-auto text-sm text-muted-foreground hover:text-foreground hover:no-underline transition-colors"
      >
        <ChevronLeft size={15} />
        Back
      </Button>

      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Create your store</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You&apos;re all set to manage orders manually.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        {initialError && (
          <div className="mb-4 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {ERROR_MESSAGES[initialError] ?? 'Something went wrong.'}
          </div>
        )}

        <form action={createManualStore} className="space-y-4">
          <StoreFields />
          <Button
            type="submit"
            className="w-full rounded-md text-sm font-medium transition-colors"
          >
            Create store
          </Button>
        </form>
      </div>
    </div>
  );
}

function StorefrontSetupForm({
  onBack,
  initialError,
}: {
  onBack: () => void;
  initialError?: string;
}) {
  return (
    <div className="w-full max-w-sm">
      <Button
        type="button"
        variant="link"
        onClick={onBack}
        className="mb-6 flex items-center gap-1 p-0 h-auto text-sm text-muted-foreground hover:text-foreground hover:no-underline transition-colors"
      >
        <ChevronLeft size={15} />
        Back
      </Button>

      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Set up your store</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Storefront integration keeps your workspace ready for when sync goes live.
        </p>
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-card p-6">
          {initialError && (
            <div className="mb-4 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 px-4 py-3 text-sm text-red-700 dark:text-red-400">
              {ERROR_MESSAGES[initialError] ?? 'Something went wrong.'}
            </div>
          )}

          <form action={createStorefrontStore} className="space-y-4">
            <StoreFields />

            {/* Integration coming-soon card */}
            <div className="rounded-lg border border-border bg-muted p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-foreground">Shopify / WooCommerce Sync</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Automatic webhook-driven inventory sync is in private beta. Your store will
                    use manual management until your integration slot opens.
                  </p>
                </div>
                <span className="shrink-0 inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                  Coming soon
                </span>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full rounded-md text-sm font-medium transition-colors"
            >
              Continue to dashboard
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function OnboardingWizard({ initialError }: { initialError?: string }) {
  const [track, setTrack] = useState<Track>(null);

  if (track === null) {
    return <TrackSelector onSelect={setTrack} />;
  }

  if (track === 'MANUAL') {
    return <ManualSetupForm onBack={() => setTrack(null)} initialError={initialError} />;
  }

  return <StorefrontSetupForm onBack={() => setTrack(null)} initialError={initialError} />;
}
