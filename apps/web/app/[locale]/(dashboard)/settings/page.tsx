'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { toast } from '@/hooks/use-toast';
import { useErrorMessage } from '@/lib/api-error';
import { AramexForm } from './_components/aramex-form';
import { getAramexAccount, updateStore, type AramexAccountView } from './actions';

/**
 * Mirrors `CreateTenantDto`: name is `@MinLength(2)`, slug is
 * `@Matches(/^[a-z0-9-]+$/)`. Blank stays legal on both — the store keeps the
 * value it already has, which is what makes a partial save possible.
 */
function useStoreSchema() {
  const tv = useTranslations('validation');
  const te = useTranslations('errors');

  return useMemo(
    () =>
      z.object({
        name: z
          .string()
          .trim()
          .refine((v) => v.length === 0 || v.length >= 2, {
            message: tv('minLength', { count: 2 }),
          }),
        slug: z
          .string()
          .trim()
          .refine((v) => v.length === 0 || /^[a-z0-9-]+$/.test(v), {
            message: te('SLUG_INVALID_FORMAT'),
          }),
      }),
    [tv, te],
  );
}

export default function SettingsPage() {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const getError = useErrorMessage();

  const [account, setAccount] = useState<AramexAccountView | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [reloadCount, setReloadCount] = useState(0);

  const schema = useStoreSchema();
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', slug: '' },
  });

  /**
   * Stable by construction: it closes over nothing and only bumps a counter,
   * so passing it to child components can never re-trigger the fetch below.
   */
  const reloadAccounts = useCallback(() => setReloadCount((n) => n + 1), []);

  /**
   * Depends only on the reload counter. Deliberately does not close over the
   * error translator or a toast call — an effect that both fetches and depends
   * on a function identity re-runs on every render, which is an unbounded
   * request loop. The failure is held as state and rendered below instead.
   */
  useEffect(() => {
    let cancelled = false;

    getAramexAccount()
      .then((data) => {
        if (cancelled) return;
        setAccount(data);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadCount]);

  /**
   * Errors used to be swallowed here with a `// silent` comment, so a rejected
   * slug looked identical to a successful save.
   */
  async function onSubmit(values: z.infer<typeof schema>) {
    try {
      await updateStore({
        ...(values.name ? { name: values.name } : {}),
        ...(values.slug ? { slug: values.slug } : {}),
      });
      toast({ variant: 'success', title: t('savedSuccess') });
    } catch (err) {
      toast({ variant: 'destructive', title: getError(err) });
    }
  }

  return (
    <div className="max-w-2xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">{t('title')}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mb-8">
          <div className="space-y-4 rounded-lg border border-border bg-card p-6">
            <h2 className="text-sm font-semibold text-foreground">{t('storeDetails')}</h2>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="gap-1.5">
                  <FormLabel>{t('storeName')}</FormLabel>
                  <FormControl>
                    <Input placeholder="My Store" className="text-sm" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem className="gap-1.5">
                  <FormLabel>{t('slug')}</FormLabel>
                  <FormControl>
                    <Input placeholder="my-store" className="font-mono text-sm" {...field} />
                  </FormControl>
                  <FormDescription className="text-xs">{t('slugHint')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              size="sm"
              disabled={form.formState.isSubmitting}
              className="rounded-md text-xs font-medium"
            >
              {form.formState.isSubmitting ? tc('saving') : tc('saveChanges')}
            </Button>
          </div>
        </form>
      </Form>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{t('courierKeys')}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t('carriersDesc')}</p>
        </div>

        {loadError ? (
          // Rendered rather than toasted: a page that failed to load is a
          // standing state the merchant can retry, not a transient event.
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400">
            <AlertCircle size={14} className="shrink-0" />
            <span className="min-w-0 flex-1">{getError(loadError)}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={reloadAccounts}
              className="rounded-md text-xs"
            >
              {tc('retry')}
            </Button>
          </div>
        ) : account === null ? (
          <Skeleton className="h-96 w-full rounded-lg" />
        ) : (
          <AramexForm account={account} onSaved={reloadAccounts} />
        )}
      </section>
    </div>
  );
}
