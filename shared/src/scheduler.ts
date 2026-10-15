/**
 * Mesin penjadwalan (6.3–6.7). Fungsi murni yang dipakai server (sumber
 * kebenaran, hasil disimpan ke database) maupun client (pratinjau saat drag).
 */

import {
  nextWorkingDay,
  shiftWorkingDays,
  workingDaysBetween,
  type ProjectCalendar,
} from './calendar.js';
import { maxDate, minDate, parseIsoDate, toIsoDate } from './dates.js';
import type { DependencyType } from './types.js';

export interface ScheduleTaskInput {
  id: string;
  parentId: string | null;
  /** Urutan antar saudara; hanya dipakai untuk tampilan. */
  position: number;
  durationDays: number;
  /** Batas "mulai paling awal" yang diisi pengguna. */
  startDate: string;
  progress: number;
}

export interface ScheduleDependencyInput {
  predecessorId: string;
  successorId: string;
  type: DependencyType;
  lagDays: number;
}

export interface ScheduledTaskResult {
  id: string;
  scheduledStart: string;
  scheduledEnd: string;
  durationDays: number;
  progress: number;
}

export const MIN_DURATION_DAYS = 1;
export const MAX_DEPTH = 3;

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** Id tugas yang tidak punya anak (hanya daun yang boleh punya dependensi). */
export function getLeafTaskIds(tasks: readonly ScheduleTaskInput[]): Set<string> {
  const parentIds = new Set<string>();
  const ids = new Set(tasks.map((task) => task.id));
  for (const task of tasks) {
    if (task.parentId && ids.has(task.parentId)) parentIds.add(task.parentId);
  }
  return new Set(tasks.filter((task) => !parentIds.has(task.id)).map((task) => task.id));
}

/** Kedalaman tugas (0 = level teratas). Dipakai untuk validasi maksimal 3 level. */
export function getTaskDepth(tasks: readonly ScheduleTaskInput[], taskId: string): number {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  let depth = 0;
  let current = byId.get(taskId);
  const guard = new Set<string>([taskId]);
  while (current?.parentId) {
    const parent = byId.get(current.parentId);
    if (!parent || guard.has(parent.id)) break;
    guard.add(parent.id);
    depth += 1;
    current = parent;
  }
  return depth;
}

export function getChildIds(tasks: readonly ScheduleTaskInput[]): Map<string, string[]> {
  const ids = new Set(tasks.map((task) => task.id));
  const childrenByParent = new Map<string, string[]>();
  for (const task of tasks) {
    if (!task.parentId || !ids.has(task.parentId)) continue;
    const list = childrenByParent.get(task.parentId) ?? [];
    list.push(task.id);
    childrenByParent.set(task.parentId, list);
  }
  return childrenByParent;
}

/**
 * Urutan topologis tugas daun (algoritma Kahn). `cyclicIds` berisi tugas yang
 * tidak pernah lepas dari siklus; pemanggil API menolak siklus sebelum disimpan.
 */
export function topologicalLeafOrder(
  tasks: readonly ScheduleTaskInput[],
  dependencies: readonly ScheduleDependencyInput[],
): { order: string[]; cyclicIds: string[] } {
  const leafIds = getLeafTaskIds(tasks);
  const indegree = new Map<string, number>();
  const successors = new Map<string, string[]>();
  for (const id of leafIds) indegree.set(id, 0);

  for (const dependency of dependencies) {
    if (!leafIds.has(dependency.predecessorId) || !leafIds.has(dependency.successorId)) continue;
    successors.set(dependency.predecessorId, [
      ...(successors.get(dependency.predecessorId) ?? []),
      dependency.successorId,
    ]);
    indegree.set(dependency.successorId, (indegree.get(dependency.successorId) ?? 0) + 1);
  }

  const orderedInput = [...tasks].sort((a, b) => a.position - b.position);
  const queue = orderedInput
    .filter((task) => leafIds.has(task.id) && (indegree.get(task.id) ?? 0) === 0)
    .map((task) => task.id);

  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    order.push(id);
    for (const successor of successors.get(id) ?? []) {
      const remaining = (indegree.get(successor) ?? 0) - 1;
      indegree.set(successor, remaining);
      if (remaining === 0) queue.push(successor);
    }
  }

  const cyclicIds = [...leafIds].filter((id) => !order.includes(id));
  return { order, cyclicIds };
}

/** Mencari satu siklus pada graf dependensi, untuk pesan error 422. */
export function findCyclePath(
  dependencies: readonly ScheduleDependencyInput[],
): string[] | null {
  const successors = new Map<string, string[]>();
  for (const dependency of dependencies) {
    successors.set(dependency.predecessorId, [
      ...(successors.get(dependency.predecessorId) ?? []),
      dependency.successorId,
    ]);
  }

  const state = new Map<string, 'visiting' | 'done'>();
  const stack: string[] = [];

  const visit = (id: string): string[] | null => {
    const current = state.get(id);
    if (current === 'done') return null;
    if (current === 'visiting') {
      const startIndex = stack.indexOf(id);
      return [...stack.slice(startIndex), id];
    }
    state.set(id, 'visiting');
    stack.push(id);
    for (const successor of successors.get(id) ?? []) {
      const cycle = visit(successor);
      if (cycle) return cycle;
    }
    stack.pop();
    state.set(id, 'done');
    return null;
  };

  for (const id of successors.keys()) {
    const cycle = visit(id);
    if (cycle) return cycle;
  }
  return null;
}

