import { describe, expect, it } from 'vitest';

import {
  addDays,
  calendarDaysBetween,
  eachDate,
  formatIsoDateLong,
  formatIsoDateShort,
  isValidIsoDate,
  parseIsoDate,
  toIsoDate,
  dayOfWeek,
} from './dates.js';

describe('tanggal UTC murni', () => {
  it('mengubah string ISO menjadi Date tanpa pergeseran hari', () => {
    const date = parseIsoDate('2026-10-23');
    expect(date.getUTCFullYear()).toBe(2026);
    expect(date.getUTCMonth()).toBe(9);
    expect(date.getUTCDate()).toBe(23);
    expect(date.getUTCHours()).toBe(0);
    expect(toIsoDate(date)).toBe('2026-10-23');
  });

  it('menolak format dan tanggal yang tidak ada', () => {
    expect(isValidIsoDate('2026-10-23')).toBe(true);
    expect(isValidIsoDate('2026-1-1')).toBe(false);
    expect(isValidIsoDate('2026-02-30')).toBe(false);
    expect(isValidIsoDate('2026-13-01')).toBe(false);
    expect(isValidIsoDate('23-10-2026')).toBe(false);
    expect(isValidIsoDate('bukan tanggal')).toBe(false);
    expect(() => parseIsoDate('2026-02-30')).toThrow(/tidak valid/i);
  });

  it('menambah hari melintasi bulan dan tahun', () => {
    expect(toIsoDate(addDays(parseIsoDate('2026-10-31'), 1))).toBe('2026-11-01');
    expect(toIsoDate(addDays(parseIsoDate('2026-12-31'), 1))).toBe('2027-01-01');
    expect(toIsoDate(addDays(parseIsoDate('2027-01-01'), -1))).toBe('2026-12-31');
  });

  it('menghitung selisih hari kalender', () => {
    expect(calendarDaysBetween(parseIsoDate('2026-10-19'), parseIsoDate('2026-10-23'))).toBe(4);
    expect(calendarDaysBetween(parseIsoDate('2026-10-23'), parseIsoDate('2026-10-19'))).toBe(-4);
  });

  it('membuat daftar tanggal inklusif', () => {
    const dates = eachDate(parseIsoDate('2026-10-23'), parseIsoDate('2026-10-26'));
    expect(dates.map(toIsoDate)).toEqual([
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
    ]);
    expect(eachDate(parseIsoDate('2026-10-26'), parseIsoDate('2026-10-23'))).toEqual([]);
  });

  it('mengenali hari dalam minggu', () => {
    expect(dayOfWeek(parseIsoDate('2026-10-23'))).toBe(5); // Jumat
    expect(dayOfWeek(parseIsoDate('2026-10-24'))).toBe(6); // Sabtu
    expect(dayOfWeek(parseIsoDate('2026-10-25'))).toBe(0); // Minggu
    expect(dayOfWeek(parseIsoDate('2026-10-19'))).toBe(1); // Senin
  });

  it('memformat tanggal dalam bahasa Indonesia', () => {
    expect(formatIsoDateShort('2026-10-23')).toBe('23 Okt 2026');
    expect(formatIsoDateLong('2026-10-23')).toBe('Jumat, 23 Oktober 2026');
    expect(formatIsoDateLong('2026-12-25')).toBe('Jumat, 25 Desember 2026');
  });
});
