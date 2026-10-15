import { describe, expect, it } from 'vitest';

import { createCalendar } from './calendar.js';
import {
  computeSchedule,
  findCyclePath,
  getLeafTaskIds,
  getTaskDepth,
  topologicalLeafOrder,
  type ScheduleDependencyInput,
  type ScheduleTaskInput,
} from './scheduler.js';

const calendar = createCalendar({ weekendDays: [0, 6] });
const calendarWithHoliday = createCalendar({ weekendDays: [0, 6], holidays: ['2026-10-26'] });

function makeTask(partial: Partial<ScheduleTaskInput> & { id: string }): ScheduleTaskInput {
  return {
    parentId: null,
    position: 0,
    durationDays: 1,
    startDate: '2026-10-19',
    progress: 0,
    ...partial,
  };
}

function scheduleOf(tasks: ScheduleTaskInput[], dependencies: ScheduleDependencyInput[] = []) {
  return computeSchedule(tasks, dependencies, calendar);
}

describe('durasi dan vektor uji 6.11', () => {
  it('mulai Jumat 2026-10-23 selama 3 hari berakhir Selasa 2026-10-27', () => {
    const schedule = scheduleOf([
      makeTask({ id: 'a', startDate: '2026-10-23', durationDays: 3 }),
    ]);
    const result = schedule.get('a');
    expect(result?.scheduledStart).toBe('2026-10-23');
    expect(result?.scheduledEnd).toBe('2026-10-27');
    expect(result?.durationDays).toBe(3);
  });

  it('FS lag 0 membuat penerus mulai Rabu 2026-10-28', () => {
    const tasks = [
      makeTask({ id: 'a', startDate: '2026-10-23', durationDays: 3 }),
      makeTask({ id: 'b', startDate: '2026-01-01', durationDays: 2 }),
    ];
    const schedule = scheduleOf(tasks, [
      { predecessorId: 'a', successorId: 'b', type: 'FS', lagDays: 0 },
    ]);
    expect(schedule.get('b')?.scheduledStart).toBe('2026-10-28');
    expect(schedule.get('b')?.scheduledEnd).toBe('2026-10-29');
  });

  it('SS lag 2 membuat penerus mulai Selasa 2026-10-27', () => {
    const tasks = [
      makeTask({ id: 'a', startDate: '2026-10-23', durationDays: 3 }),
      makeTask({ id: 'b', startDate: '2026-01-01', durationDays: 2 }),
    ];
    const schedule = scheduleOf(tasks, [
      { predecessorId: 'a', successorId: 'b', type: 'SS', lagDays: 2 },
    ]);
    expect(schedule.get('b')?.scheduledStart).toBe('2026-10-27');
  });

  it('dengan libur Senin 2026-10-26 tugas berakhir Rabu 2026-10-28', () => {
    const schedule = computeSchedule(
      [makeTask({ id: 'a', startDate: '2026-10-23', durationDays: 3 })],
      [],
      calendarWithHoliday,
    );
    expect(schedule.get('a')?.scheduledEnd).toBe('2026-10-28');
  });
});

describe('batas dependensi', () => {
  it('menghitung lag positif dan negatif pada FS', () => {
    const base = [
      makeTask({ id: 'a', startDate: '2026-10-19', durationDays: 3 }),
      makeTask({ id: 'b', startDate: '2026-01-01', durationDays: 1 }),
    ];
    const lagOne = scheduleOf(base, [
      { predecessorId: 'a', successorId: 'b', type: 'FS', lagDays: 1 },
    ]);
    // a berakhir Rabu 2026-10-21, lag 1 -> Jumat 2026-10-23
    expect(lagOne.get('b')?.scheduledStart).toBe('2026-10-23');

    const lagNegative = scheduleOf(base, [
      { predecessorId: 'a', successorId: 'b', type: 'FS', lagDays: -1 },
    ]);
    // (1 + -1) = 0 -> geser 0 hari kerja dari akhir predecessor (2026-10-21)
    expect(lagNegative.get('b')?.scheduledStart).toBe('2026-10-21');
  });

  it('mengambil batas paling ketat dari beberapa predecessor', () => {
    const tasks = [
      makeTask({ id: 'a', startDate: '2026-10-19', durationDays: 3 }),
      makeTask({ id: 'b', startDate: '2026-10-19', durationDays: 8 }),
      makeTask({ id: 'c', startDate: '2026-10-19', durationDays: 1 }),
    ];
    const schedule = scheduleOf(tasks, [
      { predecessorId: 'a', successorId: 'c', type: 'FS', lagDays: 0 },
      { predecessorId: 'b', successorId: 'c', type: 'FS', lagDays: 0 },
    ]);
    // b berakhir Rabu 2026-10-28, jadi c mulai Kamis 2026-10-29
    expect(schedule.get('c')?.scheduledStart).toBe('2026-10-29');
  });

  it('memakai startDate sebagai batas mulai paling awal', () => {
    const tasks = [
      makeTask({ id: 'a', startDate: '2026-10-19', durationDays: 2 }),
      makeTask({ id: 'b', startDate: '2026-10-26', durationDays: 1 }),
    ];
    const schedule = scheduleOf(tasks, [
      { predecessorId: 'a', successorId: 'b', type: 'FS', lagDays: 0 },
    ]);
    expect(schedule.get('b')?.scheduledStart).toBe('2026-10-26');
  });

  it('menyandikan startDate yang jatuh pada akhir pekan', () => {
    const schedule = scheduleOf([makeTask({ id: 'a', startDate: '2026-10-24', durationDays: 1 })]);
    expect(schedule.get('a')?.scheduledStart).toBe('2026-10-26');
  });

  it('durasi minimal satu hari kerja', () => {
    const schedule = scheduleOf([makeTask({ id: 'a', durationDays: 0 })]);
    expect(schedule.get('a')?.durationDays).toBe(1);
    expect(schedule.get('a')?.scheduledStart).toBe('2026-10-19');
    expect(schedule.get('a')?.scheduledEnd).toBe('2026-10-19');
  });
});

