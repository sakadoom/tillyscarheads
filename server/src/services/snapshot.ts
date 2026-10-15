import type { ProjectSnapshot } from 'shared';

import { prisma } from '../db.js';
import {
  toAssignmentDto,
  toDependencyDto,
  toHolidayDto,
  toProjectDto,
  toResourceDto,
  toTaskDto,
} from './serialize.js';

/** Snapshot lengkap satu proyek: proyek, tugas, dependensi, resource, alokasi, libur. */
export async function getProjectSnapshot(projectId: string): Promise<ProjectSnapshot> {
  const [project, tasks, dependencies, resources, assignments, holidays] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { id: projectId } }),
    prisma.task.findMany({
      where: { projectId },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    }),
    prisma.dependency.findMany({
      where: { predecessor: { projectId } },
      orderBy: [{ id: 'asc' }],
    }),
    prisma.resource.findMany({ where: { projectId }, orderBy: [{ name: 'asc' }] }),
    prisma.assignment.findMany({ where: { task: { projectId } }, orderBy: [{ id: 'asc' }] }),
    prisma.holiday.findMany({ where: { projectId }, orderBy: [{ date: 'asc' }] }),
  ]);

  return {
    project: toProjectDto(project),
    tasks: tasks.map(toTaskDto),
    dependencies: dependencies.map(toDependencyDto),
    resources: resources.map(toResourceDto),
    assignments: assignments.map(toAssignmentDto),
    holidays: holidays.map(toHolidayDto),
  };
}
