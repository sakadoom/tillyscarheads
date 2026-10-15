import type { Express } from 'express';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';

export const app: Express = createApp();

export const DEMO_PASSWORD = 'Password123';

let userCounter = 0;

export interface TestUser {
  userId: string;
  email: string;
  token: string;
}

/** Menghapus seluruh data supaya setiap test berdiri sendiri. */
export async function resetDatabase(): Promise<void> {
  await prisma.assignment.deleteMany();
  await prisma.dependency.deleteMany();
  await prisma.task.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.holiday.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
}

export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

export async function registerUser(email?: string): Promise<TestUser> {
  userCounter += 1;
  const finalEmail = email ?? `pengguna${userCounter}@example.com`;
  const response = await request(app)
    .post('/api/auth/register')
    .send({ name: `Pengguna ${userCounter}`, email: finalEmail, password: DEMO_PASSWORD });

  if (response.status !== 201) {
    throw new Error(`Registrasi gagal: ${response.status} ${JSON.stringify(response.body)}`);
  }

  return {
    userId: response.body.user.id as string,
    email: finalEmail,
    token: response.body.token as string,
  };
}

export interface CreatedProject {
  id: string;
  name: string;
  startDate: string;
  weekendDays: number[];
}

export async function createProject(
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<CreatedProject> {
  const response = await request(app)
    .post('/api/projects')
    .set(authHeader(token))
    .send({
      name: 'Proyek Uji',
      description: 'Proyek untuk test integrasi',
      startDate: '2026-10-19',
      ...overrides,
    });

  if (response.status !== 201) {
    throw new Error(`Membuat proyek gagal: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return response.body.project as CreatedProject;
}

export interface CreatedTask {
  id: string;
  name: string;
  parentId: string | null;
  color: string;
  startDate: string;
  durationDays: number;
  scheduledStart: string;
  scheduledEnd: string;
  progress: number;
  priority: string;
}

export async function createTask(
  token: string,
  projectId: string,
  body: Record<string, unknown>,
): Promise<CreatedTask> {
  const response = await request(app)
    .post(`/api/projects/${projectId}/tasks`)
    .set(authHeader(token))
    .send({ name: 'Tugas Baru', ...body });

  if (response.status !== 201) {
    throw new Error(`Membuat tugas gagal: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return response.body.task as CreatedTask;
}

export async function getSnapshot(token: string, projectId: string) {
  const response = await request(app).get(`/api/projects/${projectId}`).set(authHeader(token));
  if (response.status !== 200) {
    throw new Error(`Mengambil proyek gagal: ${response.status}`);
  }
  return response.body;
}

export function findTask(tasks: CreatedTask[], id: string): CreatedTask {
  const task = tasks.find((candidate) => candidate.id === id);
  if (!task) throw new Error(`Tugas ${id} tidak ada pada respons`);
  return task;
}
