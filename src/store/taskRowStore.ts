import { create } from 'zustand';

// 프로젝트별 태스크 행 위치: { [taskId]: localRowIndex }
interface TaskRowStore {
  rowMap: Record<string, number>; // taskId -> local row within team
  projectId: string | null;
  loadRowMap: (projectId: string) => void;
  setTaskRow: (taskId: string, row: number) => void;
}

function getKey(projectId: string) {
  return `schedule-dashboard-taskrows-${projectId}`;
}

export const useTaskRowStore = create<TaskRowStore>((set, get) => ({
  rowMap: {},
  projectId: null,

  loadRowMap: (projectId: string) => {
    try {
      const raw = localStorage.getItem(getKey(projectId));
      set({ rowMap: raw ? JSON.parse(raw) : {}, projectId });
    } catch {
      set({ rowMap: {}, projectId });
    }
  },

  setTaskRow: (taskId: string, row: number) => {
    const { rowMap, projectId } = get();
    const updated = { ...rowMap, [taskId]: row };
    set({ rowMap: updated });
    if (projectId) {
      localStorage.setItem(getKey(projectId), JSON.stringify(updated));
    }
  },
}));
