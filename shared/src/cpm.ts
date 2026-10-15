/**
 * Critical Path Method (6.8). Hanya menghitung tugas daun.
 *
 * Ordinal hari kerja `ord(d)` = jumlah hari kerja dari awal proyek (ordinal 0)
 * sampai `d`.
 */

import { dateFromWorkingDayOrdinal, workingDayOrdinal, type ProjectCalendar } from './calendar.js';
import { parseIsoDate } from './dates.js';
import {
  getLeafTaskIds,
  topologicalLeafOrder,
  type ScheduleDependencyInput,
  type ScheduleTaskInput,
} from './scheduler.js';

export interface CpmTaskInput extends ScheduleTaskInput {
  name: string;
  scheduledStart: string;
  scheduledEnd: string;
}

export interface CpmTaskResult {
  id: string;
  name: string;
  es: number;
  ef: number;
  ls: number;
  lf: number;
  totalFloat: number;
  critical: boolean;
}

export interface CpmResult {
  /** Ordinal hari kerja akhir proyek. */
  projectEnd: number;
  tasks: Map<string, CpmTaskResult>;
  /** Rangkaian tugas kritis yang terhubung, diurutkan menurut ES. */
  criticalPath: string[];
}

export interface CpmInput {
  tasks: readonly CpmTaskInput[];
  dependencies: readonly ScheduleDependencyInput[];
  calendar: ProjectCalendar;
  /** Tanggal mulai proyek (ordinal 0). */
  projectStart: string;
}

export function computeCpm({
  tasks,
  dependencies,
  calendar,
  projectStart,
}: CpmInput): CpmResult {
  const leafIds = getLeafTaskIds(tasks);
  const leaves = tasks.filter((task) => leafIds.has(task.id));
  const origin = parseIsoDate(projectStart);
  const ord = (value: string): number => workingDayOrdinal(calendar, origin, parseIsoDate(value));

  const successors = new Map<string, ScheduleDependencyInput[]>();
  const predecessors = new Map<string, ScheduleDependencyInput[]>();
  for (const dependency of dependencies) {
    if (!leafIds.has(dependency.predecessorId) || !leafIds.has(dependency.successorId)) continue;
    successors.set(dependency.predecessorId, [
      ...(successors.get(dependency.predecessorId) ?? []),
      dependency,
    ]);
    predecessors.set(dependency.successorId, [
      ...(predecessors.get(dependency.successorId) ?? []),
      dependency,
    ]);
  }

  const results = new Map<string, CpmTaskResult>();
  let projectEnd = 0;
  for (const task of leaves) {
    const es = ord(task.scheduledStart);
    const ef = ord(task.scheduledEnd);
    projectEnd = Math.max(projectEnd, ef);
    results.set(task.id, {
      id: task.id,
      name: task.name,
      es,
      ef,
      ls: es,
      lf: ef,
      totalFloat: 0,
      critical: false,
    });
  }

  const { order } = topologicalLeafOrder(tasks, dependencies);
  for (const id of [...order].reverse()) {
    const result = results.get(id);
    const task = leaves.find((candidate) => candidate.id === id);
    if (!result || !task) continue;

    const outEdges = successors.get(id) ?? [];
    let latestFinish = projectEnd;
    if (outEdges.length > 0) {
      const boundaries: number[] = [];
      for (const dependency of outEdges) {
        const successor = results.get(dependency.successorId);
        if (!successor) continue;
        if (dependency.type === 'SS') {
          boundaries.push(successor.ls - dependency.lagDays + task.durationDays - 1);
        } else {
          boundaries.push(successor.ls - 1 - dependency.lagDays);
        }
      }
      if (boundaries.length > 0) latestFinish = Math.min(...boundaries);
    }

    const ls = latestFinish - task.durationDays + 1;
    const totalFloat = Math.max(0, ls - result.es);
    results.set(id, { ...result, lf: latestFinish, ls, totalFloat, critical: totalFloat === 0 });
  }

  return {
    projectEnd,
    tasks: results,
    criticalPath: findCriticalChain(leaves, predecessors, successors, results),
  };
}

/**
 * Rangkaian terpanjang tugas kritis yang saling terhubung. Memilih rantai
 * terpanjang (bukan sekadar mengikuti penerus pertama) supaya jalur kritis yang
 * dilaporkan benar-benar utuh.
 */
function findCriticalChain(
  leaves: readonly CpmTaskInput[],
  _predecessors: Map<string, ScheduleDependencyInput[]>,
  successors: Map<string, ScheduleDependencyInput[]>,
  results: Map<string, CpmTaskResult>,
): string[] {
  const memo = new Map<string, string[]>();

  const longestFrom = (id: string): string[] => {
    const cached = memo.get(id);
    if (cached) return cached;
    const paths: string[][] = [];
    for (const dependency of successors.get(id) ?? []) {
      const successor = results.get(dependency.successorId);
      if (!successor?.critical) continue;
      paths.push([id, ...longestFrom(successor.id)]);
    }
    const best = paths.sort((a, b) => b.length - a.length)[0] ?? [id];
    memo.set(id, best);
    return best;
  };

  const criticalStarters = leaves
    .filter((task) => results.get(task.id)?.critical)
    .sort((a, b) => (results.get(a.id)?.es ?? 0) - (results.get(b.id)?.es ?? 0));

  let best: string[] = [];
  let bestEs = Number.POSITIVE_INFINITY;
  for (const task of criticalStarters) {
    const path = longestFrom(task.id);
    const es = results.get(task.id)?.es ?? 0;
    if (path.length > best.length || (path.length === best.length && es < bestEs)) {
      best = path;
      bestEs = es;
    }
  }
  return best;
}

/** Tanggal untuk ordinal hari kerja (dipakai tampilan analisis). */
export function dateAtOrdinal(
  calendar: ProjectCalendar,
  projectStart: string,
  ordinal: number,
): string {
  const date = dateFromWorkingDayOrdinal(calendar, parseIsoDate(projectStart), ordinal);
  return date.toISOString().slice(0, 10);
}
