/**
 * Tipe domain bersama untuk server dan client.
 *
 * Tanggal selalu berupa string ISO `YYYY-MM-DD` (tanggal UTC murni, tanpa zona
 * waktu) supaya tidak ada pergeseran satu hari.
 */

export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const DEPENDENCY_TYPES = ['FS', 'SS'] as const;
export type DependencyType = (typeof DEPENDENCY_TYPES)[number];

/** 0 = Minggu ... 6 = Sabtu. Default akhir pekan: Sabtu dan Minggu. */
export const DEFAULT_WEEKEND_DAYS: readonly number[] = [0, 6];

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: 'Rendah',
  MEDIUM: 'Sedang',
  HIGH: 'Tinggi',
};

export const DEPENDENCY_TYPE_LABELS: Record<DependencyType, string> = {
  FS: 'Finish-to-Start',
  SS: 'Start-to-Start',
};

/** Ringkasan proyek untuk halaman daftar proyek. */
export interface ProjectSummaryDto extends ProjectDto {
  taskCount: number;
  resourceCount: number;
  holidayCount: number;
  /** Progres proyek (rata-rata berbobot durasi dari tugas level teratas). */
  progress: number;
  scheduledStart: string | null;
  scheduledEnd: string | null;
}

export interface UserDto {
  id: string;
  name: string;
  email: string;
}

export interface ProjectDto {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  startDate: string;
  weekendDays: number[];
  createdAt: string;
}

export interface TaskDto {
  id: string;
  projectId: string;
  parentId: string | null;
  position: number;
  name: string;
  description: string | null;
  /** Durasi hari kerja (>= 1). Untuk tugas induk dihitung otomatis. */
  durationDays: number;
  /** Batas "mulai paling awal" yang diisi pengguna. */
  startDate: string;
  scheduledStart: string;
  scheduledEnd: string;
  priority: Priority;
  color: string;
  progress: number;
  optimisticDays: number | null;
  pessimisticDays: number | null;
}

export interface DependencyDto {
  id: string;
  predecessorId: string;
  successorId: string;
  type: DependencyType;
  lagDays: number;
}

export interface ResourceDto {
  id: string;
  projectId: string;
  name: string;
  email: string;
  role: string;
  /** Gaji per bulan dalam rupiah. */
  salary: number;
}

export interface AssignmentDto {
  id: string;
  taskId: string;
  resourceId: string;
  allocationPercent: number;
}

export interface HolidayDto {
  id: string;
  projectId: string;
  date: string;
  name: string;
}

/** Snapshot lengkap satu proyek (respons GET /projects/:id). */
export interface ProjectSnapshot {
  project: ProjectDto;
  tasks: TaskDto[];
  dependencies: DependencyDto[];
  resources: ResourceDto[];
  assignments: AssignmentDto[];
  holidays: HolidayDto[];
}

export interface AuthResponse {
  token: string;
  user: UserDto;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/** Daftar warna yang ditawarkan pada form tugas (hex). */
export const TASK_COLORS: readonly string[] = [
  '#4F46E5',
  '#7C3AED',
  '#2563EB',
  '#0891B2',
  '#059669',
  '#65A30D',
  '#D97706',
  '#DC2626',
  '#DB2777',
  '#475569',
];

/** Mengubah `weekendDays` yang tersimpan sebagai string "0,6" menjadi number[]. */
export function parseWeekendDays(value: string): number[] {
  return value
    .split(',')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    .sort((a, b) => a - b);
}

/** Mengubah number[] menjadi bentuk string yang disimpan di database. */
export function formatWeekendDays(days: readonly number[]): string {
  return [...days].sort((a, b) => a - b).join(',');
}
