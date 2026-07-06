/** "Blue / XL" → "BLUE-XL", used to derive variant SKUs from the product SKU. */
export function slugifySku(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
