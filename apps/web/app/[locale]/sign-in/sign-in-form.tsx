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
import { signInWithCredentials } from './actions';

export function SignInForm({
  callbackUrl,
  initialError,
}: {
  callbackUrl?: string;
  initialError?: string;
}) {
  const t = useTranslations('auth.signIn');
  const tv = useTranslations('validation');

  const schema = useMemo(
    () =>
      z.object({
        email: z.string().trim().min(1, { message: tv('required') }).email({
          message: tv('email'),
        }),
        password: z.string().min(1, { message: tv('required') }),
      }),
    [tv],
  );

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  // Auth.js can still land here with `?error=` from flows outside this form.
  const [submitError, setSubmitError] = useState<string | null>(
    initialError
      ? initialError === 'CredentialsSignin'
        ? t('errorInvalid')
        : t('errorGeneric')
      : null,
  );

  async function onSubmit(values: z.infer<typeof schema>) {
    setSubmitError(null);
    const result = await signInWithCredentials({ ...values, callbackUrl });
    // Success redirects, so anything returned here is a failure. Which of the
    // two fields was wrong is deliberately not disclosed.
    if (result?.error) {
      setSubmitError(result.error === 'invalid' ? t('errorInvalid') : t('errorGeneric'));
    }
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
                  autoComplete="current-password"
                  placeholder="••••••••"
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
