import type { Assignment, Dependency, Holiday, Project, Resource, Task } from '@prisma/client';

import { prisma } from '../db.js';
import { ApiError } from '../middleware/error.js';

/**
 * Semua akses data lewat pemilik proyek. Data milik pengguna lain dijawab 404
 * supaya keberadaannya tidak terbocorkan.
 */
export async function getOwnedProject(userId: string, projectId: string): Promise<Project> {
  const project = await prisma.project.findFirst({ where: { id: projectId, ownerId: userId } });
  if (!project) throw ApiError.notFound('Proyek tidak ditemukan.');
  return project;
}

export interface OwnedTask {
  task: Task;
  project: Project;
}

export async function getOwnedTask(userId: string, taskId: string): Promise<OwnedTask> {
  const task = await prisma.task.findFirst({
    where: { id: taskId, project: { ownerId: userId } },
    include: { project: true },
  });
  if (!task) throw ApiError.notFound('Tugas tidak ditemukan.');
  const { project, ...rest } = task;
  return { task: rest, project };
}

export interface OwnedDependency {
  dependency: Dependency;
  project: Project;
}

export async function getOwnedDependency(
  userId: string,
  dependencyId: string,
): Promise<OwnedDependency> {
  const dependency = await prisma.dependency.findFirst({
    where: { id: dependencyId, predecessor: { project: { ownerId: userId } } },
    include: { predecessor: { include: { project: true } } },
  });
  if (!dependency) throw ApiError.notFound('Dependensi tidak ditemukan.');
  const { predecessor, ...rest } = dependency;
  return { dependency: rest, project: predecessor.project };
}

export async function getOwnedResource(userId: string, resourceId: string): Promise<Resource> {
  const resource = await prisma.resource.findFirst({
    where: { id: resourceId, project: { ownerId: userId } },
  });
  if (!resource) throw ApiError.notFound('Anggota tim tidak ditemukan.');
  return resource;
}

export interface OwnedAssignment {
  assignment: Assignment;
  project: Project;
}

export async function getOwnedAssignment(
  userId: string,
  assignmentId: string,
): Promise<OwnedAssignment> {
  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, task: { project: { ownerId: userId } } },
    include: { task: { include: { project: true } } },
  });
  if (!assignment) throw ApiError.notFound('Alokasi tidak ditemukan.');
  const { task, ...rest } = assignment;
  return { assignment: rest, project: task.project };
}

export async function getOwnedHoliday(userId: string, holidayId: string): Promise<Holiday> {
  const holiday = await prisma.holiday.findFirst({
    where: { id: holidayId, project: { ownerId: userId } },
  });
  if (!holiday) throw ApiError.notFound('Hari libur tidak ditemukan.');
  return holiday;
}
