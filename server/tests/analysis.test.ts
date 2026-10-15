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

async function addDependency(successorId: string, predecessorId: string) {
  const response = await request(app)
    .post(`/api/tasks/${successorId}/dependencies`)
    .set(authHeader(user.token))
    .send({ predecessorId, type: 'FS', lagDays: 0 });
  if (response.status !== 201) {
    throw new Error(`Gagal menambah dependensi: ${JSON.stringify(response.body)}`);
  }
}

async function getAnalysis() {
  const response = await request(app)
    .get(`/api/projects/${project.id}/analysis`)
    .set(authHeader(user.token));
  if (response.status !== 200) {
    throw new Error(`Gagal mengambil analisis: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return response.body;
}

describe('analisis proyek', () => {
  it('menghasilkan CPM, jalur kritis, dan PERT sesuai vektor uji', async () => {
    const a = await createTask(user.token, project.id, { name: 'A', durationDays: 3 });
    const b = await createTask(user.token, project.id, { name: 'B', durationDays: 2 });
    const c = await createTask(user.token, project.id, {
      name: 'C',
      durationDays: 5,
      optimisticDays: 1,
      pessimisticDays: 4,
    });
    const d = await createTask(user.token, project.id, { name: 'D', durationDays: 1 });

    await addDependency(b.id, a.id);
    await addDependency(c.id, a.id);
    await addDependency(d.id, b.id);
    await addDependency(d.id, c.id);

    interface CpmRow {
      name: string;
      es: number;
      ef: number;
      ls: number;
      lf: number;
      totalFloat: number;
      critical: boolean;
    }
    interface PertRow {
      name: string;
      column: number;
      critical: boolean;
      expectedDays: number | null;
      variance: number | null;
    }

    const analysis = await getAnalysis();
    const cpmRows: CpmRow[] = analysis.cpm;
    const rowByName = new Map(cpmRows.map((row) => [row.name, row]));

    expect(analysis.summary.totalWorkingDays).toBe(9);
    expect(analysis.summary.projectEnd).toBe('2026-10-29');
    expect(analysis.summary.criticalTaskCount).toBe(3);

    expect(rowByName.get('A')).toMatchObject({ es: 0, ef: 2, lf: 2, totalFloat: 0, critical: true });
    expect(rowByName.get('B')).toMatchObject({ es: 3, ef: 4, ls: 6, lf: 7, totalFloat: 3, critical: false });
    expect(rowByName.get('C')).toMatchObject({ es: 3, ef: 7, totalFloat: 0, critical: true });
    expect(rowByName.get('D')).toMatchObject({ es: 8, ef: 8, totalFloat: 0, critical: true });

    const nameById = new Map<string, string>([
      [a.id, 'A'],
      [b.id, 'B'],
      [c.id, 'C'],
      [d.id, 'D'],
    ]);
    expect(analysis.criticalPath.map((id: string) => nameById.get(id))).toEqual(['A', 'C', 'D']);

    const pertNodes: PertRow[] = analysis.pert.nodes;
    expect(pertNodes).toHaveLength(4);
    expect(analysis.pert.columnCount).toBe(3);
    const nodeC = pertNodes.find((node) => node.name === 'C');
    expect(nodeC?.expectedDays).toBeCloseTo(25 / 6, 6);
    expect(nodeC?.critical).toBe(true);

    // Hanya C yang punya estimasi dan C ada di jalur kritis.
    expect(analysis.pert.totalVariance).toBeCloseTo(0.25, 6);
    expect(analysis.pert.standardDeviation).toBeCloseTo(0.5, 6);
  });

  it('mengembalikan nilai kosong yang aman untuk proyek tanpa tugas', async () => {
    const analysis = await getAnalysis();

    expect(analysis.summary.projectEnd).toBeNull();
    expect(analysis.summary.totalWorkingDays).toBe(0);
    expect(analysis.summary.totalCost).toBe(0);
    expect(analysis.cpm).toEqual([]);
    expect(analysis.criticalPath).toEqual([]);
    expect(analysis.pert.nodes).toEqual([]);
  });

  it('mengabaikan tugas induk pada CPM dan PERT', async () => {
    const parent = await createTask(user.token, project.id, { name: 'Induk' });
    const first = await createTask(user.token, project.id, {
      name: 'Anak 1',
      parentId: parent.id,
      durationDays: 4,
    });
    const second = await createTask(user.token, project.id, {
      name: 'Anak 2',
      parentId: parent.id,
      durationDays: 2,
      startDate: '2026-10-26',
    });
    await addDependency(second.id, first.id);

    const analysis = await getAnalysis();
    expect(analysis.summary.taskCount).toBe(3);
    expect(analysis.summary.leafTaskCount).toBe(2);
    expect(analysis.cpm).toHaveLength(2);
    expect(analysis.pert.nodes.map((node: { name: string }) => node.name).sort()).toEqual([
      'Anak 1',
      'Anak 2',
    ]);
  });

  it('menghitung ulang analisis setelah kalender berubah', async () => {
    const task = await createTask(user.token, project.id, { name: 'Implementasi', durationDays: 5 });
    const before = await getAnalysis();
    expect(before.summary.projectEnd).toBe('2026-10-23');

    await request(app)
      .post(`/api/projects/${project.id}/holidays`)
      .set(authHeader(user.token))
      .send({ date: '2026-10-20', name: 'Libur' })
      .expect(201);

    const after = await getAnalysis();
    expect(after.summary.totalWorkingDays).toBe(5);
    expect(after.summary.projectEnd).toBe('2026-10-26');
    expect(after.pert.nodes[0].ef).toBe(4);
    expect(task.durationDays).toBe(5);
  });
});
