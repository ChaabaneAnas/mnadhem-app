'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

interface TimeseriesPoint {
  date: string;
  orders: number;
  cod: number;
}

/** Formats a YYYY-MM-DD key as a short weekday+day label in the active locale. */
function formatTick(date: string, locale: string) {
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric' });
}

export function OrdersChart({ data }: { data: TimeseriesPoint[] }) {
  const t = useTranslations('dashboard');
  const locale = useLocale();

  const chartConfig = {
    orders: {
      label: t('chartOrders'),
      color: 'var(--chart-1)',
    },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={chartConfig} className="h-[220px] w-full">
      <BarChart accessibilityLayer data={data} margin={{ top: 8, left: 4, right: 4 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(v) => formatTick(String(v), locale)}
        />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent labelFormatter={(v) => formatTick(String(v), locale)} />}
        />
        <Bar dataKey="orders" fill="var(--color-orders)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
