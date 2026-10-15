import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarDays, FolderKanban, Plus, Trash, TriangleAlert, Users } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import {
  DEFAULT_WEEKEND_DAYS,
  INDONESIAN_DAY_NAMES_FULL,
  isoDateSchema,
  type ProjectSummaryDto,
} from 'shared';
import { z } from 'zod';

import { AppShell } from '../components/layout/AppShell';
import { useActionFeedback, useToast } from '../components/ui/Toast';
import { Button, IconButton } from '../components/ui/Button';
import { Card, Chip, EmptyState, ProgressBar, Skeleton } from '../components/ui/Card';
import { Field, Input, Textarea, useFieldId } from '../components/ui/Input';
import { ConfirmDialog, Modal } from '../components/ui/Modal';
import { useProjectListActions } from '../api/mutations';
import { useProjects } from '../api/hooks';
import { formatDateRange, formatPercent, todayIso } from '../lib/format';

const projectFormSchema = z.object({
  name: z.string().trim().min(1, 'Nama proyek wajib diisi').max(120, 'Nama maksimal 120 karakter'),
  description: z.string().trim().max(2000, 'Deskripsi maksimal 2000 karakter'),
  startDate: isoDateSchema,
});

type ProjectFormValues = z.infer<typeof projectFormSchema>;

