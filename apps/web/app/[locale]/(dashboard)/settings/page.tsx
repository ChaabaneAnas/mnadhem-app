'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';

export default function SettingsPage() {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const body = {
      name: data.get('name'),
      slug: data.get('slug'),
      yalidineApiKey: data.get('yalidineApiKey') || undefined,
      aramexApiKey: data.get('aramexApiKey') || undefined,
      jexportApiKey: data.get('jexportApiKey') || undefined,
    };

    try {
      const res = await fetch(
        `/api/settings/tenant`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      );
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      // silent — production should add proper error handling
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-lg">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">{t('title')}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Store details */}
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">{t('storeDetails')}</h2>

          <div className="space-y-1.5">
            <Label htmlFor="name">{t('storeName')}</Label>
            <Input id="name" name="name" placeholder="My Store" className="text-sm" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="slug">{t('slug')}</Label>
            <Input id="slug" name="slug" placeholder="my-store" className="text-sm font-mono" />
            <p className="text-xs text-muted-foreground">{t('slugHint')}</p>
          </div>
        </div>

        {/* Courier API keys */}
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">{t('courierKeys')}</h2>
          <p className="text-xs text-muted-foreground">
            {t('courierKeysDesc')}
          </p>

          <Separator />

          {[
            { name: 'yalidineApiKey', label: 'Yalidine', placeholder: 'yal_...' },
            { name: 'aramexApiKey', label: 'Aramex', placeholder: 'amx_...' },
            { name: 'jexportApiKey', label: 'Jexport', placeholder: 'jxp_...' },
          ].map(({ name, label, placeholder }) => (
            <div key={name} className="space-y-1.5">
              <Label htmlFor={name}>{label}</Label>
              <Input id={name} name={name} type="password" placeholder={placeholder} className="text-sm font-mono" />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            className="rounded-md text-sm font-medium transition-colors"
          >
            {tc('saveChanges')}
          </Button>
          {saved && <span className="text-xs text-green-700 dark:text-green-400">{t('savedSuccess')}</span>}
        </div>
      </form>
    </div>
  );
}
