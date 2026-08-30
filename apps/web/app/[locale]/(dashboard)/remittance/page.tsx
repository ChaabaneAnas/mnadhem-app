import { getTranslations } from 'next-intl/server';
import { apiRequest } from '@/lib/api';
import { formatTND } from '@/lib/format';
import { RemittanceTable, type AwaitingShipment } from './_components/remittance-table';

export default async function RemittancePage() {
  const t = await getTranslations('remittance');

  const shipments = await apiRequest<AwaitingShipment[]>(
    '/shipments/awaiting-remittance',
  ).catch((): AwaitingShipment[] => []);

  // collectedCash is stamped on delivery; fall back to the order's COD amount so
  // a row still shows a figure if an older shipment predates that write.
  const total = shipments.reduce(
    (sum, s) => sum + Number(s.collectedCash ?? s.order.codAmount),
    0,
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">{t('title')}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="mb-4 rounded-lg border border-border bg-card p-5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t('totalOutstanding')}
        </span>
        <div className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
          {formatTND(total)}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('parcelCount', { count: shipments.length })}
        </p>
      </div>

      <RemittanceTable shipments={shipments} />
    </div>
  );
}
