import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { api } from '../lib/api';
import { projectKeys } from './hooks';

/** Mutasi proyek pada level daftar (buat dan hapus). */
export function useProjectListActions() {
  const queryClient = useQueryClient();
  const create = useMutation({
    mutationFn: (body: {
      name: string;
      description?: string | null;
      startDate: string;
      weekendDays?: number[];
    }) => api.createProject(body),
  });
  const remove = useMutation({ mutationFn: (projectId: string) => api.deleteProject(projectId) });

  return useMemo(
    () => ({
      createProject: async (body: Parameters<typeof api.createProject>[0]) => {
        const result = await create.mutateAsync(body);
        void queryClient.invalidateQueries({ queryKey: projectKeys.list });
        return result.project;
      },
      deleteProject: async (projectId: string) => {
        await remove.mutateAsync(projectId);
        void queryClient.invalidateQueries({ queryKey: projectKeys.list });
        queryClient.removeQueries({ queryKey: projectKeys.detail(projectId) });
      },
    }),
    [create, queryClient, remove],
  );
}
