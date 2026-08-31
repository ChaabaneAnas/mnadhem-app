'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { useErrorMessage } from '@/lib/api-error';
import { cancelOrder } from '../actions';
import type { Order } from './types';

export function CancelModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const t = useTranslations('orders');
  const getError = useErrorMessage();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCancel() {
    startTransition(async () => {
      try {
        await cancelOrder(order.id);
        onClose();
      } catch (err) {
        setError(getError(err));
      }
    });
  }

  return (
    <ResponsiveModal title={t('cancelTitle')} onClose={onClose}>
      <p className="mb-4 text-sm text-muted-foreground">
        {t('cancelConfirm', { reference: order.reference })}
      </p>
      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          className="rounded-md border-border text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-muted-foreground"
        >
          {t('keepOrder')}
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={handleCancel}
          disabled={pending}
          className="rounded-md bg-red-600 text-xs font-medium transition-colors hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? t('cancelling') : t('cancel')}
        </Button>
      </div>
    </ResponsiveModal>
  );
}
