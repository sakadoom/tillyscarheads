/**
 * Data diagram PERT (6.9): jaringan activity-on-node dari tugas daun.
 * Estimasi optimistis/pesimistis bersifat informasi tambahan dan tidak
 * mengubah jadwal.
 */

import { getLeafTaskIds, type ScheduleDependencyInput, type ScheduleTaskInput } from './scheduler.js';
import type { CpmResult } from './cpm.js';

export interface PertTaskInput extends ScheduleTaskInput {
  name: string;
  optimisticDays: number | null;
  pessimisticDays: number | null;
}

export interface PertNode {
  id: string;
  name: string;
  durationDays: number;
  es: number;
  ef: number;
  ls: number;
  lf: number;
  slack: number;
  critical: boolean;
  /** Kolom tata letak = kedalaman jalur terpanjang dari node awal. */
  column: number;
  optimisticDays: number | null;
  pessimisticDays: number | null;
  /** Estimasi PERT (o + 4m + p) / 6 bila kedua estimasi terisi. */
  expectedDays: number | null;
  variance: number | null;
}

export interface PertResult {
  nodes: PertNode[];
  /** Jumlah kolom yang dipakai untuk menggambar diagram. */
  columnCount: number;
  totalVariance: number;
  standardDeviation: number;
}

export interface PertInput {
  tasks: readonly PertTaskInput[];
  dependencies: readonly ScheduleDependencyInput[];
  cpm: CpmResult;
}

export function computePert({ tasks, dependencies, cpm }: PertInput): PertResult {
  const leafIds = getLeafTaskIds(tasks);
  const leaves = tasks.filter((task) => leafIds.has(task.id));

  const predecessors = new Map<string, string[]>();
  const successors = new Map<string, string[]>();
  for (const dependency of dependencies) {
    if (!leafIds.has(dependency.predecessorId) || !leafIds.has(dependency.successorId)) continue;
    predecessors.set(dependency.successorId, [
      ...(predecessors.get(dependency.successorId) ?? []),
      dependency.predecessorId,
    ]);
    successors.set(dependency.predecessorId, [
      ...(successors.get(dependency.predecessorId) ?? []),
      dependency.successorId,
    ]);
  }

  const columns = new Map<string, number>();
  const visiting = new Set<string>();
  const resolveColumn = (id: string): number => {
    const cached = columns.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const incoming = predecessors.get(id) ?? [];
    const column =
      incoming.length === 0
        ? 0
        : Math.max(...incoming.map((predecessorId) => resolveColumn(predecessorId) + 1));
    visiting.delete(id);
    columns.set(id, column);
    return column;
  };

  const nodes: PertNode[] = leaves.map((task) => {
    const cpmTask = cpm.tasks.get(task.id);
    const optimistic = task.optimisticDays;
    const pessimistic = task.pessimisticDays;
    const hasEstimates =
      typeof optimistic === 'number' &&
      typeof pessimistic === 'number' &&
      optimistic > 0 &&
      pessimistic > 0;
    const expectedDays = hasEstimates
      ? (optimistic + 4 * task.durationDays + pessimistic) / 6
      : null;
    const variance = hasEstimates ? ((pessimistic - optimistic) / 6) ** 2 : null;

    return {
      id: task.id,
      name: task.name,
      durationDays: task.durationDays,
      es: cpmTask?.es ?? 0,
      ef: cpmTask?.ef ?? 0,
      ls: cpmTask?.ls ?? 0,
      lf: cpmTask?.lf ?? 0,
      slack: cpmTask?.totalFloat ?? 0,
      critical: cpmTask?.critical ?? false,
      column: resolveColumn(task.id),
      optimisticDays: optimistic,
      pessimisticDays: pessimistic,
      expectedDays,
      variance,
    };
  });

  const criticalIds = new Set(cpm.criticalPath);
  const pathVariances = nodes
    .filter((node) => criticalIds.has(node.id) && node.variance !== null)
    .map((node) => node.variance as number);
  const totalVariance = pathVariances.reduce((sum, value) => sum + value, 0);

  return {
    nodes: nodes.sort((a, b) => a.column - b.column || a.es - b.es || a.name.localeCompare(b.name)),
    columnCount: nodes.length === 0 ? 0 : Math.max(...nodes.map((node) => node.column)) + 1,
    totalVariance,
    standardDeviation: Math.sqrt(totalVariance),
  };
}
