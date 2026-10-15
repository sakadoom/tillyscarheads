import { Router } from 'express';
import {
  calendarUpdateSchema,
  formatWeekendDays,
  holidayCreateSchema,
  type CalendarUpdateInput,
  type HolidayCreateInput,
} from 'shared';

import { prisma } from '../db.js';
import { currentUserId } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';
import { validateBody } from '../middleware/validate.js';
import { getOwnedHoliday, getOwnedProject } from '../services/ownership.js';
import { recomputeProject } from '../services/recompute.js';
import { routeParam } from '../services/request.js';
import { toHolidayDto, toProjectDto, toTaskDto } from '../services/serialize.js';

export const calendarRouter = Router();

async function listHolidays(projectId: string) {
  const holidays = await prisma.holiday.findMany({
    where: { projectId },
    orderBy: [{ date: 'asc' }],
  });
  return holidays.map(toHolidayDto);
}

calendarRouter.put(
  '/projects/:id/calendar',
  validateBody(calendarUpdateSchema),
  async (req, res) => {
    const project = await getOwnedProject(currentUserId(req), routeParam(req, 'id'));
    const body = req.body as CalendarUpdateInput;

    const updated = await prisma.project.update({
      where: { id: project.id },
      data: { weekendDays: formatWeekendDays(body.weekendDays) },
    });

    const tasks = await recomputeProject(project.id);
    res.json({ project: toProjectDto(updated), tasks: tasks.map(toTaskDto) });
  },
);

calendarRouter.post(
  '/projects/:id/holidays',
  validateBody(holidayCreateSchema),
  async (req, res) => {
    const project = await getOwnedProject(currentUserId(req), routeParam(req, 'id'));
    const body = req.body as HolidayCreateInput;

    const existing = await prisma.holiday.findUnique({
      where: { projectId_date: { projectId: project.id, date: body.date } },
    });
    if (existing) {
      throw ApiError.conflict(
        'HOLIDAY_EXISTS',
        `Tanggal ${body.date} sudah ditandai sebagai hari libur (${existing.name}).`,
      );
    }

    const holiday = await prisma.holiday.create({
      data: { projectId: project.id, date: body.date, name: body.name },
    });

    const [tasks, holidays] = await Promise.all([
      recomputeProject(project.id),
      listHolidays(project.id),
    ]);

    res.status(201).json({
      holiday: toHolidayDto(holiday),
      holidays,
      tasks: tasks.map(toTaskDto),
    });
  },
);

calendarRouter.delete('/holidays/:id', async (req, res) => {
  const holiday = await getOwnedHoliday(currentUserId(req), routeParam(req, 'id'));
  await prisma.holiday.delete({ where: { id: holiday.id } });

  const [tasks, holidays] = await Promise.all([
    recomputeProject(holiday.projectId),
    listHolidays(holiday.projectId),
  ]);

  res.json({ deletedId: holiday.id, holidays, tasks: tasks.map(toTaskDto) });
});
