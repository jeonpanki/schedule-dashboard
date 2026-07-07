import { useState } from 'react';
import { ProjectListPage } from './pages/ProjectListPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { useProjectStore } from './store/projectStore';

function App() {
  const [page, setPage] = useState<'list' | 'detail'>('list');
  const selectProject = useProjectStore((s) => s.selectProject);

  const handleSelectProject = (projectId: string) => {
    selectProject(projectId);
    setPage('detail');
  };

  const handleBack = () => {
    setPage('list');
  };

  if (page === 'detail') {
    return <ProjectDetailPage onBack={handleBack} />;
  }

  return <ProjectListPage onSelectProject={handleSelectProject} />;
}

export default App;
