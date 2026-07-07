import { useProjectStore } from '../../store/projectStore';

export function TeamFilter() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const teamFilter = useProjectStore((s) => s.teamFilter);
  const setTeamFilter = useProjectStore((s) => s.setTeamFilter);
  const clearTeamFilter = useProjectStore((s) => s.clearTeamFilter);

  if (!currentProject || currentProject.teams.length === 0) return null;

  const handleToggle = (team: string) => {
    if (teamFilter.includes(team)) {
      setTeamFilter(teamFilter.filter((t) => t !== team));
    } else {
      setTeamFilter([...teamFilter, team]);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm font-medium text-gray-700">팀 필터:</span>
      {currentProject.teams.map((team) => (
        <button
          key={team}
          onClick={() => handleToggle(team)}
          className={`px-2 py-1 rounded text-xs border transition-colors ${
            teamFilter.includes(team)
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
          }`}
          aria-pressed={teamFilter.includes(team)}
          aria-label={`팀 필터: ${team}`}
        >
          {team}
        </button>
      ))}
      {teamFilter.length > 0 && (
        <button
          onClick={clearTeamFilter}
          className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 underline"
        >
          전체 보기
        </button>
      )}
    </div>
  );
}
