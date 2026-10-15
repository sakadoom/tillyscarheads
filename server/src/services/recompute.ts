import type { Task } from '@prisma/client';
import {
  calendarFromProject,
  computeSchedule,
  type DependencyType,
  type ProjectCalendar,
  type ScheduleTaskInput,
} from 'shared';

import { prisma } from '../db.js';

export async function loadProjectCalendar(projectId: string): Promise<ProjectCalendar> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { holidays: { select: { date: true } } },
  });
  if (!project) throw new Error(`Proyek ${projectId} tidak ditemukan saat menghitung jadwal.`);
  return calendarFromProject({
    weekendDays: project.weekendDays,
    holidays: project.holidays.map((holiday) => holiday.date),
  });
}

export async function listProjectTasks(projectId: string): Promise<Task[]> {
  return prisma.task.findMany({
    where: { projectId },
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
  });
}

/**
 * Menghitung ulang jadwal seluruh tugas proyek dengan mesin `shared` lalu
 * menyimpannya. Mengembalikan daftar tugas terbaru supaya client cukup
 * memperbarui cache-nya.
 */
export async function recomputeProject(projectId: string): Promise<Task[]> {
  const [calendar, tasks, dependencies] = await Promise.all([
    loadProjectCalendar(projectId),
    prisma.task.findMany({ where: { projectId } }),
    prisma.dependency.findMany({ where: { predecessor: { projectId } } }),
  ]);

  const scheduleInputs: ScheduleTaskInput[] = tasks.map((task) => ({
    id: task.id,
    parentId: task.parentId,
    position: task.position,
    durationDays: task.durationDays,
    startDate: task.startDate,
    progress: task.progress,
  }));

  const schedule = computeSchedule(
    scheduleInputs,
    dependencies.map((dependency) => ({
      predecessorId: dependency.predecessorId,
      successorId: dependency.successorId,
      type: dependency.type as DependencyType,
      lagDays: dependency.lagDays,
    })),
    calendar,
  );

  const updates = tasks.flatMap((task) => {
    const scheduled = schedule.get(task.id);
    if (!scheduled) return [];
    const unchanged =
      task.scheduledStart === scheduled.scheduledStart &&
      task.scheduledEnd === scheduled.scheduledEnd &&
      task.durationDays === scheduled.durationDays &&
      task.progress === scheduled.progress;
    if (unchanged) return [];
    return [
      prisma.task.update({
        where: { id: task.id },
        data: {
          scheduledStart: scheduled.scheduledStart,
          scheduledEnd: scheduled.scheduledEnd,
          durationDays: scheduled.durationDays,
          progress: scheduled.progress,
        },
      }),
    ];
  });

  if (updates.length > 0) {
    await prisma.$transaction(updates);
  }

  return listProjectTasks(projectId);
}
