import { describe, expect, it } from 'vitest';

import { createCalendar } from './calendar.js';
import { computeCpm, type CpmTaskInput } from './cpm.js';
import { computePert, type PertTaskInput } from './pert.js';
import {
  computeSchedule,
  type ScheduleDependencyInput,
  type ScheduleTaskInput,
} from './scheduler.js';

const calendar = createCalendar({ weekendDays: [0, 6] });
const PROJECT_START = '2026-10-19';

interface TaskDefinition {
  id: string;
  durationDays: number;
  optimisticDays?: number;
  pessimisticDays?: number;
}

function buildPert(definitions: TaskDefinition[], dependencies: ScheduleDependencyInput[]) {
  const tasks: ScheduleTaskInput[] = definitions.map((definition, index) => ({
    id: definition.id,
    parentId: null,
    position: index,
    durationDays: definition.durationDays,
    startDate: PROJECT_START,
    progress: 0,
  }));
  const schedule = computeSchedule(tasks, dependencies, calendar);
  const cpmTasks: CpmTaskInput[] = tasks.map((task) => {
    const scheduled = schedule.get(task.id);
    if (!scheduled) throw new Error(`Tugas ${task.id} tidak terjadwal`);
    return { ...task, name: task.id, ...scheduled };
  });
  const cpm = computeCpm({ tasks: cpmTasks, dependencies, calendar, projectStart: PROJECT_START });
  const pertTasks: PertTaskInput[] = definitions.map((definition, index) => ({
    ...(tasks[index] as ScheduleTaskInput),
    name: definition.id,
    optimisticDays: definition.optimisticDays ?? null,
    pessimisticDays: definition.pessimisticDays ?? null,
  }));
  return computePert({ tasks: pertTasks, dependencies, cpm });
}

describe('diagram PERT', () => {
  it('menyusun kolom menurut kedalaman jalur terpanjang', () => {
    const pert = buildPert(
      [
        { id: 'A', durationDays: 2 },
        { id: 'B', durationDays: 2 },
        { id: 'C', durationDays: 2 },
      ],
      [
        { predecessorId: 'A', successorId: 'B', type: 'FS', lagDays: 0 },
        { predecessorId: 'B', successorId: 'C', type: 'FS', lagDays: 0 },
      ],
    );
    const column = (id: string) => pert.nodes.find((node) => node.id === id)?.column;
    expect(column('A')).toBe(0);
    expect(column('B')).toBe(1);
    expect(column('C')).toBe(2);
    expect(pert.columnCount).toBe(3);
  });

  it('memberi kolom sama untuk cabang paralel dan menggabungkan di node akhir', () => {
    const pert = buildPert(
      [
        { id: 'A', durationDays: 1 },
        { id: 'B', durationDays: 3 },
        { id: 'C', durationDays: 5 },
        { id: 'D', durationDays: 1 },
      ],
      [
        { predecessorId: 'A', successorId: 'B', type: 'FS', lagDays: 0 },
        { predecessorId: 'A', successorId: 'C', type: 'FS', lagDays: 0 },
        { predecessorId: 'B', successorId: 'D', type: 'FS', lagDays: 0 },
        { predecessorId: 'C', successorId: 'D', type: 'FS', lagDays: 0 },
      ],
    );
    const node = (id: string) => pert.nodes.find((candidate) => candidate.id === id);
    expect(node('A')?.column).toBe(0);
    expect(node('B')?.column).toBe(1);
    expect(node('C')?.column).toBe(1);
    expect(node('D')?.column).toBe(2);
    expect(node('D')?.critical).toBe(true);
    expect(node('B')?.slack).toBe(2);
    expect(node('B')?.critical).toBe(false);
  });

  it('menghitung estimasi te dan variansi bila estimasi optimistis/pesimistis terisi', () => {
    const pert = buildPert([{ id: 'A', durationDays: 10, optimisticDays: 8, pessimisticDays: 15 }], []);
    const node = pert.nodes[0];
    expect(node?.expectedDays).toBeCloseTo((8 + 40 + 15) / 6, 6);
    expect(node?.variance).toBeCloseTo((7 / 6) ** 2, 6);
    expect(pert.totalVariance).toBeCloseTo((7 / 6) ** 2, 6);
    expect(pert.standardDeviation).toBeCloseTo(7 / 6, 6);
  });

  it('tidak menampilkan estimasi bila salah satu nilai kosong', () => {
    const pert = buildPert([{ id: 'A', durationDays: 4, optimisticDays: 3 }], []);
    expect(pert.nodes[0]?.expectedDays).toBeNull();
    expect(pert.nodes[0]?.variance).toBeNull();
    expect(pert.totalVariance).toBe(0);
  });

  it('menjumlahkan variansi hanya di sepanjang jalur kritis', () => {
    const pert = buildPert(
      [
        { id: 'A', durationDays: 3, optimisticDays: 1, pessimisticDays: 4 },
        { id: 'B', durationDays: 2, optimisticDays: 1, pessimisticDays: 4 },
        { id: 'C', durationDays: 5, optimisticDays: 4, pessimisticDays: 6 },
        { id: 'D', durationDays: 1 },
      ],
      [
        { predecessorId: 'A', successorId: 'B', type: 'FS', lagDays: 0 },
        { predecessorId: 'A', successorId: 'C', type: 'FS', lagDays: 0 },
        { predecessorId: 'B', successorId: 'D', type: 'FS', lagDays: 0 },
        { predecessorId: 'C', successorId: 'D', type: 'FS', lagDays: 0 },
      ],
    );
    // Jalur kritis: A (variansi 0,25) -> C (variansi 0,111...) -> D tanpa estimasi.
    const expectedVariance = (3 / 6) ** 2 + (2 / 6) ** 2;
    expect(pert.totalVariance).toBeCloseTo(expectedVariance, 6);
    expect(pert.standardDeviation).toBeCloseTo(Math.sqrt(expectedVariance), 6);
  });
});
