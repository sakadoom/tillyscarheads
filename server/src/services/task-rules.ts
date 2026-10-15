import { MAX_DEPTH, getTaskDepth, type ScheduleTaskInput } from 'shared';

import { prisma } from '../db.js';
import { ApiError } from '../middleware/error.js';

/** Kedalaman maksimal 3 level berarti indeks kedalaman 0, 1, dan 2. */
const MAX_DEPTH_INDEX = MAX_DEPTH - 1;

export async function countChildren(taskId: string): Promise<number> {
  return prisma.task.count({ where: { parentId: taskId } });
}

function toDepthInput(task: {
  id: string;
  parentId: string | null;
  position: number;
  durationDays: number;
  startDate: string;
  progress: number;
}): ScheduleTaskInput {
  return {
    id: task.id,
    parentId: task.parentId,
    position: task.position,
    durationDays: task.durationDays,
    startDate: task.startDate,
    progress: task.progress,
  };
}

export async function getTaskTreeInputs(projectId: string): Promise<ScheduleTaskInput[]> {
  const tasks = await prisma.task.findMany({
    where: { projectId },
    select: {
      id: true,
      parentId: true,
      position: true,
      durationDays: true,
      startDate: true,
      progress: true,
    },
  });
  return tasks.map(toDepthInput);
}

/** Hanya tugas daun (tanpa sub-tugas) yang boleh punya dependensi dan alokasi. */
export async function assertLeafTask(taskId: string, action: string): Promise<void> {
  const children = await countChildren(taskId);
  if (children > 0) {
    throw ApiError.unprocessable(
      'TASK_NOT_LEAF',
      `Tugas induk tidak bisa ${action} karena durasi dan jadwalnya dihitung dari sub-tugas.`,
    );
  }
}

/** Tinggi sub-pohon sebuah tugas (0 = tanpa anak). */
export function getSubtreeHeight(inputs: readonly ScheduleTaskInput[], taskId: string): number {
  const childrenByParent = new Map<string, string[]>();
  for (const input of inputs) {
    if (!input.parentId) continue;
    childrenByParent.set(input.parentId, [
      ...(childrenByParent.get(input.parentId) ?? []),
      input.id,
    ]);
  }
  const visited = new Set<string>();
  const walk = (id: string): number => {
    if (visited.has(id)) return 0;
    visited.add(id);
    const children = childrenByParent.get(id) ?? [];
    return children.length === 0 ? 0 : 1 + Math.max(...children.map(walk));
  };
  return walk(taskId);
}

function isDescendant(
  inputs: readonly ScheduleTaskInput[],
  candidateId: string,
  ancestorId: string,
): boolean {
  const byId = new Map(inputs.map((input) => [input.id, input]));
  let current = byId.get(candidateId);
  const guard = new Set<string>([candidateId]);
  while (current?.parentId) {
    if (current.parentId === ancestorId) return true;
    if (guard.has(current.parentId)) return false;
    guard.add(current.parentId);
    current = byId.get(current.parentId);
  }
  return false;
}

/**
 * Memeriksa bahwa `parentId` boleh menerima anak (atau menerima tugas yang
 * dipindahkan) sesuai aturan 6.5.
 */
export async function assertCanBecomeParent(
  projectId: string,
  parentId: string,
  movingTaskId: string | null,
  movingSubtreeHeight: number,
): Promise<void> {
  const inputs = await getTaskTreeInputs(projectId);
  const parent = inputs.find((input) => input.id === parentId);
  if (!parent) {
    throw ApiError.badRequest('Tugas induk tidak ditemukan di proyek ini.');
  }
  if (movingTaskId && (parentId === movingTaskId || isDescendant(inputs, parentId, movingTaskId))) {
    throw ApiError.unprocessable(
      'INVALID_PARENT',
      'Tugas tidak bisa dipindahkan ke dalam dirinya sendiri atau ke sub-tugasnya.',
    );
  }

  const parentDepth = getTaskDepth(inputs, parentId);
  if (parentDepth + 1 + movingSubtreeHeight > MAX_DEPTH_INDEX) {
    throw ApiError.unprocessable(
      'MAX_DEPTH_EXCEEDED',
      `Sub-tugas maksimal ${MAX_DEPTH} level. Pilih induk lain atau ratakan dulu strukturnya.`,
    );
  }

  const counts = await prisma.task.findUniqueOrThrow({
    where: { id: parentId },
    select: {
      _count: {
        select: { dependenciesAsPredecessor: true, dependenciesAsSuccessor: true, assignments: true },
      },
    },
  });
  const { dependenciesAsPredecessor, dependenciesAsSuccessor, assignments } = counts._count;
  if (dependenciesAsPredecessor + dependenciesAsSuccessor + assignments > 0) {
    throw ApiError.conflict(
      'PARENT_HAS_RELATIONS',
      'Tugas yang sudah punya dependensi atau alokasi anggota tidak bisa dijadikan induk. Hapus dependensi dan alokasinya lebih dahulu.',
    );
  }
}

/**
 * Menyusun ulang urutan saudara setelah tugas dipindahkan: tugas diambil dari
 * urutan saat ini lalu disisipkan pada `targetIndex`, kemudian posisinya
 * dinormalkan menjadi 0..n-1.
 */
export async function reorderSiblings(
  projectId: string,
  parentId: string | null,
  movedTaskId: string,
  targetIndex: number,
): Promise<void> {
  const siblings = await prisma.task.findMany({
    where: { projectId, parentId },
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
  });
  const moved = siblings.find((task) => task.id === movedTaskId);
  const ordered = siblings.filter((task) => task.id !== movedTaskId);
  if (moved) ordered.splice(Math.max(0, Math.min(targetIndex, ordered.length)), 0, moved);

  const updates = ordered
    .map((task, position) => ({ task, position }))
    .filter(({ task, position }) => task.position !== position)
    .map(({ task, position }) =>
      prisma.task.update({ where: { id: task.id }, data: { position } }),
    );
  if (updates.length > 0) await prisma.$transaction(updates);
}

/** Posisi berikutnya untuk anak baru pada sebuah induk. */
export async function nextChildPosition(
  projectId: string,
  parentId: string | null,
): Promise<number> {
  const aggregate = await prisma.task.aggregate({
    where: { projectId, parentId },
    _max: { position: true },
  });
  return (aggregate._max.position ?? -1) + 1;
}
