/**
 * Data contoh (Bagian 9) yang menjadi satu sumber kebenaran untuk seed database
 * dan test komponen client.
 */

import type { DependencyType, Priority } from './types.js';

export interface FixtureUser {
  name: string;
  email: string;
  password: string;
}

export interface FixtureResource {
  key: string;
  name: string;
  email: string;
  role: string;
  salary: number;
}

export interface FixtureAssignment {
  resourceKey: string;
  allocationPercent: number;
}

export interface FixtureDependency {
  predecessorKey: string;
  type: DependencyType;
  lagDays: number;
}

export interface FixtureTask {
  key: string;
  name: string;
  parentKey: string | null;
  durationDays: number;
  priority: Priority;
  color: string;
  progress: number;
  optimisticDays?: number;
  pessimisticDays?: number;
  assignments: FixtureAssignment[];
  dependencies: FixtureDependency[];
}

export interface DemoProjectFixture {
  user: FixtureUser;
  project: {
    name: string;
    description: string;
    startDate: string;
    weekendDays: number[];
  };
  holidays: Array<{ date: string; name: string }>;
  resources: FixtureResource[];
  tasks: FixtureTask[];
}

export const DEMO_USER: FixtureUser = {
  name: 'Pengguna Demo',
  email: 'demo@example.com',
  password: 'Demo12345',
};

/** Warna per kelompok tugas supaya mudah dibedakan di Gantt. */
const GROUP_COLORS = {
  planning: '#4F46E5',
  design: '#7C3AED',
  development: '#2563EB',
  testing: '#D97706',
  launch: '#059669',
} as const;

