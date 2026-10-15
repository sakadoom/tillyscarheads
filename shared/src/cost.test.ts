import { describe, expect, it } from 'vitest';

import { createCalendar } from './calendar.js';
import {
  computeProjectCost,
  computeResourceLoads,
  computeTaskCosts,
  dailyRate,
  type CostAssignmentInput,
  type CostResourceInput,
  type CostTaskInput,
} from './cost.js';

const calendar = createCalendar({ weekendDays: [0, 6] });

const resources: CostResourceInput[] = [
  { id: 'r1', name: 'Andi Pratama', role: 'Project Manager', salary: 22_000_000 },
  { id: 'r2', name: 'Budi Santoso', role: 'Backend Developer', salary: 11_000_000 },
];

const tasks: CostTaskInput[] = [
  {
    id: 't1',
    name: 'Kickoff',
    durationDays: 5,
    scheduledStart: '2026-10-19',
    scheduledEnd: '2026-10-23',
  },
  {
    id: 't2',
    name: 'Riset',
    durationDays: 2,
    scheduledStart: '2026-10-26',
    scheduledEnd: '2026-10-27',
  },
];

describe('biaya proyek', () => {
  it('menghitung tarif harian dari gaji bulanan', () => {
    expect(dailyRate(22_000_000)).toBe(1_000_000);
    expect(dailyRate(11_000_000)).toBe(500_000);
  });

  it('menghitung biaya tugas per alokasi', () => {
    const assignments: CostAssignmentInput[] = [
      { taskId: 't1', resourceId: 'r1', allocationPercent: 100 },
      { taskId: 't1', resourceId: 'r2', allocationPercent: 50 },
    ];
    const [cost] = computeTaskCosts([tasks[0] as CostTaskInput], assignments, resources);
    expect(cost?.lines).toHaveLength(2);
    expect(cost?.total).toBe(1_000_000 * 5 + 500_000 * 5 * 0.5);
    expect(cost?.total).toBe(6_250_000);
  });

  it('menjumlahkan seluruh tugas daun', () => {
    const assignments: CostAssignmentInput[] = [
      { taskId: 't1', resourceId: 'r1', allocationPercent: 100 },
      { taskId: 't2', resourceId: 'r2', allocationPercent: 100 },
    ];
    const cost = computeProjectCost(tasks, assignments, resources);
    expect(cost.total).toBe(1_000_000 * 5 + 500_000 * 2);
    expect(cost.tasks).toHaveLength(2);
  });

  it('mengabaikan assignment yang resource-nya sudah dihapus', () => {
    const cost = computeProjectCost(
      [tasks[0] as CostTaskInput],
      [{ taskId: 't1', resourceId: 'tidak-ada', allocationPercent: 100 }],
      resources,
    );
    expect(cost.total).toBe(0);
  });
});

describe('beban kerja resource', () => {
  it('menghitung total biaya per anggota dan tanpa peringatan saat tidak tumpang tindih', () => {
    const assignments: CostAssignmentInput[] = [
      { taskId: 't1', resourceId: 'r1', allocationPercent: 100 },
      { taskId: 't2', resourceId: 'r1', allocationPercent: 100 },
    ];
    const { resources: loads, warnings } = computeResourceLoads({
      tasks,
      assignments,
      resources,
      calendar,
    });
    expect(warnings).toHaveLength(0);
    const andi = loads.find((load) => load.resourceId === 'r1');
    expect(andi?.totalCost).toBe(1_000_000 * 5 + 1_000_000 * 2);
    expect(andi?.peakPercent).toBe(100);
    expect(andi?.assignments.map((item) => item.taskName)).toEqual(['Kickoff', 'Riset']);
  });

  it('memberi peringatan ketika total alokasi melebihi 100% pada hari kerja yang sama', () => {
    const overlappingTasks: CostTaskInput[] = [
      {
        id: 't1',
        name: 'Integrasi',
        durationDays: 3,
        scheduledStart: '2026-10-19',
        scheduledEnd: '2026-10-21',
      },
      {
        id: 't2',
        name: 'Perbaikan bug',
        durationDays: 2,
        scheduledStart: '2026-10-20',
        scheduledEnd: '2026-10-21',
      },
    ];
    const assignments: CostAssignmentInput[] = [
      { taskId: 't1', resourceId: 'r2', allocationPercent: 60 },
      { taskId: 't2', resourceId: 'r2', allocationPercent: 60 },
    ];
    const { resources: loads, warnings } = computeResourceLoads({
      tasks: overlappingTasks,
      assignments,
      resources,
      calendar,
    });

    expect(warnings).toHaveLength(2);
    expect(warnings.map((warning) => warning.date)).toEqual(['2026-10-20', '2026-10-21']);
    expect(warnings[0]?.totalPercent).toBe(120);
    expect(warnings[0]?.taskNames.sort()).toEqual(['Integrasi', 'Perbaikan bug']);

    const budi = loads.find((load) => load.resourceId === 'r2');
    expect(budi?.peakPercent).toBe(120);
    expect(budi?.overallocatedDays).toEqual(['2026-10-20', '2026-10-21']);
  });

  it('hanya menghitung hari kerja pada pemetaan beban', () => {
    const { resources: loads } = computeResourceLoads({
      tasks,
      assignments: [{ taskId: 't1', resourceId: 'r1', allocationPercent: 100 }],
      resources,
      calendar,
    });
    expect(loads[0]?.days.map((day) => day.date)).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
    ]);
  });
});
