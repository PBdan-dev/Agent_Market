export function formatPrice(priceCents: number | null, currency: string, unit: string | null): string {
  if (priceCents === null) return "Prix sur demande";
  if (priceCents === 0) return "Gratuit";
  const amount = new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(priceCents / 100);
  return unit ? `${amount} ${unit}` : amount;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(date);
}
