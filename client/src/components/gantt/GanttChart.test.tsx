import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildFixtureSnapshot, calendarFromProject, getLeafTaskIds } from 'shared';

import { GanttChart } from './GanttChart';
import { ROW_HEIGHT, createTimelineScale, xForDate } from './timeline';
import { buildTaskRows } from './tree';

const snapshot = buildFixtureSnapshot();
const calendar = calendarFromProject({
  weekendDays: snapshot.project.weekendDays,
  holidays: snapshot.holidays.map((holiday) => holiday.date),
});
const treeRows = buildTaskRows(snapshot.tasks);
const rows = treeRows.map((row) => ({
  task: row.task,
  depth: row.depth,
  isSummary: row.isSummary,
}));
const starts = snapshot.tasks.map((task) => task.scheduledStart).sort();
const ends = snapshot.tasks.map((task) => task.scheduledEnd).sort();
const scale = createTimelineScale({
  earliest: starts[0] ?? null,
  latest: ends[ends.length - 1] ?? null,
  calendar,
  holidays: new Set(snapshot.holidays.map((holiday) => holiday.date)),
  zoom: 'day',
  today: '2026-11-02',
});

function renderChart(overrides: Partial<React.ComponentProps<typeof GanttChart>> = {}) {
  const handlers = {
    onSelectTask: vi.fn(),
    onEditTask: vi.fn(),
    onDragTask: vi.fn(),
    onResizeTask: vi.fn(),
    onConstrained: vi.fn(),
  };
  const view = render(
    <GanttChart
      scale={scale}
      rows={rows}
      allTasks={snapshot.tasks}
      dependencies={snapshot.dependencies}
      calendar={calendar}
      criticalIds={new Set(['1.1', '1.2'])}
      showCritical={false}
      selectedTaskId={null}
      rowHeight={ROW_HEIGHT}
      {...handlers}
      {...overrides}
    />,
  );
  return { view, handlers };
}

describe('GanttChart', () => {
  it('menggambar satu bar untuk setiap tugas daun dari data seed', () => {
    renderChart();
    const leaves = getLeafTaskIds(snapshot.tasks);
    expect(screen.getAllByTestId('gantt-bar')).toHaveLength(leaves.size);
    expect(leaves.size).toBe(12);
  });

  it('menggambar bar khusus untuk tugas induk', () => {
    renderChart();
    expect(screen.getAllByTestId('gantt-summary-bar')).toHaveLength(5);
  });

  it('menggambar panah dependensi FS dan SS pada posisi jadwal', () => {
    renderChart();
    const arrows = screen.getAllByTestId('dependency-arrow');
    expect(arrows).toHaveLength(snapshot.dependencies.length);

    const fs = arrows.filter((arrow) => arrow.getAttribute('data-dependency-type') === 'FS');
    const ss = arrows.filter((arrow) => arrow.getAttribute('data-dependency-type') === 'SS');
    expect(fs.length).toBeGreaterThan(0);
    expect(ss.length).toBeGreaterThan(0);

    // 3.3 punya dua dependensi: FS dari 2.2 dan SS dari 3.2 lag 3.
    const successor = snapshot.tasks.find((task) => task.id === '3.3');
    const predecessor = snapshot.tasks.find((task) => task.id === '2.2');
    const successorStartX = xForDate(scale, successor?.scheduledStart ?? '');
    const ssArrow = arrows.find((arrow) =>
      (arrow.getAttribute('d') ?? '').includes(String(successorStartX - 3)),
    );
    expect(ssArrow).toBeDefined();
    expect(predecessor).toBeDefined();
  });

  it('menempatkan bar sesuai tanggal jadwal tugas', () => {
    renderChart();
    const task = snapshot.tasks.find((candidate) => candidate.id === '3.1');
    const group = screen.getAllByTestId('gantt-bar').find(
      (element) => element.getAttribute('data-task-id') === '3.1',
    );
    const bar = group?.querySelector('rect');
    expect(bar?.getAttribute('x')).toBe(String(xForDate(scale, task?.scheduledStart ?? '')));
  });

  it('menampilkan garis hari ini dan sorotan jalur kritis', () => {
    const { view } = renderChart({ showCritical: true });
    expect(screen.getByTestId('gantt-today-line')).toBeTruthy();

    const criticalBar = screen
      .getAllByTestId('gantt-bar')
      .find((element) => element.getAttribute('data-task-id') === '1.1');
    expect(criticalBar?.getAttribute('data-critical')).toBe('true');

    view.unmount();
    renderChart({ showCritical: false });
    const nonHighlighted = screen
      .getAllByTestId('gantt-bar')
      .find((element) => element.getAttribute('data-task-id') === '1.1');
    expect(nonHighlighted?.getAttribute('data-critical')).toBe('false');
  });

  it('memanggil onEditTask saat bar dijangkau keyboard dan onSelectTask saat diklik', () => {
    const { handlers } = renderChart();
    const group = screen
      .getAllByTestId('gantt-bar')
      .find((element) => element.getAttribute('data-task-id') === '1.1');
    const interactive = group?.querySelector('[role="button"]') as SVGRectElement;

    fireEvent.click(interactive);
    expect(handlers.onSelectTask).toHaveBeenCalledWith('1.1');

    fireEvent.keyDown(interactive, { key: 'Enter' });
    expect(handlers.onEditTask).toHaveBeenCalled();
  });

  it('menyediakan pegangan resize untuk setiap tugas daun', () => {
    renderChart();
    expect(screen.getAllByTestId('gantt-resize-handle')).toHaveLength(12);
  });
});
