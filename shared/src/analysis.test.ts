import { describe, expect, it } from 'vitest';

import { buildProjectAnalysis, summarizeProject } from './analysis.js';
import { buildFixtureSnapshot } from './fixture-schedule.js';
import { demoProjectFixture } from './fixtures.js';

const snapshot = buildFixtureSnapshot();

const analysis = buildProjectAnalysis({
  project: snapshot.project,
  tasks: snapshot.tasks,
  dependencies: snapshot.dependencies,
  resources: snapshot.resources,
  assignments: snapshot.assignments,
  holidays: snapshot.holidays,
});

describe('analisis proyek dari data seed', () => {
  it('menghasilkan jadwal yang menghormati urutan dependensi', () => {
    const task = (key: string) => {
      const found = snapshot.tasks.find((candidate) => candidate.id === key);
      if (!found) throw new Error(`Tugas ${key} tidak ditemukan di fixture`);
      return found;
    };
    // 1.2 FS dari 1.1
    expect(task('1.2').scheduledStart >= task('1.1').scheduledEnd).toBe(true);
    // 3.3 FS dari 2.2 dan SS dari 3.2 lag 3
    expect(task('3.3').scheduledStart >= task('2.2').scheduledEnd).toBe(true);
    // 5.2 setelah 5.1
    expect(task('5.2').scheduledStart > task('5.1').scheduledEnd).toBe(true);
  });

  it('menyusun ringkasan, CPM, dan jalur kritis', () => {
    expect(analysis.summary.taskCount).toBe(17);
    expect(analysis.summary.leafTaskCount).toBe(12);
    expect(analysis.summary.resourceCount).toBe(4);
    expect(analysis.summary.totalWorkingDays).toBeGreaterThan(0);
    expect(analysis.summary.projectEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(analysis.summary.totalCost).toBeGreaterThan(0);
    expect(analysis.cpm).toHaveLength(12);
    expect(analysis.criticalPath.length).toBeGreaterThan(2);
    expect(analysis.criticalPath.every((id) => analysis.cpm.find((row) => row.id === id)?.critical)).toBe(
      true,
    );
  });

  it('menyisakan minimal satu tugas non-kritis sesuai Bagian 9', () => {
    const nonCritical = analysis.cpm.filter((row) => !row.critical);
    expect(nonCritical.length).toBeGreaterThan(0);
    expect(analysis.cpm.find((row) => row.id === '4.1')?.critical).toBe(false);
  });

  it('mengurutkan baris CPM menurut ES', () => {
    const esValues = analysis.cpm.map((row) => row.es);
    expect([...esValues].sort((a, b) => a - b)).toEqual(esValues);
  });

  it('menyediakan data PERT dengan estimasi pada tugas yang mengisinya', () => {
    expect(analysis.pert.nodes).toHaveLength(12);
    expect(analysis.pert.columnCount).toBeGreaterThan(0);
    const backend = analysis.pert.nodes.find((node) => node.id === '3.2');
    expect(backend?.expectedDays).toBeCloseTo((8 + 4 * 10 + 15) / 6, 6);
    expect(backend?.variance).toBeCloseTo((7 / 6) ** 2, 6);
    const kickoff = analysis.pert.nodes.find((node) => node.id === '1.1');
    expect(kickoff?.expectedDays).toBeNull();
  });

  it('menghitung biaya per anggota dan peringatan over-alokasi', () => {
    const budi = analysis.resourceLoads.find((load) => load.resourceId === 'budi');
    expect(budi?.totalCost).toBeGreaterThan(0);
    expect(budi?.assignments.length).toBe(4);
    // Budi 100% pada 3.2 sementara 3.3 memakai 50% Budi pada rentang yang tumpang tindih.
    expect(analysis.warnings.some((warning) => warning.resourceId === 'budi')).toBe(true);
    const totalFromResources = analysis.resourceLoads.reduce(
      (sum, load) => sum + load.totalCost,
      0,
    );
    expect(Math.abs(totalFromResources - analysis.summary.totalCost)).toBeLessThanOrEqual(4);
  });

  it('meringkas proyek untuk halaman daftar', () => {
    const summary = summarizeProject({
      project: snapshot.project,
      tasks: snapshot.tasks,
      resourceCount: snapshot.resources.length,
      holidayCount: snapshot.holidays.length,
    });
    expect(summary.taskCount).toBe(17);
    expect(summary.holidayCount).toBe(2);
    expect(summary.progress).toBeGreaterThan(0);
    expect(summary.scheduledStart).toBe(demoProjectFixture.project.startDate);
  });
});
