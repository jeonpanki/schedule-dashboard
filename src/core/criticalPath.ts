import { Task } from '../models/task';
import { ScheduleResult } from '../models/dependency';

/**
 * 스케줄 결과에서 크리티컬 패스를 추출한다.
 * 크리티컬 패스는 슬랙이 0인 태스크들의 의존관계 체인이다.
 *
 * 이미 calculateBackwardSchedule에서 criticalPath를 계산하지만,
 * 이 함수는 독립적으로 크리티컬 패스를 재검증할 때 사용한다.
 */
export function findCriticalPath(
  tasks: Task[],
  scheduleResult: ScheduleResult
): string[] {
  const criticalTasks: string[] = [];

  for (const task of tasks) {
    const schedule = scheduleResult.taskSchedules.get(task.id);
    if (schedule && schedule.slack === 0) {
      criticalTasks.push(task.id);
    }
  }

  // 의존관계 순서대로 정렬
  return sortByCriticalOrder(tasks, criticalTasks);
}

/**
 * 크리티컬 패스 태스크들을 의존관계 순서로 정렬한다.
 */
function sortByCriticalOrder(tasks: Task[], criticalIds: string[]): string[] {
  const criticalSet = new Set(criticalIds);
  const taskMap = new Map<string, Task>();
  for (const task of tasks) {
    taskMap.set(task.id, task);
  }

  // 크리티컬 패스 내 인접 리스트
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const id of criticalIds) {
    inDegree.set(id, 0);
    adjacency.set(id, []);
  }

  for (const id of criticalIds) {
    const task = taskMap.get(id)!;
    for (const depId of task.dependencies) {
      if (criticalSet.has(depId)) {
        adjacency.get(depId)!.push(id);
        inDegree.set(id, (inDegree.get(id) || 0) + 1);
      }
    }
  }

  // Kahn's algorithm
  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const result: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);
    for (const neighbor of adjacency.get(node) || []) {
      const newDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  return result;
}
