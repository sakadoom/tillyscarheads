import {
  addDays,
  calendarDaysBetween,
  eachDate,
  formatIsoDateShort,
  formatMonthYear,
  isWorkingDay,
  parseIsoDate,
  toIsoDate,
  type ProjectCalendar,
} from 'shared';

export type ZoomLevel = 'day' | 'week' | 'month';

/** Lebar satu hari (px) per tingkat zoom. */
export const DAY_WIDTH: Record<ZoomLevel, number> = {
  day: 34,
  week: 13,
  month: 5,
};

export const ROW_HEIGHT = 40;
export const HEADER_HEIGHT = 56;

export const ZOOM_LABELS: Record<ZoomLevel, string> = {
  day: 'Hari',
  week: 'Minggu',
  month: 'Bulan',
};

export interface TimelineDay {
  iso: string;
  x: number;
  width: number;
  isWorking: boolean;
  isHoliday: boolean;
  isToday: boolean;
  /** Label tanggal ditampilkan bila kolomnya cukup lebar. */
  label: string | null;
  isWeekStart: boolean;
}

export interface TimelineMonth {
  label: string;
  x: number;
  width: number;
}

export interface TimelineScale {
  zoom: ZoomLevel;
  dayWidth: number;
  totalWidth: number;
  start: string;
  end: string;
  days: TimelineDay[];
  months: TimelineMonth[];
  todayX: number | null;
}

export interface TimelineInput {
  /** Rentang tanggal yang wajib terlihat (biasanya scheduledStart tugas). */
  earliest: string | null;
  /** Rentang tanggal terakhir yang wajib terlihat. */
  latest: string | null;
  calendar: ProjectCalendar;
  holidays: ReadonlySet<string>;
  zoom: ZoomLevel;
  today: string;
  paddingDays?: number;
}

/** Membuat skala timeline: posisi x dihitung dari tanggal, bukan indeks hari. */
export function createTimelineScale({
  earliest,
  latest,
  calendar,
  holidays,
  zoom,
  today,
  paddingDays = 3,
}: TimelineInput): TimelineScale {
  const dayWidth = DAY_WIDTH[zoom];
  const todayDate = parseIsoDate(today);

  const firstDate = earliest ? addDays(parseIsoDate(earliest), -paddingDays) : addDays(todayDate, -7);
  const lastDate = latest
    ? addDays(parseIsoDate(latest), paddingDays)
    : addDays(todayDate, 21);

  const start = firstDate;
  const end = lastDate;

  const days: TimelineDay[] = eachDate(start, end).map((date) => {
    const iso = toIsoDate(date);
    const weekday = date.getUTCDay();
    const isHoliday = holidays.has(iso);
    const isWorking = isWorkingDay(calendar, date);
    const x = calendarDaysBetween(start, date) * dayWidth;
    return {
      iso,
      x,
      width: dayWidth,
      isWorking,
      isHoliday,
      isToday: iso === today,
      isWeekStart: weekday === 1,
      label:
        dayWidth >= 24
          ? String(date.getUTCDate())
          : zoom === 'week' && weekday === 1
            ? formatIsoDateShort(iso).slice(0, 6)
            : null,
    };
  });

  const months: TimelineMonth[] = [];
  for (const day of days) {
    const date = parseIsoDate(day.iso);
    const label = formatMonthYear(day.iso);
    const existing = months[months.length - 1];
    if (existing && existing.label === label) {
      existing.width += dayWidth;
    } else {
      months.push({
        label,
        x: calendarDaysBetween(start, date) * dayWidth,
        width: dayWidth,
      });
    }
  }

  const todayOffset = calendarDaysBetween(start, todayDate);
  const todayX =
    todayOffset >= 0 && todayOffset <= calendarDaysBetween(start, end)
      ? todayOffset * dayWidth + dayWidth / 2
      : null;

  return {
    zoom,
    dayWidth,
    totalWidth: days.length * dayWidth,
    start: toIsoDate(start),
    end: toIsoDate(end),
    days,
    months,
    todayX,
  };
}

/** Lebar bar untuk rentang tanggal inklusif. */
export function rangeWidth(scale: TimelineScale, startIso: string, endIso: string): number {
  const days = calendarDaysBetween(parseIsoDate(startIso), parseIsoDate(endIso));
  return Math.max(scale.dayWidth, (days + 1) * scale.dayWidth);
}

export function xForDate(scale: TimelineScale, iso: string): number {
  return calendarDaysBetween(parseIsoDate(scale.start), parseIsoDate(iso)) * scale.dayWidth;
}

/** Jumlah hari kalender untuk satu langkah drag pada zoom saat ini. */
export function daysForDelta(scale: TimelineScale, deltaPixels: number): number {
  return Math.round(deltaPixels / scale.dayWidth);
}
