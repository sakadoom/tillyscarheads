import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  computeSchedule,
  formatIsoDateShort,
  type DependencyDto,
  type DependencyType,
  type ProjectCalendar,
  type ScheduleDependencyInput,
  type TaskDto,
} from 'shared';

import { candidates, type DragState } from './drag';
import {
  daysForDelta,
  rangeWidth,
  xForDate,
  type TimelineScale,
} from './timeline';

export interface GanttRow {
  task: TaskDto;
  depth: number;
  isSummary: boolean;
}

export interface GanttChartProps {
  scale: TimelineScale;
  rows: GanttRow[];
  allTasks: TaskDto[];
  dependencies: DependencyDto[];
  calendar: ProjectCalendar;
  criticalIds: ReadonlySet<string>;
  showCritical: boolean;
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onEditTask: (task: TaskDto) => void;
  onDragTask: (taskId: string, nextStartDate: string) => void;
  onResizeTask: (taskId: string, nextDurationDays: number) => void;
  onConstrained: (message: string) => void;
  rowHeight: number;
}

const BAR_HEIGHT = 22;

export function GanttChart({
  scale,
  rows,
  allTasks,
  dependencies,
  calendar,
  criticalIds,
  showCritical,
  selectedTaskId,
  onSelectTask,
  onEditTask,
  onDragTask,
  onResizeTask,
  onConstrained,
  rowHeight,
}: GanttChartProps) {
  const dragRef = useRef<DragState | null>(null);
  const [, forceRender] = useReducer((count: number) => count + 1, 0);
  const drag = dragRef.current;

  const dependencyInputs = useMemo<ScheduleDependencyInput[]>(
    () =>
      dependencies.map((dependency) => ({
        predecessorId: dependency.predecessorId,
        successorId: dependency.successorId,
        type: dependency.type as DependencyType,
        lagDays: dependency.lagDays,
      })),
    [dependencies],
  );

  /**
   * Pratinjau drag memakai mesin `shared` yang sama dengan server, jadi hasil
   * pratinjau sama dengan hasil akhir setelah PATCH.
   */
  const preview = useMemo(() => {
    if (!drag) return null;
    const tasks = allTasks.map((task) =>
      task.id === drag.taskId
        ? {
            ...task,
            startDate: drag.mode === 'move' ? drag.candidateStart : task.startDate,
            durationDays: drag.mode === 'resize' ? drag.candidateDuration : task.durationDays,
          }
        : task,
    );
    return computeSchedule(
      tasks.map((task) => ({
        id: task.id,
        parentId: task.parentId,
        position: task.position,
        durationDays: task.durationDays,
        startDate: task.startDate,
        progress: task.progress,
      })),
      dependencyInputs,
      calendar,
    );
  }, [allTasks, calendar, dependencyInputs, drag]);

  const effective = useCallback(
    (task: TaskDto) => {
      const scheduled = preview?.get(task.id);
      return scheduled ?? task;
    },
    [preview],
  );

  useEffect(() => {
    if (!drag) return undefined;

    const handleMove = (event: PointerEvent) => {
      const current = dragRef.current;
      if (!current) return;
      const deltaDays = daysForDelta(scale, event.clientX - current.startX);
      if (deltaDays === current.deltaDays) return;
      dragRef.current = { ...current, deltaDays, ...candidates(current, deltaDays, calendar) };
      forceRender();
    };

    const handleUp = () => {
      const current = dragRef.current;
      dragRef.current = null;
      if (!current) return;
      if (current.deltaDays === 0) {
        forceRender();
        return;
      }
      forceRender();

      if (current.mode === 'move') {
        const scheduled = computeSchedule(
          allTasks.map((task) =>
            task.id === current.taskId
              ? { ...task, startDate: current.candidateStart }
              : task,
          ).map((task) => ({
            id: task.id,
            parentId: task.parentId,
            position: task.position,
            durationDays: task.durationDays,
            startDate: task.startDate,
            progress: task.progress,
          })),
          dependencyInputs,
          calendar,
        ).get(current.taskId);
        if (scheduled && scheduled.scheduledStart !== current.candidateStart) {
          onConstrained(
            `Bar dikembalikan ke ${formatIsoDateShort(scheduled.scheduledStart)} karena batas dependensi tidak mengizinkan tanggal yang lebih awal.`,
          );
        }
        onDragTask(current.taskId, current.candidateStart);
      } else {
        onResizeTask(current.taskId, current.candidateDuration);
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [allTasks, calendar, dependencyInputs, drag, forceRender, onConstrained, onDragTask, onResizeTask, scale]);

  const startDrag = (event: ReactPointerEvent, task: TaskDto, mode: 'move' | 'resize'): void => {
    // Bar tugas induk tidak bisa di-drag (6.7).
    if (rows.find((row) => row.task.id === task.id)?.isSummary) return;
    event.preventDefault();
    event.stopPropagation();
    const base = candidates(
      {
        taskId: task.id,
        mode,
        startX: event.clientX,
        deltaDays: 0,
        original: task,
        candidateStart: task.startDate,
        candidateDuration: task.durationDays,
      },
      0,
      calendar,
    );
    dragRef.current = {
      taskId: task.id,
      mode,
      startX: event.clientX,
      deltaDays: 0,
      original: task,
      ...base,
    };
    forceRender();
  };

  const rowIndexById = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((row, index) => map.set(row.task.id, index));
    return map;
  }, [rows]);

  const height = rows.length * rowHeight;
  const taskById = useMemo(() => new Map(allTasks.map((task) => [task.id, task])), [allTasks]);

  const arrows = useMemo(
    () =>
      dependencies.flatMap((dependency) => {
        const predecessorRow = rowIndexById.get(dependency.predecessorId);
        const successorRow = rowIndexById.get(dependency.successorId);
        const predecessor = taskById.get(dependency.predecessorId);
        const successor = taskById.get(dependency.successorId);
        if (
          predecessorRow === undefined ||
          successorRow === undefined ||
          !predecessor ||
          !successor
        ) {
          return [];
        }
        const predecessorScheduled = effective(predecessor);
        const successorScheduled = effective(successor);
        const predecessorY = predecessorRow * rowHeight + rowHeight / 2;
        const successorY = successorRow * rowHeight + rowHeight / 2;
        const isCritical =
          showCritical &&
          criticalIds.has(dependency.predecessorId) &&
          criticalIds.has(dependency.successorId);

        const fromX =
          dependency.type === 'SS'
            ? xForDate(scale, predecessorScheduled.scheduledStart)
            : xForDate(scale, predecessorScheduled.scheduledEnd) + scale.dayWidth;
        const toX = xForDate(scale, successorScheduled.scheduledStart);
        const elbowX = dependency.type === 'SS' ? fromX - 12 : fromX + 12;
        const targetX = toX - 3;
        const path =
          predecessorY === successorY
            ? `M ${fromX} ${predecessorY} H ${targetX}`
            : `M ${fromX} ${predecessorY} H ${elbowX} V ${successorY} H ${targetX}`;

        return [
          {
            id: dependency.id,
            path,
            isCritical,
            type: dependency.type as DependencyType,
          },
        ];
      }),
    [
      criticalIds,
      dependencies,
      effective,
      rowHeight,
      rowIndexById,
      scale,
      showCritical,
      taskById,
    ],
  );

  return (
    <svg
      width={Math.max(scale.totalWidth, 320)}
      height={Math.max(height, rowHeight)}
      className="block"
      role="group"
      aria-label="Timeline Gantt"
      data-testid="gantt-timeline"
    >
      <defs>
        <marker
          id="gantt-arrow-head"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
          className="text-ink-3"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
        </marker>
        <marker
          id="gantt-arrow-head-critical"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
          className="text-danger"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
        </marker>
      </defs>

      {scale.days.map((day) =>
        day.isHoliday ? (
          <rect
            key={`holiday-${day.iso}`}
            x={day.x}
            y={0}
            width={day.width}
            height={Math.max(height, rowHeight)}
            className="fill-warning-bg"
            opacity={0.55}
          />
        ) : !day.isWorking ? (
          <rect
            key={`weekend-${day.iso}`}
            x={day.x}
            y={0}
            width={day.width}
            height={Math.max(height, rowHeight)}
            className="fill-surface-2"
          />
        ) : null,
      )}

      {scale.days.map((day) =>
        day.label || day.isWeekStart ? (
          <line
            key={`grid-${day.iso}`}
            x1={day.x}
            y1={0}
            x2={day.x}
            y2={Math.max(height, rowHeight)}
            className="stroke-line"
            strokeWidth={1}
          />
        ) : null,
      )}

      {rows.map((row, index) => (
        <line
          key={`row-${row.task.id}`}
          x1={0}
          y1={(index + 1) * rowHeight}
          x2={scale.totalWidth}
          y2={(index + 1) * rowHeight}
          className="stroke-line"
          strokeWidth={1}
          opacity={0.7}
        />
      ))}

      {scale.todayX !== null ? (
        <g data-testid="gantt-today-line">
          <line
            x1={scale.todayX}
            y1={0}
            x2={scale.todayX}
            y2={Math.max(height, rowHeight)}
            className="stroke-brand-600"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
        </g>
      ) : null}

      {rows.map((row, index) => {
        const scheduled = effective(row.task);
        const x = xForDate(scale, scheduled.scheduledStart);
        const width = rangeWidth(scale, scheduled.scheduledStart, scheduled.scheduledEnd);
        const y = index * rowHeight;
        const isCritical = showCritical && criticalIds.has(row.task.id);
        const isSelected = selectedTaskId === row.task.id;
        const barY = y + (rowHeight - BAR_HEIGHT) / 2;

        if (row.isSummary) {
          const bracketY = y + rowHeight / 2;
          return (
            <g key={row.task.id} data-testid="gantt-summary-bar" data-task-id={row.task.id}>
              <rect
                x={x}
                y={bracketY - 4}
                width={Math.max(width, 4)}
                height={8}
                rx={2}
                style={{ fill: row.task.color }}
              />
              <path
                d={`M ${x} ${bracketY - 4} l 0 8 l -5 -8 z M ${x + Math.max(width, 4)} ${bracketY - 4} l 0 8 l 5 -8 z`}
                style={{ fill: row.task.color }}
              />
            </g>
          );
        }

        return (
          <g
            key={row.task.id}
            data-testid="gantt-bar"
            data-task-id={row.task.id}
            data-critical={isCritical ? 'true' : 'false'}
            data-selected={isSelected ? 'true' : 'false'}
          >
            <rect
              x={x}
              y={barY}
              width={Math.max(width, 6)}
              height={BAR_HEIGHT}
              rx={4}
              style={{ fill: row.task.color }}
              className={isCritical && showCritical ? 'stroke-danger' : 'stroke-transparent'}
              strokeWidth={isCritical && showCritical ? 2 : 1}
            />
            <rect
              x={x}
              y={barY}
              width={(Math.max(width, 6) * Math.min(100, Math.max(0, scheduled.progress))) / 100}
              height={BAR_HEIGHT}
              rx={4}
              fill="rgba(15, 23, 42, 0.28)"
            />
            <rect
              x={x}
              y={barY}
              width={Math.max(width, 6)}
              height={BAR_HEIGHT}
              rx={4}
              fill="transparent"
              role="button"
              tabIndex={0}
              aria-label={`${row.task.name}, ${formatIsoDateShort(scheduled.scheduledStart)} sampai ${formatIsoDateShort(scheduled.scheduledEnd)}`}
              className="cursor-grab"
              onPointerDown={(event) => startDrag(event, row.task, 'move')}
              onClick={() => onSelectTask(row.task.id)}
              onDoubleClick={() => onEditTask(row.task)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onEditTask(row.task);
                }
              }}
            />
            {width > 96 ? (
              <text
                x={x + 8}
                y={barY + BAR_HEIGHT / 2}
                dominantBaseline="middle"
                className="pointer-events-none fill-white text-caption font-semibold"
              >
                {row.task.name.length > 26 ? `${row.task.name.slice(0, 25)}…` : row.task.name}
              </text>
            ) : null}
            <rect
              data-testid="gantt-resize-handle"
              data-task-id={row.task.id}
              x={x + Math.max(width, 6) - 6}
              y={barY}
              width={6}
              height={BAR_HEIGHT}
              rx={2}
              className="cursor-col-resize fill-white/70 hover:fill-white"
              onPointerDown={(event) => startDrag(event, row.task, 'resize')}
            />
          </g>
        );
      })}

      {arrows.map((arrow) => (
        <path
          key={arrow.id}
          data-testid="dependency-arrow"
          data-dependency-type={arrow.type}
          data-critical={arrow.isCritical ? 'true' : 'false'}
          d={arrow.path}
          fill="none"
          strokeWidth={arrow.isCritical ? 2 : 1.5}
          markerEnd={arrow.isCritical ? 'url(#gantt-arrow-head-critical)' : 'url(#gantt-arrow-head)'}
          className={arrow.isCritical ? 'text-danger stroke-danger' : 'text-ink-3 stroke-ink-3'}
          opacity={arrow.isCritical ? 1 : 0.75}
        />
      ))}
    </svg>
  );
}

