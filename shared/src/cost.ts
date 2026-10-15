/**
 * Biaya dan beban kerja (6.10).
 * Tarif harian = gaji bulanan / 22; hanya tugas daun yang dihitung.
 */

import { workingDaysInRange, type ProjectCalendar } from './calendar.js';
import { parseIsoDate, toIsoDate } from './dates.js';

export const WORKING_DAYS_PER_MONTH = 22;

export interface CostTaskInput {
  id: string;
  name: string;
  durationDays: number;
  scheduledStart: string;
  scheduledEnd: string;
}

export interface CostAssignmentInput {
  taskId: string;
  resourceId: string;
  allocationPercent: number;
}

export interface CostResourceInput {
  id: string;
  name: string;
  role: string;
  salary: number;
}

/** Tarif harian dari gaji bulanan. */
export function dailyRate(salary: number): number {
  return salary / WORKING_DAYS_PER_MONTH;
}

export interface TaskCostLine {
  resourceId: string;
  resourceName: string;
  allocationPercent: number;
  cost: number;
}

export interface TaskCost {
  taskId: string;
  taskName: string;
  durationDays: number;
  lines: TaskCostLine[];
  total: number;
}

export function computeTaskCosts(
  tasks: readonly CostTaskInput[],
  assignments: readonly CostAssignmentInput[],
  resources: readonly CostResourceInput[],
): TaskCost[] {
  const resourceById = new Map(resources.map((resource) => [resource.id, resource]));
  return tasks.map((task) => {
    const lines: TaskCostLine[] = [];
    for (const assignment of assignments) {
      if (assignment.taskId !== task.id) continue;
      const resource = resourceById.get(assignment.resourceId);
      if (!resource) continue;
      const cost =
        dailyRate(resource.salary) * task.durationDays * (assignment.allocationPercent / 100);
      lines.push({
        resourceId: resource.id,
        resourceName: resource.name,
        allocationPercent: assignment.allocationPercent,
        cost,
      });
    }
    return {
      taskId: task.id,
      taskName: task.name,
      durationDays: task.durationDays,
      lines,
      total: lines.reduce((sum, line) => sum + line.cost, 0),
    };
  });
}

export interface ProjectCostResult {
  tasks: TaskCost[];
  total: number;
}

export function computeProjectCost(
  tasks: readonly CostTaskInput[],
  assignments: readonly CostAssignmentInput[],
  resources: readonly CostResourceInput[],
): ProjectCostResult {
  const taskCosts = computeTaskCosts(tasks, assignments, resources);
  return {
    tasks: taskCosts,
    total: Math.round(taskCosts.reduce((sum, task) => sum + task.total, 0)),
  };
}

export interface ResourceAssignationSummary {
  taskId: string;
  taskName: string;
  allocationPercent: number;
  cost: number;
}

export interface ResourceDayLoad {
  date: string;
  totalPercent: number;
  taskIds: string[];
}

export interface ResourceLoad {
  resourceId: string;
  name: string;
  role: string;
  salary: number;
  dailyRate: number;
  totalCost: number;
  assignments: ResourceAssignationSummary[];
  peakPercent: number;
  overallocatedDays: string[];
  days: ResourceDayLoad[];
}

export interface OverAllocationWarning {
  resourceId: string;
  resourceName: string;
  date: string;
  totalPercent: number;
  taskIds: string[];
  taskNames: string[];
}

export interface ResourceLoadInput {
  tasks: readonly CostTaskInput[];
  assignments: readonly CostAssignmentInput[];
  resources: readonly CostResourceInput[];
  calendar: ProjectCalendar;
}

export function computeResourceLoads({
  tasks,
  assignments,
  resources,
  calendar,
}: ResourceLoadInput): { resources: ResourceLoad[]; warnings: OverAllocationWarning[] } {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const taskCosts = new Map(computeTaskCosts(tasks, assignments, resources).map((t) => [t.taskId, t]));
  const warnings: OverAllocationWarning[] = [];

  const loads = resources.map((resource) => {
    const own = assignments.filter((assignment) => assignment.resourceId === resource.id);
    const perDay = new Map<string, { totalPercent: number; taskIds: string[] }>();

    for (const assignment of own) {
      const task = taskById.get(assignment.taskId);
      if (!task) continue;
      const days = workingDaysInRange(
        calendar,
        parseIsoDate(task.scheduledStart),
        parseIsoDate(task.scheduledEnd),
      );
      for (const day of days) {
        const key = toIsoDate(day);
        const entry = perDay.get(key) ?? { totalPercent: 0, taskIds: [] };
        entry.totalPercent += assignment.allocationPercent;
        if (!entry.taskIds.includes(task.id)) entry.taskIds.push(task.id);
        perDay.set(key, entry);
      }
    }

    const days: ResourceDayLoad[] = [...perDay.entries()]
      .map(([date, entry]) => ({ date, totalPercent: entry.totalPercent, taskIds: entry.taskIds }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const overallocatedDays = days
      .filter((day) => day.totalPercent > 100)
      .map((day) => day.date);

    for (const day of days) {
      if (day.totalPercent <= 100) continue;
      warnings.push({
        resourceId: resource.id,
        resourceName: resource.name,
        date: day.date,
        totalPercent: day.totalPercent,
        taskIds: day.taskIds,
        taskNames: day.taskIds.map((taskId) => taskById.get(taskId)?.name ?? taskId),
      });
    }

    const summary: ResourceAssignationSummary[] = own.flatMap((assignment) => {
      const task = taskById.get(assignment.taskId);
      if (!task) return [];
      const line = taskCosts
        .get(task.id)
        ?.lines.find((candidate) => candidate.resourceId === resource.id);
      return [
        {
          taskId: task.id,
          taskName: task.name,
          allocationPercent: assignment.allocationPercent,
          cost: line?.cost ?? 0,
        },
      ];
    });

    return {
      resourceId: resource.id,
      name: resource.name,
      role: resource.role,
      salary: resource.salary,
      dailyRate: dailyRate(resource.salary),
      totalCost: Math.round(summary.reduce((sum, item) => sum + item.cost, 0)),
      assignments: summary.sort((a, b) => a.taskName.localeCompare(b.taskName)),
      peakPercent: days.reduce((max, day) => Math.max(max, day.totalPercent), 0),
      overallocatedDays,
      days,
    };
  });

  return {
    resources: loads,
    warnings: warnings.sort(
      (a, b) => a.date.localeCompare(b.date) || a.resourceName.localeCompare(b.resourceName),
    ),
  };
}
