import { Router } from 'express';
import {
  assignmentCreateSchema,
  assignmentUpdateSchema,
  type AssignmentCreateInput,
  type AssignmentUpdateInput,
} from 'shared';

import { prisma } from '../db.js';
import { currentUserId } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';
import { validateBody } from '../middleware/validate.js';
import { getOwnedAssignment, getOwnedTask } from '../services/ownership.js';
import { routeParam } from '../services/request.js';
import { toAssignmentDto } from '../services/serialize.js';
import { assertLeafTask } from '../services/task-rules.js';

export const assignmentsRouter = Router();

async function listAssignments(projectId: string) {
  const assignments = await prisma.assignment.findMany({
    where: { task: { projectId } },
    orderBy: [{ id: 'asc' }],
  });
  return assignments.map(toAssignmentDto);
}

assignmentsRouter.post(
  '/tasks/:id/assignments',
  validateBody(assignmentCreateSchema),
  async (req, res) => {
    const { task, project } = await getOwnedTask(currentUserId(req), routeParam(req, 'id'));
    const body = req.body as AssignmentCreateInput;

    await assertLeafTask(task.id, 'punya alokasi anggota');

    const resource = await prisma.resource.findFirst({
      where: { id: body.resourceId, projectId: project.id },
    });
    if (!resource) {
      throw ApiError.badRequest('Anggota tim tidak ditemukan di proyek ini.');
    }

    const duplicate = await prisma.assignment.findUnique({
      where: { taskId_resourceId: { taskId: task.id, resourceId: resource.id } },
    });
    if (duplicate) {
      throw ApiError.conflict(
        'ALREADY_ASSIGNED',
        `${resource.name} sudah dialokasikan pada tugas ini. Ubah persentase alokasinya pada baris yang sudah ada.`,
      );
    }

    const assignment = await prisma.assignment.create({
      data: {
        taskId: task.id,
        resourceId: resource.id,
        allocationPercent: body.allocationPercent,
      },
    });

    res.status(201).json({
      assignment: toAssignmentDto(assignment),
      assignments: await listAssignments(project.id),
    });
  },
);

assignmentsRouter.patch(
  '/assignments/:id',
  validateBody(assignmentUpdateSchema),
  async (req, res) => {
    const { assignment, project } = await getOwnedAssignment(currentUserId(req), routeParam(req, 'id'));
    const body = req.body as AssignmentUpdateInput;

    const updated = await prisma.assignment.update({
      where: { id: assignment.id },
      data: { allocationPercent: body.allocationPercent },
    });

    res.json({
      assignment: toAssignmentDto(updated),
      assignments: await listAssignments(project.id),
    });
  },
);

assignmentsRouter.delete('/assignments/:id', async (req, res) => {
  const { assignment, project } = await getOwnedAssignment(currentUserId(req), routeParam(req, 'id'));
  await prisma.assignment.delete({ where: { id: assignment.id } });

  res.json({
    deletedId: assignment.id,
    assignments: await listAssignments(project.id),
  });
});