export function ProjectsPage() {
  const navigate = useNavigate();
  const projectsQuery = useProjects();
  const actions = useProjectListActions();
  const feedback = useActionFeedback();
  const toast = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [weekendDays, setWeekendDays] = useState<number[]>([...DEFAULT_WEEKEND_DAYS]);
  const [pendingDelete, setPendingDelete] = useState<ProjectSummaryDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const nameId = useFieldId('project-name');
  const descriptionId = useFieldId('project-description');
  const startId = useFieldId('project-start');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: { name: '', description: '', startDate: todayIso() },
  });

  const onSubmit = handleSubmit(async (values) => {
    const created = await feedback.run(
      () =>
        actions.createProject({
          name: values.name,
          description: values.description || null,
          startDate: values.startDate,
          weekendDays,
        }),
      { success: 'Proyek dibuat' },
    );
    if (created) {
      reset({ name: '', description: '', startDate: todayIso() });
      setWeekendDays([...DEFAULT_WEEKEND_DAYS]);
      setCreateOpen(false);
      navigate(`/projects/${created.id}/gantt`);
    }
  });

  const confirmDelete = async (): Promise<void> => {
    if (!pendingDelete) return;
    setDeleting(true);
    const result = await feedback.run(() => actions.deleteProject(pendingDelete.id), {
      success: `Proyek "${pendingDelete.name}" dihapus`,
    });
    setDeleting(false);
    if (result !== null) setPendingDelete(null);
  };

  const projects = projectsQuery.data ?? [];

  return (
    <AppShell>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1 text-ink">Proyek</h1>
          <p className="mt-1 text-body-sm text-ink-3">
            Setiap proyek punya kalender, tim, dan analisis jalur kritisnya sendiri.
          </p>
        </div>
        <Button
          variant="primary"
          icon={<Plus aria-hidden className="size-4" />}
          onClick={() => setCreateOpen(true)}
        >
          Buat proyek
        </Button>
      </header>

      {projectsQuery.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-48" />
          ))}
        </div>
      ) : projectsQuery.isError ? (
        <Card>
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-danger-bg text-danger">
              <TriangleAlert aria-hidden className="size-6" />
            </span>
            <p className="text-body text-ink-2">Gagal memuat daftar proyek.</p>
            <Button onClick={() => void projectsQuery.refetch()}>Coba lagi</Button>
          </div>
        </Card>
      ) : projects.length === 0 ? (
        <Card>
          <EmptyState
            icon={FolderKanban}
            title="Belum ada proyek"
            description="Buat proyek pertama Anda untuk mulai menyusun tugas, dependensi, dan jadwal tim."
            action={
              <Button variant="primary" onClick={() => setCreateOpen(true)}>
                Buat proyek
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <article
              key={project.id}
              className="flex flex-col justify-between rounded-lg border border-line bg-surface p-5 shadow-sm transition hover:shadow-md"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-h3 text-ink">
                    <Link
                      to={`/projects/${project.id}/gantt`}
                      className="hover:text-brand-700 focus-visible:underline"
                    >
                      {project.name}
                    </Link>
                  </h2>
                  <IconButton
                    label={`Hapus proyek ${project.name}`}
                    tone="danger"
                    onClick={() => setPendingDelete(project)}
                  >
                    <Trash aria-hidden className="size-4" />
                  </IconButton>
                </div>
                <p className="mt-1 line-clamp-2 text-body-sm text-ink-3">
                  {project.description || 'Tanpa deskripsi'}
                </p>

                <div className="mt-3 flex items-center gap-2 text-body-sm text-ink-2">
                  <CalendarDays aria-hidden className="size-4 text-ink-3" />
                  {formatDateRange(project.scheduledStart, project.scheduledEnd)}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Chip tone="brand">{project.taskCount} tugas</Chip>
                  <Chip icon={Users}>{project.resourceCount} anggota</Chip>
                  <Chip tone="neutral">{project.holidayCount} hari libur</Chip>
                </div>
              </div>

              <div className="mt-5">
                <div className="mb-3 flex items-center justify-between text-caption text-ink-3">
                  <span>Progres proyek</span>
                  <span className="tabular font-semibold text-ink-2">
                    {formatPercent(project.progress)}
                  </span>
                </div>
                <ProgressBar value={project.progress} label={`Progres ${project.name}`} />
                <div className="mt-4 flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate(`/projects/${project.id}/gantt`)}
                  >
                    Buka Gantt
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => navigate(`/projects/${project.id}/analysis`)}
                  >
                    Analisis
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Buat proyek"
        description="Tentukan nama dan kalender dasar. Hari kerja dipakai untuk menghitung durasi tugas."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={isSubmitting}>
              Batal
            </Button>
            <Button variant="primary" type="submit" form="project-form" loading={isSubmitting}>
              Simpan proyek
            </Button>
          </>
        }
      >
        <form id="project-form" onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Field label="Nama proyek" htmlFor={nameId} error={errors.name?.message} required>
            <Input
              id={nameId}
              invalid={Boolean(errors.name)}
              placeholder="Contoh: Pengembangan Aplikasi Mobile"
              {...register('name')}
            />
          </Field>

          <Field
            label="Deskripsi"
            htmlFor={descriptionId}
            error={errors.description?.message}
            hint="Opsional"
          >
            <Textarea
              id={descriptionId}
              invalid={Boolean(errors.description)}
              placeholder="Ringkasan singkat tujuan proyek"
              {...register('description')}
            />
          </Field>

          <Field
            label="Tanggal mulai proyek"
            htmlFor={startId}
            error={errors.startDate?.message}
            hint="Dipakai sebagai ordinal 0 pada perhitungan jalur kritis"
            required
          >
            <Input id={startId} type="date" invalid={Boolean(errors.startDate)} {...register('startDate')} />
          </Field>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-body-sm font-medium text-ink-2">Hari akhir pekan</legend>
            <div className="flex flex-wrap gap-2">
              {INDONESIAN_DAY_NAMES_FULL.map((dayName, index) => {
                const checked = weekendDays.includes(index);
                return (
                  <label
                    key={dayName}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-body-sm ${
                      checked ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-line text-ink-2'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-brand-600"
                      checked={checked}
                      onChange={(event) => {
                        setWeekendDays((current) => {
                          const next = event.target.checked
                            ? [...current, index]
                            : current.filter((day) => day !== index);
                          if (next.length === 0) {
                            toast.error('Pilih minimal satu hari sebagai akhir pekan.');
                            return current;
                          }
                          if (next.length === 7) {
                            toast.error('Semua hari tidak boleh menjadi akhir pekan.');
                            return current;
                          }
                          return next.sort((a, b) => a - b);
                        });
                      }}
                    />
                    {dayName}
                  </label>
                );
              })}
            </div>
          </fieldset>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Hapus proyek?"
        message={`Semua tugas, dependensi, anggota, dan hari libur pada "${pendingDelete?.name ?? ''}" akan ikut terhapus. Tindakan ini tidak bisa dibatalkan.`}
        confirmLabel="Hapus proyek"
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </AppShell>
  );
}
