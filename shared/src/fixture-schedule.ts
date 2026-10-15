/**
 * Helper untuk mengubah data fixture (Bagian 9) menjadi tugas terjadwal memakai
 * mesin `shared`. Dipakai seed server dan test komponen client.
 */

import { createCalendar, type ProjectCalendar } from './calendar.js';
import { demoProjectFixture, type DemoProjectFixture } from './fixtures.js';
import type { ProjectSnapshot } from './types.js';
import {
  computeSchedule,
  type ScheduleDependencyInput,
  type ScheduleTaskInput,
  type ScheduledTaskResult,
} from './scheduler.js';

/** Posisi urutan antar saudara mengikuti urutan pada fixture. */
export function fixtureTaskPositions(fixture: DemoProjectFixture): Map<string, number> {
  const counters = new Map<string, number>();
  const positions = new Map<string, number>();
  for (const task of fixture.tasks) {
    const key = task.parentKey ?? '__root__';
    const next = counters.get(key) ?? 0;
    positions.set(task.key, next);
    counters.set(key, next + 1);
  }
  return positions;
}

export interface FixtureSchedule {
  calendar: ProjectCalendar;
  tasks: ScheduleTaskInput[];
  dependencies: ScheduleDependencyInput[];
  schedule: Map<string, ScheduledTaskResult>;
}

export function buildFixtureSchedule(
  fixture: DemoProjectFixture = demoProjectFixture,
): FixtureSchedule {
  const calendar = createCalendar({
    weekendDays: fixture.project.weekendDays,
    holidays: fixture.holidays.map((holiday) => holiday.date),
  });
  const positions = fixtureTaskPositions(fixture);
  const tasks: ScheduleTaskInput[] = fixture.tasks.map((task) => ({
    id: task.key,
    parentId: task.parentKey,
    position: positions.get(task.key) ?? 0,
    durationDays: task.durationDays,
    startDate: fixture.project.startDate,
    progress: task.progress,
  }));
  const dependencies: ScheduleDependencyInput[] = fixture.tasks.flatMap((task) =>
    task.dependencies.map((dependency) => ({
      predecessorId: dependency.predecessorKey,
      successorId: task.key,
      type: dependency.type,
      lagDays: dependency.lagDays,
    })),
  );
  return {
    calendar,
    tasks,
    dependencies,
    schedule: computeSchedule(tasks, dependencies, calendar),
  };
}

/**
 * Snapshot proyek demo berbentuk DTO (id = kunci fixture). Dipakai test client
 * dan test analisis agar memakai data yang sama dengan seed.
 */
export function buildFixtureSnapshot(
  fixture: DemoProjectFixture = demoProjectFixture,
): ProjectSnapshot {
  const { schedule } = buildFixtureSchedule(fixture);
  const positions = fixtureTaskPositions(fixture);
  const startDate = fixture.project.startDate;

  return {
    project: {
      id: 'project-demo',
      ownerId: 'user-demo',
      name: fixture.project.name,
      description: fixture.project.description,
      startDate,
      weekendDays: [...fixture.project.weekendDays],
      createdAt: '2026-10-01T00:00:00.000Z',
    },
    tasks: fixture.tasks.map((task) => {
      const scheduled = schedule.get(task.key);
      if (!scheduled) throw new Error(`Tugas ${task.key} tidak terjadwal`);
      return {
        id: task.key,
        projectId: 'project-demo',
        parentId: task.parentKey,
        position: positions.get(task.key) ?? 0,
        name: task.name,
        description: null,
        durationDays: scheduled.durationDays,
        startDate,
        scheduledStart: scheduled.scheduledStart,
        scheduledEnd: scheduled.scheduledEnd,
        priority: task.priority,
        color: task.color,
        progress: scheduled.progress,
        optimisticDays: task.optimisticDays ?? null,
        pessimisticDays: task.pessimisticDays ?? null,
      };
    }),
    dependencies: fixture.tasks.flatMap((task) =>
      task.dependencies.map((dependency) => ({
        id: `dep-${dependency.predecessorKey}-${task.key}`,
        predecessorId: dependency.predecessorKey,
        successorId: task.key,
        type: dependency.type,
        lagDays: dependency.lagDays,
      })),
    ),
    resources: fixture.resources.map((resource) => ({
      id: resource.key,
      projectId: 'project-demo',
      name: resource.name,
      email: resource.email,
      role: resource.role,
      salary: resource.salary,
    })),
    assignments: fixture.tasks.flatMap((task) =>
      task.assignments.map((assignment) => ({
        id: `asg-${task.key}-${assignment.resourceKey}`,
        taskId: task.key,
        resourceId: assignment.resourceKey,
        allocationPercent: assignment.allocationPercent,
      })),
    ),
    holidays: fixture.holidays.map((holiday) => ({
      id: `holiday-${holiday.date}`,
      projectId: 'project-demo',
      date: holiday.date,
      name: holiday.name,
    })),
  };
}
