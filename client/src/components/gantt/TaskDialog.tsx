import { zodResolver } from '@hookform/resolvers/zod';
import { Trash } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  DEPENDENCY_TYPE_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  TASK_COLORS,
  hexColorSchema,
  isoDateSchema,
  prioritySchema,
  type AssignmentDto,
  type DependencyDto,
  type DependencyType,
  type Priority,
  type ResourceDto,
  type TaskDto,
} from 'shared';
import { z } from 'zod';

import { Button, IconButton } from '../ui/Button';
import { Field, Input, Select, Textarea, useFieldId } from '../ui/Input';
import { Modal } from '../ui/Modal';

const taskFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Nama tugas wajib diisi').max(160, 'Nama maksimal 160 karakter'),
    description: z.string().trim().max(2000, 'Deskripsi maksimal 2000 karakter'),
    parentId: z.string(),
    durationDays: z
      .number({ invalid_type_error: 'Durasi harus angka' })
      .int('Durasi harus bilangan bulat')
      .min(1, 'Durasi minimal 1 hari kerja')
      .max(3650, 'Durasi maksimal 3650 hari kerja'),
    startDate: isoDateSchema,
    priority: prioritySchema,
    color: hexColorSchema,
    progress: z.number().int().min(0, 'Progres 0–100').max(100, 'Progres 0–100'),
    optimisticDays: z
      .number()
      .int()
      .min(1, 'Estimasi minimal 1 hari')
      .max(3650)
      .nullable(),
    pessimisticDays: z
      .number()
      .int()
      .min(1, 'Estimasi minimal 1 hari')
      .max(3650)
      .nullable(),
  })
  .refine(
    (values) =>
      values.optimisticDays === null ||
      values.pessimisticDays === null ||
      values.pessimisticDays >= values.optimisticDays,
    {
      message: 'Estimasi pesimistis tidak boleh lebih kecil dari optimistis',
      path: ['pessimisticDays'],
    },
  );

export type TaskFormValues = z.infer<typeof taskFormSchema>;

export interface TaskDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  task?: TaskDto | null;
  parentId?: string | null;
  projectStartDate: string;
  tasks: readonly TaskDto[];
  resources: readonly ResourceDto[];
  assignments: readonly AssignmentDto[];
  dependencies: readonly DependencyDto[];
  onClose: () => void;
  onSubmit: (values: TaskFormValues) => Promise<boolean>;
  onAddDependency: (values: {
    predecessorId: string;
    type: DependencyType;
    lagDays: number;
  }) => Promise<boolean>;
  onUpdateDependency: (dependencyId: string, values: { lagDays: number }) => Promise<boolean>;
  onDeleteDependency: (dependencyId: string) => Promise<boolean>;
  onAddAssignment: (values: {
    resourceId: string;
    allocationPercent: number;
  }) => Promise<boolean>;
  onUpdateAssignment: (assignmentId: string, allocationPercent: number) => Promise<boolean>;
  onDeleteAssignment: (assignmentId: string) => Promise<boolean>;
}

const emptyValues = (startDate: string): TaskFormValues => ({
  name: '',
  description: '',
  parentId: '',
  durationDays: 1,
  startDate,
  priority: 'MEDIUM',
  color: TASK_COLORS[0] ?? '#4F46E5',
  progress: 0,
  optimisticDays: null,
  pessimisticDays: null,
});

