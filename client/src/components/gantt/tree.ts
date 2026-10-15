import type { TaskDto } from 'shared';

export interface TaskTreeRow {
  task: TaskDto;
  depth: number;
  isSummary: boolean;
  wbs: string;
  childCount: number;
}

function sortSiblings(a: TaskDto, b: TaskDto): number {
  return a.position - b.position || a.name.localeCompare(b.name);
}

/** Menyusun tugas menjadi baris berurutan (DFS) dengan nomor WBS. */
export function buildTaskRows(tasks: readonly TaskDto[]): TaskTreeRow[] {
  const ids = new Set(tasks.map((task) => task.id));
  const childrenByParent = new Map<string | null, TaskDto[]>();
  for (const task of tasks) {
    const parentId = task.parentId && ids.has(task.parentId) ? task.parentId : null;
    childrenByParent.set(parentId, [...(childrenByParent.get(parentId) ?? []), task]);
  }
  for (const [key, children] of childrenByParent) {
    childrenByParent.set(key, [...children].sort(sortSiblings));
  }

  const rows: TaskTreeRow[] = [];
  const walk = (parentId: string | null, depth: number, prefix: string): void => {
    const children = childrenByParent.get(parentId) ?? [];
    children.forEach((task, index) => {
      const wbs = prefix ? `${prefix}.${index + 1}` : String(index + 1);
      const grandChildren = childrenByParent.get(task.id) ?? [];
      rows.push({
        task,
        depth,
        isSummary: grandChildren.length > 0,
        wbs,
        childCount: grandChildren.length,
      });
      walk(task.id, depth + 1, wbs);
    });
  };
  walk(null, 0, '');
  return rows;
}

/** Menyembunyikan anak dari tugas induk yang dilipat. */
export function computeVisibleRows(
  rows: readonly TaskTreeRow[],
  collapsed: ReadonlySet<string>,
): TaskTreeRow[] {
  const visible: TaskTreeRow[] = [];
  let hiddenDepth: number | null = null;
  for (const row of rows) {
    if (hiddenDepth !== null) {
      if (row.depth > hiddenDepth) continue;
      hiddenDepth = null;
    }
    visible.push(row);
    if (row.isSummary && collapsed.has(row.task.id)) {
      hiddenDepth = row.depth;
    }
  }
  return visible;
}
