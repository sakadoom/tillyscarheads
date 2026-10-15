import { Router } from 'express';
import {
  DEFAULT_WEEKEND_DAYS,
  formatWeekendDays,
  projectCreateSchema,
  projectUpdateSchema,
  summarizeProject,
  type ProjectCreateInput,
  type ProjectUpdateInput,
} from 'shared';

import { prisma } from '../db.js';
import { currentUserId } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { getOwnedProject } from '../services/ownership.js';
import { recomputeProject } from '../services/recompute.js';
import { routeParam } from '../services/request.js';
import { toProjectDto, toTaskDto } from '../services/serialize.js';
import { getProjectSnapshot } from '../services/snapshot.js';

export const projectsRouter = Router();

projectsRouter.get('/projects', async (req, res) => {
  const userId = currentUserId(req);
  const projects = await prisma.project.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: 'desc' },
    include: {
      tasks: true,
      _count: { select: { resources: true, holidays: true } },
    },
  });

  res.json({
    projects: projects.map((project) =>
      summarizeProject({
        project: toProjectDto(project),
        tasks: project.tasks.map(toTaskDto),
        resourceCount: project._count.resources,
        holidayCount: project._count.holidays,
      }),
    ),
  });
});

projectsRouter.post('/projects', validateBody(projectCreateSchema), async (req, res) => {
  const body = req.body as ProjectCreateInput;
  const project = await prisma.project.create({
    data: {
      ownerId: currentUserId(req),
      name: body.name,
      description: body.description ?? null,
      startDate: body.startDate,
      weekendDays: formatWeekendDays(body.weekendDays ?? DEFAULT_WEEKEND_DAYS),
    },
  });

  res.status(201).json({ project: toProjectDto(project) });
});

projectsRouter.get('/projects/:id', async (req, res) => {
  const project = await getOwnedProject(currentUserId(req), routeParam(req, 'id'));
  res.json(await getProjectSnapshot(project.id));
});

projectsRouter.patch('/projects/:id', validateBody(projectUpdateSchema), async (req, res) => {
  const userId = currentUserId(req);
  const existing = await getOwnedProject(userId, routeParam(req, 'id'));
  const body = req.body as ProjectUpdateInput;

  const project = await prisma.project.update({
    where: { id: existing.id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description ?? null } : {}),
      ...(body.startDate !== undefined ? { startDate: body.startDate } : {}),
      ...(body.weekendDays !== undefined
        ? { weekendDays: formatWeekendDays(body.weekendDays) }
        : {}),
    },
  });

  const tasks = await recomputeProject(project.id);
  res.json({ project: toProjectDto(project), tasks: tasks.map(toTaskDto) });
});

projectsRouter.delete('/projects/:id', async (req, res) => {
  const project = await getOwnedProject(currentUserId(req), routeParam(req, 'id'));
  await prisma.project.delete({ where: { id: project.id } });
  res.json({ deletedId: project.id });
});
