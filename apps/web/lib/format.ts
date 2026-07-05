export function formatTND(n: string | number) {
  return new Intl.NumberFormat('fr-TN', {
    style: 'currency',
    currency: 'TND',
    maximumFractionDigits: 0,
  }).format(Number(n));
}
