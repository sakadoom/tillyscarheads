import {
  addDays,
  nextWorkingDay,
  parseIsoDate,
  shiftWorkingDays,
  toIsoDate,
  workingDaysBetween,
  type ProjectCalendar,
  type TaskDto,
} from 'shared';

/** Status satu interaksi drag bar pada timeline. */
export interface DragState {
  taskId: string;
  mode: 'move' | 'resize';
  startX: number;
  deltaDays: number;
  original: TaskDto;
  candidateStart: string;
  candidateDuration: number;
}

/** Membulatkan tanggal ke hari kerja berikutnya/sebelumnya sesuai arah geser. */
export function snapToWorkingDay(
  calendar: ProjectCalendar,
  iso: string,
  direction: 'next' | 'previous',
): string {
  if (direction === 'next') return toIsoDate(nextWorkingDay(calendar, parseIsoDate(iso)));
  let cursor = parseIsoDate(iso);
  for (let guard = 0; guard < 366; guard += 1) {
    const isoDate = toIsoDate(cursor);
    if (toIsoDate(nextWorkingDay(calendar, cursor)) === isoDate) return isoDate;
    cursor = addDays(cursor, -1);
  }
  return iso;
}

/** Menghitung kandidat tanggal/durasi baru untuk satu langkah drag (6.7). */
export function candidates(
  drag: DragState,
  deltaDays: number,
  calendar: ProjectCalendar,
): Pick<DragState, 'candidateStart' | 'candidateDuration'> {
  const scheduledStart = parseIsoDate(drag.original.scheduledStart);
  const scheduledEnd = parseIsoDate(drag.original.scheduledEnd);

  if (drag.mode === 'move') {
    // Titik awal geser adalah jadwal yang terlihat pengguna (scheduledStart), bukan
    // startDate (batas 'mulai paling awal') yang bisa jauh lebih awal. Geserannya
    // dalam hari kerja, jadi bar mengikuti kursor dan tanggal mulai tersimpan sesuai (6.7).
    const shifted = shiftWorkingDays(calendar, scheduledStart, deltaDays);
    return {
      candidateStart: toIsoDate(shifted),
      candidateDuration: drag.original.durationDays,
    };
  }

  const shiftedEnd = addDays(scheduledEnd, deltaDays);
  const snappedEnd = snapToWorkingDay(calendar, toIsoDate(shiftedEnd), deltaDays >= 0 ? 'next' : 'previous');
  const duration = workingDaysBetween(calendar, scheduledStart, parseIsoDate(snappedEnd));
  return {
    candidateStart: drag.original.startDate,
    candidateDuration: Math.max(1, duration),
  };
}
