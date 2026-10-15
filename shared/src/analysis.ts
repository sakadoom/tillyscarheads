/**
 * Analisis proyek (6.8–6.10): CPM, jalur kritis, data PERT, biaya, dan beban
 * resource. Fungsi murni supaya hasil server dan client identik.
 */

import { calendarFromProject, type ProjectCalendar } from './calendar.js';
import { computeCpm, dateAtOrdinal, type CpmTaskInput, type CpmTaskResult } from './cpm.js';
import {
  computeProjectCost,
  computeResourceLoads,
  type OverAllocationWarning,
  type ResourceLoad,
  type TaskCost,
} from './cost.js';
import { computePert, type PertResult } from './pert.js';
import { getLeafTaskIds } from './scheduler.js';
import type {
  AssignmentDto,
  DependencyDto,
  HolidayDto,
  ProjectDto,
  ProjectSummaryDto,
  ResourceDto,
  TaskDto,
} from './types.js';

export interface AnalysisSummary {
  projectStart: string;
  projectEnd: string | null;
  /** Jumlah hari kerja yang dipakai proyek (ordinal akhir + 1). */
  totalWorkingDays: number;
  totalCost: number;
  criticalTaskCount: number;
  taskCount: number;
  leafTaskCount: number;
  resourceCount: number;
}

export interface AnalysisResult {
  summary: AnalysisSummary;
  /** Baris tabel CPM untuk tugas daun, diurutkan menurut ES. */
  cpm: CpmTaskResult[];
  criticalPath: string[];
  pert: PertResult;
  cost: {
    tasks: TaskCost[];
    total: number;
  };
  resourceLoads: ResourceLoad[];
  warnings: OverAllocationWarning[];
}

export interface AnalysisInput {
  project: ProjectDto;
  tasks: readonly TaskDto[];
  dependencies: readonly DependencyDto[];
  resources: readonly ResourceDto[];
  assignments: readonly AssignmentDto[];
  holidays: readonly HolidayDto[];
}

function createProjectCalendar(input: AnalysisInput): ProjectCalendar {
  return calendarFromProject({
    weekendDays: input.project.weekendDays,
    holidays: input.holidays.map((holiday) => holiday.date),
  });
}

export function buildProjectAnalysis(input: AnalysisInput): AnalysisResult {
  const { project, tasks, dependencies, resources, assignments } = input;
  const calendar = createProjectCalendar(input);
  const leafIds = getLeafTaskIds(tasks);
  const leaves = tasks.filter((task) => leafIds.has(task.id));

  const dependencyInputs = dependencies.map((dependency) => ({
    predecessorId: dependency.predecessorId,
    successorId: dependency.successorId,
    type: dependency.type,
    lagDays: dependency.lagDays,
  }));

  const cpmTasks: CpmTaskInput[] = leaves.map((task) => ({
    id: task.id,
    name: task.name,
    parentId: task.parentId,
    position: task.position,
    durationDays: task.durationDays,
    startDate: task.startDate,
    progress: task.progress,
    scheduledStart: task.scheduledStart,
    scheduledEnd: task.scheduledEnd,
  }));

  const cpm = computeCpm({
    tasks: cpmTasks,
    dependencies: dependencyInputs,
    calendar,
    projectStart: project.startDate,
  });

  const pert = computePert({
    tasks: leaves.map((task) => ({
      id: task.id,
      name: task.name,
      parentId: task.parentId,
      position: task.position,
      durationDays: task.durationDays,
      startDate: task.startDate,
      progress: task.progress,
      optimisticDays: task.optimisticDays,
      pessimisticDays: task.pessimisticDays,
    })),
    dependencies: dependencyInputs,
    cpm,
  });

  const costTasks = leaves.map((task) => ({
    id: task.id,
    name: task.name,
    durationDays: task.durationDays,
    scheduledStart: task.scheduledStart,
    scheduledEnd: task.scheduledEnd,
  }));
  const assignmentInputs = assignments.map((assignment) => ({
    taskId: assignment.taskId,
    resourceId: assignment.resourceId,
    allocationPercent: assignment.allocationPercent,
  }));
  const resourceInputs = resources.map((resource) => ({
    id: resource.id,
    name: resource.name,
    role: resource.role,
    salary: resource.salary,
  }));

  const cost = computeProjectCost(costTasks, assignmentInputs, resourceInputs);
  const { resources: resourceLoads, warnings } = computeResourceLoads({
    tasks: costTasks,
    assignments: assignmentInputs,
    resources: resourceInputs,
    calendar,
  });

  const cpmRows = [...cpm.tasks.values()].sort((a, b) => a.es - b.es || a.name.localeCompare(b.name));

  return {
    summary: {
      projectStart: project.startDate,
      projectEnd: leaves.length > 0 ? dateAtOrdinal(calendar, project.startDate, cpm.projectEnd) : null,
      totalWorkingDays: leaves.length > 0 ? cpm.projectEnd + 1 : 0,
      totalCost: cost.total,
      criticalTaskCount: cpmRows.filter((row) => row.critical).length,
      taskCount: tasks.length,
      leafTaskCount: leaves.length,
      resourceCount: resources.length,
    },
    cpm: cpmRows,
    criticalPath: cpm.criticalPath,
    pert,
    cost,
    resourceLoads,
    warnings,
  };
}

/** Ringkasan proyek untuk halaman daftar proyek. */
export function summarizeProject(input: {
  project: ProjectDto;
  tasks: readonly TaskDto[];
  resourceCount: number;
  holidayCount: number;
}): ProjectSummaryDto {
  const { project, tasks, resourceCount, holidayCount } = input;
  const ids = new Set(tasks.map((task) => task.id));
  const roots = tasks.filter((task) => !task.parentId || !ids.has(task.parentId));
  const totalDuration = roots.reduce((sum, task) => sum + task.durationDays, 0);
  const progress =
    totalDuration > 0
      ? Math.round(
          roots.reduce((sum, task) => sum + task.progress * task.durationDays, 0) / totalDuration,
        )
      : 0;

  const starts = tasks.map((task) => task.scheduledStart).sort();
  const ends = tasks.map((task) => task.scheduledEnd).sort();

  return {
    ...project,
    taskCount: tasks.length,
    resourceCount,
    holidayCount,
    progress,
    scheduledStart: starts[0] ?? null,
    scheduledEnd: ends[ends.length - 1] ?? null,
  };
}
