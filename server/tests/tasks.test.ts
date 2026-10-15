import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '../src/db.js';
import {
  app,
  authHeader,
  createProject,
  createTask,
  findTask,
  getSnapshot,
  registerUser,
  resetDatabase,
  type CreatedProject,
  type CreatedTask,
  type TestUser,
} from './helpers.js';

let user: TestUser;
let project: CreatedProject;

beforeEach(async () => {
  await resetDatabase();
  user = await registerUser();
  project = await createProject(user.token);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('CRUD tugas', () => {
  it('membuat tugas dengan nilai default dan menyimpannya', async () => {
    const response = await request(app)
      .post(`/api/projects/${project.id}/tasks`)
      .set(authHeader(user.token))
      .send({ name: 'Riset pengguna' });

    expect(response.status).toBe(201);
    expect(response.body.task).toMatchObject({
      name: 'Riset pengguna',
      durationDays: 1,
      priority: 'MEDIUM',
      progress: 0,
      startDate: '2026-10-19',
      scheduledStart: '2026-10-19',
      scheduledEnd: '2026-10-19',
      parentId: null,
    });
    expect(response.body.task.color).toMatch(/^#[0-9a-f]{6}$/i);

    const stored = await prisma.task.findUniqueOrThrow({ where: { id: response.body.task.id } });
    expect(stored.name).toBe('Riset pengguna');
  });

  it('menyimpan durasi, tanggal mulai, prioritas, warna, dan progres', async () => {
    const task = await createTask(user.token, project.id, {
      name: 'Desain UI',
      durationDays: 5,
      startDate: '2026-10-23',
      priority: 'HIGH',
      color: '#123456',
      progress: 40,
      optimisticDays: 4,
      pessimisticDays: 8,
    });

    // Mulai Jumat 2026-10-23, 5 hari kerja -> Kamis 2026-10-29
    expect(task.scheduledStart).toBe('2026-10-23');
    expect(task.scheduledEnd).toBe('2026-10-29');
    expect(task.durationDays).toBe(5);
    expect(task.priority).toBe('HIGH');
    expect(task.progress).toBe(40);

    const snapshot = await getSnapshot(user.token, project.id);
    const saved = findTask(snapshot.tasks, task.id);
    expect(saved.color).toBe('#123456');
    expect(saved.startDate).toBe('2026-10-23');

    const stored = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(stored.optimisticDays).toBe(4);
    expect(stored.pessimisticDays).toBe(8);
  });

  it('mengubah tugas dan menghitung ulang jadwalnya', async () => {
    const task = await createTask(user.token, project.id, { name: 'Awal', durationDays: 5 });
    expect(task.scheduledEnd).toBe('2026-10-23');

    const response = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set(authHeader(user.token))
      .send({ name: 'Setelah diubah', durationDays: 2, priority: 'LOW', progress: 25 });

    expect(response.status).toBe(200);
    expect(response.body.task).toMatchObject({
      name: 'Setelah diubah',
      durationDays: 2,
      scheduledEnd: '2026-10-20',
      priority: 'LOW',
      progress: 25,
    });
  });

  it('menolak input tugas yang tidak valid', async () => {
    const response = await request(app)
      .post(`/api/projects/${project.id}/tasks`)
      .set(authHeader(user.token))
      .send({ name: '', durationDays: 0, priority: 'URGENT', color: 'biru', progress: 150 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    const fields = response.body.error.details.fields;
    expect(fields).toHaveProperty('name');
    expect(fields).toHaveProperty('durationDays');
    expect(fields).toHaveProperty('priority');
    expect(fields).toHaveProperty('color');
  });

  it('menghapus tugas beserta sub-tugasnya', async () => {
    const parent = await createTask(user.token, project.id, { name: 'Induk' });
    const child = await createTask(user.token, project.id, {
      name: 'Anak',
      parentId: parent.id,
      durationDays: 3,
    });

    const response = await request(app)
      .delete(`/api/tasks/${parent.id}`)
      .set(authHeader(user.token));

    expect(response.status).toBe(200);
    expect(response.body.deletedId).toBe(parent.id);
    expect(await prisma.task.count({ where: { id: child.id } })).toBe(0);
  });
});

describe('sub-tugas dan tugas induk', () => {
  it('menghitung rentang serta progres induk dari anak', async () => {
    const parent = await createTask(user.token, project.id, { name: 'Perencanaan' });
    const first = await createTask(user.token, project.id, {
      name: 'Kickoff',
      parentId: parent.id,
      durationDays: 3,
      progress: 100,
    });
    const second = await createTask(user.token, project.id, {
      name: 'Spesifikasi',
      parentId: parent.id,
      durationDays: 5,
      progress: 0,
      startDate: '2026-10-26',
    });

    const snapshot = await getSnapshot(user.token, project.id);
    const summary = findTask(snapshot.tasks, parent.id);
    expect(summary.scheduledStart).toBe('2026-10-19');
    expect(summary.scheduledEnd).toBe('2026-10-30');
    expect(summary.durationDays).toBe(10);
    expect(summary.progress).toBe(38); // (100x3 + 0x5) / 8 = 37,5 dibulatkan
    expect(findTask(snapshot.tasks, first.id).progress).toBe(100);
    expect(findTask(snapshot.tasks, second.id).progress).toBe(0);
  });

  it('hanya mengizinkan nama, deskripsi, warna, dan prioritas diubah pada tugas induk', async () => {
    const parent = await createTask(user.token, project.id, { name: 'Desain' });
    await createTask(user.token, project.id, { name: 'Wireframe', parentId: parent.id, durationDays: 2 });

    const nameUpdate = await request(app)
      .patch(`/api/tasks/${parent.id}`)
      .set(authHeader(user.token))
      .send({ name: 'Desain (diperbarui)', priority: 'HIGH' });
    expect(nameUpdate.status).toBe(200);
    expect(nameUpdate.body.task.name).toBe('Desain (diperbarui)');

    const lockedUpdate = await request(app)
      .patch(`/api/tasks/${parent.id}`)
      .set(authHeader(user.token))
      .send({ durationDays: 7 });
    expect(lockedUpdate.status).toBe(422);
    expect(lockedUpdate.body.error.code).toBe('SUMMARY_TASK_FIELDS_LOCKED');
  });

  it('menolak tugas yang sudah punya dependensi atau alokasi menjadi induk', async () => {
    const project2 = await createProject(user.token, { name: 'Proyek Kedua' });
    const first = await createTask(user.token, project2.id, { name: 'A', durationDays: 2 });
    const second = await createTask(user.token, project2.id, { name: 'B', durationDays: 2 });
    await request(app)
      .post(`/api/tasks/${second.id}/dependencies`)
      .set(authHeader(user.token))
      .send({ predecessorId: first.id, type: 'FS', lagDays: 0 })
      .expect(201);

    const response = await request(app)
      .post(`/api/projects/${project2.id}/tasks`)
      .set(authHeader(user.token))
      .send({ name: 'Anak dari B', parentId: second.id });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('PARENT_HAS_RELATIONS');
    expect(response.body.error.message).toMatch(/dependensi atau alokasi/i);
  });

  it('membatasi hierarki maksimal tiga level', async () => {
    const roots = await Promise.all([1, 2, 3, 4].map((index) =>
      createTask(user.token, project.id, { name: `Level 1 - ${index}` }),
    ));

    const third = await createTask(user.token, project.id, {
      name: 'Level 3',
      parentId: (await createTask(user.token, project.id, {
        name: 'Level 2',
        parentId: roots[0]?.id,
      })).id,
    });

    const tooDeep = await request(app)
      .post(`/api/projects/${project.id}/tasks`)
      .set(authHeader(user.token))
      .send({ name: 'Level 4', parentId: third.id });

    expect(tooDeep.status).toBe(422);
    expect(tooDeep.body.error.code).toBe('MAX_DEPTH_EXCEEDED');
  });

  it('mengurutkan saudara menurut posisi', async () => {
    const parent = await createTask(user.token, project.id, { name: 'Induk' });
    const a = await createTask(user.token, project.id, { name: 'Anak A', parentId: parent.id });
    const b = await createTask(user.token, project.id, { name: 'Anak B', parentId: parent.id });
    const c = await createTask(user.token, project.id, { name: 'Anak C', parentId: parent.id });

    const snapshot = await getSnapshot(user.token, project.id);
    const children = snapshot.tasks
      .filter((task: CreatedTask) => task.parentId === parent.id)
      .map((task: CreatedTask) => task.id);
    expect(children).toEqual([a.id, b.id, c.id]);
  });

  it('memindahkan tugas ke induk lain dan menyusun ulang posisinya', async () => {
    const parentA = await createTask(user.token, project.id, { name: 'Induk A' });
    const parentB = await createTask(user.token, project.id, { name: 'Induk B' });
    const childA = await createTask(user.token, project.id, { name: 'A1', parentId: parentA.id });
    const childB = await createTask(user.token, project.id, { name: 'A2', parentId: parentA.id });

    const response = await request(app)
      .post(`/api/tasks/${childB.id}/move`)
      .set(authHeader(user.token))
      .send({ parentId: parentB.id, position: 0 });

    expect(response.status).toBe(200);
    expect(response.body.task.parentId).toBe(parentB.id);

    const snapshot = await getSnapshot(user.token, project.id);
    const underB = snapshot.tasks.filter((task: CreatedTask) => task.parentId === parentB.id);
    expect(underB.map((task: CreatedTask) => task.id)).toEqual([childB.id]);

    const underA = snapshot.tasks.filter((task: CreatedTask) => task.parentId === parentA.id);
    expect(underA.map((task: CreatedTask) => task.id)).toEqual([childA.id]);
  });

  it('menolak memindahkan tugas ke dalam sub-tugasnya sendiri', async () => {
    const parent = await createTask(user.token, project.id, { name: 'Induk' });
    const child = await createTask(user.token, project.id, { name: 'Anak', parentId: parent.id });

    const response = await request(app)
      .post(`/api/tasks/${parent.id}/move`)
      .set(authHeader(user.token))
      .send({ parentId: child.id, position: 0 });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('INVALID_PARENT');
  });

  it('menolak induk dari proyek lain', async () => {
    const otherProject = await createProject(user.token, { name: 'Proyek Lain' });
    const otherTask = await createTask(user.token, otherProject.id, { name: 'Tugas lain' });

    const response = await request(app)
      .post(`/api/projects/${project.id}/tasks`)
      .set(authHeader(user.token))
      .send({ name: 'Anak lintas proyek', parentId: otherTask.id });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toMatch(/induk tidak ditemukan/i);
  });
});
