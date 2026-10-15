import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import type { AnalysisResult, ProjectSnapshot, ProjectSummaryDto, TaskDto } from 'shared';

import { api, type TaskMutationResult } from '../lib/api';

export const projectKeys = {
  list: ['projects'] as const,
  detail: (projectId: string) => ['project', projectId] as const,
  analysis: (projectId: string) => ['analysis', projectId] as const,
};

export function useProjects() {
  return useQuery({
    queryKey: projectKeys.list,
    queryFn: () => api.listProjects(),
    select: (data): ProjectSummaryDto[] => data.projects,
  });
}

export function useProjectSnapshot(projectId: string | undefined) {
  return useQuery({
    queryKey: projectKeys.detail(projectId ?? 'tidak-ada'),
    queryFn: () => api.getProject(projectId as string),
    enabled: Boolean(projectId),
  });
}

export function useProjectAnalysis(projectId: string | undefined) {
  return useQuery({
    queryKey: projectKeys.analysis(projectId ?? 'tidak-ada'),
    queryFn: () => api.getAnalysis(projectId as string),
    enabled: Boolean(projectId),
  });
}

export type ProjectActions = ReturnType<typeof useProjectActions>;

/**
 * Semua mutasi proyek: hasil `{ tasks }` dari server langsung dipakai untuk
 * memperbarui cache snapshot (sesuai kontrak API Bagian 7) dan analisis
 * dianggap usang karena angka CPM/biaya ikut berubah.
 */
export function useProjectActions(projectId: string) {
  const queryClient = useQueryClient();

  const applyTasks = useCallback(
    (result: TaskMutationResult) => {
      queryClient.setQueryData<ProjectSnapshot>(projectKeys.detail(projectId), (current) =>
        current ? { ...current, tasks: result.tasks } : current,
      );
      void queryClient.invalidateQueries({ queryKey: projectKeys.analysis(projectId) });
    },
    [projectId, queryClient],
  );

  const invalidateAnalysis = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: projectKeys.analysis(projectId) });
  }, [projectId, queryClient]);

  const taskMutation = useMutation({ mutationFn: (input: { taskId: string; body: Record<string, unknown> }) => api.updateTask(input.taskId, input.body) });

  const actions = useMemo(() => {
    // Semua aksi mengembalikan `true` saat sukses supaya pemanggil (form/toast)
    // bisa membedakan berhasil dan gagal tanpa memeriksa nilai balikan API.
    const runTaskMutation = async (input: {
      taskId: string;
      body: Record<string, unknown>;
    }): Promise<boolean> => {
      const result = await taskMutation.mutateAsync(input);
      applyTasks(result);
      return true;
    };

    return {
      createTask: async (body: Parameters<typeof api.createTask>[1]) => {
        const result = await api.createTask(projectId, body);
        applyTasks(result);
        return result.task as TaskDto;
      },
      updateTask: (taskId: string, body: Record<string, unknown>) => runTaskMutation({ taskId, body }),
      deleteTask: async (taskId: string): Promise<boolean> => {
        const result = await api.deleteTask(taskId);
        applyTasks(result);
        return true;
      },
      moveTask: async (
        taskId: string,
        body: { parentId: string | null; position: number },
      ): Promise<boolean> => {
        const result = await api.moveTask(taskId, body);
        applyTasks(result);
        return true;
      },
      createDependency: async (
        taskId: string,
        body: { predecessorId: string; type: string; lagDays: number },
      ): Promise<boolean> => {
        const result = await api.createDependency(taskId, body);
        applyTasks(result);
        return true;
      },
      updateDependency: async (
        dependencyId: string,
        body: { type?: string; lagDays?: number },
      ): Promise<boolean> => {
        const result = await api.updateDependency(dependencyId, body);
        applyTasks(result);
        return true;
      },
      deleteDependency: async (dependencyId: string): Promise<boolean> => {
        const result = await api.deleteDependency(dependencyId);
        applyTasks(result);
        return true;
      },
      createAssignment: async (
        taskId: string,
        body: { resourceId: string; allocationPercent: number },
      ): Promise<boolean> => {
        const result = await api.createAssignment(taskId, body);
        queryClient.setQueryData<ProjectSnapshot>(projectKeys.detail(projectId), (current) =>
          current ? { ...current, assignments: result.assignments } : current,
        );
        invalidateAnalysis();
        return true;
      },
      updateAssignment: async (
        assignmentId: string,
        body: { allocationPercent: number },
      ): Promise<boolean> => {
        const result = await api.updateAssignment(assignmentId, body);
        queryClient.setQueryData<ProjectSnapshot>(projectKeys.detail(projectId), (current) =>
          current ? { ...current, assignments: result.assignments } : current,
        );
        invalidateAnalysis();
        return true;
      },
      deleteAssignment: async (assignmentId: string): Promise<boolean> => {
        const result = await api.deleteAssignment(assignmentId);
        queryClient.setQueryData<ProjectSnapshot>(projectKeys.detail(projectId), (current) =>
          current ? { ...current, assignments: result.assignments } : current,
        );
        invalidateAnalysis();
        return true;
      },
      createResource: async (body: {
        name: string;
        email: string;
        role: string;
        salary: number;
      }): Promise<boolean> => {
        const result = await api.createResource(projectId, body);
        queryClient.setQueryData<ProjectSnapshot>(projectKeys.detail(projectId), (current) =>
          current ? { ...current, resources: result.resources } : current,
        );
        invalidateAnalysis();
        return true;
      },
      updateResource: async (resourceId: string, body: Record<string, unknown>): Promise<boolean> => {
        const result = await api.updateResource(resourceId, body);
        queryClient.setQueryData<ProjectSnapshot>(projectKeys.detail(projectId), (current) =>
          current ? { ...current, resources: result.resources } : current,
        );
        invalidateAnalysis();
        return true;
      },
      deleteResource: async (resourceId: string): Promise<boolean> => {
        const result = await api.deleteResource(resourceId);
        queryClient.setQueryData<ProjectSnapshot>(projectKeys.detail(projectId), (current) =>
          current ? { ...current, resources: result.resources } : current,
        );
        invalidateAnalysis();
        return true;
      },
      updateCalendar: async (weekendDays: number[]): Promise<boolean> => {
        const result = await api.updateCalendar(projectId, weekendDays);
        queryClient.setQueryData<ProjectSnapshot>(projectKeys.detail(projectId), (current) =>
          current ? { ...current, project: result.project, tasks: result.tasks } : current,
        );
        invalidateAnalysis();
        return true;
      },
      createHoliday: async (body: { date: string; name: string }): Promise<boolean> => {
        const result = await api.createHoliday(projectId, body);
        queryClient.setQueryData<ProjectSnapshot>(projectKeys.detail(projectId), (current) =>
          current ? { ...current, holidays: result.holidays, tasks: result.tasks } : current,
        );
        invalidateAnalysis();
        return true;
      },
      deleteHoliday: async (holidayId: string): Promise<boolean> => {
        const result = await api.deleteHoliday(holidayId);
        queryClient.setQueryData<ProjectSnapshot>(projectKeys.detail(projectId), (current) =>
          current ? { ...current, holidays: result.holidays, tasks: result.tasks } : current,
        );
        invalidateAnalysis();
        return true;
      },
    };
  }, [applyTasks, invalidateAnalysis, projectId, queryClient, taskMutation]);

  return actions;
}

export type { AnalysisResult };
