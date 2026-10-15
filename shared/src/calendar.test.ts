import { describe, expect, it } from 'vitest';

import {
  calendarFromProject,
  createCalendar,
  dateFromWorkingDayOrdinal,
  isWorkingDay,
  nextWorkingDay,
  previousWorkingDay,
  shiftWorkingDays,
  validateWeekendDays,
  workingDayOrdinal,
  workingDaysBetween,
  workingDaysInRange,
} from './calendar.js';
import { parseIsoDate, toIsoDate } from './dates.js';

const calendar = createCalendar({ weekendDays: [0, 6] });
const withHoliday = createCalendar({ weekendDays: [0, 6], holidays: ['2026-10-26'] });

describe('kalender proyek', () => {
  it('menolak akhir pekan tujuh hari', () => {
    expect(validateWeekendDays([0, 1, 2, 3, 4, 5, 6])).toMatch(/semua hari/i);
    expect(validateWeekendDays([])).toMatch(/minimal satu hari/i);
    expect(validateWeekendDays([0, 6])).toBeNull();
    expect(() => createCalendar({ weekendDays: [0, 1, 2, 3, 4, 5, 6] })).toThrow();
  });

  it('mengenali akhir pekan dan hari libur', () => {
    expect(isWorkingDay(calendar, parseIsoDate('2026-10-23'))).toBe(true); // Jumat
    expect(isWorkingDay(calendar, parseIsoDate('2026-10-24'))).toBe(false); // Sabtu
    expect(isWorkingDay(calendar, parseIsoDate('2026-10-25'))).toBe(false); // Minggu
    expect(isWorkingDay(withHoliday, parseIsoDate('2026-10-26'))).toBe(false); // Libur Senin
  });

  it('memajukan tanggal ke hari kerja berikutnya', () => {
    expect(toIsoDate(nextWorkingDay(calendar, parseIsoDate('2026-10-23')))).toBe('2026-10-23');
    expect(toIsoDate(nextWorkingDay(calendar, parseIsoDate('2026-10-24')))).toBe('2026-10-26');
    expect(toIsoDate(nextWorkingDay(withHoliday, parseIsoDate('2026-10-24')))).toBe('2026-10-27');
    expect(toIsoDate(previousWorkingDay(calendar, parseIsoDate('2026-10-26')))).toBe('2026-10-26');
    expect(toIsoDate(previousWorkingDay(calendar, parseIsoDate('2026-10-25')))).toBe('2026-10-23');
  });

  it('menggeser hari kerja termasuk mundur', () => {
    expect(toIsoDate(shiftWorkingDays(calendar, parseIsoDate('2026-10-23'), 1))).toBe('2026-10-26');
    expect(toIsoDate(shiftWorkingDays(calendar, parseIsoDate('2026-10-23'), 2))).toBe('2026-10-27');
    expect(toIsoDate(shiftWorkingDays(calendar, parseIsoDate('2026-10-26'), -1))).toBe('2026-10-23');
    expect(toIsoDate(shiftWorkingDays(calendar, parseIsoDate('2026-10-23'), 0))).toBe('2026-10-23');
    // Tanggal non-kerja disnap ke hari kerja berikutnya lebih dahulu
    expect(toIsoDate(shiftWorkingDays(calendar, parseIsoDate('2026-10-24'), 0))).toBe('2026-10-26');
  });

  it('menghitung hari kerja secara inklusif', () => {
    expect(
      workingDaysBetween(calendar, parseIsoDate('2026-10-19'), parseIsoDate('2026-10-23')),
    ).toBe(5);
    expect(
      workingDaysBetween(calendar, parseIsoDate('2026-10-23'), parseIsoDate('2026-10-27')),
    ).toBe(3); // Jumat, Senin, Selasa
    expect(
      workingDaysBetween(withHoliday, parseIsoDate('2026-10-23'), parseIsoDate('2026-10-28')),
    ).toBe(3); // libur Senin 26 tidak dihitung
    expect(
      workingDaysBetween(calendar, parseIsoDate('2026-10-26'), parseIsoDate('2026-10-23')),
    ).toBe(0);
  });

  it('mengembalikan daftar hari kerja dalam rentang', () => {
    expect(
      workingDaysInRange(calendar, parseIsoDate('2026-10-23'), parseIsoDate('2026-10-27')).map(
        toIsoDate,
      ),
    ).toEqual(['2026-10-23', '2026-10-26', '2026-10-27']);
  });

  it('menghitung ordinal hari kerja dua arah', () => {
    const origin = parseIsoDate('2026-10-19');
    expect(workingDayOrdinal(calendar, origin, parseIsoDate('2026-10-19'))).toBe(0);
    expect(workingDayOrdinal(calendar, origin, parseIsoDate('2026-10-20'))).toBe(1);
    expect(workingDayOrdinal(calendar, origin, parseIsoDate('2026-10-26'))).toBe(5);
    expect(workingDayOrdinal(calendar, origin, parseIsoDate('2026-10-16'))).toBe(-1);
    expect(toIsoDate(dateFromWorkingDayOrdinal(calendar, origin, 5))).toBe('2026-10-26');
    expect(toIsoDate(dateFromWorkingDayOrdinal(calendar, origin, 0))).toBe('2026-10-19');
  });

  it('membangun kalender dari bentuk yang disimpan di database', () => {
    const fromDb = calendarFromProject({ weekendDays: '0,6', holidays: ['2026-11-11'] });
    expect(isWorkingDay(fromDb, parseIsoDate('2026-11-11'))).toBe(false);
    expect([...fromDb.weekendDays].sort()).toEqual([0, 6]);
  });
});
