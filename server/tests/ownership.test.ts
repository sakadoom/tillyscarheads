import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '../src/db.js';
import {
  app,
  authHeader,
  createProject,
  createTask,
  registerUser,
  resetDatabase,
  type CreatedProject,
  type TestUser,
} from './helpers.js';

let owner: TestUser;
let intruder: TestUser;
let project: CreatedProject;
let taskId: string;

beforeEach(async () => {
  await resetDatabase();
  owner = await registerUser('pemilik@example.com');
  intruder = await registerUser('penyusup@example.com');
  project = await createProject(owner.token, { name: 'Proyek Rahasia' });
  const task = await createTask(owner.token, project.id, { name: 'Tugas Rahasia', durationDays: 3 });
  taskId = task.id;
  await request(app)
    .post(`/api/projects/${project.id}/resources`)
    .set(authHeader(owner.token))
    .send({ name: 'Anggota', email: 'anggota@example.com', role: 'Developer', salary: 10_000_000 })
    .expect(201);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('isolasi data antar pengguna', () => {
  it('hanya menampilkan proyek milik pengguna sendiri', async () => {
    const own = await request(app).get('/api/projects').set(authHeader(owner.token));
    expect(own.body.projects).toHaveLength(1);

    const other = await request(app).get('/api/projects').set(authHeader(intruder.token));
    expect(other.status).toBe(200);
    expect(other.body.projects).toEqual([]);
  });

  it('menjawab 404 ketika pengguna lain membuka detail proyek', async () => {
    const response = await request(app)
      .get(`/api/projects/${project.id}`)
      .set(authHeader(intruder.token));

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('menolak mutasi pada proyek, tugas, dan anggota milik pengguna lain', async () => {
    const renameProject = await request(app)
      .patch(`/api/projects/${project.id}`)
      .set(authHeader(intruder.token))
      .send({ name: 'Dibajak' });
    expect(renameProject.status).toBe(404);

    const updateTask = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set(authHeader(intruder.token))
      .send({ name: 'Dibajak' });
    expect(updateTask.status).toBe(404);

    const deleteTask = await request(app)
      .delete(`/api/tasks/${taskId}`)
      .set(authHeader(intruder.token));
    expect(deleteTask.status).toBe(404);

    const addTask = await request(app)
      .post(`/api/projects/${project.id}/tasks`)
      .set(authHeader(intruder.token))
      .send({ name: 'Tugas Baru' });
    expect(addTask.status).toBe(404);

    const addResource = await request(app)
      .post(`/api/projects/${project.id}/resources`)
      .set(authHeader(intruder.token))
      .send({ name: 'X', email: 'x@example.com', role: 'Y', salary: 1000 });
    expect(addResource.status).toBe(404);

    const analysis = await request(app)
      .get(`/api/projects/${project.id}/analysis`)
      .set(authHeader(intruder.token));
    expect(analysis.status).toBe(404);

    const calendar = await request(app)
      .put(`/api/projects/${project.id}/calendar`)
      .set(authHeader(intruder.token))
      .send({ weekendDays: [5, 6] });
    expect(calendar.status).toBe(404);

    // Data pemilik tetap utuh.
    const snapshot = await request(app)
      .get(`/api/projects/${project.id}`)
      .set(authHeader(owner.token));
    expect(snapshot.body.project.name).toBe('Proyek Rahasia');
    expect(snapshot.body.tasks).toHaveLength(1);
  });

  it('menolak alokasi ke tugas milik pengguna lain', async () => {
    const response = await request(app)
      .post(`/api/tasks/${taskId}/assignments`)
      .set(authHeader(intruder.token))
      .send({ resourceId: 'apa-saja', allocationPercent: 50 });

    expect(response.status).toBe(404);
  });

  it('tidak bisa memakai id resource milik pengguna lain', async () => {
    const ownProject = await createProject(intruder.token, { name: 'Proyek Penyusup' });
    const ownTask = await createTask(intruder.token, ownProject.id, { name: 'Tugas sendiri' });
    const ownerResources = await request(app)
      .get(`/api/projects/${project.id}/resources`)
      .set(authHeader(owner.token));
    const foreignResourceId = ownerResources.body.resources[0].id as string;

    const response = await request(app)
      .post(`/api/tasks/${ownTask.id}/assignments`)
      .set(authHeader(intruder.token))
      .send({ resourceId: foreignResourceId, allocationPercent: 100 });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toMatch(/tidak ditemukan di proyek ini/i);
  });
});
