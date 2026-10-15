import { CalendarCheck, ChartGantt, ListTree, Plus, TriangleAlert } from 'lucide-react';
import { useCallback, useMemo, useRef, useState, type UIEvent } from 'react';
import { useParams } from 'react-router-dom';
import {
  calendarFromProject,
  formatIsoDateShort,
  type DependencyType,
  type ProjectCalendar,
  type TaskDto,
} from 'shared';

import { AppShell } from '../components/layout/AppShell';
import { GanttChart } from '../components/gantt/GanttChart';
import { TaskDialog, type TaskFormValues } from '../components/gantt/TaskDialog';
import { TaskTable } from '../components/gantt/TaskTable';
import { buildTaskRows, computeVisibleRows } from '../components/gantt/tree';
import {
  HEADER_HEIGHT,
  ROW_HEIGHT,
  ZOOM_LABELS,
  createTimelineScale,
  type TimelineScale,
  type ZoomLevel,
} from '../components/gantt/timeline';
import { Button } from '../components/ui/Button';
import { Card, EmptyState, Skeleton } from '../components/ui/Card';
import { useActionFeedback, useToast } from '../components/ui/Toast';
import { ConfirmDialog } from '../components/ui/Modal';
import { useProjectActions, useProjectAnalysis, useProjectSnapshot } from '../api/hooks';
import { formatDateRange, todayIso } from '../lib/format';

type MobileView = 'table' | 'timeline';

