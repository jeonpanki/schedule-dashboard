import { create } from 'zustand';

export interface Annotation {
  id: string;
  text: string;
  x: number;
  y: number;
}

interface AnnotationStore {
  projectId: string | null;
  annotations: Annotation[];
  loadAnnotations: (projectId: string) => void;
  addAnnotation: (text: string) => void;
  removeAnnotation: (id: string) => void;
  updateAnnotationPosition: (id: string, x: number, y: number) => void;
  updateAnnotationText: (id: string, text: string) => void;
}

function getStorageKey(projectId: string) {
  return `schedule-dashboard-annotations-${projectId}`;
}

function loadFromStorage(projectId: string): Annotation[] {
  try {
    const raw = localStorage.getItem(getStorageKey(projectId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveToStorage(projectId: string, annotations: Annotation[]) {
  localStorage.setItem(getStorageKey(projectId), JSON.stringify(annotations));
}

export const useAnnotationStore = create<AnnotationStore>((set, get) => ({
  projectId: null,
  annotations: [],

  loadAnnotations: (projectId: string) => {
    const annotations = loadFromStorage(projectId);
    set({ projectId, annotations });
  },

  addAnnotation: (text: string) => {
    const { annotations, projectId } = get();
    if (!projectId) return;
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const maxY = annotations.length > 0 ? Math.max(...annotations.map(a => a.y)) + 30 : 10;
    const newAnnotation: Annotation = { id, text, x: 100, y: maxY };
    const updated = [...annotations, newAnnotation];
    set({ annotations: updated });
    saveToStorage(projectId, updated);
  },

  removeAnnotation: (id: string) => {
    const { projectId } = get();
    if (!projectId) return;
    const updated = get().annotations.filter(a => a.id !== id);
    set({ annotations: updated });
    saveToStorage(projectId, updated);
  },

  updateAnnotationPosition: (id: string, x: number, y: number) => {
    const { projectId } = get();
    if (!projectId) return;
    const updated = get().annotations.map(a => a.id === id ? { ...a, x, y } : a);
    set({ annotations: updated });
    saveToStorage(projectId, updated);
  },

  updateAnnotationText: (id: string, text: string) => {
    const { projectId } = get();
    if (!projectId) return;
    const updated = get().annotations.map(a => a.id === id ? { ...a, text } : a);
    set({ annotations: updated });
    saveToStorage(projectId, updated);
  },
}));
