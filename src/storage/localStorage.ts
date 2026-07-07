import { Project } from '../models/project';
import { Task } from '../models/task';

const PROJECTS_KEY = 'schedule-dashboard-projects';
const PROJECT_DATA_PREFIX = 'schedule-dashboard-data-';

interface StoredProjectData {
  project: Project;
  tasks: Task[];
}

/**
 * 프로젝트와 태스크 데이터를 로컬 스토리지에 저장한다.
 */
export function saveProject(project: Project, tasks: Task[]): void {
  try {
    // 프로젝트 데이터 저장
    const data: StoredProjectData = { project, tasks };
    localStorage.setItem(
      PROJECT_DATA_PREFIX + project.id,
      JSON.stringify(data)
    );

    // 프로젝트 목록 업데이트
    const projects = listProjects();
    const existingIndex = projects.findIndex((p) => p.id === project.id);
    if (existingIndex >= 0) {
      projects[existingIndex] = project;
    } else {
      projects.push(project);
    }
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  } catch (e) {
    console.error('로컬 스토리지 저장 실패:', e);
  }
}

/**
 * 프로젝트 ID로 저장된 프로젝트 데이터를 불러온다.
 */
export function loadProject(
  projectId: string
): { project: Project; tasks: Task[] } | null {
  try {
    const raw = localStorage.getItem(PROJECT_DATA_PREFIX + projectId);
    if (!raw) return null;
    const data: StoredProjectData = JSON.parse(raw);
    return data;
  } catch (e) {
    console.error('프로젝트 불러오기 실패:', e);
    return null;
  }
}

/**
 * 저장된 프로젝트 목록을 반환한다.
 */
export function listProjects(): Project[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('프로젝트 목록 불러오기 실패:', e);
    return [];
  }
}

/**
 * 프로젝트를 로컬 스토리지에서 삭제한다.
 */
export function deleteProjectFromStorage(projectId: string): void {
  try {
    localStorage.removeItem(PROJECT_DATA_PREFIX + projectId);
    const projects = listProjects().filter((p) => p.id !== projectId);
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  } catch (e) {
    console.error('프로젝트 삭제 실패:', e);
  }
}
