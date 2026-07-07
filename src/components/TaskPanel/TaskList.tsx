import { useState, useMemo } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useTeamStore } from '../../store/teamStore';
import { Task } from '../../models/task';

export function TaskList() {
  const tasks = useProjectStore((s) => s.tasks);
  const deleteTask = useProjectStore((s) => s.deleteTask);
  const addDependency = useProjectStore((s) => s.addDependency);
  const removeDependency = useProjectStore((s) => s.removeDependency);
  const [depFromTeam, setDepFromTeam] = useState('');
  const [depFrom, setDepFrom] = useState('');
  const [depToTeam, setDepToTeam] = useState('');
  const [depTo, setDepTo] = useState('');
  const [depError, setDepError] = useState('');

  // 팀 목록
  const teamList = useMemo(() => {
    const teams = new Set<string>();
    for (const t of tasks) teams.add(t.team);
    return Array.from(teams);
  }, [tasks]);

  const handleAddDep = () => {
    if (!depFrom || !depTo || depFrom === depTo) return;
    const success = addDependency(depFrom, depTo);
    if (!success) {
      setDepError('순환 의존관계가 감지되었습니다.');
      setTimeout(() => setDepError(''), 3000);
    } else {
      setDepFromTeam('');
      setDepFrom('');
      setDepToTeam('');
      setDepTo('');
      setDepError('');
    }
  };

  if (tasks.length === 0) {
    return <p className="text-sm text-gray-500">태스크가 없습니다.</p>;
  }

  return (
    <div className="space-y-3">
      {/* 의존관계 설정 */}
      <div className="flex gap-2 items-end flex-wrap text-xs">
        <div>
          <span className="text-gray-600">선행:</span>
          <div className="flex gap-1">
            <select value={depFromTeam} onChange={(e) => { setDepFromTeam(e.target.value); setDepFrom(''); }} className="border rounded p-0.5 text-xs w-20">
              <option value="">팀</option>
              {teamList.map((team) => (<option key={team} value={team}>{team}</option>))}
            </select>
            <select value={depFrom} onChange={(e) => setDepFrom(e.target.value)} className="border rounded p-0.5 text-xs w-28" disabled={!depFromTeam}>
              <option value="">태스크</option>
              {tasks.filter(t => t.team === depFromTeam).map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
            </select>
          </div>
        </div>
        <span className="text-gray-400 pb-0.5">→</span>
        <div>
          <span className="text-gray-600">후행:</span>
          <div className="flex gap-1">
            <select value={depToTeam} onChange={(e) => { setDepToTeam(e.target.value); setDepTo(''); }} className="border rounded p-0.5 text-xs w-20">
              <option value="">팀</option>
              {teamList.map((team) => (<option key={team} value={team}>{team}</option>))}
            </select>
            <select value={depTo} onChange={(e) => setDepTo(e.target.value)} className="border rounded p-0.5 text-xs w-28" disabled={!depToTeam}>
              <option value="">태스크</option>
              {tasks.filter(t => t.team === depToTeam).map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
            </select>
          </div>
        </div>
        <button onClick={handleAddDep} className="px-2 py-0.5 bg-purple-600 text-white rounded text-xs hover:bg-purple-700">
          추가
        </button>
        {depError && <span className="text-red-500">{depError}</span>}
      </div>

      {/* 태스크 목록 - 팀별 그룹 (순서 드래그 가능) */}
      {(() => {
        const groups = new Map<string, Task[]>();
        for (const task of tasks) {
          const list = groups.get(task.team) || [];
          list.push(task);
          groups.set(task.team, list);
        }
        return (
          <TeamGroupList
            groups={groups}
            allTasks={tasks}
            onDelete={deleteTask}
            onRemoveDep={removeDependency}
          />
        );
      })()}
    </div>
  );
}

function TeamGroupList({
  groups,
  allTasks,
  onDelete,
  onRemoveDep,
}: {
  groups: Map<string, Task[]>;
  allTasks: Task[];
  onDelete: (id: string) => void;
  onRemoveDep: (from: string, to: string) => void;
}) {
  const teamOrder = useProjectStore((s) => s.teamOrder);
  const setTeamOrder = useProjectStore((s) => s.setTeamOrder);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // teamOrder에 따라 정렬
  const teams = useMemo(() => {
    const keys = [...groups.keys()];
    return keys.sort((a, b) => {
      const aIdx = teamOrder.indexOf(a);
      const bIdx = teamOrder.indexOf(b);
      if (aIdx === -1 && bIdx === -1) return 0;
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });
  }, [groups, teamOrder]);

  const handleDragStart = (idx: number) => {
    setDragIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = (idx: number) => {
    if (dragIdx === null || dragIdx === idx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    const newOrder = [...teams];
    const [moved] = newOrder.splice(dragIdx, 1);
    newOrder.splice(idx, 0, moved);
    setTeamOrder(newOrder);
    setDragIdx(null);
    setDragOverIdx(null);
  };

  return (
    <div className="space-y-2">
      {teams.map((team, idx) => (
        <div
          key={team}
          draggable
          onDragStart={() => handleDragStart(idx)}
          onDragOver={(e) => handleDragOver(e, idx)}
          onDrop={() => handleDrop(idx)}
          onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
          className={`transition-all ${dragOverIdx === idx ? 'border-t-2 border-blue-400' : ''} ${dragIdx === idx ? 'opacity-50' : ''}`}
        >
          <TeamGroup
            team={team}
            teamTasks={groups.get(team) || []}
            allTasks={allTasks}
            onDelete={onDelete}
            onRemoveDep={onRemoveDep}
          />
        </div>
      ))}
    </div>
  );
}

function TeamGroup({
  team,
  teamTasks,
  allTasks,
  onDelete,
  onRemoveDep,
}: {
  team: string;
  teamTasks: Task[];
  allTasks: Task[];
  onDelete: (id: string) => void;
  onRemoveDep: (from: string, to: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="border rounded overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-100 hover:bg-gray-200 transition-colors text-sm font-medium text-left"
      >
        <span>{isOpen ? '▼' : '▶'} {team} ({teamTasks.length})</span>
      </button>
      {isOpen && (
        <table className="w-full text-sm border-collapse table-fixed">
          <thead>
            <tr className="bg-gray-50">
              <th className="p-2 text-left border-b text-xs w-[30%]">이름</th>
              <th className="p-2 text-left border-b text-xs w-[8%]">유형</th>
              <th className="p-2 text-left border-b text-xs w-[25%]">기간/목표일</th>
              <th className="p-2 text-left border-b text-xs w-[27%]">선행 태스크</th>
              <th className="p-2 text-left border-b text-xs w-[10%]">작업</th>
            </tr>
          </thead>
          <tbody>
            {teamTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                tasks={allTasks}
                onDelete={onDelete}
                onRemoveDep={onRemoveDep}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function TaskRow({
  task,
  tasks,
  onDelete,
  onRemoveDep,
}: {
  task: Task;
  tasks: Task[];
  onDelete: (id: string) => void;
  onRemoveDep: (from: string, to: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(task.name);
  const [editTeam, setEditTeam] = useState(task.team);
  const [editDuration, setEditDuration] = useState(task.type === 'duration' ? String(task.duration) : '');
  const [editStartDate, setEditStartDate] = useState(task.type === 'duration' ? (task.fixedStartDate || '') : '');
  const [editTargetDate, setEditTargetDate] = useState(task.type === 'event' ? task.targetDate : '');
  const updateTask = useProjectStore((s) => s.updateTask);
  const schedule = useProjectStore((s) => s.schedule);

  const taskSchedule = schedule?.taskSchedules.get(task.id);

  const formatDateRange = () => {
    if (task.type === 'event') {
      return taskSchedule ? taskSchedule.startDate : task.targetDate;
    }
    if (taskSchedule) {
      return `${taskSchedule.startDate} ~ ${taskSchedule.endDate} (${task.duration}일)`;
    }
    return `${task.duration}일`;
  };

  const handleSave = () => {
    if (!editName.trim() || !editTeam.trim()) return;

    if (task.type === 'duration') {
      const dur = Number(editDuration);
      if (dur <= 0) return;
      updateTask(task.id, {
        name: editName.trim(),
        team: editTeam.trim(),
        duration: dur,
        fixedStartDate: editStartDate || undefined,
      } as Partial<Task>);
    } else {
      if (!editTargetDate) return;
      updateTask(task.id, {
        name: editName.trim(),
        team: editTeam.trim(),
        targetDate: editTargetDate,
      } as Partial<Task>);
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <tr className="bg-yellow-50">
        <td className="p-2 border-b">
          <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full text-sm border rounded p-1" />
        </td>
        <td className="p-2 border-b text-xs">{task.type === 'duration' ? '기간' : '이벤트'}</td>
        <td className="p-2 border-b">
          {task.type === 'duration' ? (
            <div className="flex gap-1 items-center flex-wrap">
              <input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} className="text-xs border rounded p-0.5" />
              <input type="number" min={1} value={editDuration} onChange={(e) => setEditDuration(e.target.value)} className="text-xs border rounded p-0.5 w-14" />
              <span className="text-xs text-gray-500">일</span>
            </div>
          ) : (
            <input type="date" value={editTargetDate} onChange={(e) => setEditTargetDate(e.target.value)} className="text-xs border rounded p-0.5" />
          )}
        </td>
        <td className="p-2 border-b">
          <select value={editTeam} onChange={(e) => setEditTeam(e.target.value)} className="text-xs border rounded p-0.5">
            {[...new Set([...useTeamStore.getState().teams, ...(useProjectStore.getState().currentProject?.teams || []), ...tasks.map(t => t.team)])].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </td>
        <td className="p-2 border-b">
          <div className="flex gap-1">
            <button onClick={handleSave} className="text-xs bg-blue-500 text-white rounded px-2 py-0.5 hover:bg-blue-600">저장</button>
            <button onClick={() => setIsEditing(false)} className="text-xs text-gray-500 hover:text-gray-700">취소</button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-gray-50">
      <td className="p-2 border-b font-medium" title={task.name}>
        {task.name.length > 40 ? task.name.slice(0, 40) + '…' : task.name}
      </td>
      <td className="p-2 border-b text-xs">{task.type === 'duration' ? '기간' : '이벤트'}</td>
      <td className="p-2 border-b text-xs">{formatDateRange()}</td>
      <td className="p-2 border-b">
        {task.dependencies.length > 0 ? (
          <div className="flex flex-col gap-0.5">
            {task.dependencies.map((depId) => {
              const depName = tasks.find((t) => t.id === depId)?.name || depId;
              const displayName = depName.length > 40 ? depName.slice(0, 40) + '…' : depName;
              return (
                <span key={depId} className="inline-flex items-center gap-1 bg-gray-200 rounded px-1.5 py-0.5 text-xs" title={depName}>
                  {displayName}
                  <button onClick={() => onRemoveDep(depId, task.id)} className="text-red-500 hover:text-red-700" aria-label="의존관계 제거">×</button>
                </span>
              );
            })}
          </div>
        ) : (
          <span className="text-gray-400 text-xs">없음</span>
        )}
      </td>
      <td className="p-2 border-b">
        <div className="flex gap-1">
          <button onClick={() => setIsEditing(true)} className="text-blue-500 hover:text-blue-700 text-xs">수정</button>
          <button onClick={() => onDelete(task.id)} className="text-red-500 hover:text-red-700 text-xs" aria-label={`태스크 삭제: ${task.name}`}>삭제</button>
        </div>
      </td>
    </tr>
  );
}
