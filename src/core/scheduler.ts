import { Task, DurationTask } from '../models/task';
import { ScheduleResult, TaskSchedule } from '../models/dependency';
import { topologicalSort } from './graphUtils';

/**
 * 타임존 안전한 로컬 날짜 파싱
 */
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Date 객체를 'YYYY-MM-DD' 형식으로 변환
 */
function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 날짜 유틸리티: ISO 날짜 문자열에 일수를 더한다.
 */
export function addDays(dateStr: string, days: number): string {
  const date = parseLocalDate(dateStr);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

/**
 * 날짜 유틸리티: ISO 날짜 문자열에서 일수를 뺀다.
 */
export function subtractDays(dateStr: string, days: number): string {
  return addDays(dateStr, -days);
}

/**
 * 두 날짜 간의 차이(일수)를 반환한다.
 */
export function daysBetween(startStr: string, endStr: string): number {
  const start = parseLocalDate(startStr);
  const end = parseLocalDate(endStr);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * 출시일 기준으로 일정을 계산한다.
 *
 * 계산 방식:
 * - fixedStartDate가 있는 태스크: 그 날짜를 시작일로 사용
 * - fixedStartDate가 없고 의존관계가 있는 태스크: 선행 태스크 종료일 이후부터 시작
 * - fixedStartDate도 없고 의존관계도 없는 태스크: 출시일에서 역산하여 가장 늦게 시작 가능한 날짜
 *
 * Forward pass로 실제 시작/종료일을 계산하고, 출시일과 비교하여 feasibility를 판정한다.
 */
export function calculateBackwardSchedule(
  tasks: Task[],
  releaseDate: string
): ScheduleResult {
  if (tasks.length === 0) {
    return {
      taskSchedules: new Map(),
      criticalPath: [],
      projectFeasible: true,
      overdueDays: 0,
    };
  }

  const sorted = topologicalSort(tasks);
  if (sorted.length === 0 && tasks.length > 0) {
    return {
      taskSchedules: new Map(),
      criticalPath: [],
      projectFeasible: false,
      overdueDays: 0,
    };
  }

  const taskMap = new Map<string, Task>();
  for (const task of tasks) {
    taskMap.set(task.id, task);
  }

  // Forward pass: 각 태스크의 실제 시작일/종료일 계산
  const startDates = new Map<string, string>();
  const endDates = new Map<string, string>();

  for (const taskId of sorted) {
    const task = taskMap.get(taskId)!;
    const duration = getTaskDuration(task);

    // 시작일 결정: 사용자가 지정한 시작일을 최우선으로 사용
    let taskStartDate: string;

    if (task.type === 'event') {
      // 이벤트 태스크는 항상 targetDate를 사용
      taskStartDate = task.targetDate;
    } else if (task.type === 'duration' && (task as DurationTask).fixedStartDate) {
      // 사용자가 시작일을 지정한 경우 — 무조건 존중
      taskStartDate = (task as DurationTask).fixedStartDate!;
    } else if (task.dependencies.length > 0) {
      // 시작일 미지정 + 선행 태스크 있는 경우: 선행 태스크 중 가장 늦은 종료일부터 시작
      let latestEnd = '1900-01-01';
      for (const depId of task.dependencies) {
        const depEnd = endDates.get(depId);
        if (depEnd && depEnd > latestEnd) {
          latestEnd = depEnd;
        }
      }
      taskStartDate = latestEnd;
    } else {
      // 의존관계 없고 시작일도 없는 경우: 출시일에서 역산
      taskStartDate = subtractDays(releaseDate, duration);
    }

    const taskEndDate = addDays(taskStartDate, duration);

    startDates.set(taskId, taskStartDate);
    endDates.set(taskId, taskEndDate);
  }

  // 프로젝트 최종 종료일 (가장 늦은 태스크 종료일)
  let projectEndDate = '1900-01-01';
  for (const endDate of endDates.values()) {
    if (endDate > projectEndDate) projectEndDate = endDate;
  }

  // 출시일 준수 여부
  const overdueDays = daysBetween(releaseDate, projectEndDate);
  const projectFeasible = overdueDays <= 0;

  // Backward pass: Late Finish/Start 및 슬랙 계산
  const lateFinish = new Map<string, string>();
  const lateStart = new Map<string, string>();

  // 후행 태스크 인접 리스트
  const successors = new Map<string, string[]>();
  for (const task of tasks) {
    successors.set(task.id, []);
  }
  for (const task of tasks) {
    for (const depId of task.dependencies) {
      if (successors.has(depId)) {
        successors.get(depId)!.push(task.id);
      }
    }
  }

  const reverseSorted = [...sorted].reverse();
  for (const taskId of reverseSorted) {
    const task = taskMap.get(taskId)!;
    const duration = getTaskDuration(task);
    const succs = successors.get(taskId) || [];

    // LF = min(LS of all successors), 후행이 없으면 출시일
    let lf = releaseDate;
    for (const succId of succs) {
      const succLs = lateStart.get(succId);
      if (succLs && succLs < lf) {
        lf = succLs;
      }
    }
    lateFinish.set(taskId, lf);
    lateStart.set(taskId, subtractDays(lf, duration));
  }

  // 스케줄 결과 조립
  const taskSchedules = new Map<string, TaskSchedule>();
  const criticalPath: string[] = [];

  for (const taskId of sorted) {
    const start = startDates.get(taskId)!;
    const end = endDates.get(taskId)!;
    const ls = lateStart.get(taskId)!;
    const slack = daysBetween(start, ls);
    const isOnCriticalPath = slack <= 0;

    if (isOnCriticalPath) {
      criticalPath.push(taskId);
    }

    taskSchedules.set(taskId, {
      taskId,
      startDate: start,
      endDate: end,
      slack: Math.max(0, slack),
      isOnCriticalPath,
    });
  }

  return {
    taskSchedules,
    criticalPath,
    projectFeasible,
    overdueDays: Math.max(0, overdueDays),
  };
}

/**
 * Forward pass만 수행하여 각 태스크의 ES, EF를 반환한다.
 */
export function calculateForwardPass(
  tasks: Task[]
): Map<string, { es: string; ef: string }> {
  const releaseDate = '2099-12-31';
  const result = calculateBackwardSchedule(tasks, releaseDate);
  const forwardResult = new Map<string, { es: string; ef: string }>();

  for (const [taskId, schedule] of result.taskSchedules) {
    forwardResult.set(taskId, {
      es: schedule.startDate,
      ef: schedule.endDate,
    });
  }

  return forwardResult;
}

/**
 * 태스크의 소요 기간(일)을 반환한다.
 */
function getTaskDuration(task: Task): number {
  if (task.type === 'event') return 0;
  return task.duration;
}
