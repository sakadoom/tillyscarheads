/**
 * Kalender proyek (6.2): akhir pekan yang dapat diatur dan daftar hari libur.
 * Durasi tugas hanya menghitung hari kerja.
 */

import { addDays, dayOfWeek, eachDate, isAfter, isSameDate, toIsoDate } from './dates.js';
import { DEFAULT_WEEKEND_DAYS, parseWeekendDays } from './types.js';

export interface ProjectCalendar {
  weekendDays: ReadonlySet<number>;
  holidays: ReadonlySet<string>;
}

export interface CalendarConfig {
  weekendDays: readonly number[];
  holidays?: readonly string[];
}

/** Batas iterasi agar kalender yang salah tidak membuat perulangan tanpa henti. */
const MAX_SCAN_DAYS = 20000;

export function validateWeekendDays(days: readonly number[]): string | null {
  if (days.length === 0) return 'Pilih minimal satu hari sebagai akhir pekan.';
  const unique = new Set(days);
  for (const day of unique) {
    if (!Number.isInteger(day) || day < 0 || day > 6) {
      return 'Hari akhir pekan harus berupa angka 0 (Minggu) sampai 6 (Sabtu).';
    }
  }
  if (unique.size === 7) return 'Semua hari tidak boleh ditandai sebagai akhir pekan.';
  return null;
}

export function createCalendar(config: CalendarConfig): ProjectCalendar {
  const error = validateWeekendDays(config.weekendDays);
  if (error) throw new Error(error);
  return {
    weekendDays: new Set(config.weekendDays),
    holidays: new Set(config.holidays ?? []),
  };
}

/** Membangun kalender dari bentuk yang disimpan di database. */
export function calendarFromProject(project: {
  weekendDays: string | readonly number[];
  holidays?: readonly string[];
}): ProjectCalendar {
  const weekendDays =
    typeof project.weekendDays === 'string'
      ? parseWeekendDays(project.weekendDays)
      : [...project.weekendDays];
  return createCalendar({
    weekendDays: weekendDays.length > 0 ? weekendDays : [...DEFAULT_WEEKEND_DAYS],
    holidays: project.holidays ?? [],
  });
}

export function isWorkingDay(calendar: ProjectCalendar, date: Date): boolean {
  if (calendar.weekendDays.has(dayOfWeek(date))) return false;
  return !calendar.holidays.has(toIsoDate(date));
}

/** Tanggal itu sendiri bila hari kerja, jika tidak maju ke hari kerja berikutnya. */
export function nextWorkingDay(calendar: ProjectCalendar, date: Date): Date {
  let cursor = date;
  for (let scanned = 0; scanned < MAX_SCAN_DAYS; scanned += 1) {
    if (isWorkingDay(calendar, cursor)) return cursor;
    cursor = addDays(cursor, 1);
  }
  throw new Error('Kalender tidak punya hari kerja sama sekali.');
}

/**
 * Tanggal itu sendiri bila hari kerja, jika tidak mundur ke hari kerja
 * sebelumnya (dipakai untuk menggeser mundur).
 */
export function previousWorkingDay(calendar: ProjectCalendar, date: Date): Date {
  let cursor = date;
  for (let scanned = 0; scanned < MAX_SCAN_DAYS; scanned += 1) {
    if (isWorkingDay(calendar, cursor)) return cursor;
    cursor = addDays(cursor, -1);
  }
  throw new Error('Kalender tidak punya hari kerja sama sekali.');
}

/**
 * Menggeser tanggal sebanyak `amount` hari kerja (boleh negatif). Bila `date`
 * bukan hari kerja, tanggal itu disnap ke hari kerja berikutnya lebih dahulu.
 */
export function shiftWorkingDays(calendar: ProjectCalendar, date: Date, amount: number): Date {
  let cursor = isWorkingDay(calendar, date) ? date : nextWorkingDay(calendar, date);
  let remaining = amount;
  while (remaining > 0) {
    cursor = nextWorkingDay(calendar, addDays(cursor, 1));
    remaining -= 1;
  }
  while (remaining < 0) {
    cursor = previousWorkingDay(calendar, addDays(cursor, -1));
    remaining += 1;
  }
  return cursor;
}

/**
 * Jumlah hari kerja antara `from` dan `to` (inklusif). Bila `to` lebih awal dari
 * `from`, hasilnya 0.
 */
export function workingDaysBetween(calendar: ProjectCalendar, from: Date, to: Date): number {
  if (isAfter(from, to)) return 0;
  let count = 0;
  for (const date of eachDate(from, to)) {
    if (isWorkingDay(calendar, date)) count += 1;
  }
  return count;
}

/** Daftar hari kerja dalam rentang (inklusif). */
export function workingDaysInRange(calendar: ProjectCalendar, from: Date, to: Date): Date[] {
  if (isAfter(from, to)) return [];
  return eachDate(from, to).filter((date) => isWorkingDay(calendar, date));
}

/**
 * Ordinal hari kerja: jumlah hari kerja dari `origin` (ordinal 0) sampai `date`.
 * Bernilai negatif bila `date` sebelum `origin`.
 */
export function workingDayOrdinal(calendar: ProjectCalendar, origin: Date, date: Date): number {
  if (isSameDate(origin, date)) return 0;
  if (isAfter(date, origin)) return workingDaysBetween(calendar, origin, date) - 1;
  return -(workingDaysBetween(calendar, date, origin) - 1);
}

/** Membalik ordinal hari kerja menjadi tanggal. */
export function dateFromWorkingDayOrdinal(
  calendar: ProjectCalendar,
  origin: Date,
  ordinal: number,
): Date {
  return shiftWorkingDays(calendar, origin, ordinal);
}

/** Daftar tanggal non-kerja (akhir pekan atau libur) dalam rentang. */
export function nonWorkingDaysInRange(
  calendar: ProjectCalendar,
  from: Date,
  to: Date,
): Date[] {
  if (isAfter(from, to)) return [];
  return eachDate(from, to).filter((date) => !isWorkingDay(calendar, date));
}