export function GanttPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const snapshotQuery = useProjectSnapshot(projectId);
  const analysisQuery = useProjectAnalysis(projectId);
  const actions = useProjectActions(projectId ?? '');
  const feedback = useActionFeedback();
  const toast = useToast();

  const [zoom, setZoom] = useState<ZoomLevel>('week');
  const [showCritical, setShowCritical] = useState(false);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>('table');
  const [dialog, setDialog] = useState<{
    mode: 'create' | 'edit';
    task: TaskDto | null;
    parentId: string | null;
  } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TaskDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const tableRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);
  const today = useMemo(() => todayIso(), []);

  const snapshot = snapshotQuery.data;
  const tasks = useMemo(() => snapshot?.tasks ?? [], [snapshot]);
  const calendar = useMemo<ProjectCalendar | null>(
    () =>
      snapshot
        ? calendarFromProject({
            weekendDays: snapshot.project.weekendDays,
            holidays: snapshot.holidays.map((holiday) => holiday.date),
          })
        : null,
    [snapshot],
  );
  const holidaySet = useMemo(
    () => new Set((snapshot?.holidays ?? []).map((holiday) => holiday.date)),
    [snapshot],
  );

  const treeRows = useMemo(() => buildTaskRows(tasks), [tasks]);
  const visibleRows = useMemo(() => computeVisibleRows(treeRows, collapsed), [treeRows, collapsed]);

  const scale = useMemo<TimelineScale | null>(() => {
    if (!calendar) return null;
    const starts = tasks.map((task) => task.scheduledStart).sort();
    const ends = tasks.map((task) => task.scheduledEnd).sort();
    return createTimelineScale({
      earliest: starts[0] ?? null,
      latest: ends[ends.length - 1] ?? null,
      calendar,
      holidays: holidaySet,
      zoom,
      today,
    });
  }, [calendar, holidaySet, tasks, today, zoom]);

  const criticalIds = useMemo(
    () => new Set(analysisQuery.data?.criticalPath ?? []),
    [analysisQuery.data],
  );

  const syncScroll = useCallback((source: MobileView) => {
    return (event: UIEvent<HTMLDivElement>) => {
      if (syncing.current) return;
      syncing.current = true;
      const target = source === 'table' ? timelineRef.current : tableRef.current;
      if (target) target.scrollTop = event.currentTarget.scrollTop;
      window.requestAnimationFrame(() => {
        syncing.current = false;
      });
    };
  }, []);

  const scrollToToday = useCallback(() => {
    if (!scale || !timelineRef.current) return;
    const offset = scale.todayX;
    if (offset === null) return;
    timelineRef.current.scrollTo({ left: Math.max(0, offset - 200), behavior: 'smooth' });
  }, [scale]);

  const toggleCollapse = useCallback((taskId: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const submitTask = async (values: TaskFormValues): Promise<boolean> => {
    const payload = {
      name: values.name,
      description: values.description || null,
      durationDays: values.durationDays,
      startDate: values.startDate,
      priority: values.priority,
      color: values.color,
      progress: values.progress,
      optimisticDays: values.optimisticDays,
      pessimisticDays: values.pessimisticDays,
    };

    if (dialog?.mode === 'edit' && dialog.task) {
      const result = await feedback.run(() => actions.updateTask(dialog.task?.id ?? '', payload), {
        success: 'Perubahan tugas disimpan',
      });
      return result === true;
    }

    const created = await feedback.run(
      () => actions.createTask({ ...payload, parentId: values.parentId || null }),
      { success: 'Tugas ditambahkan' },
    );
    if (created && typeof created === 'object') setSelectedTaskId(created.id);
    return Boolean(created);
  };

  const confirmDelete = async (): Promise<void> => {
    if (!pendingDelete) return;
    setDeleting(true);
    const result = await feedback.run(() => actions.deleteTask(pendingDelete.id), {
      success: `Tugas "${pendingDelete.name}" dihapus`,
    });
    setDeleting(false);
    if (result === true) {
      setPendingDelete(null);
      if (selectedTaskId === pendingDelete.id) setSelectedTaskId(null);
    }
  };

  const projectName = snapshot?.project.name ?? 'Memuat proyek…';

  return (
    <AppShell projectId={projectId}>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-caption font-semibold tracking-wide text-ink-3 uppercase">Gantt</p>
          <h1 className="truncate text-h1 text-ink">{projectName}</h1>
          {snapshot ? (
            <p className="mt-1 text-body-sm text-ink-3">
              {formatDateRange(
                tasks.map((task) => task.scheduledStart).sort()[0] ?? null,
                tasks.map((task) => task.scheduledEnd).sort().slice(-1)[0] ?? null,
              )}{' '}
              · mulai proyek {formatIsoDateShort(snapshot.project.startDate)} · {tasks.length} tugas
            </p>
          ) : null}
        </div>
        <Button
          variant="primary"
          icon={<Plus aria-hidden className="size-4" />}
          onClick={() => setDialog({ mode: 'create', task: null, parentId: null })}
          disabled={!snapshot}
        >
          Tambah tugas
        </Button>
      </header>

      {snapshotQuery.isPending ? (
        <Card className="p-4">
          <Skeleton className="h-10 w-64" />
          <div className="mt-4 flex flex-col gap-2">
            {[1, 2, 3, 4, 5, 6].map((key) => (
              <Skeleton key={key} className="h-9" />
            ))}
          </div>
        </Card>
      ) : snapshotQuery.isError || !snapshot || !calendar || !scale ? (
        <Card>
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-danger-bg text-danger">
              <TriangleAlert aria-hidden className="size-6" />
            </span>
            <p className="text-body text-ink-2">Proyek tidak bisa dimuat.</p>
            <Button onClick={() => void snapshotQuery.refetch()}>Coba lagi</Button>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <div
                role="group"
                aria-label="Tingkat zoom timeline"
                className="flex items-center gap-1 rounded-md border border-line bg-surface-2 p-1"
              >
                {(Object.keys(ZOOM_LABELS) as ZoomLevel[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    aria-pressed={zoom === level}
                    onClick={() => setZoom(level)}
                    className={`rounded-sm px-2.5 py-1 text-body-sm font-medium transition-colors ${
                      zoom === level ? 'bg-surface text-brand-700 shadow-sm' : 'text-ink-3 hover:text-ink'
                    }`}
                  >
                    {ZOOM_LABELS[level]}
                  </button>
                ))}
              </div>

              <Button size="sm" icon={<CalendarCheck aria-hidden className="size-4" />} onClick={scrollToToday}>
                Hari ini
              </Button>

              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-line px-3 py-2 text-body-sm text-ink-2">
                <input
                  type="checkbox"
                  className="size-4 accent-brand-600"
                  checked={showCritical}
                  onChange={(event) => setShowCritical(event.target.checked)}
                />
                Sorot jalur kritis
              </label>
              {analysisQuery.isSuccess ? (
                <span className="text-caption text-ink-3">
                  {analysisQuery.data.summary.criticalTaskCount} tugas kritis
                </span>
              ) : null}
            </div>

            <div
              role="group"
              aria-label="Pilih tampilan"
              className="flex items-center gap-1 rounded-md border border-line bg-surface-2 p-1 md:hidden"
            >
              <button
                type="button"
                aria-pressed={mobileView === 'table'}
                onClick={() => setMobileView('table')}
                className={`inline-flex items-center gap-1 rounded-sm px-2.5 py-1 text-body-sm ${
                  mobileView === 'table' ? 'bg-surface text-brand-700 shadow-sm' : 'text-ink-3'
                }`}
              >
                <ListTree aria-hidden className="size-4" /> Tabel
              </button>
              <button
                type="button"
                aria-pressed={mobileView === 'timeline'}
                onClick={() => setMobileView('timeline')}
                className={`inline-flex items-center gap-1 rounded-sm px-2.5 py-1 text-body-sm ${
                  mobileView === 'timeline' ? 'bg-surface text-brand-700 shadow-sm' : 'text-ink-3'
                }`}
              >
                <ChartGantt aria-hidden className="size-4" /> Timeline
              </button>
            </div>
          </div>

          {tasks.length === 0 ? (
            <EmptyState
              icon={ChartGantt}
              title="Belum ada tugas"
              description="Tambahkan tugas pertama, lalu atur durasi dan dependensinya untuk melihat jadwal di timeline."
              action={
                <Button
                  variant="primary"
                  onClick={() => setDialog({ mode: 'create', task: null, parentId: null })}
                >
                  Tambah tugas
                </Button>
              }
            />
          ) : (
            <div className="grid md:grid-cols-[minmax(340px,42%)_1fr]">
              <div
                ref={tableRef}
                onScroll={syncScroll('table')}
                data-testid="gantt-table-panel"
                className={`max-h-[70vh] overflow-y-auto border-line md:border-r ${
                  mobileView === 'table' ? 'block' : 'hidden md:block'
                }`}
              >
                <div
                  className="sticky top-0 z-10 flex items-center border-b border-line bg-surface-2 px-3 text-caption font-semibold tracking-wide text-ink-3 uppercase"
                  style={{ height: HEADER_HEIGHT }}
                >
                  Daftar tugas
                </div>
                <TaskTable
                  rows={visibleRows}
                  rowHeight={ROW_HEIGHT}
                  collapsed={collapsed}
                  selectedTaskId={selectedTaskId}
                  resources={snapshot.resources}
                  assignments={snapshot.assignments}
                  criticalIds={criticalIds}
                  showCritical={showCritical}
                  onToggleCollapse={toggleCollapse}
                  onSelectTask={setSelectedTaskId}
                  onEditTask={(task) => setDialog({ mode: 'edit', task, parentId: task.parentId })}
                  onDeleteTask={setPendingDelete}
                  onAddSubtask={(task) =>
                    setDialog({ mode: 'create', task: null, parentId: task.id })
                  }
                />
              </div>

              <div
                ref={timelineRef}
                onScroll={syncScroll('timeline')}
                data-testid="gantt-timeline-panel"
                className={`max-h-[70vh] overflow-auto ${
                  mobileView === 'timeline' ? 'block' : 'hidden md:block'
                }`}
              >
                <div
                  className="sticky top-0 z-10 border-b border-line bg-surface"
                  style={{ width: Math.max(scale.totalWidth, 320), height: HEADER_HEIGHT }}
                >
                  <div className="relative h-7 border-b border-line">
                    {scale.months.map((month) => (
                      <span
                        key={`${month.label}-${month.x}`}
                        className="absolute top-1 text-caption font-semibold text-ink-2"
                        style={{ left: month.x + 6 }}
                      >
                        {month.label}
                      </span>
                    ))}
                  </div>
                  <div className="relative h-7">
                    {scale.days
                      .filter((day) => day.label)
                      .map((day) => (
                        <span
                          key={day.iso}
                          className={`absolute top-1 w-8 text-center text-caption ${
                            day.isToday ? 'font-bold text-brand-700' : 'text-ink-3'
                          }`}
                          style={{ left: day.x }}
                        >
                          {day.label}
                        </span>
                      ))}
                  </div>
                </div>

                <GanttChart
                  scale={scale}
                  rows={visibleRows.map((row) => ({
                    task: row.task,
                    depth: row.depth,
                    isSummary: row.isSummary,
                  }))}
                  allTasks={tasks}
                  dependencies={snapshot.dependencies}
                  calendar={calendar}
                  criticalIds={criticalIds}
                  showCritical={showCritical}
                  selectedTaskId={selectedTaskId}
                  onSelectTask={setSelectedTaskId}
                  onEditTask={(task) => setDialog({ mode: 'edit', task, parentId: task.parentId })}
                  onDragTask={(taskId, nextStartDate) => {
                    void feedback.run(() => actions.updateTask(taskId, { startDate: nextStartDate }), {
                      success: 'Tanggal mulai tugas diperbarui',
                    });
                  }}
                  onResizeTask={(taskId, nextDurationDays) => {
                    void feedback.run(
                      () => actions.updateTask(taskId, { durationDays: nextDurationDays }),
                      { success: 'Durasi tugas diperbarui' },
                    );
                  }}
                  onConstrained={(message) => toast.info(message)}
                  rowHeight={ROW_HEIGHT}
                />
              </div>
            </div>
          )}
        </Card>
      )}

      {dialog && snapshot ? (
        <TaskDialog
          open
          mode={dialog.mode}
          task={dialog.task}
          parentId={dialog.parentId}
          projectStartDate={snapshot.project.startDate}
          tasks={tasks}
          resources={snapshot.resources}
          assignments={snapshot.assignments}
          dependencies={snapshot.dependencies}
          onClose={() => setDialog(null)}
          onSubmit={submitTask}
          onAddDependency={(values) =>
            feedback.run(
              () =>
                actions.createDependency(dialog.task?.id ?? '', {
                  predecessorId: values.predecessorId,
                  type: values.type as DependencyType,
                  lagDays: values.lagDays,
                }),
              { success: 'Predecessor ditambahkan' },
            ).then((result) => result === true)
          }
          onUpdateDependency={(dependencyId, values) =>
            feedback.run(() => actions.updateDependency(dependencyId, values), {
              success: 'Jeda dependensi diperbarui',
            }).then((result) => result === true)
          }
          onDeleteDependency={(dependencyId) =>
            feedback.run(() => actions.deleteDependency(dependencyId), {
              success: 'Dependensi dihapus',
            }).then((result) => result === true)
          }
          onAddAssignment={(values) =>
            feedback.run(
              () =>
                actions.createAssignment(dialog.task?.id ?? '', {
                  resourceId: values.resourceId,
                  allocationPercent: values.allocationPercent,
                }),
              { success: 'Anggota dialokasikan' },
            ).then((result) => result === true)
          }
          onUpdateAssignment={(assignmentId, allocationPercent) =>
            feedback.run(() => actions.updateAssignment(assignmentId, { allocationPercent }), {
              success: 'Alokasi diperbarui',
            }).then((result) => result === true)
          }
          onDeleteAssignment={(assignmentId) =>
            feedback.run(() => actions.deleteAssignment(assignmentId), {
              success: 'Alokasi dihapus',
            }).then((result) => result === true)
          }
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Hapus tugas?"
        message={`Tugas "${pendingDelete?.name ?? ''}" beserta sub-tugas, dependensi, dan alokasinya akan dihapus.`}
        confirmLabel="Hapus tugas"
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </AppShell>
  );
}
