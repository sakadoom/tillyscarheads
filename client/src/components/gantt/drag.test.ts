import { describe, expect, it } from 'vitest';
import { buildFixtureSnapshot, calendarFromProject } from 'shared';

import { candidates, type DragState } from './drag';

const snapshot = buildFixtureSnapshot();
const calendar = calendarFromProject({
  weekendDays: snapshot.project.weekendDays,
  holidays: snapshot.holidays.map((holiday) => holiday.date),
});

/** 4.1 punya startDate 2026-10-19 (batas 'mulai paling awal') tetapi jadwal terlihatnya 2026-11-10. */
function dragState(taskId: string, mode: DragState['mode']): DragState {
  const task = snapshot.tasks.find((candidate) => candidate.id === taskId);
  if (!task) throw new Error(`tugas ${taskId} tidak ada di fixture`);
  return {
    taskId,
    mode,
    startX: 0,
    deltaDays: 0,
    original: task,
    candidateStart: task.startDate,
    candidateDuration: task.durationDays,
  };
}

describe('candidates', () => {
  it('menggeser dari jadwal yang terlihat, bukan dari startDate tersimpan', () => {
    const drag = dragState('4.1', 'move');
    expect(drag.original.startDate).toBe('2026-10-19');
    expect(drag.original.scheduledStart).toBe('2026-11-10');

    // Geser 3 hari kerja ke kanan: melewati libur 2026-11-11.
    expect(candidates(drag, 3, calendar).candidateStart).toBe('2026-11-16');
    // Geser 1 hari kerja ke kiri.
    expect(candidates(drag, -1, calendar).candidateStart).toBe('2026-11-09');
    expect(candidates(drag, -1, calendar).candidateDuration).toBe(3);
  });

  it('menahan durasi yang sama saat bar digeser', () => {
    const drag = dragState('3.1', 'move');
    expect(candidates(drag, 2, calendar).candidateDuration).toBe(drag.original.durationDays);
  });

  it('menambah durasi saat tepi kanan ditarik dan tidak pernah kurang dari 1 hari', () => {
    const drag = dragState('1.1', 'move');
    drag.mode = 'resize';
    // 1.1: 2026-10-19 sampai 2026-10-21 (3 hari).
    expect(candidates(drag, 2, calendar).candidateDuration).toBe(5);
    expect(candidates(drag, -5, calendar).candidateDuration).toBe(1);
    expect(candidates(drag, 2, calendar).candidateStart).toBe(drag.original.startDate);
  });

  it('menghitung resize dalam hari kerja ketika melewati hari libur', () => {
    const drag = dragState('3.3', 'resize');
    // 3.3: 2026-11-10 sampai 2026-11-26 (12 hari kerja), libur 2026-11-11 ada di dalamnya.
    expect(candidates(drag, 1, calendar).candidateDuration).toBe(13);
    // Tepi digeser 4 hari kalender (26 -> 30 Nov, akhir pekan di antaranya dilewati).
    expect(candidates(drag, 4, calendar).candidateDuration).toBe(14);
  });
});
