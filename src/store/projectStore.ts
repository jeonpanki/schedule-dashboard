import { create } from 'zustand';
import { Project } from '../models/project';
import { Task } from '../models/task';
import { ScheduleResult } from '../models/dependency';
import { DelayImpact, analyzeDelay } from '../core/impactAnalysis';
import { calculateBackwardSchedule } from '../core/scheduler';
import { hasCycle } from '../core/graphUtils';
import { saveProject, loadProject, listProjects } from '../storage/localStorage';

interface ProjectStore {
  projects: Project[];
  currentProject: Project | null;
  tasks: Task[];
  schedule: ScheduleResult | null;
  teamFilter: string[];
  delayImpact: DelayImpact | null;
  teamOrder: string[]; // 팀 표시 순서

  // 프로젝트 관리
  createProject: (name: string, releaseDate: string) => void;
  selectProject: (projectId: string) => void;
  updateReleaseDate: (date: string) => void;
  loadProjectList: () => void;

  // 태스크 관리
  addTask: (task: Omit<Task, 'id'>) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  deleteTask: (taskId: string) => void;
  setTaskActualEndDate: (taskId: string, actualEndDate: string) => void;

  // 의존관계 관리
  addDependency: (fromTaskId: string, toTaskId: string) => boolean;
  removeDependency: (fromTaskId: string, toTaskId: string) => void;

  // 필터
  setTeamFilter: (teams: string[]) => void;
  clearTeamFilter: () => void;

  // 일정 계산
  recalculateSchedule: () => void;

  // 팀 순서
  setTeamOrder: (order: string[]) => void;

  // 프로젝트별 팀 추가
  addProjectTeam: (teamName: string) => void;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  currentProject: null,
  tasks: [],
  schedule: null,
  teamFilter: [],
  delayImpact: null,
  teamOrder: [],

  loadProjectList: () => {
    const projects = listProjects();
    set({ projects });
  },

  createProject: (name: string, releaseDate: string) => {
    const now = new Date().toISOString();
    const project: Project = {
      id: generateId(),
      name,
      releaseDate,
      teams: [],
      createdAt: now,
      updatedAt: now,
    };
    const projects = [...get().projects, project];
    set({ projects, currentProject: project, tasks: [], schedule: null, delayImpact: null });
    saveProject(project, []);
  },

  selectProject: (projectId: string) => {
    try {
      const data = loadProject(projectId);
      if (data) {
        set({
          currentProject: data.project,
          tasks: data.tasks,
          delayImpact: null,
          teamFilter: [],
        });
        // 팀 순서 로드
        try {
          const savedOrder = localStorage.getItem('schedule-dashboard-teamorder-' + projectId);
          set({ teamOrder: savedOrder ? JSON.parse(savedOrder) : [] });
        } catch { set({ teamOrder: [] }); }
        // 일정 재계산
        const schedule = calculateBackwardSchedule(data.tasks, data.project.releaseDate);
        set({ schedule });
      }
    } catch (e) {
      console.error('프로젝트 로드 실패:', e);
    }
  },

  updateReleaseDate: (date: string) => {
    const { currentProject, tasks } = get();
    if (!currentProject) return;
    const updated = { ...currentProject, releaseDate: date, updatedAt: new Date().toISOString() };
    set({ currentProject: updated });
    const schedule = calculateBackwardSchedule(tasks, date);
    set({ schedule, delayImpact: null });
    saveProject(updated, tasks);
    // 프로젝트 목록도 갱신
    const projects = get().projects.map((p) => (p.id === updated.id ? updated : p));
    set({ projects });
  },

  addTask: (taskData: Omit<Task, 'id'>) => {
    const { currentProject, tasks } = get();
    if (!currentProject) return;

    const task = { ...taskData, id: generateId() } as Task;
    const newTasks = [...tasks, task];

    // 팀 목록 업데이트
    const teams = [...new Set(newTasks.map((t) => t.team))];
    const updatedProject = { ...currentProject, teams, updatedAt: new Date().toISOString() };

    set({ tasks: newTasks, currentProject: updatedProject });

    // 일정 재계산
    const schedule = calculateBackwardSchedule(newTasks, updatedProject.releaseDate);
    set({ schedule, delayImpact: null });
    saveProject(updatedProject, newTasks);
    const projects = get().projects.map((p) => (p.id === updatedProject.id ? updatedProject : p));
    set({ projects });
  },

