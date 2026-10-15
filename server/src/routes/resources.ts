import { Router } from 'express';
import {
  resourceCreateSchema,
  resourceUpdateSchema,
  type ResourceCreateInput,
  type ResourceUpdateInput,
} from 'shared';

import { prisma } from '../db.js';
import { currentUserId } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { getOwnedProject, getOwnedResource } from '../services/ownership.js';
import { routeParam } from '../services/request.js';
import { toResourceDto } from '../services/serialize.js';

export const resourcesRouter = Router();

async function listResources(projectId: string) {
  const resources = await prisma.resource.findMany({
    where: { projectId },
    orderBy: [{ name: 'asc' }],
  });
  return resources.map(toResourceDto);
}

resourcesRouter.get('/projects/:id/resources', async (req, res) => {
  const project = await getOwnedProject(currentUserId(req), routeParam(req, 'id'));
  res.json({ resources: await listResources(project.id) });
});

resourcesRouter.post(
  '/projects/:id/resources',
  validateBody(resourceCreateSchema),
  async (req, res) => {
    const project = await getOwnedProject(currentUserId(req), routeParam(req, 'id'));
    const body = req.body as ResourceCreateInput;

    const resource = await prisma.resource.create({
      data: {
        projectId: project.id,
        name: body.name,
        email: body.email,
        role: body.role,
        salary: body.salary,
      },
    });

    res.status(201).json({
      resource: toResourceDto(resource),
      resources: await listResources(project.id),
    });
  },
);

resourcesRouter.patch(
  '/resources/:id',
  validateBody(resourceUpdateSchema),
  async (req, res) => {
    const existing = await getOwnedResource(currentUserId(req), routeParam(req, 'id'));
    const body = req.body as ResourceUpdateInput;

    const resource = await prisma.resource.update({
      where: { id: existing.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.role !== undefined ? { role: body.role } : {}),
        ...(body.salary !== undefined ? { salary: body.salary } : {}),
      },
    });

    res.json({
      resource: toResourceDto(resource),
      resources: await listResources(existing.projectId),
    });
  },
);

resourcesRouter.delete('/resources/:id', async (req, res) => {
  const resource = await getOwnedResource(currentUserId(req), routeParam(req, 'id'));
  // Alokasi anggota ini terhapus otomatis lewat onDelete: Cascade.
  await prisma.resource.delete({ where: { id: resource.id } });

  res.json({
    deletedId: resource.id,
    resources: await listResources(resource.projectId),
  });
});
