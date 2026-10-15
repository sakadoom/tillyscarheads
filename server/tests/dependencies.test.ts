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

async function addDependency(
  successorId: string,
  body: Record<string, unknown>,
): Promise<request.Response> {
  return request(app)
    .post(`/api/tasks/${successorId}/dependencies`)
    .set(authHeader(user.token))
    .send(body);
}

describe('dependensi dan lag', () => {
  it('menggeser penerus sesuai aturan FS dan vektor uji 6.11', async () => {
    const predecessor = await createTask(user.token, project.id, {
      name: 'Kickoff',
      durationDays: 3,
      startDate: '2026-10-23',
    });
    const successor = await createTask(user.token, project.id, {
      name: 'Spesifikasi',
      durationDays: 2,
      startDate: '2026-01-01',
    });

    expect(predecessor.scheduledEnd).toBe('2026-10-27');

    const response = await addDependency(successor.id, {
      predecessorId: predecessor.id,
      type: 'FS',
      lagDays: 0,
    });
    expect(response.status).toBe(201);

    const snapshot = await getSnapshot(user.token, project.id);
    expect(findTask(snapshot.tasks, successor.id).scheduledStart).toBe('2026-10-28');
    expect(findTask(snapshot.tasks, successor.id).scheduledEnd).toBe('2026-10-29');
  });

  it('menggeser penerus sesuai aturan SS dengan lag', async () => {
    const predecessor = await createTask(user.token, project.id, {
      name: 'Desain',
      durationDays: 5,
      startDate: '2026-10-23',
    });
    const successor = await createTask(user.token, project.id, {
      name: 'Frontend',
      durationDays: 2,
      startDate: '2026-01-01',
    });

    const response = await addDependency(successor.id, {
      predecessorId: predecessor.id,
      type: 'SS',
      lagDays: 2,
    });
    expect(response.status).toBe(201);

    const snapshot = await getSnapshot(user.token, project.id);
    // Mulai Jumat 2026-10-23 digeser 2 hari kerja -> Selasa 2026-10-27
    expect(findTask(snapshot.tasks, successor.id).scheduledStart).toBe('2026-10-27');
  });

  it('menerapkan lag positif dan negatif pada FS', async () => {
    const predecessor = await createTask(user.token, project.id, {
      name: 'Backend',
      durationDays: 3,
      startDate: '2026-10-19',
    });
    const successor = await createTask(user.token, project.id, {
      name: 'Uji integrasi',
      durationDays: 1,
      startDate: '2026-01-01',
    });

    await addDependency(successor.id, { predecessorId: predecessor.id, type: 'FS', lagDays: 1 });
    let snapshot = await getSnapshot(user.token, project.id);
    expect(findTask(snapshot.tasks, successor.id).scheduledStart).toBe('2026-10-23');

    const dependencyId = snapshot.dependencies[0].id;
    const updated = await request(app)
      .patch(`/api/dependencies/${dependencyId}`)
      .set(authHeader(user.token))
      .send({ lagDays: -1 });
    expect(updated.status).toBe(200);

    snapshot = await getSnapshot(user.token, project.id);
    expect(findTask(snapshot.tasks, successor.id).scheduledStart).toBe('2026-10-21');
  });

  it('mengembalikan jadwal ke batas startDate setelah dependensi dihapus', async () => {
    const predecessor = await createTask(user.token, project.id, {
      name: 'A',
      durationDays: 5,
      startDate: '2026-10-19',
    });
    const successor = await createTask(user.token, project.id, {
      name: 'B',
      durationDays: 2,
      startDate: '2026-10-19',
    });

    await addDependency(successor.id, { predecessorId: predecessor.id, type: 'FS', lagDays: 0 });
    let snapshot = await getSnapshot(user.token, project.id);
    expect(findTask(snapshot.tasks, successor.id).scheduledStart).toBe('2026-10-26');

    const dependencyId = snapshot.dependencies[0].id;
    const deleted = await request(app)
      .delete(`/api/dependencies/${dependencyId}`)
      .set(authHeader(user.token));
    expect(deleted.status).toBe(200);

    snapshot = await getSnapshot(user.token, project.id);
    expect(findTask(snapshot.tasks, successor.id).scheduledStart).toBe('2026-10-19');
  });
});

describe('validasi dependensi', () => {
  it('menolak dependensi ke diri sendiri', async () => {
    const task = await createTask(user.token, project.id, { name: 'A' });
    const response = await addDependency(task.id, {
      predecessorId: task.id,
      type: 'FS',
      lagDays: 0,
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('SELF_DEPENDENCY');
  });

  it('menolak pasangan dependensi duplikat', async () => {
    const first = await createTask(user.token, project.id, { name: 'A' });
    const second = await createTask(user.token, project.id, { name: 'B' });

    await addDependency(second.id, { predecessorId: first.id, type: 'FS', lagDays: 0 });
    const duplicate = await addDependency(second.id, {
      predecessorId: first.id,
      type: 'SS',
      lagDays: 3,
    });

    expect(duplicate.status).toBe(422);
    expect(duplicate.body.error.code).toBe('DUPLICATE_DEPENDENCY');
  });

  it('menolak dependensi yang membentuk siklus dengan pesan yang jelas', async () => {
    const first = await createTask(user.token, project.id, { name: 'Halaman beranda' });
    const second = await createTask(user.token, project.id, { name: 'Halaman checkout' });

    await addDependency(second.id, { predecessorId: first.id, type: 'FS', lagDays: 0 });
    const cycle = await addDependency(first.id, { predecessorId: second.id, type: 'FS', lagDays: 0 });

    expect(cycle.status).toBe(422);
    expect(cycle.body.error.code).toBe('CYCLE_DETECTED');
    expect(cycle.body.error.message).toMatch(/siklus/i);
    expect(cycle.body.error.message).toContain('Halaman beranda');
    expect(cycle.body.error.details.path.length).toBeGreaterThan(1);
  });

  it('menolak dependensi pada tugas induk', async () => {
    const parent = await createTask(user.token, project.id, { name: 'Induk' });
    await createTask(user.token, project.id, { name: 'Anak', parentId: parent.id });
    const other = await createTask(user.token, project.id, { name: 'Tugas lain' });

    const response = await addDependency(other.id, {
      predecessorId: parent.id,
      type: 'FS',
      lagDays: 0,
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('TASK_NOT_LEAF');
  });

  it('menolak lag di luar rentang -365 sampai 365', async () => {
    const first = await createTask(user.token, project.id, { name: 'A' });
    const second = await createTask(user.token, project.id, { name: 'B' });

    const response = await addDependency(second.id, {
      predecessorId: first.id,
      type: 'FS',
      lagDays: 400,
    });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('menolak predecessor dari proyek lain', async () => {
    const otherProject = await createProject(user.token, { name: 'Proyek Lain' });
    const otherTask = await createTask(user.token, otherProject.id, { name: 'Luar' });
    const task = await createTask(user.token, project.id, { name: 'Dalam' });

    const response = await addDependency(task.id, {
      predecessorId: otherTask.id,
      type: 'FS',
      lagDays: 0,
    });
    expect(response.status).toBe(400);
  });
});
