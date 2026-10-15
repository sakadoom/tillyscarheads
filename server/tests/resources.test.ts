import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '../src/db.js';
import {
  app,
  authHeader,
  createProject,
  createTask,
  getSnapshot,
  registerUser,
  resetDatabase,
  type CreatedProject,
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

async function addResource(body: Record<string, unknown> = {}) {
  const response = await request(app)
    .post(`/api/projects/${project.id}/resources`)
    .set(authHeader(user.token))
    .send({ name: 'Andi Pratama', email: 'andi@example.com', role: 'Project Manager', salary: 22_000_000, ...body });
  return response;
}

async function assign(taskId: string, body: Record<string, unknown>) {
  return request(app)
    .post(`/api/tasks/${taskId}/assignments`)
    .set(authHeader(user.token))
    .send(body);
}

describe('anggota tim', () => {
  it('menambah, mengubah, dan menghapus anggota', async () => {
    const created = await addResource();
    expect(created.status).toBe(201);
    expect(created.body.resource).toMatchObject({ name: 'Andi Pratama', salary: 22_000_000 });
    expect(created.body.resources).toHaveLength(1);

    const resourceId = created.body.resource.id as string;
    const updated = await request(app)
      .patch(`/api/resources/${resourceId}`)
      .set(authHeader(user.token))
      .send({ role: 'Scrum Master', salary: 24_000_000 });
    expect(updated.status).toBe(200);
    expect(updated.body.resource).toMatchObject({ role: 'Scrum Master', salary: 24_000_000 });

    const removed = await request(app)
      .delete(`/api/resources/${resourceId}`)
      .set(authHeader(user.token));
    expect(removed.status).toBe(200);
    expect(removed.body.resources).toHaveLength(0);
  });

  it('menolak data anggota yang tidak valid', async () => {
    const response = await addResource({ email: 'bukan-email', salary: -1 });
    expect(response.status).toBe(400);
    expect(response.body.error.details.fields.email).toBeDefined();
    expect(response.body.error.details.fields.salary).toBeDefined();
  });

  it('menolak alokasi pada tugas induk dan alokasi duplikat', async () => {
    const resource = (await addResource()).body.resource;
    const parent = await createTask(user.token, project.id, { name: 'Induk' });
    await createTask(user.token, project.id, { name: 'Anak', parentId: parent.id });
    const leaf = await createTask(user.token, project.id, { name: 'Daun', durationDays: 5 });

    const onParent = await assign(parent.id, { resourceId: resource.id, allocationPercent: 50 });
    expect(onParent.status).toBe(422);
    expect(onParent.body.error.code).toBe('TASK_NOT_LEAF');

    const first = await assign(leaf.id, { resourceId: resource.id, allocationPercent: 50 });
    expect(first.status).toBe(201);

    const duplicate = await assign(leaf.id, { resourceId: resource.id, allocationPercent: 80 });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('ALREADY_ASSIGNED');
  });

  it('memvalidasi persentase alokasi', async () => {
    const resource = (await addResource()).body.resource;
    const task = await createTask(user.token, project.id, { name: 'Tugas' });

    const tooSmall = await assign(task.id, { resourceId: resource.id, allocationPercent: 0 });
    expect(tooSmall.status).toBe(400);

    const tooBig = await assign(task.id, { resourceId: resource.id, allocationPercent: 150 });
    expect(tooBig.status).toBe(400);
  });

  it('menghapus alokasi saat anggotanya dihapus', async () => {
    const resource = (await addResource()).body.resource;
    const task = await createTask(user.token, project.id, { name: 'Tugas', durationDays: 4 });
    await assign(task.id, { resourceId: resource.id, allocationPercent: 100 });

    await request(app)
      .delete(`/api/resources/${resource.id}`)
      .set(authHeader(user.token))
      .expect(200);

    const snapshot = await getSnapshot(user.token, project.id);
    expect(snapshot.assignments).toHaveLength(0);
  });
});

describe('biaya dan over-alokasi', () => {
  it('menghitung biaya per anggota dan total proyek', async () => {
    const resource = (await addResource()).body.resource;
    const task = await createTask(user.token, project.id, { name: 'Kickoff', durationDays: 5 });
    await assign(task.id, { resourceId: resource.id, allocationPercent: 100 });

    const analysis = await request(app)
      .get(`/api/projects/${project.id}/analysis`)
      .set(authHeader(user.token));

    expect(analysis.status).toBe(200);
    // Tarif harian = 22.000.000 / 22 = 1.000.000
    expect(analysis.body.resourceLoads[0]).toMatchObject({
      resourceId: resource.id,
      dailyRate: 1_000_000,
      totalCost: 5_000_000,
      peakPercent: 100,
    });
    expect(analysis.body.summary.totalCost).toBe(5_000_000);
    expect(analysis.body.warnings).toHaveLength(0);
  });

  it('menghitung alokasi sebagian dari durasi tugas', async () => {
    const resource = (await addResource()).body.resource;
    const task = await createTask(user.token, project.id, { name: 'Frontend', durationDays: 10 });
    await assign(task.id, { resourceId: resource.id, allocationPercent: 50 });

    const analysis = await request(app)
      .get(`/api/projects/${project.id}/analysis`)
      .set(authHeader(user.token));

    expect(analysis.body.summary.totalCost).toBe(5_000_000);
    expect(analysis.body.resourceLoads[0].peakPercent).toBe(50);
  });

  it('memberi peringatan ketika alokasi melebihi 100% pada hari yang sama', async () => {
    const resource = (await addResource()).body.resource;
    const firstTask = await createTask(user.token, project.id, {
      name: 'Integrasi',
      durationDays: 5,
      startDate: '2026-10-19',
    });
    const secondTask = await createTask(user.token, project.id, {
      name: 'Perbaikan bug',
      durationDays: 3,
      startDate: '2026-10-20',
    });
    await assign(firstTask.id, { resourceId: resource.id, allocationPercent: 60 });
    await assign(secondTask.id, { resourceId: resource.id, allocationPercent: 60 });

    const analysis = await request(app)
      .get(`/api/projects/${project.id}/analysis`)
      .set(authHeader(user.token));

    expect(analysis.body.warnings.length).toBeGreaterThan(0);
    expect(analysis.body.warnings[0]).toMatchObject({ totalPercent: 120, resourceName: 'Andi Pratama' });
    expect(analysis.body.resourceLoads[0].peakPercent).toBe(120);
  });
});
