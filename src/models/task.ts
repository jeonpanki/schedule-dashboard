export type TaskType = 'duration' | 'event';
export type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'delayed';

export interface BaseTask {
  id: string;
  projectId: string;
  name: string;
  team: string;
  type: TaskType;
  status: TaskStatus;
  dependencies: string[]; // predecessor task IDs
  calculatedStartDate?: string;
  calculatedEndDate?: string;
  actualEndDate?: string;
}

export interface DurationTask extends BaseTask {
  type: 'duration';
  duration: number; // days
  fixedStartDate?: string; // 사용자가 지정한 시작일 (선택)
}

export interface EventTask extends BaseTask {
  type: 'event';
  targetDate: string; // ISO date string
}

export type Task = DurationTask | EventTask;
