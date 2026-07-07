import { create } from 'zustand';

const STORAGE_KEY = 'schedule-dashboard-teams';
const DEFAULT_TEAMS = ['사업', 'PM', 'QA', 'Infra', 'BE', 'APP(IOS)', 'APP(AOS)', 'UX', 'OndeviceAI', 'LLM'];

function loadTeams(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_TEAMS;
  } catch { return DEFAULT_TEAMS; }
}

function saveTeams(teams: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(teams));
}

interface TeamStore {
  teams: string[];
  addTeam: (name: string) => boolean;
  renameTeam: (oldName: string, newName: string) => void;
  deleteTeam: (name: string) => void;
}

export const useTeamStore = create<TeamStore>((set, get) => ({
  teams: loadTeams(),

  addTeam: (name: string) => {
    const { teams } = get();
    if (teams.includes(name)) return false;
    const updated = [...teams, name];
    set({ teams: updated });
    saveTeams(updated);
    return true;
  },

  renameTeam: (oldName: string, newName: string) => {
    const { teams } = get();
    if (teams.includes(newName) && oldName !== newName) return;
    const updated = teams.map(t => t === oldName ? newName : t);
    set({ teams: updated });
    saveTeams(updated);
  },

  deleteTeam: (name: string) => {
    const updated = get().teams.filter(t => t !== name);
    set({ teams: updated });
    saveTeams(updated);
  },
}));