export const demoProjectFixture: DemoProjectFixture = {
  user: DEMO_USER,
  project: {
    name: 'Pengembangan Aplikasi Mobile Toko Online',
    description:
      'Proyek contoh: membangun aplikasi mobile toko online dari perencanaan sampai peluncuran.',
    startDate: '2026-10-19',
    weekendDays: [0, 6],
  },
  holidays: [
    { date: '2026-11-11', name: 'Libur internal (contoh)' },
    { date: '2026-12-25', name: 'Hari Raya Natal' },
  ],
  resources: [
    {
      key: 'andi',
      name: 'Andi Pratama',
      email: 'andi.pratama@example.com',
      role: 'Project Manager',
      salary: 15_000_000,
    },
    {
      key: 'budi',
      name: 'Budi Santoso',
      email: 'budi.santoso@example.com',
      role: 'Backend Developer',
      salary: 12_000_000,
    },
    {
      key: 'citra',
      name: 'Citra Lestari',
      email: 'citra.lestari@example.com',
      role: 'UI/UX Designer',
      salary: 10_000_000,
    },
    {
      key: 'dewi',
      name: 'Dewi Anggraini',
      email: 'dewi.anggraini@example.com',
      role: 'QA Engineer',
      salary: 9_000_000,
    },
  ],
  tasks: [
    {
      key: '1',
      name: 'Perencanaan',
      parentKey: null,
      durationDays: 1,
      priority: 'HIGH',
      color: GROUP_COLORS.planning,
      progress: 0,
      assignments: [],
      dependencies: [],
    },
    {
      key: '1.1',
      name: 'Kickoff dan kebutuhan',
      parentKey: '1',
      durationDays: 3,
      priority: 'HIGH',
      color: GROUP_COLORS.planning,
      progress: 100,
      assignments: [{ resourceKey: 'andi', allocationPercent: 100 }],
      dependencies: [],
    },
    {
      key: '1.2',
      name: 'Penyusunan spesifikasi',
      parentKey: '1',
      durationDays: 4,
      priority: 'HIGH',
      color: GROUP_COLORS.planning,
      progress: 60,
      assignments: [{ resourceKey: 'andi', allocationPercent: 100 }],
      dependencies: [{ predecessorKey: '1.1', type: 'FS', lagDays: 0 }],
    },
    {
      key: '2',
      name: 'Desain',
      parentKey: null,
      durationDays: 1,
      priority: 'MEDIUM',
      color: GROUP_COLORS.design,
      progress: 0,
      assignments: [],
      dependencies: [],
    },
    {
      key: '2.1',
      name: 'Riset dan wireframe',
      parentKey: '2',
      durationDays: 5,
      priority: 'MEDIUM',
      color: GROUP_COLORS.design,
      progress: 40,
      assignments: [{ resourceKey: 'citra', allocationPercent: 100 }],
      dependencies: [{ predecessorKey: '1.2', type: 'SS', lagDays: 2 }],
    },
    {
      key: '2.2',
      name: 'Desain UI high-fidelity',
      parentKey: '2',
      durationDays: 6,
      priority: 'MEDIUM',
      color: GROUP_COLORS.design,
      progress: 0,
      assignments: [{ resourceKey: 'citra', allocationPercent: 100 }],
      dependencies: [{ predecessorKey: '2.1', type: 'FS', lagDays: 0 }],
    },
    {
      key: '3',
      name: 'Pengembangan',
      parentKey: null,
      durationDays: 1,
      priority: 'HIGH',
      color: GROUP_COLORS.development,
      progress: 0,
      assignments: [],
      dependencies: [],
    },
    {
      key: '3.1',
      name: 'Rancang database dan API',
      parentKey: '3',
      durationDays: 5,
      priority: 'HIGH',
      color: GROUP_COLORS.development,
      progress: 20,
      assignments: [{ resourceKey: 'budi', allocationPercent: 100 }],
      dependencies: [{ predecessorKey: '1.2', type: 'FS', lagDays: 0 }],
    },
    {
      key: '3.2',
      name: 'Implementasi backend',
      parentKey: '3',
      durationDays: 10,
      priority: 'HIGH',
      color: GROUP_COLORS.development,
      progress: 0,
      optimisticDays: 8,
      pessimisticDays: 15,
      assignments: [{ resourceKey: 'budi', allocationPercent: 100 }],
      dependencies: [{ predecessorKey: '3.1', type: 'FS', lagDays: 0 }],
    },
    {
      key: '3.3',
      name: 'Implementasi frontend mobile',
      parentKey: '3',
      durationDays: 12,
      priority: 'HIGH',
      color: GROUP_COLORS.development,
      progress: 0,
      assignments: [
        { resourceKey: 'budi', allocationPercent: 50 },
        { resourceKey: 'citra', allocationPercent: 50 },
      ],
      dependencies: [
        { predecessorKey: '2.2', type: 'FS', lagDays: 0 },
        { predecessorKey: '3.2', type: 'SS', lagDays: 3 },
      ],
    },
    {
      key: '4',
      name: 'Pengujian',
      parentKey: null,
      durationDays: 1,
      priority: 'MEDIUM',
      color: GROUP_COLORS.testing,
      progress: 0,
      assignments: [],
      dependencies: [],
    },
    {
      key: '4.1',
      name: 'Skenario uji',
      parentKey: '4',
      durationDays: 3,
      priority: 'MEDIUM',
      color: GROUP_COLORS.testing,
      progress: 0,
      assignments: [{ resourceKey: 'dewi', allocationPercent: 100 }],
      dependencies: [{ predecessorKey: '3.2', type: 'SS', lagDays: 4 }],
    },
    {
      key: '4.2',
      name: 'Integrasi dan uji sistem',
      parentKey: '4',
      durationDays: 6,
      priority: 'HIGH',
      color: GROUP_COLORS.testing,
      progress: 0,
      assignments: [{ resourceKey: 'dewi', allocationPercent: 100 }],
      dependencies: [
        { predecessorKey: '3.2', type: 'FS', lagDays: 0 },
        { predecessorKey: '3.3', type: 'FS', lagDays: 0 },
      ],
    },
    {
      key: '4.3',
      name: 'Perbaikan bug',
      parentKey: '4',
      durationDays: 4,
      priority: 'MEDIUM',
      color: GROUP_COLORS.testing,
      progress: 0,
      assignments: [{ resourceKey: 'budi', allocationPercent: 100 }],
      dependencies: [{ predecessorKey: '4.2', type: 'FS', lagDays: 0 }],
    },
    {
      key: '5',
      name: 'Peluncuran',
      parentKey: null,
      durationDays: 1,
      priority: 'MEDIUM',
      color: GROUP_COLORS.launch,
      progress: 0,
      assignments: [],
      dependencies: [],
    },
    {
      key: '5.1',
      name: 'Persiapan rilis',
      parentKey: '5',
      durationDays: 2,
      priority: 'MEDIUM',
      color: GROUP_COLORS.launch,
      progress: 0,
      assignments: [{ resourceKey: 'andi', allocationPercent: 100 }],
      dependencies: [{ predecessorKey: '4.3', type: 'FS', lagDays: 1 }],
    },
    {
      key: '5.2',
      name: 'Rilis dan serah terima',
      parentKey: '5',
      durationDays: 1,
      priority: 'HIGH',
      color: GROUP_COLORS.launch,
      progress: 0,
      assignments: [{ resourceKey: 'andi', allocationPercent: 100 }],
      dependencies: [{ predecessorKey: '5.1', type: 'FS', lagDays: 0 }],
    },
  ],
};
