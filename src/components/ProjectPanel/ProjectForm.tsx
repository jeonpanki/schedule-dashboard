import { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';

export function ProjectForm() {
  const [name, setName] = useState('');
  const [releaseDate, setReleaseDate] = useState('');
  const createProject = useProjectStore((s) => s.createProject);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !releaseDate) return;
    createProject(name.trim(), releaseDate);
    setName('');
    setReleaseDate('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-end">
      <div>
        <label htmlFor="project-name" className="block text-sm font-medium text-gray-700">
          프로젝트 이름
        </label>
        <input
          id="project-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="프로젝트 이름"
          className="mt-1 block w-48 rounded border-gray-300 shadow-sm text-sm p-2 border"
          required
        />
      </div>
      <div>
        <label htmlFor="release-date" className="block text-sm font-medium text-gray-700">
          출시일
        </label>
        <input
          id="release-date"
          type="date"
          value={releaseDate}
          onChange={(e) => setReleaseDate(e.target.value)}
          className="mt-1 block rounded border-gray-300 shadow-sm text-sm p-2 border"
          required
        />
      </div>
      <button
        type="submit"
        className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
      >
        생성
      </button>
    </form>
  );
}
