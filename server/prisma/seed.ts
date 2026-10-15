/**
 * Seed data demo (Bagian 9). Idempoten: proyek demo lama dihapus lebih dahulu
 * lalu dibuat ulang dari fixture di paket `shared`, jadi aman dijalankan
 * berulang kali.
 */

import bcrypt from 'bcryptjs';
import {
  buildFixtureSchedule,
  demoProjectFixture,
  formatWeekendDays,
  fixtureTaskPositions,
} from 'shared';

import { config } from '../src/config.js';
import { prisma } from '../src/db.js';

async function main(): Promise<void> {
  const fixture = demoProjectFixture;
  const { schedule } = buildFixtureSchedule(fixture);
  const positions = fixtureTaskPositions(fixture);

  const passwordHash = await bcrypt.hash(fixture.user.password, config.bcryptRounds);
  const demoUser = await prisma.user.upsert({
    where: { email: fixture.user.email },
    update: { name: fixture.user.name, passwordHash },
    create: { name: fixture.user.name, email: fixture.user.email, passwordHash },
  });

  await prisma.project.deleteMany({
    where: { ownerId: demoUser.id, name: fixture.project.name },
  });

  const project = await prisma.project.create({
    data: {
      ownerId: demoUser.id,
      name: fixture.project.name,
      description: fixture.project.description,
      startDate: fixture.project.startDate,
      weekendDays: formatWeekendDays(fixture.project.weekendDays),
    },
  });

  await prisma.holiday.createMany({
    data: fixture.holidays.map((holiday) => ({
      projectId: project.id,
      date: holiday.date,
      name: holiday.name,
    })),
  });

  const resourceIdByKey = new Map<string, string>();
  for (const resource of fixture.resources) {
    const created = await prisma.resource.create({
      data: {
        projectId: project.id,
        name: resource.name,
        email: resource.email,
        role: resource.role,
        salary: resource.salary,
      },
    });
    resourceIdByKey.set(resource.key, created.id);
  }

  const taskIdByKey = new Map<string, string>();
  for (const task of fixture.tasks) {
    const scheduled = schedule.get(task.key);
    if (!scheduled) throw new Error(`Tugas ${task.key} tidak terjadwal oleh mesin shared`);

    const created = await prisma.task.create({
      data: {
        projectId: project.id,
        parentId: task.parentKey ? (taskIdByKey.get(task.parentKey) ?? null) : null,
        position: positions.get(task.key) ?? 0,
        name: task.name,
        description: null,
        durationDays: scheduled.durationDays,
        startDate: fixture.project.startDate,
        scheduledStart: scheduled.scheduledStart,
        scheduledEnd: scheduled.scheduledEnd,
        priority: task.priority,
        color: task.color,
        progress: scheduled.progress,
        optimisticDays: task.optimisticDays ?? null,
        pessimisticDays: task.pessimisticDays ?? null,
      },
    });
    taskIdByKey.set(task.key, created.id);
  }

  for (const task of fixture.tasks) {
    for (const dependency of task.dependencies) {
      const predecessorId = taskIdByKey.get(dependency.predecessorKey);
      const successorId = taskIdByKey.get(task.key);
      if (!predecessorId || !successorId) {
        throw new Error(`Relasi ${dependency.predecessorKey} -> ${task.key} tidak bisa dibuat`);
      }
      await prisma.dependency.create({
        data: {
          predecessorId,
          successorId,
          type: dependency.type,
          lagDays: dependency.lagDays,
        },
      });
    }

    for (const assignment of task.assignments) {
      const taskId = taskIdByKey.get(task.key);
      const resourceId = resourceIdByKey.get(assignment.resourceKey);
      if (!taskId || !resourceId) {
        throw new Error(`Alokasi ${assignment.resourceKey} pada ${task.key} tidak bisa dibuat`);
      }
      await prisma.assignment.create({
        data: {
          taskId,
          resourceId,
          allocationPercent: assignment.allocationPercent,
        },
      });
    }
  }

  const lastTask = [...schedule.values()].reduce(
    (latest, task) => (task.scheduledEnd > latest ? task.scheduledEnd : latest),
    fixture.project.startDate,
  );

  console.log('Seed selesai:');
  console.log(`  Akun demo   : ${fixture.user.email} / ${fixture.user.password}`);
  console.log(`  Proyek      : ${project.name} (${project.id})`);
  console.log(`  Tugas       : ${fixture.tasks.length}`);
  console.log(`  Resource    : ${fixture.resources.length}`);
  console.log(`  Libur       : ${fixture.holidays.length}`);
  console.log(`  Selesai     : ${lastTask}`);
  const leaves = [...schedule.keys()].length;
  console.log(`  Tugas terjadwal: ${leaves}`);
}

main()
  .catch((error: unknown) => {
    console.error('Seed gagal:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