  updateTask: (taskId: string, updates: Partial<Task>) => {
    const { currentProject, tasks } = get();
    if (!currentProject) return;

    const newTasks = tasks.map((t) => {
      if (t.id !== taskId) return t;
      // 명시적으로 모든 필드를 병합 (undefined 값도 적용하여 기존 값 제거 가능)
      const merged = { ...t };
      for (const key of Object.keys(updates)) {
        (merged as Record<string, unknown>)[key] = (updates as Record<string, unknown>)[key];
      }
      return merged as Task;
    });
    const teams = [...new Set(newTasks.map((t) => t.team))];
    const updatedProject = { ...currentProject, teams, updatedAt: new Date().toISOString() };

    set({ tasks: newTasks, currentProject: updatedProject });
    const schedule = calculateBackwardSchedule(newTasks, updatedProject.releaseDate);
    set({ schedule, delayImpact: null });
    saveProject(updatedProject, newTasks);
    const projects = get().projects.map((p) => (p.id === updatedProject.id ? updatedProject : p));
    set({ projects });
  },

  deleteTask: (taskId: string) => {
    const { currentProject, tasks } = get();
    if (!currentProject) return;

    // 태스크 삭제 + 의존관계 정리 (Property 6)
    const newTasks = tasks
      .filter((t) => t.id !== taskId)
      .map((t) => ({
        ...t,
        dependencies: t.dependencies.filter((d) => d !== taskId),
      })) as Task[];

    const teams = [...new Set(newTasks.map((t) => t.team))];
    const updatedProject = { ...currentProject, teams, updatedAt: new Date().toISOString() };

    set({ tasks: newTasks, currentProject: updatedProject });
    const schedule = calculateBackwardSchedule(newTasks, updatedProject.releaseDate);
    set({ schedule, delayImpact: null });
    saveProject(updatedProject, newTasks);
    const projects = get().projects.map((p) => (p.id === updatedProject.id ? updatedProject : p));
    set({ projects });
  },

  setTaskActualEndDate: (taskId: string, actualEndDate: string) => {
    const { currentProject, tasks } = get();
    if (!currentProject) return;

    const newTasks = tasks.map((t) =>
      t.id === taskId ? { ...t, actualEndDate, status: 'delayed' as const } : t
    ) as Task[];
    set({ tasks: newTasks });

    // 지연 영향 분석
    const impact = analyzeDelay(newTasks, taskId, actualEndDate, currentProject.releaseDate);
    set({ delayImpact: impact, schedule: impact.newSchedule });
    saveProject(currentProject, newTasks);
  },

  addDependency: (fromTaskId: string, toTaskId: string) => {
    const { currentProject, tasks } = get();
    if (!currentProject) return false;

    // 순환 참조 검증 (Property 3)
    if (hasCycle(tasks, { from: fromTaskId, to: toTaskId })) {
      return false;
    }

    const newTasks = tasks.map((t) => {
      if (t.id === toTaskId) {
        return { ...t, dependencies: [...t.dependencies, fromTaskId] } as Task;
      }
      return t;
    });

    set({ tasks: newTasks });
    const schedule = calculateBackwardSchedule(newTasks, currentProject.releaseDate);
    set({ schedule, delayImpact: null });
    saveProject(currentProject, newTasks);
    return true;
  },

  removeDependency: (fromTaskId: string, toTaskId: string) => {
    const { currentProject, tasks } = get();
    if (!currentProject) return;

    const newTasks = tasks.map((t) => {
      if (t.id === toTaskId) {
        return { ...t, dependencies: t.dependencies.filter((d) => d !== fromTaskId) } as Task;
      }
      return t;
    });

    set({ tasks: newTasks });
    const schedule = calculateBackwardSchedule(newTasks, currentProject.releaseDate);
    set({ schedule, delayImpact: null });
    saveProject(currentProject, newTasks);
  },

  setTeamFilter: (teams: string[]) => {
    set({ teamFilter: teams });
  },

  clearTeamFilter: () => {
    set({ teamFilter: [] });
  },

  recalculateSchedule: () => {
    const { currentProject, tasks } = get();
    if (!currentProject) return;
    const schedule = calculateBackwardSchedule(tasks, currentProject.releaseDate);
    set({ schedule });
  },

  setTeamOrder: (order: string[]) => {
    const { currentProject } = get();
    set({ teamOrder: order });
    if (currentProject) {
      localStorage.setItem('schedule-dashboard-teamorder-' + currentProject.id, JSON.stringify(order));
    }
  },

  addProjectTeam: (teamName: string) => {
    const { currentProject, tasks } = get();
    if (!currentProject) return;
    if (currentProject.teams.includes(teamName)) return;
    const updatedProject = {
      ...currentProject,
      teams: [...currentProject.teams, teamName],
      updatedAt: new Date().toISOString(),
    };
    set({ currentProject: updatedProject });
    saveProject(updatedProject, tasks);
    const projects = get().projects.map((p) => (p.id === updatedProject.id ? updatedProject : p));
    set({ projects });
  },
}));