/**
 * Batas mulai penerus dari satu predecessor (6.4):
 * FS: shift(pred.scheduledEnd, 1 + lag)
 * SS: shift(pred.scheduledStart, lag)
 */
export function dependencyBound(
  dependency: ScheduleDependencyInput,
  predecessor: ScheduledTaskResult,
  calendar: ProjectCalendar,
): Date {
  if (dependency.type === 'SS') {
    return shiftWorkingDays(
      calendar,
      parseIsoDate(predecessor.scheduledStart),
      dependency.lagDays,
    );
  }
  return shiftWorkingDays(calendar, parseIsoDate(predecessor.scheduledEnd), 1 + dependency.lagDays);
}

/**
 * Menghitung jadwal seluruh tugas: tugas daun dulu (urut topologis), lalu
 * roll-up tugas induk dari bawah ke atas (6.5–6.6).
 */
export function computeSchedule(
  tasks: readonly ScheduleTaskInput[],
  dependencies: readonly ScheduleDependencyInput[],
  calendar: ProjectCalendar,
): Map<string, ScheduledTaskResult> {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const childrenByParent = getChildIds(tasks);
  const predecessorsBySuccessor = new Map<string, ScheduleDependencyInput[]>();
  for (const dependency of dependencies) {
    const list = predecessorsBySuccessor.get(dependency.successorId) ?? [];
    list.push(dependency);
    predecessorsBySuccessor.set(dependency.successorId, list);
  }

  const result = new Map<string, ScheduledTaskResult>();

  const scheduleLeaf = (task: ScheduleTaskInput): void => {
    const bounds: Date[] = [parseIsoDate(task.startDate)];
    for (const dependency of predecessorsBySuccessor.get(task.id) ?? []) {
      const predecessor = result.get(dependency.predecessorId);
      if (!predecessor) continue;
      bounds.push(dependencyBound(dependency, predecessor, calendar));
    }
    const scheduledStart = nextWorkingDay(calendar, maxDate(bounds));
    const durationDays = Math.max(MIN_DURATION_DAYS, Math.round(task.durationDays));
    const scheduledEnd = shiftWorkingDays(calendar, scheduledStart, durationDays - 1);
    result.set(task.id, {
      id: task.id,
      scheduledStart: toIsoDate(scheduledStart),
      scheduledEnd: toIsoDate(scheduledEnd),
      durationDays,
      progress: clampProgress(task.progress),
    });
  };

  const { order, cyclicIds } = topologicalLeafOrder(tasks, dependencies);
  for (const id of order) {
    const task = byId.get(id);
    if (task) scheduleLeaf(task);
  }
  // Tugas yang terlibat siklus tetap dijadwalkan dari batasnya sendiri supaya
  // tampilan tidak kosong; API menolak siklus sebelum data ini tersimpan.
  for (const id of cyclicIds) {
    const task = byId.get(id);
    if (task) scheduleLeaf(task);
  }

  const parentIds = [...childrenByParent.keys()].sort(
    (a, b) => getTaskDepth(tasks, b) - getTaskDepth(tasks, a),
  );
  for (const parentId of parentIds) {
    const parent = byId.get(parentId);
    if (!parent) continue;
    const childSchedules = (childrenByParent.get(parentId) ?? [])
      .map((childId) => result.get(childId))
      .filter((child): child is ScheduledTaskResult => Boolean(child));
    if (childSchedules.length === 0) {
      if (!result.has(parentId)) scheduleLeaf(parent);
      continue;
    }
    const starts = childSchedules.map((child) => parseIsoDate(child.scheduledStart));
    const ends = childSchedules.map((child) => parseIsoDate(child.scheduledEnd));
    const scheduledStart = minDate(starts);
    const scheduledEnd = maxDate(ends);
    const totalDuration = childSchedules.reduce((sum, child) => sum + child.durationDays, 0);
    const weightedProgress =
      totalDuration > 0
        ? childSchedules.reduce(
            (sum, child) => sum + child.progress * child.durationDays,
            0,
          ) / totalDuration
        : childSchedules.reduce((sum, child) => sum + child.progress, 0) / childSchedules.length;

    result.set(parentId, {
      id: parentId,
      scheduledStart: toIsoDate(scheduledStart),
      scheduledEnd: toIsoDate(scheduledEnd),
      durationDays: workingDaysBetween(calendar, scheduledStart, scheduledEnd),
      progress: clampProgress(weightedProgress),
    });
  }

  return result;
}
