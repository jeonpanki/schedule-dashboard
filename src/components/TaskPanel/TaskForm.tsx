import { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useTeamStore } from '../../store/teamStore';
import { TaskType } from '../../models/task';
import { daysBetween } from '../../core/scheduler';

export function TaskForm() {
  const [name, setName] = useState('');
  const [team, setTeam] = useState('');
  const [type, setType] = useState<TaskType>('duration');
  const [startDate, setStartDate] = useState('');
  const [duration, setDuration] = useState<number | ''>('');
  const [endDate, setEndDate] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [isAddingTeam, setIsAddingTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const addTask = useProjectStore((s) => s.addTask);
  const currentProject = useProjectStore((s) => s.currentProject);
  const addProjectTeam = useProjectStore((s) => s.addProjectTeam);
  const allTeams = useTeamStore((s) => s.teams);

  if (!currentProject) return null;

  // 공통 팀 + 현재 프로젝트에서 사용 중인 팀 합산
  const projectTeams = currentProject.teams || [];
  const combinedTeams = [...new Set([...allTeams, ...projectTeams])];

  const handleAddTeam = () => {
    if (newTeamName.trim() && !combinedTeams.includes(newTeamName.trim())) {
      addProjectTeam(newTeamName.trim());
      setTeam(newTeamName.trim());
      setNewTeamName('');
      setIsAddingTeam(false);
    }
  };

  // 소요기간에 값이 있으면 종료일 비활성화, 종료일에 값이 있으면 소요기간 비활성화
  const hasDurationValue = duration !== '' && duration > 0;
  const hasEndDateValue = endDate !== '';
  const isDurationDisabled = hasEndDateValue;
  const isEndDateDisabled = hasDurationValue;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !team.trim()) return;

    if (type === 'duration') {
      if (!startDate) return;

      let finalDuration = 0;
      if (hasDurationValue) {
        finalDuration = duration as number;
      } else if (hasEndDateValue) {
        finalDuration = daysBetween(startDate, endDate);
      }
      if (finalDuration <= 0) return;

      addTask({
        projectId: currentProject.id,
        name: name.trim(),
        team: team.trim(),
        type: 'duration',
        status: 'pending',
        dependencies: [],
        duration: finalDuration,
        fixedStartDate: startDate,
      } as Omit<typeof import('../../models/task').Task, 'id'>);
    } else {
      if (!targetDate) return;
      addTask({
        projectId: currentProject.id,
        name: name.trim(),
        team: team.trim(),
        type: 'event',
        status: 'pending',
        dependencies: [],
        targetDate,
      } as Omit<typeof import('../../models/task').Task, 'id'>);
    }

    setName('');
    setTeam('');
    setStartDate('');
    setDuration('');
    setEndDate('');
    setTargetDate('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-1">
      <div className="flex flex-wrap gap-1.5 items-end">
        <div>
          <label htmlFor="task-name" className="block text-xs font-medium text-gray-700">태스크 이름</label>
          <input
            id="task-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="태스크 이름"
            className="mt-1 block w-40 rounded border-gray-300 shadow-sm text-sm p-1.5 border"
            required
          />
        </div>
        <div>
          <label htmlFor="task-team" className="block text-xs font-medium text-gray-700">담당 팀</label>
          {isAddingTeam ? (
            <div className="mt-1 flex gap-1">
              <input
                type="text"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTeam(); } }}
                placeholder="새 팀 이름"
                className="block w-24 rounded border-gray-300 shadow-sm text-sm p-1.5 border"
                autoFocus
              />
              <button type="button" onClick={handleAddTeam} className="text-xs bg-blue-500 text-white rounded px-1.5">추가</button>
              <button type="button" onClick={() => setIsAddingTeam(false)} className="text-xs text-gray-500">취소</button>
            </div>
          ) : (
            <select
              id="task-team"
              value={team}
              onChange={(e) => {
                if (e.target.value === '__add__') {
                  setIsAddingTeam(true);
                } else {
                  setTeam(e.target.value);
                }
              }}
              className="mt-1 block w-32 rounded border-gray-300 shadow-sm text-sm p-1.5 border"
              required
            >
              <option value="">선택</option>
              {combinedTeams.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
              <option value="__add__">+ 팀 추가...</option>
            </select>
          )}
        </div>
        <div>
          <label htmlFor="task-type" className="block text-xs font-medium text-gray-700">유형</label>
          <select
            id="task-type"
            value={type}
            onChange={(e) => setType(e.target.value as TaskType)}
            className="mt-1 block rounded border-gray-300 shadow-sm text-sm p-1.5 border"
          >
            <option value="duration">기간 태스크</option>
            <option value="event">이벤트</option>
          </select>
        </div>

        {type === 'duration' && (
          <>
            {/* 시작일 (공통) */}
            <div>
              <label htmlFor="task-start-date" className="block text-xs font-medium text-gray-700">시작일</label>
              <input
                id="task-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 block rounded border-gray-300 shadow-sm text-sm p-1.5 border"
                required
              />
            </div>

            {/* 소요기간 */}
            <div className={`transition-opacity ${isDurationDisabled ? 'opacity-40' : ''}`}>
              <label htmlFor="task-duration" className="block text-xs font-medium text-gray-700">소요기간</label>
              <input
                id="task-duration"
                type="number"
                min={1}
                value={duration}
                onChange={(e) => {
                  const val = e.target.value;
                  setDuration(val === '' ? '' : Number(val));
                }}
                disabled={isDurationDisabled}
                placeholder="일"
                className="mt-1 block w-16 rounded border-gray-300 shadow-sm text-sm p-1.5 border disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            <span className="text-gray-400 text-xs pb-1 self-end">또는</span>

            {/* 종료일 */}
            <div className={`transition-opacity ${isEndDateDisabled ? 'opacity-40' : ''}`}>
              <label htmlFor="task-end-date" className="block text-xs font-medium text-gray-700">종료일</label>
              <input
                id="task-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={isEndDateDisabled}
                className="mt-1 block rounded border-gray-300 shadow-sm text-sm p-1.5 border disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
          </>
        )}

        {type === 'event' && (
          <div>
            <label htmlFor="task-target-date" className="block text-xs font-medium text-gray-700">목표일</label>
            <input
              id="task-target-date"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="mt-1 block rounded border-gray-300 shadow-sm text-sm p-1.5 border"
              required
            />
          </div>
        )}

        <button
          type="submit"
          className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700"
        >
          추가
        </button>
      </div>

      {type === 'duration' && (
        <div className="text-xs text-gray-500">
          {hasDurationValue
            ? `시작일 + 소요기간: ${duration}일`
            : hasEndDateValue && startDate
              ? `시작일 ~ 종료일: ${daysBetween(startDate, endDate)}일`
              : '소요기간 또는 종료일 중 하나를 입력하세요'}
        </div>
      )}
    </form>
  );
}