describe('tugas induk', () => {
  it('menghitung rentang dan progres berbobot durasi dari anak', () => {
    const tasks = [
      makeTask({ id: 'parent', durationDays: 1, progress: 0 }),
      makeTask({ id: 'child-a', parentId: 'parent', position: 0, durationDays: 3, progress: 100 }),
      makeTask({
        id: 'child-b',
        parentId: 'parent',
        position: 1,
        durationDays: 2,
        progress: 0,
        startDate: '2026-10-19',
      }),
    ];
    const schedule = scheduleOf(tasks);
    const parent = schedule.get('parent');
    expect(parent?.scheduledStart).toBe('2026-10-19');
    expect(parent?.scheduledEnd).toBe('2026-10-21'); // anak A: 3 hari dari 2026-10-19
    expect(parent?.durationDays).toBe(3);
    expect(parent?.progress).toBe(60); // (100x3 + 0x2) / 5
  });

  it('melakukan roll-up tiga level dari bawah ke atas', () => {
    const tasks = [
      makeTask({ id: 'level-1', durationDays: 1 }),
      makeTask({ id: 'level-2', parentId: 'level-1', position: 0, durationDays: 1 }),
      makeTask({ id: 'leaf-a', parentId: 'level-2', position: 0, durationDays: 2, progress: 50 }),
      makeTask({
        id: 'leaf-b',
        parentId: 'level-2',
        position: 1,
        durationDays: 2,
        progress: 100,
        startDate: '2026-10-21',
      }),
    ];
    const schedule = scheduleOf(tasks);
    expect(schedule.get('level-2')?.scheduledStart).toBe('2026-10-19');
    expect(schedule.get('level-2')?.scheduledEnd).toBe('2026-10-22');
    expect(schedule.get('level-2')?.progress).toBe(75);
    expect(schedule.get('level-1')?.scheduledEnd).toBe('2026-10-22');
    expect(schedule.get('level-1')?.progress).toBe(75);
    expect(getTaskDepth(tasks, 'leaf-a')).toBe(2);
  });

  it('mengabaikan anak yang memiliki induk tidak dikenal', () => {
    const tasks = [
      makeTask({ id: 'orphan', parentId: 'tidak-ada', durationDays: 2 }),
    ];
    expect(getLeafTaskIds(tasks).has('orphan')).toBe(true);
    expect(scheduleOf(tasks).get('orphan')?.scheduledEnd).toBe('2026-10-20');
  });
});

describe('siklus dependensi', () => {
  const tasks = [makeTask({ id: 'a' }), makeTask({ id: 'b' }), makeTask({ id: 'c' })];
  const cycle: ScheduleDependencyInput[] = [
    { predecessorId: 'a', successorId: 'b', type: 'FS', lagDays: 0 },
    { predecessorId: 'b', successorId: 'a', type: 'FS', lagDays: 0 },
  ];

  it('menemukan siklus', () => {
    expect(findCyclePath(cycle)).toEqual(['a', 'b', 'a']);
    expect(
      findCyclePath([
        { predecessorId: 'a', successorId: 'b', type: 'FS', lagDays: 0 },
        { predecessorId: 'b', successorId: 'c', type: 'SS', lagDays: 2 },
      ]),
    ).toBeNull();
  });

  it('mengeluarkan tugas dalam siklus dari urutan topologis namun tetap menjadwalkannya', () => {
    const { order, cyclicIds } = topologicalLeafOrder(tasks, cycle);
    expect(cyclicIds.sort()).toEqual(['a', 'b']);
    expect(order).toEqual(['c']);
    const schedule = computeSchedule(tasks, cycle, calendar);
    expect(schedule.get('a')?.scheduledStart).toBe('2026-10-19');
  });

  it('hanya tugas daun yang boleh punya dependensi', () => {
    const withParent = [
      makeTask({ id: 'parent' }),
      makeTask({ id: 'child', parentId: 'parent' }),
      makeTask({ id: 'other' }),
    ];
    expect([...getLeafTaskIds(withParent)].sort()).toEqual(['child', 'other']);
    const { order } = topologicalLeafOrder(withParent, [
      { predecessorId: 'parent', successorId: 'other', type: 'FS', lagDays: 0 },
    ]);
    expect(order).toContain('other');
  });
});
