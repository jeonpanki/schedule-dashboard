export interface ScheduleResult {
  taskSchedules: Map<string, TaskSchedule>;
  criticalPath: string[];
  projectFeasible: boolean;
  overdueDays: number;
}

export interface TaskSchedule {
  taskId: string;
  startDate: string;
  endDate: string;
  slack: number;
  isOnCriticalPath: boolean;
}
