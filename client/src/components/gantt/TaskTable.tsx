import { ChevronDown, ChevronRight, ListPlus, Pencil, Trash, TriangleAlert } from 'lucide-react';
import { formatIsoDateShort, PRIORITY_LABELS, type AssignmentDto, type ResourceDto, type TaskDto } from 'shared';

import { formatPercent } from '../../lib/format';
import { IconButton } from '../ui/Button';
import { Avatar } from '../ui/Card';
import type { TaskTreeRow } from './tree';

export interface TaskTableProps {
  rows: TaskTreeRow[];
  rowHeight: number;
  collapsed: ReadonlySet<string>;
  selectedTaskId: string | null;
  resources: ResourceDto[];
  assignments: AssignmentDto[];
  criticalIds: ReadonlySet<string>;
  showCritical: boolean;
  onToggleCollapse: (taskId: string) => void;
  onSelectTask: (taskId: string) => void;
  onEditTask: (task: TaskDto) => void;
  onDeleteTask: (task: TaskDto) => void;
  onAddSubtask: (task: TaskDto) => void;
}

const PRIORITY_CLASS: Record<string, string> = {
  LOW: 'bg-priority-low-bg text-priority-low',
  MEDIUM: 'bg-priority-medium-bg text-priority-medium',
  HIGH: 'bg-priority-high-bg text-priority-high',
};

export function TaskTable({
  rows,
  rowHeight,
  collapsed,
  selectedTaskId,
  resources,
  assignments,
  criticalIds,
  showCritical,
  onToggleCollapse,
  onSelectTask,
  onEditTask,
  onDeleteTask,
  onAddSubtask,
}: TaskTableProps) {
  const resourceById = new Map(resources.map((resource) => [resource.id, resource]));

  return (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">Daftar tugas proyek</caption>
      <thead>
        <tr className="text-caption font-semibold tracking-wide text-ink-3 uppercase">
          <th scope="col" className="w-14 px-3 py-2">
            WBS
          </th>
          <th scope="col" className="px-3 py-2">
            Tugas
          </th>
          <th scope="col" className="w-14 px-3 py-2 text-right">
            Hari
          </th>
          <th scope="col" className="w-24 px-3 py-2">
            Mulai
          </th>
          <th scope="col" className="w-24 px-3 py-2">
            Selesai
          </th>
          <th scope="col" className="w-20 px-3 py-2">
            Prioritas
          </th>
          <th scope="col" className="w-32 px-3 py-2">
            Penanggung jawab
          </th>
          <th scope="col" className="w-28 px-3 py-2">
            Progres
          </th>
          <th scope="col" className="w-24 px-3 py-2 text-right">
            Aksi
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const isSelected = selectedTaskId === row.task.id;
          const isCritical = showCritical && criticalIds.has(row.task.id) && !row.isSummary;
          const taskAssignments = assignments.filter(
            (assignment) => assignment.taskId === row.task.id,
          );
          const isCollapsed = collapsed.has(row.task.id);

          return (
            <tr
              key={row.task.id}
              data-testid="task-row"
              data-task-id={row.task.id}
              aria-selected={isSelected}
              style={{ height: rowHeight }}
              className={`border-b border-line transition-colors ${
                isSelected ? 'bg-brand-50' : 'hover:bg-surface-2'
              }`}
            >
              <td className="tabular px-3 py-1 text-body-sm text-ink-3">{row.wbs}</td>
              <td className="px-3 py-1">
                <div className="flex items-center gap-1.5" style={{ paddingLeft: row.depth * 16 }}>
                  {row.isSummary ? (
                    <button
                      type="button"
                      onClick={() => onToggleCollapse(row.task.id)}
                      aria-expanded={!isCollapsed}
                      aria-label={`${isCollapsed ? 'Tampilkan' : 'Sembunyikan'} sub-tugas ${row.task.name}`}
                      className="grid size-6 place-items-center rounded-sm text-ink-3 hover:bg-surface-3 hover:text-ink"
                    >
                      {isCollapsed ? (
                        <ChevronRight aria-hidden className="size-4" />
                      ) : (
                        <ChevronDown aria-hidden className="size-4" />
                      )}
                    </button>
                  ) : (
                    <span aria-hidden className="inline-block size-6" />
                  )}
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: row.task.color }}
                  />
                  <button
                    type="button"
                    onClick={() => onSelectTask(row.task.id)}
                    onDoubleClick={() => onEditTask(row.task)}
                    className={`truncate text-left text-body-sm ${
                      row.isSummary ? 'font-semibold text-ink' : 'text-ink-2'
                    } hover:text-brand-700`}
                    title={row.task.name}
                  >
                    {row.task.name}
                  </button>
                  {isCritical ? (
                    <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-danger-bg px-1.5 py-0.5 text-caption font-semibold text-danger">
                      <TriangleAlert aria-hidden className="size-3" />
                      Kritis
                    </span>
                  ) : null}
                </div>
              </td>
              <td className="tabular px-3 py-1 text-right text-body-sm text-ink-2">
                {row.task.durationDays}
              </td>
              <td className="tabular px-3 py-1 text-body-sm text-ink-2">
                {formatIsoDateShort(row.task.scheduledStart)}
              </td>
              <td className="tabular px-3 py-1 text-body-sm text-ink-2">
                {formatIsoDateShort(row.task.scheduledEnd)}
              </td>
              <td className="px-3 py-1">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-caption font-semibold ${
                    PRIORITY_CLASS[row.task.priority] ?? PRIORITY_CLASS.MEDIUM
                  }`}
                >
                  {PRIORITY_LABELS[row.task.priority]}
                </span>
              </td>
              <td className="px-3 py-1">
                {taskAssignments.length === 0 ? (
                  <span className="text-body-sm text-ink-3">—</span>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Avatar
                      name={resourceById.get(taskAssignments[0]?.resourceId ?? '')?.name ?? '—'}
                      size={24}
                    />
                    <span className="truncate text-body-sm text-ink-2">
                      {resourceById.get(taskAssignments[0]?.resourceId ?? '')?.name ?? 'Tidak dikenal'}
                      {taskAssignments.length > 1 ? ` +${taskAssignments.length - 1}` : ''}
                    </span>
                  </div>
                )}
              </td>
              <td className="px-3 py-1">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className="h-full rounded-full bg-brand-600"
                      style={{ width: `${Math.min(100, Math.max(0, row.task.progress))}%` }}
                    />
                  </div>
                  <span className="tabular text-caption text-ink-3">
                    {formatPercent(row.task.progress)}
                  </span>
                </div>
              </td>
              <td className="px-3 py-1">
                <div className="flex items-center justify-end gap-0.5">
                  <IconButton
                    label={`Tambah sub-tugas untuk ${row.task.name}`}
                    onClick={() => onAddSubtask(row.task)}
                  >
                    <ListPlus aria-hidden className="size-4" />
                  </IconButton>
                  <IconButton label={`Ubah ${row.task.name}`} onClick={() => onEditTask(row.task)}>
                    <Pencil aria-hidden className="size-4" />
                  </IconButton>
                  <IconButton
                    label={`Hapus ${row.task.name}`}
                    tone="danger"
                    onClick={() => onDeleteTask(row.task)}
                  >
                    <Trash aria-hidden className="size-4" />
                  </IconButton>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
