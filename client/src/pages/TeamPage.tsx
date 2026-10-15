import { zodResolver } from '@hookform/resolvers/zod';
import { CircleDollarSign, Plus, TriangleAlert, Trash, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom';
import { resourceCreateSchema, type AnalysisResult, type ResourceDto } from 'shared';
import { z } from 'zod';

import { AppShell } from '../components/layout/AppShell';
import { Button, IconButton } from '../components/ui/Button';
import { Avatar, Card, CardHeader, Chip, EmptyState, ProgressBar, Skeleton } from '../components/ui/Card';
import { Field, Input, useFieldId } from '../components/ui/Input';
import { ConfirmDialog, Modal } from '../components/ui/Modal';
import { useActionFeedback } from '../components/ui/Toast';
import { useProjectActions, useProjectAnalysis, useProjectSnapshot } from '../api/hooks';
import { formatCurrency, formatCurrencyCompact, formatIsoDateShort, formatNumber } from '../lib/format';

const resourceFormSchema = z.object({
  name: resourceCreateSchema.shape.name,
  email: resourceCreateSchema.shape.email,
  role: resourceCreateSchema.shape.role,
  salary: z.coerce
    .number({ invalid_type_error: 'Gaji harus angka' })
    .int('Gaji harus bilangan bulat')
    .min(0, 'Gaji tidak boleh negatif')
    .max(1_000_000_000, 'Gaji terlalu besar'),
});

type ResourceFormValues = z.infer<typeof resourceFormSchema>;

export function TeamPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const snapshotQuery = useProjectSnapshot(projectId);
  const analysisQuery = useProjectAnalysis(projectId);
  const actions = useProjectActions(projectId ?? '');
  const feedback = useActionFeedback();

  const [dialog, setDialog] = useState<{ mode: 'create' | 'edit'; resource: ResourceDto | null } | null>(
    null,
  );
  const [pendingDelete, setPendingDelete] = useState<ResourceDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const nameId = useFieldId('resource-name');
  const emailId = useFieldId('resource-email');
  const roleId = useFieldId('resource-role');
  const salaryId = useFieldId('resource-salary');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ResourceFormValues>({
    resolver: zodResolver(resourceFormSchema),
    defaultValues: { name: '', email: '', role: '', salary: 0 },
  });

  const snapshot = snapshotQuery.data;
  const analysis = analysisQuery.data;
  const loadByResource = useMemo(
    () => new Map((analysis?.resourceLoads ?? []).map((load) => [load.resourceId, load])),
    [analysis],
  );
  const warningsByResource = useMemo(() => {
    const map = new Map<string, AnalysisResult['warnings']>();
    for (const warning of analysis?.warnings ?? []) {
      map.set(warning.resourceId, [...(map.get(warning.resourceId) ?? []), warning]);
    }
    return map;
  }, [analysis]);

  const openCreate = (): void => {
    reset({ name: '', email: '', role: '', salary: 0 });
    setDialog({ mode: 'create', resource: null });
  };

  const openEdit = (resource: ResourceDto): void => {
    reset({
      name: resource.name,
      email: resource.email,
      role: resource.role,
      salary: resource.salary,
    });
    setDialog({ mode: 'edit', resource });
  };

  const onSubmit = handleSubmit(async (values) => {
    const success = await feedback.run(
      () =>
        dialog?.mode === 'edit' && dialog.resource
          ? actions.updateResource(dialog.resource.id, values)
          : actions.createResource(values),
      { success: dialog?.mode === 'edit' ? 'Data anggota diperbarui' : 'Anggota ditambahkan' },
    );
    if (success === true) setDialog(null);
  });

  const confirmDelete = async (): Promise<void> => {
    if (!pendingDelete) return;
    setDeleting(true);
    const result = await feedback.run(() => actions.deleteResource(pendingDelete.id), {
      success: `Anggota "${pendingDelete.name}" dihapus`,
    });
    setDeleting(false);
    if (result === true) setPendingDelete(null);
  };

  return (
    <AppShell projectId={projectId}>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-caption font-semibold tracking-wide text-ink-3 uppercase">Tim</p>
          <h1 className="text-h1 text-ink">Anggota dan biaya</h1>
          <p className="mt-1 text-body-sm text-ink-3">
            Tarif harian = gaji bulanan ÷ 22 hari kerja. Peringatan muncul bila total alokasi melebihi 100%
            pada hari yang sama.
          </p>
        </div>
        <Button variant="primary" icon={<Plus aria-hidden className="size-4" />} onClick={openCreate}>
          Tambah anggota
        </Button>
      </header>

      {snapshotQuery.isPending ? (
        <Card className="p-4">
          {[1, 2, 3, 4].map((key) => (
            <Skeleton key={key} className="mb-2 h-12" />
          ))}
        </Card>
      ) : !snapshot ? (
        <Card>
          <div className="px-6 py-10 text-center">
            <p className="text-body text-ink-2">Data tim tidak bisa dimuat.</p>
            <Button className="mt-3" onClick={() => void snapshotQuery.refetch()}>
              Coba lagi
            </Button>
          </div>
        </Card>
      ) : snapshot.resources.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="Belum ada anggota tim"
            description="Tambahkan anggota dengan peran dan gaji bulanan, lalu alokasikan ke tugas lewat dialog tugas."
            action={
              <Button variant="primary" onClick={openCreate}>
                Tambah anggota
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {analysis && analysis.warnings.length > 0 ? (
            <Card className="border-warning/40 bg-warning-bg/60">
              <div className="flex items-start gap-3 px-5 py-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-warning-bg text-warning">
                  <TriangleAlert aria-hidden className="size-5" />
                </span>
                <div>
                  <h2 className="text-h3 text-ink">Peringatan over-alokasi</h2>
                  <ul className="mt-2 flex flex-col gap-1 text-body-sm text-ink-2">
                    {analysis.warnings.slice(0, 6).map((warning) => (
                      <li key={`${warning.resourceId}-${warning.date}`}>
                        <span className="font-semibold">{warning.resourceName}</span> teralokasi{' '}
                        {warning.totalPercent}% pada {formatIsoDateShort(warning.date)} (
                        {warning.taskNames.join(', ')})
                      </li>
                    ))}
                  </ul>
                  {analysis.warnings.length > 6 ? (
                    <p className="mt-2 text-caption text-ink-3">
                      dan {analysis.warnings.length - 6} peringatan lain.
                    </p>
                  ) : null}
                </div>
              </div>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              icon={Users}
              title="Anggota tim"
              description={`${snapshot.resources.length} anggota · total biaya ${formatCurrency(
                analysis?.summary.totalCost ?? 0,
              )}`}
            />
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">Daftar anggota tim beserta alokasi dan biayanya</caption>
                <thead>
                  <tr className="text-caption font-semibold tracking-wide text-ink-3 uppercase">
                    <th scope="col" className="px-5 py-2">
                      Nama
                    </th>
                    <th scope="col" className="px-5 py-2">
                      Peran
                    </th>
                    <th scope="col" className="px-5 py-2 text-right">
                      Gaji / bulan
                    </th>
                    <th scope="col" className="px-5 py-2 text-right">
                      Tarif harian
                    </th>
                    <th scope="col" className="px-5 py-2">
                      Tugas dialokasikan
                    </th>
                    <th scope="col" className="px-5 py-2 text-right">
                      Total biaya
                    </th>
                    <th scope="col" className="px-5 py-2">
                      Beban puncak
                    </th>
                    <th scope="col" className="px-5 py-2 text-right">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.resources.map((resource) => {
                    const load = loadByResource.get(resource.id);
                    const warnings = warningsByResource.get(resource.id) ?? [];
                    return (
                      <tr key={resource.id} className="border-t border-line align-top">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={resource.name} size={36} />
                            <div>
                              <p className="text-body-sm font-semibold text-ink">{resource.name}</p>
                              <p className="text-caption text-ink-3">{resource.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-body-sm text-ink-2">{resource.role}</td>
                        <td className="tabular px-5 py-3 text-right text-body-sm text-ink-2">
                          {formatCurrency(resource.salary)}
                        </td>
                        <td className="tabular px-5 py-3 text-right text-body-sm text-ink-2">
                          {formatCurrency(load?.dailyRate ?? resource.salary / 22)}
                        </td>
                        <td className="px-5 py-3">
                          {load && load.assignments.length > 0 ? (
                            <ul className="flex flex-col gap-1">
                              {load.assignments.map((assignment) => (
                                <li key={assignment.taskId} className="text-body-sm text-ink-2">
                                  {assignment.taskName}
                                  <span className="ml-2 text-caption text-ink-3">
                                    {assignment.allocationPercent}% · {formatCurrency(assignment.cost)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-body-sm text-ink-3">Belum ada alokasi</span>
                          )}
                        </td>
                        <td className="tabular px-5 py-3 text-right text-body-sm font-semibold text-ink">
                          {formatCurrency(load?.totalCost ?? 0)}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex min-w-40 flex-col gap-1">
                            <ProgressBar
                              value={Math.min(100, load?.peakPercent ?? 0)}
                              label={`Beban puncak ${resource.name}`}
                              tone={(load?.peakPercent ?? 0) > 100 ? 'danger' : 'brand'}
                            />
                            <span
                              className={`text-caption font-medium ${
                                warnings.length > 0 ? 'text-danger' : 'text-ink-3'
                              }`}
                            >
                              {warnings.length > 0
                                ? `Over-alokasi di ${warnings.length} hari`
                                : 'Beban aman'}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => openEdit(resource)}>
                              Ubah
                            </Button>
                            <IconButton
                              label={`Hapus ${resource.name}`}
                              tone="danger"
                              onClick={() => setPendingDelete(resource)}
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
            </div>
          </Card>

          {analysis ? (
            <Card>
              <CardHeader
                icon={CircleDollarSign}
                title="Biaya per tugas"
                description="Hanya tugas daun yang dihitung; total mengikuti durasi dan persentase alokasi."
                action={
                  <Chip tone="brand">{formatCurrencyCompact(analysis.summary.totalCost)}</Chip>
                }
              />
              <ul className="divide-y divide-line">
                {analysis.cost.tasks.map((taskCost) => (
                  <li key={taskCost.taskId} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                    <div>
                      <p className="text-body-sm font-medium text-ink">{taskCost.taskName}</p>
                      <p className="text-caption text-ink-3">
                        {formatNumber(taskCost.durationDays)} hari kerja ·{' '}
                        {taskCost.lines.length === 0
                          ? 'tanpa alokasi'
                          : taskCost.lines
                              .map(
                                (line) =>
                                  `${line.resourceName} ${line.allocationPercent}%`,
                              )
                              .join(' · ')}
                      </p>
                    </div>
                    <span className="tabular text-body-sm font-semibold text-ink">
                      {formatCurrency(taskCost.total)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      )}

      <Modal
        open={Boolean(dialog)}
        onClose={() => setDialog(null)}
        title={dialog?.mode === 'edit' ? 'Ubah anggota' : 'Tambah anggota'}
        description="Gaji dipakai untuk menghitung tarif harian dan biaya tugas."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)} disabled={isSubmitting}>
              Batal
            </Button>
            <Button variant="primary" type="submit" form="resource-form" loading={isSubmitting}>
              {dialog?.mode === 'edit' ? 'Simpan perubahan' : 'Simpan anggota'}
            </Button>
          </>
        }
      >
        <form id="resource-form" onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Field label="Nama" htmlFor={nameId} error={errors.name?.message} required>
            <Input id={nameId} invalid={Boolean(errors.name)} {...register('name')} />
          </Field>
          <Field label="Email" htmlFor={emailId} error={errors.email?.message} required>
            <Input id={emailId} type="email" invalid={Boolean(errors.email)} {...register('email')} />
          </Field>
          <Field label="Peran" htmlFor={roleId} error={errors.role?.message} required>
            <Input
              id={roleId}
              invalid={Boolean(errors.role)}
              placeholder="Contoh: Backend Developer"
              {...register('role')}
            />
          </Field>
          <Field
            label="Gaji per bulan (Rp)"
            htmlFor={salaryId}
            error={errors.salary?.message}
            hint="Masukkan angka penuh, contoh 12000000"
            required
          >
            <Input
              id={salaryId}
              type="number"
              min={0}
              step={100000}
              invalid={Boolean(errors.salary)}
              {...register('salary', { valueAsNumber: true })}
            />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Hapus anggota?"
        message={`"${pendingDelete?.name ?? ''}" akan dihapus dan semua alokasinya pada tugas dilepas.`}
        confirmLabel="Hapus anggota"
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </AppShell>
  );
}
