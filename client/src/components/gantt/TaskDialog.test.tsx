import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TaskDialog, type TaskDialogProps } from './TaskDialog';

function setup(overrides: Partial<TaskDialogProps> = {}) {
  const onSubmit = vi.fn(async () => true);
  const onClose = vi.fn();
  const props: TaskDialogProps = {
    open: true,
    mode: 'create',
    task: null,
    parentId: null,
    projectStartDate: '2026-10-19',
    tasks: [],
    resources: [],
    assignments: [],
    dependencies: [],
    onClose,
    onSubmit,
    onAddDependency: vi.fn(async () => true),
    onUpdateDependency: vi.fn(async () => true),
    onDeleteDependency: vi.fn(async () => true),
    onAddAssignment: vi.fn(async () => true),
    onUpdateAssignment: vi.fn(async () => true),
    onDeleteAssignment: vi.fn(async () => true),
    ...overrides,
  };
  render(<TaskDialog {...props} />);
  return { onSubmit, onClose };
}

/** Mengumpulkan teks pesan validasi yang sedang tampil. */
function alertTexts(): string {
  return Array.from(document.querySelectorAll('[role="alert"]'))
    .map((node) => node.textContent ?? '')
    .join(' | ');
}

describe('TaskDialog', () => {
  it('menampilkan pesan kesalahan saat nama tugas kosong', async () => {
    const { onSubmit } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Simpan tugas' }));

    await waitFor(() => {
      expect(alertTexts()).toContain('Nama tugas wajib diisi');
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('menolak durasi kurang dari satu hari kerja', async () => {
    const { onSubmit } = setup();

    fireEvent.change(screen.getByLabelText(/Nama tugas/), { target: { value: 'Tugas uji' } });
    fireEvent.change(screen.getByLabelText(/Durasi \(hari kerja\)/), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simpan tugas' }));

    await waitFor(() => {
      expect(alertTexts()).toContain('Durasi minimal 1 hari kerja');
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('mengirim nilai terformat saat form valid', async () => {
    const { onSubmit, onClose } = setup();

    fireEvent.change(screen.getByLabelText(/Nama tugas/), { target: { value: 'Riset pengguna' } });
    fireEvent.change(screen.getByLabelText(/Durasi \(hari kerja\)/), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText(/Mulai paling awal/), {
      target: { value: '2026-10-23' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Simpan tugas' }));

    await waitFor(() => {
      if (onSubmit.mock.calls.length === 0) {
        throw new Error(`Form belum terkirim. Pesan validasi: ${alertTexts() || '(tidak ada)'}`);
      }
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Riset pengguna',
        durationDays: 3,
        startDate: '2026-10-23',
        priority: 'MEDIUM',
        progress: 0,
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('menonaktifkan kolom yang dihitung otomatis pada tugas induk', () => {
    setup({
      mode: 'edit',
      task: {
        id: 'parent',
        projectId: 'project-demo',
        parentId: null,
        position: 0,
        name: 'Perencanaan',
        description: null,
        durationDays: 7,
        startDate: '2026-10-19',
        scheduledStart: '2026-10-19',
        scheduledEnd: '2026-10-27',
        priority: 'HIGH',
        color: '#4F46E5',
        progress: 50,
        optimisticDays: null,
        pessimisticDays: null,
      },
      tasks: [
        {
          id: 'parent',
          projectId: 'project-demo',
          parentId: null,
          position: 0,
          name: 'Perencanaan',
          description: null,
          durationDays: 7,
          startDate: '2026-10-19',
          scheduledStart: '2026-10-19',
          scheduledEnd: '2026-10-27',
          priority: 'HIGH',
          color: '#4F46E5',
          progress: 50,
          optimisticDays: null,
          pessimisticDays: null,
        },
        {
          id: 'child',
          projectId: 'project-demo',
          parentId: 'parent',
          position: 0,
          name: 'Kickoff',
          description: null,
          durationDays: 3,
          startDate: '2026-10-19',
          scheduledStart: '2026-10-19',
          scheduledEnd: '2026-10-21',
          priority: 'HIGH',
          color: '#4F46E5',
          progress: 100,
          optimisticDays: null,
          pessimisticDays: null,
        },
      ],
    });

    const duration = screen.getByLabelText(/Durasi \(hari kerja\)/) as HTMLInputElement;
    const progress = screen.getByLabelText(/Progres \(%\)/) as HTMLInputElement;
    expect(duration.disabled).toBe(true);
    expect(progress.disabled).toBe(true);
    expect(
      screen.getByText('Tugas induk tidak bisa punya dependensi. Ubah dependensinya pada sub-tugas.'),
    ).toBeTruthy();
  });
});
