/**
 * Helper tanggal UTC murni (6.1). Semua perhitungan memakai `Date.UTC` sehingga
 * tidak terpengaruh zona waktu mesin yang menjalankan kode.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const INDONESIAN_DAY_NAMES_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
export const INDONESIAN_DAY_NAMES_FULL = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
];
export const INDONESIAN_MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];
export const INDONESIAN_MONTHS_FULL = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

/** Membuat Date UTC pukul 00:00 dari komponen tanggal. */
export function createDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

/** Memeriksa format dan keabsahan tanggal ISO `YYYY-MM-DD`. */
export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map((part) => Number.parseInt(part, 10));
  if (year === undefined || month === undefined || day === undefined) return false;
  const date = createDate(year, month, day);
  return toIsoDate(date) === value;
}

/** Mengubah string ISO menjadi Date UTC; melempar error bila tidak valid. */
export function parseIsoDate(value: string): Date {
  if (!isValidIsoDate(value)) {
    throw new Error(`Tanggal tidak valid: "${value}". Format yang benar: YYYY-MM-DD.`);
  }
  const [year, month, day] = value.split('-').map((part) => Number.parseInt(part, 10)) as [
    number,
    number,
    number,
  ];
  return createDate(year, month, day);
}

/** Mengubah Date UTC menjadi string ISO `YYYY-MM-DD`. */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, amount: number): Date {
  return new Date(date.getTime() + amount * DAY_MS);
}

export function compareDates(a: Date, b: Date): number {
  return a.getTime() - b.getTime();
}

export function isSameDate(a: Date, b: Date): boolean {
  return a.getTime() === b.getTime();
}

export function isBefore(a: Date, b: Date): boolean {
  return a.getTime() < b.getTime();
}

export function isAfter(a: Date, b: Date): boolean {
  return a.getTime() > b.getTime();
}

export function dayOfWeek(date: Date): number {
  return date.getUTCDay();
}

/** Selisih hari kalender (b - a) tanpa memperhatikan hari kerja. */
export function calendarDaysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

/** Daftar tanggal dari `from` sampai `to` (inklusif). Kosong bila `to` < `from`. */
export function eachDate(from: Date, to: Date): Date[] {
  const dates: Date[] = [];
  for (let cursor = from; !isAfter(cursor, to); cursor = addDays(cursor, 1)) {
    dates.push(cursor);
  }
  return dates;
}

export function minDate(dates: readonly Date[]): Date {
  if (dates.length === 0) throw new Error('minDate: daftar tanggal kosong');
  return dates.reduce((acc, current) => (isBefore(current, acc) ? current : acc));
}

export function maxDate(dates: readonly Date[]): Date {
  if (dates.length === 0) throw new Error('maxDate: daftar tanggal kosong');
  return dates.reduce((acc, current) => (isAfter(current, acc) ? current : acc));
}

/** "12 Okt 2026" */
export function formatIsoDateShort(value: string | Date): string {
  const date = typeof value === 'string' ? parseIsoDate(value) : value;
  const day = date.getUTCDate();
  const month = INDONESIAN_MONTHS_SHORT[date.getUTCMonth()] ?? '';
  return `${day} ${month} ${date.getUTCFullYear()}`;
}

/** "Sen, 12 Okt 2026" */
export function formatIsoDateWithDay(value: string | Date): string {
  const date = typeof value === 'string' ? parseIsoDate(value) : value;
  const dayName = INDONESIAN_DAY_NAMES_SHORT[dayOfWeek(date)] ?? '';
  return `${dayName}, ${formatIsoDateShort(date)}`;
}

/** "Senin, 12 Oktober 2026" */
export function formatIsoDateLong(value: string | Date): string {
  const date = typeof value === 'string' ? parseIsoDate(value) : value;
  const dayName = INDONESIAN_DAY_NAMES_FULL[dayOfWeek(date)] ?? '';
  const month = INDONESIAN_MONTHS_FULL[date.getUTCMonth()] ?? '';
  return `${dayName}, ${date.getUTCDate()} ${month} ${date.getUTCFullYear()}`;
}

/** "Okt 2026" */
export function formatMonthYear(value: string | Date): string {
  const date = typeof value === 'string' ? parseIsoDate(value) : value;
  const month = INDONESIAN_MONTHS_SHORT[date.getUTCMonth()] ?? '';
  return `${month} ${date.getUTCFullYear()}`;
}
