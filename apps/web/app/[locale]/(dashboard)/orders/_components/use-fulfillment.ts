'use client';

import { useCallback, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useErrorMessage } from '@/lib/api-error';
import { toast } from '@/hooks/use-toast';
import {
  generateAwbs as generateAwbsAction,
  printLabels as printLabelsAction,
  requestPickups as requestPickupsAction,
  type FulfillmentResult,
  type SkippedOrder,
} from '../actions';

/**
 * Runs the three fulfillment actions and turns their `{ succeeded, skipped }`
 * result into a toast.
 *
 * Reporting the skipped orders is the whole point — spec section 4.D requires
 * the merchant be told how many were left behind and why, rather than silently
 * acting on a subset. The remittance page's bulk action discards the same shape
 * and says nothing, which is the behaviour this deliberately does not copy.
 */

export type FulfillmentAction = 'awb' | 'pickup' | 'print';

/**
 * Distinct skip reasons, most common first, so a toast lists "no label yet"
 * once rather than repeating it per order.
 */
function distinctReasons(skipped: SkippedOrder[]): string[] {
  const counts = new Map<string, number>();
  for (const entry of skipped) {
    counts.set(entry.reason, (counts.get(entry.reason) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([reason]) => reason);
}

export function useFulfillment(onDone?: () => void) {
  const t = useTranslations('orders');
  const getError = useErrorMessage();
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState<FulfillmentAction | null>(null);

  const report = useCallback(
    (action: FulfillmentAction, result: FulfillmentResult) => {
      const { succeeded, skipped } = result;
      const reasons = distinctReasons(skipped).map(getError).join(' ');

      if (succeeded > 0 && skipped.length === 0) {
        toast({
          variant: 'success',
          title:
            action === 'awb'
              ? t('awbDone', { count: succeeded })
              : action === 'pickup'
                ? t('pickupDone', { count: succeeded })
                : t('printDone', { count: succeeded }),
        });
        return;
      }

      if (succeeded > 0) {
        toast({
          variant: 'warning',
          title:
            action === 'awb'
              ? t('awbPartial', { done: succeeded, skipped: skipped.length })
              : action === 'pickup'
                ? t('pickupPartial', { ready: succeeded, skipped: skipped.length })
                : t('printPartial', { done: succeeded, skipped: skipped.length }),
          description: reasons,
        });
        return;
      }

      // Nothing succeeded: the reasons are the message, not a footnote.
      toast({
        variant: 'destructive',
        title:
          action === 'awb'
            ? t('awbNone')
            : action === 'pickup'
              ? t('pickupNone')
              : t('printNone'),
        description: reasons,
      });
    },
    [getError, t],
  );

  /** Hands the merged PDF to the browser as a download. */
  const downloadPdf = useCallback(
    (pdfBase64: string) => {
      const bytes = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));

      const link = document.createElement('a');
      link.href = url;
      link.download = `${t('labelFileName')}-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      // Revoked on the next tick; revoking synchronously can cancel the download.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    },
    [t],
  );

  const run = useCallback(
    (action: FulfillmentAction, orderIds: string[]) => {
      if (orderIds.length === 0) return;
      setRunning(action);

      startTransition(async () => {
        try {
          if (action === 'print') {
            const result = await printLabelsAction(orderIds);
            if (result.pdfBase64) downloadPdf(result.pdfBase64);
            report('print', result);
          } else {
            const result =
              action === 'awb'
                ? await generateAwbsAction(orderIds)
                : await requestPickupsAction(orderIds);
            report(action, result);
          }
          onDone?.();
        } catch (err) {
          // A thrown error is a whole-action failure (no default carrier, auth,
          // network) rather than a per-order skip.
          toast({ variant: 'destructive', title: getError(err) });
        } finally {
          setRunning(null);
        }
      });
    },
    [downloadPdf, getError, onDone, report],
  );

  return {
    run,
    pending,
    running,
    /** Label for a button while its own action is in flight. */
    labelFor: (action: FulfillmentAction, idle: string) =>
      running === action
        ? action === 'awb'
          ? t('generating')
          : action === 'pickup'
            ? t('requesting')
            : t('printing')
        : idle,
  };
}
