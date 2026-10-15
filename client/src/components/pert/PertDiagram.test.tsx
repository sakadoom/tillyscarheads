import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { buildFixtureSnapshot, buildProjectAnalysis } from 'shared';

import { PertDiagram } from './PertDiagram';

const snapshot = buildFixtureSnapshot();
const analysis = buildProjectAnalysis({
  project: snapshot.project,
  tasks: snapshot.tasks,
  dependencies: snapshot.dependencies,
  resources: snapshot.resources,
  assignments: snapshot.assignments,
  holidays: snapshot.holidays,
});

function renderDiagram(showAll = true) {
  return render(
    <PertDiagram
      nodes={analysis.pert.nodes}
      dependencies={snapshot.dependencies}
      criticalPath={showAll ? analysis.criticalPath : []}
      totalVariance={analysis.pert.totalVariance}
      standardDeviation={analysis.pert.standardDeviation}
    />,
  );
}

describe('PertDiagram', () => {
  it('menampilkan satu node untuk setiap tugas daun', () => {
    renderDiagram();
    expect(screen.getAllByTestId('pert-node')).toHaveLength(analysis.pert.nodes.length);
    expect(analysis.pert.nodes.length).toBe(12);
  });

  it('menandai node pada jalur kritis dan menyisakan node non-kritis tetap netral', () => {
    renderDiagram();
    const nodes = screen.getAllByTestId('pert-node');
    const critical = nodes.filter((node) => node.getAttribute('data-critical') === 'true');
    const nonCritical = nodes.filter((node) => node.getAttribute('data-critical') === 'false');

    expect(critical.length).toBe(analysis.cpm.filter((row) => row.critical).length);
    expect(critical.length).toBeGreaterThan(0);
    expect(nonCritical.length).toBeGreaterThan(0);

    const skenarioUji = nodes.find((node) => node.getAttribute('data-task-id') === '4.1');
    expect(skenarioUji?.getAttribute('data-critical')).toBe('false');
  });

  it('menampilkan estimasi te dan variansi pada tugas yang punya estimasi', () => {
    renderDiagram();
    const backend = screen
      .getAllByTestId('pert-node')
      .find((node) => node.getAttribute('data-task-id') === '3.2');
    const expected = (8 + 4 * 10 + 15) / 6;
    expect(backend?.textContent).toContain(`te ${expected.toFixed(2)} hari`);
    expect(backend?.textContent).toContain('variansi');
  });

  it('menggambar sisi dependensi sesuai data seed', () => {
    renderDiagram();
    expect(screen.getAllByTestId('pert-edge')).toHaveLength(snapshot.dependencies.length);
    expect(analysis.pert.columnCount).toBeGreaterThan(1);
  });

  it('menampilkan pesan kosong bila belum ada tugas daun', () => {
    render(
      <PertDiagram
        nodes={[]}
        dependencies={[]}
        criticalPath={[]}
        totalVariance={0}
        standardDeviation={0}
      />,
    );
    expect(screen.getByText(/Diagram PERT muncul setelah proyek punya tugas daun/i)).toBeTruthy();
  });
});
