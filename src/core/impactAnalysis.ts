import { Task } from '../models/task';
import { ScheduleResult } from '../models/dependency';
import { getDescendants } from './graphUtils';
import { calculateBackwardSchedule, daysBetween } from './scheduler';

export interface DelayImpact {
  delayedTaskId: string;
  delayDays: number;
  affectedTasks: string[];
  newSchedule: ScheduleResult;
  feasible: boolean;
  overdueDays: number;
}

/**
 * 특정 태스크의 지연이 전체 일정에 미치는 영향을 분석한다.
 *
 * @param tasks - 모든 태스크 목록
 * @param taskId - 지연된 태스크 ID
 * @param actualEndDate - 실제 완료일 (지연된 날짜)
 * @param releaseDate - 목표 출시일
 */
export function analyzeDelay(
  tasks: Task[],
  taskId: string,
  actualEndDate: string,
  releaseDate: string
): DelayImpact {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) {
    return {
      delayedTaskId: taskId,
      delayDays: 0,
      affectedTasks: [],
      newSchedule: {
        taskSchedules: new Map(),
        criticalPath: [],
        projectFeasible: true,
        overdueDays: 0,
      },
      feasible: true,
      overdueDays: 0,
    };
  }

  // 기존 일정 계산
  const originalSchedule = calculateBackwardSchedule(tasks, releaseDate);
  const originalTaskSchedule = originalSchedule.taskSchedules.get(taskId);

  if (!originalTaskSchedule) {
    return {
      delayedTaskId: taskId,
      delayDays: 0,
      affectedTasks: [],
      newSchedule: originalSchedule,
      feasible: originalSchedule.projectFeasible,
      overdueDays: originalSchedule.overdueDays,
    };
  }

  // 지연일수 계산
  const delayDays = daysBetween(originalTaskSchedule.endDate, actualEndDate);
  if (delayDays <= 0) {
    // 지연이 아님
    return {
      delayedTaskId: taskId,
      delayDays: 0,
      affectedTasks: [],
      newSchedule: originalSchedule,
      feasible: originalSchedule.projectFeasible,
      overdueDays: originalSchedule.overdueDays,
    };
  }

  // 영향받는 후속 태스크 식별
  const affectedTasks = getDescendants(tasks, taskId);

  // 지연을 반영한 새 태스크 목록 생성
  // 지연된 태스크의 duration을 늘려서 시뮬레이션
  const adjustedTasks = tasks.map((t) => {
    if (t.id === taskId && t.type === 'duration') {
      return { ...t, duration: t.duration + delayDays };
    }
    if (t.id === taskId && t.type === 'event') {
      // 이벤트 태스크가 지연된 경우 — duration 태스크로 변환하여 시뮬레이션
      return {
        ...t,
        type: 'duration' as const,
        duration: delayDays,
      };
    }
    return t;
  });

  // 새 일정 계산
  const newSchedule = calculateBackwardSchedule(adjustedTasks, releaseDate);

  return {
    delayedTaskId: taskId,
    delayDays,
    affectedTasks,
    newSchedule,
    feasible: newSchedule.projectFeasible,
    overdueDays: newSchedule.overdueDays,
  };
}
