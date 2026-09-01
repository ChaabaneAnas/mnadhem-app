'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { signUpWithCredentials } from './actions';

export function SignUpForm({ locale }: { locale: string }) {
  const t = useTranslations('auth.signUp');
  const tv = useTranslations('validation');

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, { message: tv('required') }),
        email: z.string().trim().min(1, { message: tv('required') }).email({
          message: tv('email'),
        }),
        // The placeholder has always promised a minimum; now it is enforced
        // before the account is created rather than not at all.
        password: z.string().min(8, { message: tv('minLength', { count: 8 }) }),
      }),
    [tv],
  );

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const [submitError, setSubmitError] = useState<string | null>(null);

  async function onSubmit(values: z.infer<typeof schema>) {
    setSubmitError(null);
    const result = await signUpWithCredentials({ ...values, locale });
    if (!result?.error) return;

    // The server's verdict on the submission, reported as such rather than
    // pinned to an input the user may well have typed correctly.
    setSubmitError(
      result.error === 'email_taken' ? t('errorEmailTaken') : t('errorMissingFields'),
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {submitError && (
          <div className="rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {submitError}
          </div>
        )}

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="gap-1">
              <FormLabel>{t('fullName')}</FormLabel>
              <FormControl>
                <Input placeholder="Ahmed Benali" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="gap-1">
              <FormLabel>{t('email')}</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem className="gap-1">
              <FormLabel>{t('password')}</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder={t('passwordPlaceholder')}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="w-full rounded-md text-sm font-medium transition-colors"
        >
          {t('submit')}
        </Button>
      </form>
    </Form>
  );
}
