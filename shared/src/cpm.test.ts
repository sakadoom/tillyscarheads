import { describe, expect, it } from 'vitest';

import { createCalendar } from './calendar.js';
import { computeCpm, type CpmTaskInput } from './cpm.js';
import {
  computeSchedule,
  type ScheduleDependencyInput,
  type ScheduleTaskInput,
} from './scheduler.js';

const calendar = createCalendar({ weekendDays: [0, 6] });
const PROJECT_START = '2026-10-19';

function makeTask(partial: Partial<ScheduleTaskInput> & { id: string }): ScheduleTaskInput {
  return {
    parentId: null,
    position: 0,
    durationDays: 1,
    startDate: PROJECT_START,
    progress: 0,
    ...partial,
  };
}

function analyse(tasks: ScheduleTaskInput[], dependencies: ScheduleDependencyInput[]) {
  const schedule = computeSchedule(tasks, dependencies, calendar);
  const cpmTasks: CpmTaskInput[] = tasks.map((task) => {
    const scheduled = schedule.get(task.id);
    if (!scheduled) throw new Error(`Tugas ${task.id} tidak terjadwal`);
    return { ...task, name: task.id, ...scheduled };
  });
  return computeCpm({ tasks: cpmTasks, dependencies, calendar, projectStart: PROJECT_START });
}

describe('critical path method', () => {
  it('menghasilkan A, C, D kritis dan B float 3 pada vektor uji', () => {
    const tasks = [
      makeTask({ id: 'A', position: 0, durationDays: 3 }),
      makeTask({ id: 'B', position: 1, durationDays: 2 }),
      makeTask({ id: 'C', position: 2, durationDays: 5 }),
      makeTask({ id: 'D', position: 3, durationDays: 1 }),
    ];
    const dependencies: ScheduleDependencyInput[] = [
      { predecessorId: 'A', successorId: 'B', type: 'FS', lagDays: 0 },
      { predecessorId: 'A', successorId: 'C', type: 'FS', lagDays: 0 },
      { predecessorId: 'B', successorId: 'D', type: 'FS', lagDays: 0 },
      { predecessorId: 'C', successorId: 'D', type: 'FS', lagDays: 0 },
    ];

    const cpm = analyse(tasks, dependencies);

    expect(cpm.projectEnd).toBe(8);
    expect(cpm.tasks.get('A')).toMatchObject({ es: 0, ef: 2, ls: 0, lf: 2, totalFloat: 0, critical: true });
    expect(cpm.tasks.get('B')).toMatchObject({ es: 3, ef: 4, ls: 6, lf: 7, totalFloat: 3, critical: false });
    expect(cpm.tasks.get('C')).toMatchObject({ es: 3, ef: 7, ls: 3, lf: 7, totalFloat: 0, critical: true });
    expect(cpm.tasks.get('D')).toMatchObject({ es: 8, ef: 8, ls: 8, lf: 8, totalFloat: 0, critical: true });
    expect(cpm.criticalPath).toEqual(['A', 'C', 'D']);
  });

  it('memperhitungkan rumus backward untuk dependensi SS', () => {
    // Perpanjangan tugas penerus membuat batas SS menentukan akhir proyek,
    // sehingga kedua tugas menjadi kritis.
    const tasks = [
      makeTask({ id: 'P', position: 0, durationDays: 5 }),
      makeTask({ id: 'S', position: 1, durationDays: 4 }),
    ];
    const dependencies: ScheduleDependencyInput[] = [
      { predecessorId: 'P', successorId: 'S', type: 'SS', lagDays: 2 },
    ];

    const cpm = analyse(tasks, dependencies);

    expect(cpm.tasks.get('S')).toMatchObject({ es: 2, ef: 5, ls: 2, lf: 5, totalFloat: 0, critical: true });
    expect(cpm.tasks.get('P')).toMatchObject({ es: 0, ef: 4, ls: 0, lf: 4, totalFloat: 0, critical: true });
    expect(cpm.projectEnd).toBe(5);
    expect(cpm.criticalPath).toEqual(['P', 'S']);
  });

  it('memberi float pada kedua tugas SS yang tidak menentukan akhir proyek', () => {
    const tasks = [
      makeTask({ id: 'P', position: 0, durationDays: 5 }),
      makeTask({ id: 'S', position: 1, durationDays: 2 }),
    ];
    const dependencies: ScheduleDependencyInput[] = [
      { predecessorId: 'P', successorId: 'S', type: 'SS', lagDays: 2 },
    ];

    const cpm = analyse(tasks, dependencies);

    // S berakhir lebih awal dari P, jadi keduanya punya float 1 hari.
    expect(cpm.tasks.get('S')).toMatchObject({ es: 2, ef: 3, totalFloat: 1, critical: false });
    expect(cpm.tasks.get('P')).toMatchObject({ es: 0, ef: 4, totalFloat: 1, critical: false });
    expect(cpm.criticalPath).toEqual([]);
  });

  it('menghitung float pada dua cabang paralel', () => {
    const tasks = [
      makeTask({ id: 'A', position: 0, durationDays: 2 }),
      makeTask({ id: 'B', position: 1, durationDays: 1 }),
      makeTask({ id: 'C', position: 2, durationDays: 6 }),
    ];
    const dependencies: ScheduleDependencyInput[] = [
      { predecessorId: 'A', successorId: 'B', type: 'FS', lagDays: 0 },
      { predecessorId: 'A', successorId: 'C', type: 'FS', lagDays: 0 },
    ];

    const cpm = analyse(tasks, dependencies);

    expect(cpm.tasks.get('A')?.critical).toBe(true);
    expect(cpm.tasks.get('C')?.critical).toBe(true);
    expect(cpm.tasks.get('B')?.totalFloat).toBe(5);
    expect(cpm.criticalPath).toEqual(['A', 'C']);
  });

  it('menggeser ordinal karena hari libur', () => {
    const holidayCalendar = createCalendar({ weekendDays: [0, 6], holidays: ['2026-10-20'] });
    const tasks = [
      makeTask({ id: 'A', position: 0, durationDays: 3 }),
      makeTask({ id: 'B', position: 1, durationDays: 1 }),
    ];
    const dependencies: ScheduleDependencyInput[] = [
      { predecessorId: 'A', successorId: 'B', type: 'FS', lagDays: 0 },
    ];
    const schedule = computeSchedule(tasks, dependencies, holidayCalendar);
    expect(schedule.get('A')?.scheduledEnd).toBe('2026-10-22');
    expect(schedule.get('B')?.scheduledStart).toBe('2026-10-23');

    const cpm = computeCpm({
      tasks: tasks.map((task) => {
        const scheduled = schedule.get(task.id);
        if (!scheduled) throw new Error('tidak terjadwal');
        return { ...task, name: task.id, ...scheduled };
      }),
      dependencies,
      calendar: holidayCalendar,
      projectStart: PROJECT_START,
    });
    // Ordinal hari kerja: 19 (0), 21 (1), 22 (2), 23 (3) — 20 libur.
    expect(cpm.projectEnd).toBe(3);
    expect(cpm.tasks.get('B')?.es).toBe(3);
  });
});
