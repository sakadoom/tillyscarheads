import type {
  Assignment,
  Dependency,
  Holiday,
  Project,
  Resource,
  Task,
  User,
} from '@prisma/client';
import {
  parseWeekendDays,
  type AssignmentDto,
  type DependencyDto,
  type DependencyType,
  type HolidayDto,
  type Priority,
  type ProjectDto,
  type ResourceDto,
  type TaskDto,
  type UserDto,
} from 'shared';

export function toUserDto(user: User): UserDto {
  return { id: user.id, name: user.name, email: user.email };
}

export function toProjectDto(project: Project): ProjectDto {
  return {
    id: project.id,
    ownerId: project.ownerId,
    name: project.name,
    description: project.description,
    startDate: project.startDate,
    weekendDays: parseWeekendDays(project.weekendDays),
    createdAt: project.createdAt.toISOString(),
  };
}

export function toTaskDto(task: Task): TaskDto {
  return {
    id: task.id,
    projectId: task.projectId,
    parentId: task.parentId,
    position: task.position,
    name: task.name,
    description: task.description,
    durationDays: task.durationDays,
    startDate: task.startDate,
    scheduledStart: task.scheduledStart,
    scheduledEnd: task.scheduledEnd,
    priority: task.priority as Priority,
    color: task.color,
    progress: task.progress,
    optimisticDays: task.optimisticDays,
    pessimisticDays: task.pessimisticDays,
  };
}

export function toDependencyDto(dependency: Dependency): DependencyDto {
  return {
    id: dependency.id,
    predecessorId: dependency.predecessorId,
    successorId: dependency.successorId,
    type: dependency.type as DependencyType,
    lagDays: dependency.lagDays,
  };
}

export function toResourceDto(resource: Resource): ResourceDto {
  return {
    id: resource.id,
    projectId: resource.projectId,
    name: resource.name,
    email: resource.email,
    role: resource.role,
    salary: resource.salary,
  };
}

export function toAssignmentDto(assignment: Assignment): AssignmentDto {
  return {
    id: assignment.id,
    taskId: assignment.taskId,
    resourceId: assignment.resourceId,
    allocationPercent: assignment.allocationPercent,
  };
}

export function toHolidayDto(holiday: Holiday): HolidayDto {
  return {
    id: holiday.id,
    projectId: holiday.projectId,
    date: holiday.date,
    name: holiday.name,
  };
}
