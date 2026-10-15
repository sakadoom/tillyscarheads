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
let task: CreatedTask;

beforeEach(async () => {
  await resetDatabase();
  user = await registerUser();
  project = await createProject(user.token);
  task = await createTask(user.token, project.id, { name: 'Implementasi', durationDays: 5 });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('kalender proyek', () => {
  it('memakai akhir pekan Sabtu dan Minggu secara default', async () => {
    expect(project.weekendDays).toEqual([0, 6]);
    expect(task.scheduledStart).toBe('2026-10-19');
    expect(task.scheduledEnd).toBe('2026-10-23');
  });

  it('menggeser jadwal ketika akhir pekan diubah', async () => {
    const response = await request(app)
      .put(`/api/projects/${project.id}/calendar`)
      .set(authHeader(user.token))
      .send({ weekendDays: [5, 6] });

    expect(response.status).toBe(200);
    expect(response.body.project.weekendDays).toEqual([5, 6]);

    // Jumat dan Sabtu menjadi akhir pekan: 19, 20, 21, 22, lalu Minggu 25.
    const updated = findTask(response.body.tasks, task.id);
    expect(updated.scheduledEnd).toBe('2026-10-25');
  });

  it('tidak menghitung hari libur sebagai hari kerja', async () => {
    const response = await request(app)
      .post(`/api/projects/${project.id}/holidays`)
      .set(authHeader(user.token))
      .send({ date: '2026-10-21', name: 'Cuti bersama' });

    expect(response.status).toBe(201);
    expect(response.body.holiday.date).toBe('2026-10-21');
    expect(response.body.holidays).toHaveLength(1);

    const updated = findTask(response.body.tasks, task.id);
    // 19, 20, 22, 23, 26 -> berakhir Senin 2026-10-26
    expect(updated.scheduledEnd).toBe('2026-10-26');
  });

  it('mengembalikan jadwal setelah hari libur dihapus', async () => {
    const created = await request(app)
      .post(`/api/projects/${project.id}/holidays`)
      .set(authHeader(user.token))
      .send({ date: '2026-10-21', name: 'Cuti bersama' });

    const deleted = await request(app)
      .delete(`/api/holidays/${created.body.holiday.id}`)
      .set(authHeader(user.token));

    expect(deleted.status).toBe(200);
    expect(deleted.body.holidays).toHaveLength(0);
    expect(findTask(deleted.body.tasks, task.id).scheduledEnd).toBe('2026-10-23');
  });

  it('menolak hari libur duplikat pada tanggal yang sama', async () => {
    await request(app)
      .post(`/api/projects/${project.id}/holidays`)
      .set(authHeader(user.token))
      .send({ date: '2026-11-11', name: 'Libur internal' });

    const duplicate = await request(app)
      .post(`/api/projects/${project.id}/holidays`)
      .set(authHeader(user.token))
      .send({ date: '2026-11-11', name: 'Libur lain' });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('HOLIDAY_EXISTS');
  });

  it('menolak konfigurasi akhir pekan yang tidak masuk akal', async () => {
    const allDays = await request(app)
      .put(`/api/projects/${project.id}/calendar`)
      .set(authHeader(user.token))
      .send({ weekendDays: [0, 1, 2, 3, 4, 5, 6] });
    expect(allDays.status).toBe(400);
    expect(allDays.body.error.code).toBe('VALIDATION_ERROR');

    const empty = await request(app)
      .put(`/api/projects/${project.id}/calendar`)
      .set(authHeader(user.token))
      .send({ weekendDays: [] });
    expect(empty.status).toBe(400);
  });

  it('menyimpan hari libur pada snapshot proyek', async () => {
    await request(app)
      .post(`/api/projects/${project.id}/holidays`)
      .set(authHeader(user.token))
      .send({ date: '2026-12-25', name: 'Hari Raya Natal' });

    const snapshot = await getSnapshot(user.token, project.id);
    expect(snapshot.holidays).toHaveLength(1);
    expect(snapshot.holidays[0]).toMatchObject({ date: '2026-12-25', name: 'Hari Raya Natal' });
  });
});
