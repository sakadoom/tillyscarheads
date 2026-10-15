/**
 * Skema validasi zod (dipakai server untuk semua input dan client untuk form,
 * supaya pesan error konsisten).
 */

import { z } from 'zod';
import { isValidIsoDate } from './dates.js';
import { DEPENDENCY_TYPES, PRIORITIES } from './types.js';

export const isoDateSchema = z
  .string()
  .trim()
  .refine((value) => isValidIsoDate(value), { message: 'Tanggal harus format YYYY-MM-DD' });

export const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, { message: 'Warna harus format hex, contoh #2563EB' });

export const prioritySchema = z.enum(PRIORITIES, {
  errorMap: () => ({ message: 'Prioritas harus LOW, MEDIUM, atau HIGH' }),
});

export const dependencyTypeSchema = z.enum(DEPENDENCY_TYPES, {
  errorMap: () => ({ message: 'Tipe dependensi harus FS atau SS' }),
});

export const weekendDaysSchema = z
  .array(z.number().int().min(0).max(6))
  .min(1, { message: 'Pilih minimal satu hari sebagai akhir pekan' })
  .refine((days) => new Set(days).size < 7, {
    message: 'Semua hari tidak boleh ditandai sebagai akhir pekan',
  });

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(80, 'Nama maksimal 80 karakter'),
  email: z.string().trim().toLowerCase().email('Email tidak valid'),
  password: z.string().min(8, 'Password minimal 8 karakter').max(72, 'Password maksimal 72 karakter'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
});

export const projectCreateSchema = z.object({
  name: z.string().trim().min(1, 'Nama proyek wajib diisi').max(120),
  description: z.string().trim().max(2000).nullish(),
  startDate: isoDateSchema,
  weekendDays: weekendDaysSchema.optional(),
});

export const projectUpdateSchema = z
  .object({
    name: z.string().trim().min(1, 'Nama proyek wajib diisi').max(120),
    description: z.string().trim().max(2000).nullish(),
    startDate: isoDateSchema,
    weekendDays: weekendDaysSchema,
  })
  .partial();

export const taskCreateSchema = z.object({
  parentId: z.string().min(1).nullish(),
  name: z.string().trim().min(1, 'Nama tugas wajib diisi').max(160),
  description: z.string().trim().max(2000).nullish(),
  durationDays: z.coerce
    .number()
    .int('Durasi harus bilangan bulat')
    .min(1, 'Durasi minimal 1 hari kerja')
    .max(3650)
    .optional(),
  startDate: isoDateSchema.optional(),
  priority: prioritySchema.optional(),
  color: hexColorSchema.optional(),
  progress: z.coerce.number().int().min(0).max(100).optional(),
  optimisticDays: z.coerce.number().int().min(1).max(3650).nullish(),
  pessimisticDays: z.coerce.number().int().min(1).max(3650).nullish(),
});

// Memindahkan tugas ke induk lain memakai POST /tasks/:id/move, bukan PATCH ini.
export const taskUpdateSchema = taskCreateSchema.omit({ parentId: true }).partial();

export const taskMoveSchema = z.object({
  parentId: z.string().min(1).nullish(),
  position: z.coerce.number().int().min(0, 'Posisi tidak boleh negatif'),
});

export const dependencyCreateSchema = z.object({
  predecessorId: z.string().min(1, 'Tugas predecessor wajib dipilih'),
  type: dependencyTypeSchema.default('FS'),
  lagDays: z.coerce
    .number()
    .int('Jeda (lag) harus bilangan bulat')
    .min(-365, 'Jeda minimal -365 hari')
    .max(365, 'Jeda maksimal 365 hari')
    .default(0),
});

export const dependencyUpdateSchema = z.object({
  type: dependencyTypeSchema.optional(),
  lagDays: z.coerce.number().int().min(-365).max(365).optional(),
});

export const resourceCreateSchema = z.object({
  name: z.string().trim().min(1, 'Nama anggota wajib diisi').max(120),
  email: z.string().trim().toLowerCase().email('Email tidak valid'),
  role: z.string().trim().min(1, 'Peran wajib diisi').max(80),
  salary: z.coerce
    .number()
    .int('Gaji harus bilangan bulat')
    .min(0, 'Gaji tidak boleh negatif')
    .max(1_000_000_000),
});

export const resourceUpdateSchema = resourceCreateSchema.partial();

export const assignmentCreateSchema = z.object({
  resourceId: z.string().min(1, 'Anggota wajib dipilih'),
  allocationPercent: z.coerce
    .number()
    .int('Alokasi harus bilangan bulat')
    .min(1, 'Alokasi minimal 1%')
    .max(100, 'Alokasi maksimal 100%')
    .default(100),
});

export const assignmentUpdateSchema = z.object({
  allocationPercent: z.coerce
    .number()
    .int('Alokasi harus bilangan bulat')
    .min(1, 'Alokasi minimal 1%')
    .max(100, 'Alokasi maksimal 100%'),
});

export const calendarUpdateSchema = z.object({
  weekendDays: weekendDaysSchema,
});

export const holidayCreateSchema = z.object({
  date: isoDateSchema,
  name: z.string().trim().min(1, 'Nama hari libur wajib diisi').max(120),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
export type TaskMoveInput = z.infer<typeof taskMoveSchema>;
export type DependencyCreateInput = z.infer<typeof dependencyCreateSchema>;
export type DependencyUpdateInput = z.infer<typeof dependencyUpdateSchema>;
export type ResourceCreateInput = z.infer<typeof resourceCreateSchema>;
export type ResourceUpdateInput = z.infer<typeof resourceUpdateSchema>;
export type AssignmentCreateInput = z.infer<typeof assignmentCreateSchema>;
export type AssignmentUpdateInput = z.infer<typeof assignmentUpdateSchema>;
export type CalendarUpdateInput = z.infer<typeof calendarUpdateSchema>;
export type HolidayCreateInput = z.infer<typeof holidayCreateSchema>;
