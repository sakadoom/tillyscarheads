import { Router } from 'express';
import {
  TASK_COLORS,
  taskCreateSchema,
  taskMoveSchema,
  taskUpdateSchema,
  type TaskCreateInput,
  type TaskMoveInput,
  type TaskUpdateInput,
} from 'shared';

import { prisma } from '../db.js';
import { currentUserId } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';
import { validateBody } from '../middleware/validate.js';
import { getOwnedProject, getOwnedTask } from '../services/ownership.js';
import { recomputeProject } from '../services/recompute.js';
import { routeParam } from '../services/request.js';
import { toTaskDto } from '../services/serialize.js';
import {
  assertCanBecomeParent,
  countChildren,
  getSubtreeHeight,
  getTaskTreeInputs,
  nextChildPosition,
  reorderSiblings,
} from '../services/task-rules.js';

export const tasksRouter = Router();

/** Kolom yang masih boleh diubah pada tugas induk (sisanya dihitung otomatis). */
const SUMMARY_EDITABLE_FIELDS = ['name', 'description', 'color', 'priority'];

function defaultColor(index: number): string {
  return TASK_COLORS[index % TASK_COLORS.length] ?? '#2563EB';
}

tasksRouter.post('/projects/:id/tasks', validateBody(taskCreateSchema), async (req, res) => {
  const project = await getOwnedProject(currentUserId(req), routeParam(req, 'id'));
  const body = req.body as TaskCreateInput;

  if (body.parentId) {
    await assertCanBecomeParent(project.id, body.parentId, null, 0);
  }

  const position = await nextChildPosition(project.id, body.parentId ?? null);
  const startDate = body.startDate ?? project.startDate;

  const created = await prisma.task.create({
    data: {
      projectId: project.id,
      parentId: body.parentId ?? null,
      position,
      name: body.name,
      description: body.description ?? null,
      durationDays: body.durationDays ?? 1,
      startDate,
      // Nilai sementara; recomputeProject mengisi jadwal yang sebenarnya.
      scheduledStart: startDate,
      scheduledEnd: startDate,
      priority: body.priority ?? 'MEDIUM',
      color: body.color ?? defaultColor(position),
      progress: body.progress ?? 0,
      optimisticDays: body.optimisticDays ?? null,
      pessimisticDays: body.pessimisticDays ?? null,
    },
  });

  const tasks = await recomputeProject(project.id);
  const updated = tasks.find((task) => task.id === created.id) ?? created;
  res.status(201).json({ task: toTaskDto(updated), tasks: tasks.map(toTaskDto) });
});

tasksRouter.patch('/tasks/:id', validateBody(taskUpdateSchema), async (req, res) => {
  const { task, project } = await getOwnedTask(currentUserId(req), routeParam(req, 'id'));
  const body = req.body as TaskUpdateInput;

  const children = await countChildren(task.id);
  if (children > 0) {
    const lockedFields = Object.entries(body)
      .filter(([key, value]) => value !== undefined && !SUMMARY_EDITABLE_FIELDS.includes(key))
      .map(([key]) => key);
    if (lockedFields.length > 0) {
      throw ApiError.unprocessable(
        'SUMMARY_TASK_FIELDS_LOCKED',
        `Tugas induk hanya bisa diubah nama, deskripsi, warna, dan prioritasnya. Kolom yang dihitung otomatis: ${lockedFields.join(', ')}.`,
        { fields: lockedFields },
      );
    }
  }

  await prisma.task.update({
    where: { id: task.id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description ?? null } : {}),
      ...(body.durationDays !== undefined ? { durationDays: body.durationDays } : {}),
      ...(body.startDate !== undefined ? { startDate: body.startDate } : {}),
      ...(body.priority !== undefined ? { priority: body.priority } : {}),
      ...(body.color !== undefined ? { color: body.color } : {}),
      ...(body.progress !== undefined ? { progress: body.progress } : {}),
      ...(body.optimisticDays !== undefined ? { optimisticDays: body.optimisticDays } : {}),
      ...(body.pessimisticDays !== undefined ? { pessimisticDays: body.pessimisticDays } : {}),
    },
  });

  const tasks = await recomputeProject(project.id);
  const updated = tasks.find((candidate) => candidate.id === task.id) ?? task;
  res.json({ task: toTaskDto(updated), tasks: tasks.map(toTaskDto) });
});

tasksRouter.delete('/tasks/:id', async (req, res) => {
  const { task, project } = await getOwnedTask(currentUserId(req), routeParam(req, 'id'));

  // Relasi Prisma memakai onDelete: Cascade, jadi anak, dependensi, dan alokasi
  // tugas ini ikut terhapus.
  await prisma.task.delete({ where: { id: task.id } });

  const tasks = await recomputeProject(project.id);
  res.json({ deletedId: task.id, tasks: tasks.map(toTaskDto) });
});

tasksRouter.post('/tasks/:id/move', validateBody(taskMoveSchema), async (req, res) => {
  const { task, project } = await getOwnedTask(currentUserId(req), routeParam(req, 'id'));
  const body = req.body as TaskMoveInput;
  const newParentId = body.parentId ?? null;
  const position = body.position;

  const inputs = await getTaskTreeInputs(project.id);
  const subtreeHeight = getSubtreeHeight(inputs, task.id);
  if (newParentId) {
    await assertCanBecomeParent(project.id, newParentId, task.id, subtreeHeight);
  }

  await prisma.task.update({
    where: { id: task.id },
    data: { parentId: newParentId, position },
  });
  await reorderSiblings(project.id, newParentId, task.id, position);

  const tasks = await recomputeProject(project.id);
  const updated = tasks.find((candidate) => candidate.id === task.id) ?? task;
  res.json({ task: toTaskDto(updated), tasks: tasks.map(toTaskDto) });
});
