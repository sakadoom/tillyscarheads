import { Router } from 'express';
import {
  dependencyCreateSchema,
  dependencyUpdateSchema,
  findCyclePath,
  type DependencyCreateInput,
  type DependencyType,
  type DependencyUpdateInput,
} from 'shared';

import { prisma } from '../db.js';
import { currentUserId } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';
import { validateBody } from '../middleware/validate.js';
import { getOwnedDependency, getOwnedTask } from '../services/ownership.js';
import { recomputeProject } from '../services/recompute.js';
import { routeParam } from '../services/request.js';
import { toDependencyDto, toTaskDto } from '../services/serialize.js';
import { assertLeafTask } from '../services/task-rules.js';

export const dependenciesRouter = Router();

async function describeCycle(projectId: string, cycleIds: readonly string[]): Promise<string> {
  const tasks = await prisma.task.findMany({
    where: { projectId, id: { in: [...cycleIds] } },
    select: { id: true, name: true },
  });
  const nameById = new Map(tasks.map((task) => [task.id, task.name]));
  return cycleIds.map((id) => nameById.get(id) ?? id).join(' → ');
}

dependenciesRouter.post(
  '/tasks/:id/dependencies',
  validateBody(dependencyCreateSchema),
  async (req, res) => {
    const { task: successor, project } = await getOwnedTask(currentUserId(req), routeParam(req, 'id'));
    const body = req.body as DependencyCreateInput;

    if (body.predecessorId === successor.id) {
      throw ApiError.unprocessable(
        'SELF_DEPENDENCY',
        'Sebuah tugas tidak bisa menjadi predecessor bagi dirinya sendiri.',
      );
    }

    const predecessor = await prisma.task.findFirst({
      where: { id: body.predecessorId, projectId: project.id },
    });
    if (!predecessor) {
      throw ApiError.badRequest('Tugas predecessor tidak ditemukan di proyek ini.');
    }

    await assertLeafTask(successor.id, 'punya dependensi');
    await assertLeafTask(predecessor.id, 'punya dependensi');

    const duplicate = await prisma.dependency.findUnique({
      where: {
        predecessorId_successorId: {
          predecessorId: predecessor.id,
          successorId: successor.id,
        },
      },
    });
    if (duplicate) {
      throw ApiError.unprocessable(
        'DUPLICATE_DEPENDENCY',
        `Dependensi dari "${predecessor.name}" ke "${successor.name}" sudah ada.`,
      );
    }

    const existing = await prisma.dependency.findMany({
      where: { predecessor: { projectId: project.id } },
    });
    const cycle = findCyclePath([
      ...existing.map((dependency) => ({
        predecessorId: dependency.predecessorId,
        successorId: dependency.successorId,
        type: dependency.type as DependencyType,
        lagDays: dependency.lagDays,
      })),
      {
        predecessorId: predecessor.id,
        successorId: successor.id,
        type: body.type,
        lagDays: body.lagDays,
      },
    ]);
    if (cycle) {
      const description = await describeCycle(project.id, cycle);
      throw ApiError.unprocessable(
        'CYCLE_DETECTED',
        `Dependensi ini membentuk siklus: ${description}. Hapus salah satu dependensi pada siklus itu lebih dahulu.`,
        { path: cycle },
      );
    }

    const dependency = await prisma.dependency.create({
      data: {
        predecessorId: predecessor.id,
        successorId: successor.id,
        type: body.type,
        lagDays: body.lagDays,
      },
    });

    const tasks = await recomputeProject(project.id);
    res.status(201).json({ dependency: toDependencyDto(dependency), tasks: tasks.map(toTaskDto) });
  },
);

dependenciesRouter.patch(
  '/dependencies/:id',
  validateBody(dependencyUpdateSchema),
  async (req, res) => {
    const { dependency, project } = await getOwnedDependency(currentUserId(req), routeParam(req, 'id'));
    const body = req.body as DependencyUpdateInput;

    const updated = await prisma.dependency.update({
      where: { id: dependency.id },
      data: {
        ...(body.type !== undefined ? { type: body.type } : {}),
        ...(body.lagDays !== undefined ? { lagDays: body.lagDays } : {}),
      },
    });

    const tasks = await recomputeProject(project.id);
    res.json({ dependency: toDependencyDto(updated), tasks: tasks.map(toTaskDto) });
  },
);

dependenciesRouter.delete('/dependencies/:id', async (req, res) => {
  const { dependency, project } = await getOwnedDependency(currentUserId(req), routeParam(req, 'id'));
  await prisma.dependency.delete({ where: { id: dependency.id } });

  const tasks = await recomputeProject(project.id);
  res.json({ deletedId: dependency.id, tasks: tasks.map(toTaskDto) });
});
