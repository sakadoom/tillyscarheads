import { formatIsoDateShort, formatIsoDateWithDay } from 'shared';

export { formatIsoDateLong, formatIsoDateShort, formatIsoDateWithDay, formatMonthYear } from 'shared';

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('id-ID');

/** "Rp 1.250.000" */
export function formatCurrency(value: number): string {
  return currencyFormatter.format(Math.round(value));
}

/** "Rp 15 jt" untuk ringkasan yang sempit. */
export function formatCurrencyCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)} M`;
  if (Math.abs(value) >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)} jt`;
  return formatCurrency(value);
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatDateRange(start: string | null, end: string | null): string {
  if (!start || !end) return 'Belum dijadwalkan';
  return `${formatIsoDateShort(start)} – ${formatIsoDateShort(end)}`;
}

export function formatDayLabel(isoDate: string): string {
  return formatIsoDateWithDay(isoDate);
}

/** Tanggal hari ini dalam bentuk ISO berdasarkan waktu lokal pengguna. */
export function todayIso(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}
