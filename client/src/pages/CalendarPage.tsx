import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Trash } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom';
import {
  INDONESIAN_DAY_NAMES_FULL,
  INDONESIAN_DAY_NAMES_SHORT,
  addDays,
  calendarFromProject,
  holidayCreateSchema,
  isoDateSchema,
  parseIsoDate,
  toIsoDate,
} from 'shared';
import { z } from 'zod';

import { AppShell } from '../components/layout/AppShell';
import { Button, IconButton } from '../components/ui/Button';
import { Card, CardHeader, Chip, EmptyState, Skeleton } from '../components/ui/Card';
import { Field, Input, useFieldId } from '../components/ui/Input';
import { ConfirmDialog } from '../components/ui/Modal';
import { useActionFeedback, useToast } from '../components/ui/Toast';
import { useProjectActions, useProjectSnapshot } from '../api/hooks';
import { formatIsoDateLong, formatIsoDateShort, formatMonthYear } from '../lib/format';

const holidayFormSchema = holidayCreateSchema.pick({ name: true }).extend({ date: isoDateSchema });
type HolidayFormValues = z.infer<typeof holidayFormSchema>;

export function CalendarPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const snapshotQuery = useProjectSnapshot(projectId);
  const actions = useProjectActions(projectId ?? '');
  const feedback = useActionFeedback();
  const toast = useToast();

  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [monthStartIso, setMonthStartIso] = useState(() => `${new Date().toISOString().slice(0, 7)}-01`);

  const dateId = useFieldId('holiday-date');
  const holidayNameId = useFieldId('holiday-name');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<HolidayFormValues>({
    resolver: zodResolver(holidayFormSchema),
    defaultValues: { date: '', name: '' },
  });

  const snapshot = snapshotQuery.data;
  const calendar = useMemo(
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

  const monthStart = useMemo(() => parseIsoDate(monthStartIso), [monthStartIso]);
  const monthKey = monthStartIso.slice(0, 7);

  /** Enam minggu penuh (42 sel) dimulai dari hari Senin. */
  const monthDays = useMemo(() => {
    if (!calendar) return [];
    const gridStart = addDays(monthStart, -((monthStart.getUTCDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index)).map((date) => {
      const iso = toIsoDate(date);
      const isWeekend = calendar.weekendDays.has(date.getUTCDay());
      const isHoliday = holidaySet.has(iso);
      return {
        iso,
        dayNumber: date.getUTCDate(),
        isCurrentMonth: iso.slice(0, 7) === monthKey,
        isWorking: !isWeekend && !isHoliday,
        isHoliday,
        isWeekend,
      };
    });
  }, [calendar, holidaySet, monthKey, monthStart]);

  const shiftMonth = (delta: number): void => {
    setMonthStartIso(
      toIsoDate(
        new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + delta, 1)),
      ),
    );
  };

  const toggleWeekend = async (day: number, checked: boolean): Promise<void> => {
    if (!snapshot) return;
    const current = snapshot.project.weekendDays;
    const next = checked
      ? [...current, day].sort((a, b) => a - b)
      : current.filter((candidate) => candidate !== day);

    if (next.length === 0) {
      toast.error('Pilih minimal satu hari sebagai akhir pekan.');
      return;
    }
    if (next.length === 7) {
      toast.error('Semua hari tidak boleh menjadi akhir pekan.');
      return;
    }

    await feedback.run(() => actions.updateCalendar(next), { success: 'Jadwal diperbarui' });
  };

  const onSubmit = handleSubmit(async (values) => {
    const success = await feedback.run(
      () => actions.createHoliday({ date: values.date ?? '', name: values.name }),
      { success: 'Hari libur ditambahkan, jadwal diperbarui' },
    );
    if (success === true) reset({ date: '', name: '' });
  });

  const confirmDelete = async (): Promise<void> => {
    if (!pendingDelete) return;
    setDeleting(true);
    const result = await feedback.run(() => actions.deleteHoliday(pendingDelete.id), {
      success: 'Hari libur dihapus, jadwal diperbarui',
    });
    setDeleting(false);
    if (result === true) setPendingDelete(null);
  };


  return (
    <AppShell projectId={projectId}>
      <header className="mb-5">
        <p className="text-caption font-semibold tracking-wide text-ink-3 uppercase">Kalender</p>
        <h1 className="text-h1 text-ink">Kalender dan hari libur</h1>
        <p className="mt-1 text-body-sm text-ink-3">
          Durasi tugas hanya menghitung hari kerja. Mengubah akhir pekan atau menambah hari libur langsung
          menggeser seluruh jadwal.
        </p>
      </header>

      {snapshotQuery.isPending ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      ) : !snapshot || !calendar ? (
        <Card>
          <div className="px-6 py-10 text-center">
            <p className="text-body text-ink-2">Kalender tidak bisa dimuat.</p>
            <Button className="mt-3" onClick={() => void snapshotQuery.refetch()}>
              Coba lagi
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              icon={CalendarDays}
              title="Hari kerja mingguan"
              description="Hari yang ditandai tidak dihitung sebagai hari kerja."
              action={<Chip tone="brand">{snapshot.project.weekendDays.length} hari akhir pekan</Chip>}
            />
            <div className="flex flex-wrap gap-2 px-5 py-4">
              {INDONESIAN_DAY_NAMES_FULL.map((dayName, index) => {
                const checked = snapshot.project.weekendDays.includes(index);
                return (
                  <label
                    key={dayName}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-body-sm ${
                      checked ? 'border-danger/30 bg-danger-bg text-danger' : 'border-line text-ink-2'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-brand-600"
                      checked={checked}
                      onChange={(event) => void toggleWeekend(index, event.target.checked)}
                    />
                    {dayName}
                  </label>
                );
              })}
            </div>

            <div className="border-t border-line px-5 py-4">
              <h3 className="text-body-sm font-semibold text-ink">Kalender bulanan</h3>
              <div className="mt-3 flex items-center justify-between gap-2">
                <IconButton label="Bulan sebelumnya" onClick={() => shiftMonth(-1)}>
                  <ChevronLeft aria-hidden className="size-4" />
                </IconButton>
                <span className="text-body-sm font-semibold text-ink">
                  {formatMonthYear(monthStart)}
                </span>
                <IconButton label="Bulan berikutnya" onClick={() => shiftMonth(1)}>
                  <ChevronRight aria-hidden className="size-4" />
                </IconButton>
              </div>

              <div className="mt-3 grid grid-cols-7 gap-1 text-center">
                {INDONESIAN_DAY_NAMES_SHORT.map((dayName) => (
                  <span key={dayName} className="text-caption font-semibold text-ink-3">
                    {dayName}
                  </span>
                ))}
                {monthDays.map((day) => (
                  <span
                    key={day.iso}
                    title={
                      day.isHoliday
                        ? `${formatIsoDateShort(day.iso)} · hari libur`
                        : day.isWeekend
                          ? `${formatIsoDateShort(day.iso)} · akhir pekan`
                          : formatIsoDateShort(day.iso)
                    }
                    className={`tabular grid h-9 place-items-center rounded-sm text-body-sm ${
                      !day.isCurrentMonth
                        ? 'text-ink-3/50'
                        : day.isHoliday
                          ? 'bg-warning-bg font-semibold text-warning'
                          : day.isWeekend
                            ? 'bg-surface-2 text-ink-3'
                            : 'text-ink-2'
                    }`}
                  >
                    {day.dayNumber}
                  </span>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              icon={CalendarPlus}
              title="Hari libur khusus"
              description="Tanggal ini dilewati saat menghitung durasi tugas."
              action={<Chip tone="neutral">{snapshot.holidays.length} hari libur</Chip>}
            />
            <form onSubmit={onSubmit} className="flex flex-col gap-3 border-b border-line px-5 py-4" noValidate>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Tanggal" htmlFor={dateId} error={errors.date?.message} required>
                  <Input
                    id={dateId}
                    type="date"
                    invalid={Boolean(errors.date)}
                    {...register('date')}
                  />
                </Field>
                <Field label="Nama hari libur" htmlFor={holidayNameId} error={errors.name?.message} required>
                  <Input
                    id={holidayNameId}
                    invalid={Boolean(errors.name)}
                    placeholder="Contoh: Hari Raya Natal"
                    {...register('name')}
                  />
                </Field>
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  loading={isSubmitting}
                  icon={<CalendarPlus aria-hidden className="size-4" />}
                >
                  Tambah hari libur
                </Button>
              </div>
            </form>

            {snapshot.holidays.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="Belum ada hari libur"
                description="Tambahkan cuti bersama atau hari besar agar jadwal tidak dihitung pada tanggal tersebut."
              />
            ) : (
              <ul className="divide-y divide-line">
                {snapshot.holidays.map((holiday) => (
                  <li key={holiday.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="text-body-sm font-medium text-ink">{holiday.name}</p>
                      <p className="text-caption text-ink-3">{formatIsoDateLong(holiday.date)}</p>
                    </div>
                    <IconButton
                      label={`Hapus hari libur ${holiday.name}`}
                      tone="danger"
                      onClick={() => setPendingDelete({ id: holiday.id, name: holiday.name })}
                    >
                      <Trash aria-hidden className="size-4" />
                    </IconButton>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Hapus hari libur?"
        message={`"${pendingDelete?.name ?? ''}" tidak lagi dilewati saat menghitung durasi tugas.`}
        confirmLabel="Hapus hari libur"
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </AppShell>
  );
}
