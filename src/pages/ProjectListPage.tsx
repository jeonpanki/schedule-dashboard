import { useEffect, useRef, useState } from 'react';
import { ProjectForm } from '../components/ProjectPanel/ProjectForm';
import { useProjectStore } from '../store/projectStore';
import { useTeamStore } from '../store/teamStore';

interface Props {
  onSelectProject: (projectId: string) => void;
}

export function ProjectListPage({ onSelectProject }: Props) {
  const projects = useProjectStore((s) => s.projects);
  const currentProject = useProjectStore((s) => s.currentProject);
  const loadProjectList = useProjectStore((s) => s.loadProjectList);
  const prevProjectCount = useRef(projects.length);

  useEffect(() => {
    loadProjectList();
  }, [loadProjectList]);

  // 새 프로젝트가 생성되면 자동으로 상세 페이지로 이동
  useEffect(() => {
    if (projects.length > prevProjectCount.current && currentProject) {
      onSelectProject(currentProject.id);
    }
    prevProjectCount.current = projects.length;
  }, [projects.length, currentProject, onSelectProject]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900">📅 일정관리 대시보드</h1>
          <p className="mt-1 text-sm text-gray-500">프로젝트를 선택하거나 새 프로젝트를 생성하세요.</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* 새 프로젝트 생성 */}
        <section className="bg-white rounded-lg border p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-800">새 프로젝트 생성</h2>
          <ProjectForm />
        </section>

        {/* 프로젝트 목록 */}
        <section className="bg-white rounded-lg border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">프로젝트 목록</h2>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  // 모든 schedule-dashboard 관련 localStorage를 .dat로 내보내기
                  const data: Record<string, string> = {};
                  for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('schedule-dashboard')) {
                      data[key] = localStorage.getItem(key) || '';
                    }
                  }
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `schedule-dashboard-backup-${new Date().toISOString().slice(0,10)}.dat`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="text-xs border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50"
              >
                데이터 내보내기 (.dat)
              </button>
              <label className="text-xs border border-blue-300 text-blue-600 rounded px-3 py-1.5 hover:bg-blue-50 cursor-pointer">
                데이터 가져오기
                <input
                  type="file"
                  accept=".dat,.json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      try {
                        const data = JSON.parse(reader.result as string);
                        for (const [key, value] of Object.entries(data)) {
                          if (key.startsWith('schedule-dashboard')) {
                            localStorage.setItem(key, value as string);
                          }
                        }
                        loadProjectList();
                        alert('데이터를 성공적으로 가져왔습니다. 페이지를 새로고침합니다.');
                        window.location.reload();
                      } catch (err) {
                        alert('파일 형식이 올바르지 않습니다.');
                      }
                    };
                    reader.readAsText(file);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>
          {projects.length === 0 ? (
            <p className="text-gray-500 text-sm">아직 생성된 프로젝트가 없습니다.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => onSelectProject(project.id)}
                  className="p-4 rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all text-left group"
                  aria-label={`프로젝트 열기: ${project.name}`}
                >
                  <div className="font-medium text-gray-900 group-hover:text-blue-600">
                    {project.name}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    출시일: {project.releaseDate}
                  </div>
                  <div className="mt-1 text-xs text-gray-400">
                    {project.teams.length > 0 ? project.teams.join(', ') : '팀 미설정'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* 팀 관리 */}
        <TeamManagement />
      </main>
    </div>
  );
}

function TeamManagement() {
  const { teams, addTeam, renameTeam, deleteTeam } = useTeamStore();
  const [newTeamName, setNewTeamName] = useState('');
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleAdd = () => {
    if (!newTeamName.trim()) return;
    const success = addTeam(newTeamName.trim());
    if (success) setNewTeamName('');
  };

  const handleRename = (oldName: string) => {
    if (!editName.trim() || editName.trim() === oldName) {
      setEditingTeam(null);
      return;
    }
    renameTeam(oldName, editName.trim());
    setEditingTeam(null);
  };

  return (
    <section className="bg-white rounded-lg border p-6 space-y-4">
      <h2 className="text-lg font-bold text-gray-800">팀 관리</h2>
      <p className="text-xs text-gray-500">여기서 관리하는 팀 목록은 모든 프로젝트에서 기본 담당팀으로 사용됩니다.</p>
      <p className="text-xs text-blue-500">프로젝트별로 팀 추가가 가능하며 프로젝트에서 추가한 팀은 해당 프로젝트에만 적용됩니다.</p>

      {/* 팀 추가 */}
      <div className="flex gap-2 items-end">
        <input
          type="text"
          value={newTeamName}
          onChange={(e) => setNewTeamName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          placeholder="새 팀 이름"
          className="block w-48 rounded border-gray-300 shadow-sm text-sm p-2 border"
        />
        <button onClick={handleAdd} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
          추가
        </button>
      </div>

      {/* 팀 목록 */}
      <div className="flex flex-wrap gap-2">
        {teams.map((team) => (
          <div
            key={team}
            className="flex items-center gap-1 bg-gray-100 rounded-lg px-3 py-1.5 text-sm"
          >
            {editingTeam === team ? (
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => handleRename(team)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleRename(team); if (e.key === 'Escape') setEditingTeam(null); }}
                className="w-24 text-sm border rounded px-1"
                autoFocus
              />
            ) : (
              <span
                onDoubleClick={() => { setEditingTeam(team); setEditName(team); }}
                className="cursor-pointer hover:text-blue-600"
                title="더블클릭하여 수정"
              >
                {team}
              </span>
            )}
            <button
              onClick={() => deleteTeam(team)}
              className="text-red-400 hover:text-red-600 text-xs ml-1"
              title="삭제"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