export function TaskDialog({
  open,
  mode,
  task,
  parentId = null,
  projectStartDate,
  tasks,
  resources,
  assignments,
  dependencies,
  onClose,
  onSubmit,
  onAddDependency,
  onUpdateDependency,
  onDeleteDependency,
  onAddAssignment,
  onUpdateAssignment,
  onDeleteAssignment,
}: TaskDialogProps) {
  const ids = {
    name: useFieldId('task-name'),
    description: useFieldId('task-description'),
    parent: useFieldId('task-parent'),
    duration: useFieldId('task-duration'),
    start: useFieldId('task-start'),
    priority: useFieldId('task-priority'),
    color: useFieldId('task-color'),
    progress: useFieldId('task-progress'),
    optimistic: useFieldId('task-optimistic'),
    pessimistic: useFieldId('task-pessimistic'),
  };

  const [busy, setBusy] = useState(false);
  const [dependencyDraft, setDependencyDraft] = useState({
    predecessorId: '',
    type: 'FS' as DependencyType,
    lagDays: 0,
  });
  const [assignmentDraft, setAssignmentDraft] = useState({ resourceId: '', allocationPercent: 100 });

  const isSummary = useMemo(
    () => Boolean(task && tasks.some((candidate) => candidate.parentId === task.id)),
    [task, tasks],
  );
  const childCount = useMemo(
    () => (task ? tasks.filter((candidate) => candidate.parentId === task.id).length : 0),
    [task, tasks],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: emptyValues(projectStartDate),
  });

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && task) {
      reset({
        name: task.name,
        description: task.description ?? '',
        parentId: task.parentId ?? '',
        durationDays: task.durationDays,
        startDate: task.startDate,
        priority: task.priority,
        color: task.color,
        progress: task.progress,
        optimisticDays: task.optimisticDays,
        pessimisticDays: task.pessimisticDays,
      });
      return;
    }
    reset({ ...emptyValues(projectStartDate), parentId: parentId ?? '' });
  }, [mode, open, parentId, projectStartDate, reset, task]);

  const predecessorOptions = tasks.filter(
    (candidate) => candidate.id !== task?.id && !tasks.some((child) => child.parentId === candidate.id),
  );
  const currentDependencies = task
    ? dependencies.filter((dependency) => dependency.successorId === task.id)
    : [];
  const currentAssignments = task
    ? assignments.filter((assignment) => assignment.taskId === task.id)
    : [];

  const runAction = async (action: () => Promise<boolean>): Promise<void> => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const submit = handleSubmit(async (values) => {
    setBusy(true);
    try {
      const success = await onSubmit(values);
      if (success) onClose();
    } finally {
      setBusy(false);
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"      title={mode === 'create' ? 'Tambah tugas' : 'Ubah tugas'}
      description={
        isSummary
          ? 'Tugas induk: durasi, tanggal, dan progres dihitung otomatis dari sub-tugas.'
          : 'Durasi dihitung dalam hari kerja, mengikuti kalender proyek.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button variant="primary" type="submit" form="task-form" loading={busy}>
            {mode === 'create' ? 'Simpan tugas' : 'Simpan perubahan'}
          </Button>
        </>
      }
    >
      <form id="task-form" onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <section className="flex flex-col gap-3">
          <h3 className="text-body-sm font-semibold tracking-wide text-ink-3 uppercase">Detail tugas</h3>
          <Field label="Nama tugas" htmlFor={ids.name} error={errors.name?.message} required>
            <Input
              id={ids.name}
              invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? `${ids.name}-error` : undefined}
              placeholder="Contoh: Implementasi backend"
              {...register('name')}
            />
          </Field>

          <Field label="Deskripsi" htmlFor={ids.description} error={errors.description?.message}>
            <Textarea
              id={ids.description}
              invalid={Boolean(errors.description)}
              placeholder="Keterangan singkat tentang tugas ini"
              {...register('description')}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Tugas induk"
              htmlFor={ids.parent}
              hint={mode === 'edit' ? 'Ubah induk lewat aksi pindah pada tabel' : 'Kosongkan untuk tugas level teratas'}
            >
              <Select id={ids.parent} disabled={mode === 'edit'} {...register('parentId')}>
                <option value="">— Tanpa induk —</option>
                {tasks
                  .filter((candidate) => !tasks.some((child) => child.parentId === candidate.id))
                  .map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </option>
                  ))}
              </Select>
            </Field>

            <Field label="Prioritas" htmlFor={ids.priority}>
              <Select id={ids.priority} {...register('priority')}>
                {PRIORITIES.map((priority: Priority) => (
                  <option key={priority} value={priority}>
                    {PRIORITY_LABELS[priority]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field
              label="Durasi (hari kerja)"
              htmlFor={ids.duration}
              error={errors.durationDays?.message}
              hint={isSummary ? `Dihitung dari ${childCount} sub-tugas` : undefined}
              required={!isSummary}
            >
              <Input
                id={ids.duration}
                type="number"
                min={1}
                inputMode="numeric"
                disabled={isSummary}
                invalid={Boolean(errors.durationDays)}
                {...register('durationDays', { valueAsNumber: true })}
              />
            </Field>

            <Field
              label="Mulai paling awal"
              htmlFor={ids.start}
              error={errors.startDate?.message}
              required={!isSummary}
            >
              <Input
                id={ids.start}
                type="date"
                disabled={isSummary}
                invalid={Boolean(errors.startDate)}
                {...register('startDate')}
              />
            </Field>

            <Field
              label="Progres (%)"
              htmlFor={ids.progress}
              error={errors.progress?.message}
              hint={isSummary ? 'Rata-rata berbobot sub-tugas' : undefined}
            >
              <Input
                id={ids.progress}
                type="number"
                min={0}
                max={100}
                disabled={isSummary}
                invalid={Boolean(errors.progress)}
                {...register('progress', { valueAsNumber: true })}
              />
            </Field>
          </div>

          <fieldset className="flex flex-col gap-1.5">
            <legend id={ids.color} className="text-body-sm font-medium text-ink-2">
              Warna indikator
            </legend>
            <div className="flex flex-wrap items-center gap-2">
              {TASK_COLORS.map((color) => (
                <label key={color} className="cursor-pointer">
                  <input
                    type="radio"
                    value={color}
                    aria-label={`Warna ${color}`}
                    className="peer sr-only"
                    {...register('color')}
                  />
                  <span
                    style={{ backgroundColor: color }}
                    className="block size-8 rounded-full border-2 border-transparent peer-checked:border-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2"
                  />
                </label>
              ))}
            </div>
            {errors.color?.message ? (
              <p role="alert" className="text-caption font-medium text-danger">
                {errors.color.message}
              </p>
            ) : null}
          </fieldset>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-body-sm font-semibold tracking-wide text-ink-3 uppercase">
            Estimasi PERT (opsional)
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Optimistis (hari)" htmlFor={ids.optimistic} error={errors.optimisticDays?.message}>
              <Input
                id={ids.optimistic}
                type="number"
                min={1}
                placeholder="Kosongkan bila belum ada"
                {...register('optimisticDays', {
                  setValueAs: (value) => (value === '' || value === null ? null : Number(value)),
                })}
              />
            </Field>
            <Field
              label="Pesimistis (hari)"
              htmlFor={ids.pessimistic}
              error={errors.pessimisticDays?.message}
              hint="Dipakai untuk menghitung te dan variansi di halaman Analisis"
            >
              <Input
                id={ids.pessimistic}
                type="number"
                min={1}
                placeholder="Kosongkan bila belum ada"
                {...register('pessimisticDays', {
                  setValueAs: (value) => (value === '' || value === null ? null : Number(value)),
                })}
              />
            </Field>
          </div>
        </section>

        {mode === 'edit' && task ? (
          <>
            <section className="flex flex-col gap-3">
              <h3 className="text-body-sm font-semibold tracking-wide text-ink-3 uppercase">
                Predecessor
              </h3>
              {isSummary ? (
                <p className="rounded-md bg-surface-2 px-3 py-2 text-body-sm text-ink-3">
                  Tugas induk tidak bisa punya dependensi. Ubah dependensinya pada sub-tugas.
                </p>
              ) : (
                <>
                  {currentDependencies.length === 0 ? (
                    <p className="text-body-sm text-ink-3">Belum ada predecessor.</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {currentDependencies.map((dependency) => {
                        const predecessor = tasks.find(
                          (candidate) => candidate.id === dependency.predecessorId,
                        );
                        return (
                          <li
                            key={dependency.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line px-3 py-2"
                          >
                            <span className="text-body-sm text-ink-2">
                              {predecessor?.name ?? 'Tugas tidak dikenal'} ·{' '}
                              {DEPENDENCY_TYPE_LABELS[dependency.type]}
                              {dependency.lagDays !== 0 ? ` · jeda ${dependency.lagDays} hari` : ''}
                            </span>
                            <div className="flex items-center gap-1">
                              <label className="sr-only" htmlFor={`lag-${dependency.id}`}>
                                Jeda hari kerja
                              </label>
                              <Input
                                id={`lag-${dependency.id}`}
                                type="number"
                                className="h-9 w-20"
                                defaultValue={dependency.lagDays}
                                onBlur={(event) => {
                                  const lagDays = Number(event.target.value);
                                  const isValid =
                                    Number.isInteger(lagDays) && lagDays >= -365 && lagDays <= 365;
                                  if (isValid && lagDays !== dependency.lagDays) {
                                    void runAction(() =>
                                      onUpdateDependency(dependency.id, { lagDays }),
                                    );
                                  }
                                }}
                              />
                              <IconButton
                                label={`Hapus dependensi ${predecessor?.name ?? ''}`}
                                tone="danger"
                                onClick={() =>
                                  runAction(() => onDeleteDependency(dependency.id))
                                }
                              >
                                <Trash aria-hidden className="size-4" />
                              </IconButton>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  <div className="grid gap-2 sm:grid-cols-[1fr_9rem_7rem_auto]">
                    <Field label="Predecessor" htmlFor="dependency-predecessor">
                      <Select
                        id="dependency-predecessor"
                        value={dependencyDraft.predecessorId}
                        onChange={(event) =>
                          setDependencyDraft((current) => ({
                            ...current,
                            predecessorId: event.target.value,
                          }))
                        }
                      >
                        <option value="">Pilih tugas…</option>
                        {predecessorOptions
                          .filter(
                            (candidate) =>
                              !currentDependencies.some(
                                (dependency) => dependency.predecessorId === candidate.id,
                              ),
                          )
                          .map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                              {candidate.name}
                            </option>
                          ))}
                      </Select>
                    </Field>
                    <Field label="Tipe" htmlFor="dependency-type">
                      <Select
                        id="dependency-type"
                        value={dependencyDraft.type}
                        onChange={(event) =>
                          setDependencyDraft((current) => ({
                            ...current,
                            type: event.target.value as DependencyType,
                          }))
                        }
                      >
                        <option value="FS">Finish-to-Start</option>
                        <option value="SS">Start-to-Start</option>
                      </Select>
                    </Field>
                    <Field label="Jeda (hari)" htmlFor="dependency-lag">
                      <Input
                        id="dependency-lag"
                        type="number"
                        min={-365}
                        max={365}
                        value={dependencyDraft.lagDays}
                        onChange={(event) =>
                          setDependencyDraft((current) => ({
                            ...current,
                            lagDays: Number(event.target.value),
                          }))
                        }
                      />
                    </Field>
                    <div className="flex items-end">
                      <Button
                        variant="secondary"
                        disabled={!dependencyDraft.predecessorId || busy}
                        onClick={() =>
                          runAction(async () => {
                            const success = await onAddDependency(dependencyDraft);
                            if (success) {
                              setDependencyDraft({ predecessorId: '', type: 'FS', lagDays: 0 });
                            }
                            return success;
                          })
                        }
                      >
                        Tambah
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-body-sm font-semibold tracking-wide text-ink-3 uppercase">
                Penanggung jawab
              </h3>
              {isSummary ? (
                <p className="rounded-md bg-surface-2 px-3 py-2 text-body-sm text-ink-3">
                  Alokasi anggota hanya berlaku untuk tugas daun (tanpa sub-tugas).
                </p>
              ) : (
                <>
                  {currentAssignments.length === 0 ? (
                    <p className="text-body-sm text-ink-3">Belum ada anggota yang dialokasikan.</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {currentAssignments.map((assignment) => {
                        const resource = resources.find(
                          (candidate) => candidate.id === assignment.resourceId,
                        );
                        return (
                          <li
                            key={assignment.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line px-3 py-2"
                          >
                            <span className="text-body-sm text-ink-2">
                              {resource?.name ?? 'Anggota tidak dikenal'}
                              {resource ? ` · ${resource.role}` : ''}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="tabular text-body-sm text-ink-3">
                                {assignment.allocationPercent}%
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  runAction(() =>
                                    onUpdateAssignment(
                                      assignment.id,
                                      assignment.allocationPercent >= 100
                                        ? 50
                                        : Math.min(100, assignment.allocationPercent + 10),
                                    ),
                                  )
                                }
                              >
                                Ubah
                              </Button>
                              <IconButton
                                label={`Hapus alokasi ${resource?.name ?? ''}`}
                                tone="danger"
                                onClick={() => runAction(() => onDeleteAssignment(assignment.id))}
                              >
                                <Trash aria-hidden className="size-4" />
                              </IconButton>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  <div className="grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
                    <Field label="Anggota" htmlFor="assignment-resource">
                      <Select
                        id="assignment-resource"
                        value={assignmentDraft.resourceId}
                        onChange={(event) =>
                          setAssignmentDraft((current) => ({
                            ...current,
                            resourceId: event.target.value,
                          }))
                        }
                      >
                        <option value="">Pilih anggota…</option>
                        {resources
                          .filter(
                            (resource) =>
                              !currentAssignments.some(
                                (assignment) => assignment.resourceId === resource.id,
                              ),
                          )
                          .map((resource) => (
                            <option key={resource.id} value={resource.id}>
                              {resource.name} — {resource.role}
                            </option>
                          ))}
                      </Select>
                    </Field>
                    <Field label="Alokasi (%)" htmlFor="assignment-percent">
                      <Input
                        id="assignment-percent"
                        type="number"
                        min={1}
                        max={100}
                        value={assignmentDraft.allocationPercent}
                        onChange={(event) =>
                          setAssignmentDraft((current) => ({
                            ...current,
                            allocationPercent: Number(event.target.value),
                          }))
                        }
                      />
                    </Field>
                    <div className="flex items-end">
                      <Button
                        variant="secondary"
                        disabled={!assignmentDraft.resourceId || busy}
                        onClick={() =>
                          runAction(async () => {
                            const success = await onAddAssignment(assignmentDraft);
                            if (success) setAssignmentDraft({ resourceId: '', allocationPercent: 100 });
                            return success;
                          })
                        }
                      >
                        Alokasikan
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </section>
          </>
        ) : null}
      </form>
    </Modal>
  );
}
