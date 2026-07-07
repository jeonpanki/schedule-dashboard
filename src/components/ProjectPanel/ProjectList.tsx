import { useEffect } from 'react';
import { useProjectStore } from '../../store/projectStore';

export function ProjectList() {
  const projects = useProjectStore((s) => s.projects);
  const currentProject = useProjectStore((s) => s.currentProject);
  const selectProject = useProjectStore((s) => s.selectProject);
  const updateReleaseDate = useProjectStore((s) => s.updateReleaseDate);
  const loadProjectList = useProjectStore((s) => s.loadProjectList);

  useEffect(() => {
    loadProjectList();
  }, [loadProjectList]);

  if (projects.length === 0) {
    return <p className="text-sm text-gray-500">프로젝트가 없습니다. 새 프로젝트를 생성하세요.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {projects.map((project) => (
        <div
          key={project.id}
          className={`p-3 rounded border cursor-pointer transition-colors ${
            currentProject?.id === project.id
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
          onClick={() => selectProject(project.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') selectProject(project.id);
          }}
          aria-label={`프로젝트 선택: ${project.name}`}
        >
          <div className="text-sm font-medium">{project.name}</div>
          <div className="text-xs text-gray-500">
            출시일:
            {currentProject?.id === project.id ? (
              <input
                type="date"
                value={project.releaseDate}
                onChange={(e) => updateReleaseDate(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="ml-1 text-xs border rounded px-1"
                aria-label="출시일 변경"
              />
            ) : (
              <span className="ml-1">{project.releaseDate}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
