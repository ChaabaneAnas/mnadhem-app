'use client';

import { useState } from 'react';
import { ChevronLeft, MessageCircle, Globe } from 'lucide-react';
import { createManualStore, createStorefrontStore } from './actions';

type Track = 'MANUAL' | 'SHOPIFY' | null;

const ERROR_MESSAGES: Record<string, string> = {
  missing_fields: 'Please fill in all fields.',
};

const STORE_FIELD_CLASSES =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500';

function StoreFields() {
  return (
    <>
      <div className="space-y-1.5">
        <label htmlFor="storeName" className="block text-sm font-medium text-slate-700">
          Store name
        </label>
        <input
          id="storeName"
          name="storeName"
          type="text"
          required
          autoFocus
          className={STORE_FIELD_CLASSES}
          placeholder="My Store"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="storeSlug" className="block text-sm font-medium text-slate-700">
          Store slug
        </label>
        <input
          id="storeSlug"
          name="storeSlug"
          type="text"
          required
          className={STORE_FIELD_CLASSES}
          placeholder="my-store"
        />
        <p className="text-xs text-slate-400">Lowercase letters, numbers, and hyphens only.</p>
      </div>
    </>
  );
}

function TrackSelector({ onSelect }: { onSelect: (t: Track) => void }) {
  return (
    <div className="w-full max-w-lg">
      <div className="mb-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">منظّم</h1>
        <p className="mt-2 text-sm text-slate-500">
          Welcome. First, tell us how you capture orders.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* User B — Social / DM */}
        <button
          type="button"
          onClick={() => onSelect('MANUAL')}
          className="flex flex-col items-start gap-4 rounded-xl border border-slate-200 bg-white p-6 text-left transition-all duration-150 hover:border-slate-400 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
            <MessageCircle size={20} className="text-slate-600" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Social / DM-driven</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              I take orders via Instagram, Facebook, or phone calls. Mnadhem is my order book.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-800 border border-green-200">
            Most common
          </span>
        </button>

        {/* User A — Storefront */}
        <button
          type="button"
          onClick={() => onSelect('SHOPIFY')}
          className="flex flex-col items-start gap-4 rounded-xl border border-slate-200 bg-white p-6 text-left transition-all duration-150 hover:border-slate-400 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
            <Globe size={20} className="text-slate-600" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">I have a website</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              I sell via Shopify, WooCommerce, or a custom storefront and want automatic sync.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 border border-slate-200">
            Storefront
          </span>
        </button>
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
      <button
        type="button"
        onClick={onBack}
        className="mb-6 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ChevronLeft size={15} />
        Back
      </button>

      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Create your store</h1>
        <p className="mt-1 text-sm text-slate-500">
          You&apos;re all set to manage orders manually.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        {initialError && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {ERROR_MESSAGES[initialError] ?? 'Something went wrong.'}
          </div>
        )}

        <form action={createManualStore} className="space-y-4">
          <StoreFields />
          <button
            type="submit"
            className="w-full rounded-md bg-green-900 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 transition-colors"
          >
            Create store
          </button>
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
      <button
        type="button"
        onClick={onBack}
        className="mb-6 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ChevronLeft size={15} />
        Back
      </button>

      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Set up your store</h1>
        <p className="mt-1 text-sm text-slate-500">
          Storefront integration keeps your workspace ready for when sync goes live.
        </p>
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          {initialError && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {ERROR_MESSAGES[initialError] ?? 'Something went wrong.'}
            </div>
          )}

          <form action={createStorefrontStore} className="space-y-4">
            <StoreFields />

            {/* Integration coming-soon card */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-slate-700">Shopify / WooCommerce Sync</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    Automatic webhook-driven inventory sync is in private beta. Your store will
                    use manual management until your integration slot opens.
                  </p>
                </div>
                <span className="shrink-0 inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-700">
                  Coming soon
                </span>
              </div>
            </div>

            <button
              type="submit"
              className="w-full rounded-md bg-green-900 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 transition-colors"
            >
              Continue to dashboard
            </button>
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
