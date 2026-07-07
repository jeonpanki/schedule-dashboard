import { useState, useMemo, useRef, useEffect } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useAnnotationStore } from '../../store/annotationStore';
import { useTaskRowStore } from '../../store/taskRowStore';
import { Task } from '../../models/task';
import { daysBetween, addDays } from '../../core/scheduler';
import { TaskSchedule } from '../../models/dependency';

const ROW_HEIGHT = 32;
const HEADER_HEIGHT = 40;
const MIN_TEAM_LABEL_WIDTH = 60;
const CHAR_WIDTH_KO = 12; // 한글 한 글자 대략 폭
const CHAR_WIDTH_EN = 7;  // 영문 한 글자 대략 폭
const TEAM_LABEL_PADDING = 30; // 신호등 + 여백

function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// 팀 색상 (레퍼런스: 연한 민트 단색)
const TEAM_COLORS = ['#d4edda', '#d4edda', '#d4edda', '#d4edda', '#d4edda', '#d4edda', '#d4edda'];

// 텍스트를 최대 50자로 자르기
function truncateLabel(text: string, max = 50): string {
  return text.length > max ? text.slice(0, max) + '…' : text;
}

/** 후행 태스크 ID를 모두 찾는다 (BFS) */
function getDescendantTasks(tasks: Task[], taskId: string): string[] {
  const successors = new Map<string, string[]>();
  for (const t of tasks) {
    successors.set(t.id, []);
  }
  for (const t of tasks) {
    for (const depId of t.dependencies) {
      if (successors.has(depId)) {
        successors.get(depId)!.push(t.id);
      }
    }
  }
  const visited = new Set<string>();
  const queue = [taskId];
  visited.add(taskId);
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of successors.get(current) || []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  visited.delete(taskId);
  return Array.from(visited);
}

/**
 * 태스크들을 겹치지 않게 행에 배치한다.
 * 의존성 체인으로 연결된 태스크들을 같은 행에 최대한 가깝게 배치.
 */
function packTasksIntoRows(
  tasks: Task[],
  scheduleMap: Map<string, TaskSchedule>,
  minDate: string
): Map<string, number> {
  if (tasks.length === 0) return new Map();

  const taskRowMap = new Map<string, number>();
  const rows: { endDay: number }[] = [];

  // 의존관계 체인 구축: 연결된 태스크들을 그룹으로 묶음
  const chains: Task[][] = [];
  const assigned = new Set<string>();

  // DFS로 의존관계 체인 추출
  function buildChain(taskId: string, chain: Task[]) {
    const task = tasks.find(t => t.id === taskId);
    if (!task || assigned.has(taskId)) return;
    assigned.add(taskId);
    chain.push(task);
    // 이 태스크를 선행으로 갖는 후행 태스크 (같은 팀 내)
    for (const t of tasks) {
      if (t.dependencies.includes(taskId) && !assigned.has(t.id)) {
        buildChain(t.id, chain);
      }
    }
  }

  // 선행 태스크가 없거나 팀 외부 의존만 있는 태스크부터 체인 시작
  const roots = tasks.filter(t => {
    const inTeamDeps = t.dependencies.filter(depId => tasks.some(tt => tt.id === depId));
    return inTeamDeps.length === 0;
  });

  // 시작일 순으로 루트 정렬
  roots.sort((a, b) => {
    const aS = scheduleMap.get(a.id);
    const bS = scheduleMap.get(b.id);
    const aStart = aS ? daysBetween(minDate, aS.startDate) : 0;
    const bStart = bS ? daysBetween(minDate, bS.startDate) : 0;
    return aStart - bStart;
  });

  for (const root of roots) {
    if (assigned.has(root.id)) continue;
    const chain: Task[] = [];
    buildChain(root.id, chain);
    if (chain.length > 0) chains.push(chain);
  }

  // 아직 할당 안된 태스크 (고아)
  for (const task of tasks) {
    if (!assigned.has(task.id)) {
      chains.push([task]);
    }
  }

  // 각 체인 내 태스크를 시작일 순으로 정렬
  for (const chain of chains) {
    chain.sort((a, b) => {
      const aS = scheduleMap.get(a.id);
      const bS = scheduleMap.get(b.id);
      const aStart = aS ? daysBetween(minDate, aS.startDate) : 0;
      const bStart = bS ? daysBetween(minDate, bS.startDate) : 0;
      return aStart - bStart;
    });
  }

  // 체인 단위로 행에 배치 (체인 내 태스크는 같은 행에 시도)
  for (const chain of chains) {
    // 이 체인이 들어갈 수 있는 행 찾기
    let targetRow = -1;

    for (let r = 0; r < rows.length; r++) {
      // 체인의 모든 태스크가 이 행에 들어갈 수 있는지 확인
      let canFit = true;
      let simulatedEnd = rows[r].endDay;

      for (const task of chain) {
        const s = scheduleMap.get(task.id);
        if (!s) continue;
        const startDay = daysBetween(minDate, s.startDate);
        const endDay = daysBetween(minDate, s.endDate);
        if (simulatedEnd + 1 > startDay) {
          canFit = false;
          break;
        }
        simulatedEnd = Math.max(endDay, startDay + 1);
      }

      if (canFit) {
        targetRow = r;
        break;
      }
    }

    if (targetRow === -1) {
      // 새 행 생성
      targetRow = rows.length;
      rows.push({ endDay: -999 });
    }

    // 체인의 태스크들을 해당 행에 배치
    for (const task of chain) {
      const s = scheduleMap.get(task.id);
      if (!s) continue;
      const endDay = daysBetween(minDate, s.endDate);
      const startDay = daysBetween(minDate, s.startDate);
      taskRowMap.set(task.id, targetRow);
      rows[targetRow].endDay = Math.max(rows[targetRow].endDay, endDay, startDay + 1);
    }
  }

  return taskRowMap;
}

export function GanttChart() {
  const tasks = useProjectStore((s) => s.tasks);
  const schedule = useProjectStore((s) => s.schedule);
  const currentProject = useProjectStore((s) => s.currentProject);
  const teamFilter = useProjectStore((s) => s.teamFilter);
  const delayImpact = useProjectStore((s) => s.delayImpact);
  const updateTask = useProjectStore((s) => s.updateTask);
  const annotations = useAnnotationStore((s) => s.annotations);
  const updateAnnotationPosition = useAnnotationStore((s) => s.updateAnnotationPosition);
  const updateAnnotationText = useAnnotationStore((s) => s.updateAnnotationText);
  const removeAnnotation = useAnnotationStore((s) => s.removeAnnotation);
  const loadAnnotations = useAnnotationStore((s) => s.loadAnnotations);
  const taskRowMap_manual = useTaskRowStore((s) => s.rowMap);
  const setTaskRowManual = useTaskRowStore((s) => s.setTaskRow);
  const loadRowMap = useTaskRowStore((s) => s.loadRowMap);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [annotationDrag, setAnnotationDrag] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [editingAnnotation, setEditingAnnotation] = useState<string | null>(null);
  const [editingAnnotationText, setEditingAnnotationText] = useState('');
  const [editingTaskLabel, setEditingTaskLabel] = useState<string | null>(null);
  const [editingTaskLabelText, setEditingTaskLabelText] = useState('');
  const [dragState, setDragState] = useState<{
    taskId: string;
    startX: number;
    startY: number;
    originalStartDate: string;
    originalRow: number;
    teamYOffset: number;
    teamRowCount: number;
  } | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  // 사용자가 수동으로 지정한 팀 내 행 번호 (taskId -> localRow)
  const [manualRowOverrides, setManualRowOverrides] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('schedule-dashboard-rowoverrides-' + currentProject?.id);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [dragTooltip, setDragTooltip] = useState<{ x: number; y: number; date: string } | null>(null);
  const [resizeState, setResizeState] = useState<{
    taskId: string;
    edge: 'left' | 'right';
    startX: number;
    originalStartDate: string;
    originalDuration: number;
  } | null>(null);
  const [resizeTooltip, setResizeTooltip] = useState<{ x: number; y: number; date: string } | null>(null);
  const [resizeDx, setResizeDx] = useState(0);
  const [teamSignals, setTeamSignals] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('schedule-dashboard-signals-' + currentProject?.id);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const updateTeamSignal = (team: string, color: string) => {
    const updated = { ...teamSignals, [team]: color };
    setTeamSignals(updated);
    if (currentProject) {
      localStorage.setItem('schedule-dashboard-signals-' + currentProject.id, JSON.stringify(updated));
    }
  };
  const [signalPopover, setSignalPopover] = useState<{ team: string; x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // 프로젝트 변경 시 각주 & 신호등 로드
  useEffect(() => {
    if (currentProject) {
      loadAnnotations(currentProject.id);
      try {
        const saved = localStorage.getItem('schedule-dashboard-signals-' + currentProject.id);
        setTeamSignals(saved ? JSON.parse(saved) : {});
      } catch { setTeamSignals({}); }
      try {
        const saved = localStorage.getItem('schedule-dashboard-rowoverrides-' + currentProject.id);
        setManualRowOverrides(saved ? JSON.parse(saved) : {});
      } catch { setManualRowOverrides({}); }
    }
  }, [currentProject?.id, loadAnnotations, loadRowMap]);

  // 드래그 핸들러
  const handleMouseDown = (taskId: string, e: React.MouseEvent) => {
    e.preventDefault();
    const taskSchedule = schedule?.taskSchedules.get(taskId);
    if (!taskSchedule) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const currentRow = globalTaskRow.get(taskId) || 0;
    setDragState({ taskId, startX: e.clientX, startY: e.clientY, originalStartDate: taskSchedule.startDate, originalRow: currentRow, teamYOffset: 0, teamRowCount: 1 });
    setDragOffset(0);
    setDragOffsetY(0);
  };

  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      setDragOffset(dx);
      setDragOffsetY(dy);

      // 툴팁 날짜 계산
      if (containerRef.current && schedule) {
        const chartWidth = Math.max(containerWidth, 400);
        const allDates: string[] = [];
        for (const [, s] of schedule.taskSchedules) {
          allDates.push(s.startDate, s.endDate);
        }
        if (currentProject) allDates.push(currentProject.releaseDate);
        const sortedDates = [...allDates].sort();
        const minDate = sortedDates[0];
        const maxDate = sortedDates[sortedDates.length - 1];
        const totalDays = Math.min(daysBetween(minDate, maxDate) + 2, 365);
        const dayWidth = chartWidth / totalDays;

        const daysMoved = Math.round(dx / dayWidth);
        const newStartDate = addDays(dragState.originalStartDate, daysMoved);
        setDragTooltip({ x: e.clientX, y: e.clientY - 30, date: newStartDate });
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!dragState || !schedule || !currentProject) {
        setDragState(null);
        setDragOffset(0);
        setDragTooltip(null);
        return;
      }

      const chartWidth = Math.max(containerWidth, 400);
      const allDates: string[] = [];
      for (const [, s] of schedule.taskSchedules) {
        allDates.push(s.startDate, s.endDate);
      }
      allDates.push(currentProject.releaseDate);
      const sortedDates = [...allDates].sort();
      const minDate = sortedDates[0];
      const maxDate = sortedDates[sortedDates.length - 1];
      const totalDays = Math.min(daysBetween(minDate, maxDate) + 2, 365);
      const dayWidth = chartWidth / totalDays;

      const dx = e.clientX - dragState.startX;
      const daysMoved = Math.round(dx / dayWidth);

      if (daysMoved !== 0) {
        const newStartDate = addDays(dragState.originalStartDate, daysMoved);
        const draggedTask = tasks.find(t => t.id === dragState.taskId);

        if (draggedTask) {
          if (draggedTask.type === 'duration') {
            updateTask(draggedTask.id, { fixedStartDate: newStartDate } as Partial<Task>);
          } else if (draggedTask.type === 'event') {
            updateTask(draggedTask.id, { targetDate: newStartDate } as Partial<Task>);
          }

          // 후행 태스크도 같은 만큼 이동
          const descendants = getDescendantTasks(tasks, dragState.taskId);
          for (const descId of descendants) {
            const descTask = tasks.find(t => t.id === descId);
            const descSchedule = schedule.taskSchedules.get(descId);
            if (!descTask || !descSchedule) continue;

            if (descTask.type === 'duration') {
              const descNewStart = addDays(descSchedule.startDate, daysMoved);
              updateTask(descId, { fixedStartDate: descNewStart } as Partial<Task>);
            } else if (descTask.type === 'event') {
              const descNewDate = addDays(descSchedule.startDate, daysMoved);
              updateTask(descId, { targetDate: descNewDate } as Partial<Task>);
            }
          }
        }
      }

      // Y축 행 변경 (0.5 단위)
      const dy = e.clientY - dragState.startY;
      const rowsMoved = Math.round(dy / ROW_HEIGHT * 2) / 2; // 0.5 단위 스냅
      if (rowsMoved !== 0) {
        const currentLocalRow = manualRowOverrides[dragState.taskId] ?? 0;
        const newRow = Math.max(0, currentLocalRow + rowsMoved);
        const updated = { ...manualRowOverrides, [dragState.taskId]: newRow };
        setManualRowOverrides(updated);
        if (currentProject) {
          localStorage.setItem('schedule-dashboard-rowoverrides-' + currentProject.id, JSON.stringify(updated));
        }
      }

      setDragState(null);
      setDragOffset(0);
      setDragOffsetY(0);
      setDragTooltip(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, schedule, currentProject, tasks, containerWidth, updateTask]);

  // 리사이즈 핸들러
  useEffect(() => {
    if (!resizeState) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!schedule || !currentProject) return;
      const chartW = Math.max(containerWidth - 100, 400);
      const allD: string[] = [];
      for (const [, s] of schedule.taskSchedules) { allD.push(s.startDate, s.endDate); }
      allD.push(currentProject.releaseDate);
      const sorted = [...allD].sort();
      const min = sorted[0];
      const max = addDays(currentProject.releaseDate, 5);
      const total = Math.min(daysBetween(min, max) + 2, 365);
      const dw = chartW / total;

      const dx = e.clientX - resizeState.startX;
      setResizeDx(dx);

      let tooltipDate = '';
      if (resizeState.edge === 'left') {
        tooltipDate = addDays(resizeState.originalStartDate, Math.round(dx / dw));
      } else {
        const endDate = addDays(resizeState.originalStartDate, resizeState.originalDuration);
        tooltipDate = addDays(endDate, Math.round(dx / dw));
      }
      setResizeTooltip({ x: e.clientX, y: e.clientY - 30, date: tooltipDate });
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!resizeState || !schedule || !currentProject) {
        setResizeState(null);
        setResizeTooltip(null);
        return;
      }
      const chartW = Math.max(containerWidth - 100, 400);
      const allD: string[] = [];
      for (const [, s] of schedule.taskSchedules) { allD.push(s.startDate, s.endDate); }
      allD.push(currentProject.releaseDate);
      const sorted = [...allD].sort();
      const min = sorted[0];
      const max = addDays(currentProject.releaseDate, 5);
      const total = Math.min(daysBetween(min, max) + 2, 365);
      const dw = chartW / total;

      const dx = e.clientX - resizeState.startX;
      const daysDelta = Math.round(dx / dw);

      if (daysDelta !== 0) {
        const task = tasks.find(t => t.id === resizeState.taskId);
        if (task && task.type === 'duration') {
          if (resizeState.edge === 'left') {
            // 시작일 이동, 기간 축소/확대
            const newStart = addDays(resizeState.originalStartDate, daysDelta);
            const newDuration = Math.max(1, resizeState.originalDuration - daysDelta);
            updateTask(task.id, { fixedStartDate: newStart, duration: newDuration } as Partial<Task>);
          } else {
            // 종료일 이동, 기간 축소/확대
            const newDuration = Math.max(1, resizeState.originalDuration + daysDelta);
            updateTask(task.id, { duration: newDuration } as Partial<Task>);
          }
        }
      }
      setResizeState(null);
      setResizeTooltip(null);
      setResizeDx(0);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizeState, schedule, currentProject, tasks, containerWidth, updateTask]);

  const filteredTasks = useMemo(() => {
    if (teamFilter.length === 0) return tasks;
    return tasks.filter((t) => teamFilter.includes(t.team));
  }, [tasks, teamFilter]);

  const groupedTasks = useMemo(() => {
    const groups = new Map<string, Task[]>();
    for (const task of filteredTasks) {
      const list = groups.get(task.team) || [];
      list.push(task);
      groups.set(task.team, list);
    }
    return groups;
  }, [filteredTasks]);

  // 팀 라벨 너비를 가장 긴 팀 이름에 맞게 동적 계산
  const teamLabelWidth = useMemo(() => {
    const teamNames = [...new Set(filteredTasks.map(t => t.team))];
    if (teamNames.length === 0) return MIN_TEAM_LABEL_WIDTH;
    const maxWidth = Math.max(...teamNames.map(name => {
      let w = 0;
      for (const ch of name) {
        w += /[\u3131-\uD79D]/.test(ch) ? CHAR_WIDTH_KO : CHAR_WIDTH_EN;
      }
      return w;
    }));
    return Math.max(MIN_TEAM_LABEL_WIDTH, maxWidth + TEAM_LABEL_PADDING);
  }, [filteredTasks]);

  // teamOrder에 따라 정렬된 팀 키 목록
  const teamOrder = useProjectStore((s) => s.teamOrder);
  const orderedTeamKeys = useMemo(() => {
    const keys = [...groupedTasks.keys()];
    return keys.sort((a, b) => {
      const aIdx = teamOrder.indexOf(a);
      const bIdx = teamOrder.indexOf(b);
      if (aIdx === -1 && bIdx === -1) return 0;
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });
  }, [groupedTasks, teamOrder]);

  if (!currentProject || !schedule || filteredTasks.length === 0) {
    return (
      <div ref={containerRef} className="text-center text-gray-400 py-8 text-sm">
        태스크를 추가하면 간트 차트가 표시됩니다.
      </div>
    );
  }

  // 날짜 범위
  const allDates: string[] = [];
  for (const [, s] of schedule.taskSchedules) {
    allDates.push(s.startDate, s.endDate);
  }
  allDates.push(currentProject.releaseDate);
  const sortedDates = [...allDates].sort();
  const minDate = sortedDates[0];
  // 출시일 +5일까지 한 페이지에 표시
  const maxDate = addDays(currentProject.releaseDate, 5);
  const totalDays = Math.min(daysBetween(minDate, maxDate) + 2, 365);

  const chartWidth = Math.max(containerWidth - teamLabelWidth, 400);
  const dayWidth = chartWidth / totalDays;

  const dateToX = (dateStr: string) => daysBetween(minDate, dateStr) * dayWidth;
  const releaseX = dateToX(currentProject.releaseDate);

  const affectedSet = new Set(delayImpact?.affectedTasks || []);
  if (delayImpact) affectedSet.add(delayImpact.delayedTaskId);

  const hoveredRelated = (() => {
    if (!hoveredTaskId) return new Set<string>();
    const related = new Set<string>();
    const hoveredTask = filteredTasks.find((t) => t.id === hoveredTaskId);
    if (hoveredTask) {
      for (const depId of hoveredTask.dependencies) related.add(depId);
    }
    for (const t of filteredTasks) {
      if (t.dependencies.includes(hoveredTaskId)) related.add(t.id);
    }
    related.add(hoveredTaskId);
    return related;
  })();

  // 팀별로 행 패킹 계산
  const teamRowData: { team: string; rowCount: number; taskRowMap: Map<string, number> }[] = [];
  for (const team of orderedTeamKeys) {
    const teamTasks = groupedTasks.get(team) || [];
    const taskRowMap = packTasksIntoRows(teamTasks, schedule.taskSchedules, minDate);
    // 사용자 수동 행 배치 적용
    for (const task of teamTasks) {
      if (manualRowOverrides[task.id] !== undefined) {
        taskRowMap.set(task.id, manualRowOverrides[task.id]);
      }
    }
    // 행 범위 계산: 최소~최대 행을 기준으로 영역 크기 결정
    const rowValues = Array.from(taskRowMap.values());
    const minRow = rowValues.length > 0 ? Math.min(...rowValues) : 0;
    const maxRow = rowValues.length > 0 ? Math.max(...rowValues) : 0;
    // 모든 행을 최소 행 기준으로 정규화 (빈 상단 공간 제거)
    if (minRow > 0) {
      for (const [taskId, row] of taskRowMap) {
        taskRowMap.set(taskId, row - minRow);
      }
    }
    const normalizedMax = maxRow - minRow;
    const rowCount = Math.ceil(normalizedMax + 1);
    teamRowData.push({ team, rowCount, taskRowMap });
  }

  // 각 팀의 시작 Y 오프셋 계산
  let cumulativeRows = 0;
  const teamYOffsets = new Map<string, number>();
  const teamRowCounts = new Map<string, number>();
  for (const { team, rowCount } of teamRowData) {
    teamYOffsets.set(team, cumulativeRows);
    teamRowCounts.set(team, rowCount);
    cumulativeRows += rowCount;
  }

  // 전체 태스크 → 글로벌 행 번호
  const globalTaskRow = new Map<string, number>();
  for (const { team, taskRowMap } of teamRowData) {
    const teamOffset = teamYOffsets.get(team) || 0;
    for (const [taskId, localRow] of taskRowMap) {
      globalTaskRow.set(taskId, teamOffset + localRow);
    }
  }

  const totalRows = cumulativeRows;
  const FOOTER_HEIGHT = 30;
  const totalHeight = HEADER_HEIGHT + totalRows * ROW_HEIGHT + FOOTER_HEIGHT;

  // 시간축 간격
  const labelInterval = dayWidth < 5 ? 14 : dayWidth < 12 ? 7 : dayWidth < 20 ? 5 : 1;
  const gridInterval = dayWidth < 3 ? 7 : dayWidth < 8 ? 3 : 1;

  return (
    <div ref={containerRef} className="border rounded bg-white">
      <div className="flex">
        {/* 왼쪽: 팀 이름만 */}
        <div className="flex-shrink-0" style={{ width: teamLabelWidth }}>
          <div
            className="bg-gray-100 border-b border-r font-medium text-xs flex items-center justify-center"
            style={{ height: HEADER_HEIGHT }}
          >
            팀
          </div>
          {teamRowData.map(({ team, rowCount }, idx) => {
            const signalColor = teamSignals[team] || '#4caf50';
            const shadowColor = signalColor === '#4caf50' ? 'rgba(76, 175, 80, 0.6)'
              : signalColor === '#ffc107' ? 'rgba(255, 193, 7, 0.6)'
              : 'rgba(244, 67, 54, 0.6)';
            return (
              <div
                key={team}
                className="border-b border-r flex items-center justify-center text-xs font-bold relative"
                style={{
                  height: rowCount * ROW_HEIGHT,
                  backgroundColor: '#f5f5f5',
                }}
              >
                <span>{team}</span>
                {/* 신호등 바 (오른쪽) */}
                <div
                  className="absolute right-0 top-0 bottom-0 cursor-pointer hover:opacity-80 transition-opacity"
                  style={{
                    width: 6,
                    backgroundColor: signalColor,
                    boxShadow: `-2px 0 6px ${shadowColor}`,
                    borderRadius: '3px 0 0 3px',
                  }}
                  onClick={(e) => {
                    const rect = (e.target as HTMLElement).getBoundingClientRect();
                    setSignalPopover({ team, x: rect.left - 40, y: rect.top + rect.height / 2 - 20 });
                  }}
                  title="클릭하여 신호등 변경"
                />
              </div>
            );
          })}
        </div>

        {/* 오른쪽: 차트 */}
        <div className="flex-1 overflow-hidden">
          <svg
            width={chartWidth}
            height={totalHeight}
            onMouseMove={(e) => {
              if (annotationDrag) {
                const dx = e.clientX - annotationDrag.startX;
                const dy = e.clientY - annotationDrag.startY;
                updateAnnotationPosition(annotationDrag.id, annotationDrag.origX + dx, annotationDrag.origY + dy);
              }
            }}
            onMouseUp={() => setAnnotationDrag(null)}
            onMouseLeave={() => setAnnotationDrag(null)}
          >
            {/* 팀별 배경 띠 + 경계 가로줄 */}
            {teamRowData.map(({ team, rowCount }, idx) => {
              const yOffset = teamYOffsets.get(team) || 0;
              const yBottom = HEADER_HEIGHT + (yOffset + rowCount) * ROW_HEIGHT;
              return (
                <g key={`bg-${team}`}>
                  <rect
                    x={0}
                    y={HEADER_HEIGHT + yOffset * ROW_HEIGHT}
                    width={chartWidth}
                    height={rowCount * ROW_HEIGHT}
                    fill={idx % 2 === 0 ? '#fafafa' : '#ffffff'}
                  />
                  <line
                    x1={0} y1={yBottom}
                    x2={chartWidth} y2={yBottom}
                    stroke="#e0e0e0" strokeWidth={1}
                  />
                </g>
              );
            })}

            {/* 시간축 */}
            <g>
              {Array.from({ length: totalDays }, (_, i) => {
                const d = parseLocalDate(addDays(minDate, i));
                const dayOfMonth = d.getDate();
                const isFirst = dayOfMonth === 1;
                const showGrid = i % gridInterval === 0;
                const showLabel = dayOfMonth % labelInterval === 0 || dayOfMonth === 1;
                if (!showGrid && !isFirst && !showLabel) return null;
                return (
                  <g key={i}>
                    {isFirst && (
                      <text x={i * dayWidth + 2} y={14} fill="#6b7280" fontSize={9}>
                        {d.getMonth() + 1}월
                      </text>
                    )}
                    {showLabel && (
                      <text x={i * dayWidth + 2} y={28} fill="#9ca3af" fontSize={8}>
                        {dayOfMonth}
                      </text>
                    )}
                    {showGrid && (
                      <line
                        x1={i * dayWidth} y1={HEADER_HEIGHT}
                        x2={i * dayWidth} y2={totalHeight}
                        stroke="#f0f0f0" strokeWidth={0.5}
                      />
                    )}
                  </g>
                );
              })}
            </g>

            {/* 출시일 마감선 (전체 높이) */}
            <line x1={releaseX} y1={0} x2={releaseX} y2={totalHeight} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 2" />
            <text x={releaseX - 6} y={HEADER_HEIGHT - 2} fill="#ef4444" fontSize={16} fontWeight="bold" textAnchor="middle">★</text>

            {/* 의존관계 화살표 (바 뒤에 렌더링) */}
            {filteredTasks.map((task) =>
              task.dependencies.map((depId) => {
                const fromSchedule = schedule.taskSchedules.get(depId);
                const toSchedule = schedule.taskSchedules.get(task.id);
                const fromRow = globalTaskRow.get(depId);
                const toRow = globalTaskRow.get(task.id);
                if (!fromSchedule || !toSchedule || fromRow === undefined || toRow === undefined) return null;

                const fromX = dateToX(fromSchedule.endDate);
                const fromY = HEADER_HEIGHT + fromRow * ROW_HEIGHT + 16;
                const toX = dateToX(toSchedule.startDate);
                const toY = HEADER_HEIGHT + toRow * ROW_HEIGHT + 16;
                const isHighlighted = hoveredRelated.has(depId) && hoveredRelated.has(task.id);

                return (
                  <g key={`${depId}-${task.id}`}>
                    <line
                      x1={fromX} y1={fromY} x2={toX} y2={toY}
                      stroke={isHighlighted ? '#1d4ed8' : '#9ca3af'}
                      strokeWidth={isHighlighted ? 1.5 : 0.8}
                      opacity={hoveredTaskId && !isHighlighted ? 0.2 : 0.7}
                      markerEnd="url(#arrowhead)"
                    />
                  </g>
                );
              })
            )}

            {/* 태스크 바 */}
            {filteredTasks.map((task) => {
              const taskSchedule = schedule.taskSchedules.get(task.id);
              if (!taskSchedule) return null;
              const row = globalTaskRow.get(task.id);
              if (row === undefined) return null;

              const y = HEADER_HEIGHT + row * ROW_HEIGHT + 6;
              const x = dateToX(taskSchedule.startDate);
              const barWidth = Math.max(daysBetween(taskSchedule.startDate, taskSchedule.endDate) * dayWidth, 4);

              const isCritical = taskSchedule.isOnCriticalPath;
              const isAffected = affectedSet.has(task.id);
              const isHovered = hoveredRelated.has(task.id);

              // 팀 색상
              const teamIdx = teamRowData.findIndex(t => t.team === task.team);
              const baseColor = TEAM_COLORS[teamIdx % TEAM_COLORS.length];

              if (task.type === 'event') {
                const cx = x;
                const cy = y + 10;
                const size = 6;
                const isDragging = dragState?.taskId === task.id;
                const translateX = isDragging ? dragOffset : 0;
                // 이벤트: 원형 마커 (컬러)
                const eventColor = '#4caf50';
                return (
                  <g key={task.id}
                    onMouseEnter={() => !dragState && setHoveredTaskId(task.id)}
                    onMouseLeave={() => !dragState && setHoveredTaskId(null)}
                    onMouseDown={(e) => { if (editingTaskLabel !== task.id) handleMouseDown(task.id, e); }}
                    onDoubleClick={(e) => { e.stopPropagation(); setEditingTaskLabel(task.id); setEditingTaskLabelText(task.name); }}
                    style={{ cursor: dragState ? 'grabbing' : 'grab', transform: `translate(${translateX}px, ${dragState?.taskId === task.id ? dragOffsetY : 0}px)` }}
                  >
                    <title>{task.name} ({task.team})</title>
                    <circle cx={cx} cy={cy} r={size} fill={isAffected ? '#f97316' : eventColor} stroke="none" opacity={hoveredTaskId && !isHovered ? 0.4 : 1} filter="url(#barShadow)" />
                    {editingTaskLabel === task.id ? (
                      <foreignObject x={cx + size + 2} y={cy - 8} width={180} height={20}>
                        <input
                          type="text"
                          value={editingTaskLabelText}
                          onChange={(e) => setEditingTaskLabelText(e.target.value)}
                          onBlur={() => {
                            if (editingTaskLabelText.trim()) updateTask(task.id, { name: editingTaskLabelText.trim() } as Partial<Task>);
                            setEditingTaskLabel(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              if (editingTaskLabelText.trim()) updateTask(task.id, { name: editingTaskLabelText.trim() } as Partial<Task>);
                              setEditingTaskLabel(null);
                            }
                            if (e.key === 'Escape') setEditingTaskLabel(null);
                          }}
                          className="w-full text-xs border rounded px-1"
                          style={{ fontSize: '8px', outline: 'none' }}
                          autoFocus
                        />
                      </foreignObject>
                    ) : (
                      <text x={cx + size + 4} y={cy + 3} fill="#333" fontWeight="600" fontSize={8} opacity={hoveredTaskId && !isHovered ? 0.4 : 1}>
                        [{taskSchedule.startDate.split('-')[1]}/{taskSchedule.startDate.split('-')[2]}] {task.name}
                      </text>
                    )}
                  </g>
                );
              }

              // 기간 태스크 바 (레퍼런스 스타일: 플랫, 연한 색상, 둥근 모서리)
              let gradId = `url(#grad-${teamIdx % TEAM_COLORS.length})`;
              if (isCritical) gradId = 'url(#grad-critical)';
              if (isAffected) gradId = 'url(#grad-affected)';

              const showLabelInside = barWidth > 30;
              const isDragging = dragState?.taskId === task.id;
              const translateX = isDragging ? dragOffset : 0;

              // 기간 텍스트 생성: 실제 기간 계산 (소수점 버림)
              const durationLabel = task.type === 'duration'
                ? (task.duration >= 7 ? `${Math.floor(task.duration / 7)}w` : `${task.duration}d`)
                : '';

              return (
                <g key={task.id}
                  onMouseEnter={() => !dragState && setHoveredTaskId(task.id)}
                  onMouseLeave={() => !dragState && setHoveredTaskId(null)}
                  onMouseDown={(e) => { if (editingTaskLabel !== task.id) handleMouseDown(task.id, e); }}
                  onDoubleClick={(e) => { e.stopPropagation(); setEditingTaskLabel(task.id); setEditingTaskLabelText(task.name); }}
                  style={{ cursor: dragState ? 'grabbing' : 'grab', transform: `translate(${translateX}px, ${dragState?.taskId === task.id ? dragOffsetY : 0}px)` }}
                >
                  <title>{task.name} ({task.team}) - {durationLabel}</title>
                  <rect
                    x={x} y={y} width={barWidth} height={24} rx={4}
                    fill="#ffffff"
                    stroke="#333333"
                    strokeWidth={1}
                    opacity={hoveredTaskId && !isHovered ? 0.35 : 1}
                    filter="url(#barShadow)"
                  />
                  {/* 왼쪽 리사이즈 핸들 */}
                  <rect
                    x={x} y={y} width={5} height={24} rx={2}
                    fill="transparent"
                    style={{ cursor: 'col-resize' }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      const taskSch = schedule.taskSchedules.get(task.id);
                      if (taskSch && task.type === 'duration') {
                        setResizeState({ taskId: task.id, edge: 'left', startX: e.clientX, originalStartDate: taskSch.startDate, originalDuration: task.duration });
                      }
                    }}
                  />
                  {/* 오른쪽 리사이즈 핸들 */}
                  <rect
                    x={x + barWidth - 5} y={y} width={5} height={24} rx={2}
                    fill="transparent"
                    style={{ cursor: 'col-resize' }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      const taskSch = schedule.taskSchedules.get(task.id);
                      if (taskSch && task.type === 'duration') {
                        setResizeState({ taskId: task.id, edge: 'right', startX: e.clientX, originalStartDate: taskSch.startDate, originalDuration: task.duration });
                      }
                    }}
                  />
                  {/* 리사이즈 프리뷰 */}
                  {resizeState?.taskId === task.id && resizeDx !== 0 && (() => {
                    let previewX = x;
                    let previewW = barWidth;
                    if (resizeState.edge === 'left') {
                      previewX = x + resizeDx;
                      previewW = barWidth - resizeDx;
                    } else {
                      previewW = barWidth + resizeDx;
                    }
                    if (previewW < 4) previewW = 4;
                    return (
                      <rect
                        x={previewX} y={y} width={previewW} height={24} rx={4}
                        fill="#6366f1"
                        opacity={0.2}
                        stroke="#6366f1"
                        strokeWidth={1}
                        strokeDasharray="3 2"
                      />
                    );
                  })()}
                  {editingTaskLabel === task.id ? (
                    <foreignObject x={x + 2} y={y + 2} width={barWidth - 4} height={20}>
                      <input
                        type="text"
                        value={editingTaskLabelText}
                        onChange={(e) => setEditingTaskLabelText(e.target.value)}
                        onBlur={() => {
                          if (editingTaskLabelText.trim()) updateTask(task.id, { name: editingTaskLabelText.trim() } as Partial<Task>);
                          setEditingTaskLabel(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (editingTaskLabelText.trim()) updateTask(task.id, { name: editingTaskLabelText.trim() } as Partial<Task>);
                            setEditingTaskLabel(null);
                          }
                          if (e.key === 'Escape') setEditingTaskLabel(null);
                        }}
                        className="w-full h-full text-xs border-none px-1"
                        style={{ fontSize: '9px', outline: 'none', background: 'transparent' }}
                        autoFocus
                      />
                    </foreignObject>
                  ) : (
                    showLabelInside && (() => {
                    const label = task.name;
                    // 기간 라벨 폭 추정 (3자리 기준: "14w" = 약 20px + 여유)
                    const durationLabelWidth = 28;
                    const availableForName = barWidth - 12 - durationLabelWidth;
                    // 라벨 폭 추정
                    const estimatedWidth = label.split('').reduce((sum, ch) => sum + (/[\u3131-\uD79D]/.test(ch) ? 6.5 : 4.5), 0);
                    let fontSize = 10;
                    let displayLabel = label;
                    if (estimatedWidth > availableForName && availableForName > 20) {
                      // 말줄임표로 자르기
                      const charWidth = estimatedWidth / label.length;
                      const maxChars = Math.floor(availableForName / charWidth) - 1;
                      displayLabel = maxChars > 0 ? label.slice(0, maxChars) + '…' : '…';
                    } else if (availableForName <= 20) {
                      displayLabel = '';
                    }
                    return (
                      <>
                        {displayLabel && (
                          <text x={x + 4} y={y + 12} fill="#333" fontSize={fontSize} fontWeight="600" dominantBaseline="middle" opacity={hoveredTaskId && !isHovered ? 0.4 : 1}>
                            {displayLabel}
                          </text>
                        )}
                        <text x={x + barWidth - 4} y={y + 12} fill="#666" fontSize={fontSize} fontWeight="500" textAnchor="end" dominantBaseline="middle" opacity={hoveredTaskId && !isHovered ? 0.4 : 1}>
                          {durationLabel}
                        </text>
                      </>
                    );
                  })()
                  )}
                </g>
              );
            })}

            {/* 각주 텍스트 */}
            {annotations.map((ann) => (
              <g
                key={ann.id}
                onMouseDown={(e) => {
                  if (editingAnnotation === ann.id) return;
                  e.stopPropagation();
                  setAnnotationDrag({ id: ann.id, startX: e.clientX, startY: e.clientY, origX: ann.x, origY: ann.y });
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingAnnotation(ann.id);
                  setEditingAnnotationText(ann.text);
                }}
                style={{ cursor: editingAnnotation === ann.id ? 'text' : annotationDrag?.id === ann.id ? 'grabbing' : 'grab' }}
              >
                {editingAnnotation === ann.id ? (
                  <foreignObject x={ann.x - 2} y={ann.y + HEADER_HEIGHT - 14} width={200} height={60}>
                    <textarea
                      value={editingAnnotationText}
                      onChange={(e) => setEditingAnnotationText(e.target.value)}
                      onBlur={() => {
                        if (editingAnnotationText.trim() === '') {
                          removeAnnotation(ann.id);
                        } else {
                          updateAnnotationText(ann.id, editingAnnotationText.trim());
                        }
                        setEditingAnnotation(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (editingAnnotationText.trim() === '') {
                            removeAnnotation(ann.id);
                          } else {
                            updateAnnotationText(ann.id, editingAnnotationText.trim());
                          }
                          setEditingAnnotation(null);
                        }
                      }}
                      className="w-full h-full text-[10px] border border-gray-300 rounded px-1 resize-none"
                      style={{ color: '#66bb6a', outline: 'none' }}
                      autoFocus
                    />
                  </foreignObject>
                ) : (
                  <text
                    x={ann.x}
                    y={ann.y + HEADER_HEIGHT}
                    fill="#66bb6a"
                    fontSize={10}
                    fontWeight="600"
                  >
                    {ann.text.split('\n').map((line, i) => (
                      <tspan key={i} x={ann.x} dy={i === 0 ? 0 : 14}>{line}</tspan>
                    ))}
                  </text>
                )}
              </g>
            ))}

            {/* 하단 시간축 */}
            <g>
              {Array.from({ length: totalDays }, (_, i) => {
                const d = parseLocalDate(addDays(minDate, i));
                const dayOfMonth = d.getDate();
                const isFirst = dayOfMonth === 1;
                const showLabel = dayOfMonth % labelInterval === 0 || dayOfMonth === 1;
                if (!isFirst && !showLabel) return null;
                const bottomY = HEADER_HEIGHT + totalRows * ROW_HEIGHT;
                return (
                  <g key={`bottom-${i}`}>
                    {isFirst && (
                      <text x={i * dayWidth + 2} y={bottomY + 12} fill="#6b7280" fontSize={9}>
                        {d.getMonth() + 1}월
                      </text>
                    )}
                    {showLabel && (
                      <text x={i * dayWidth + 2} y={bottomY + 24} fill="#9ca3af" fontSize={8}>
                        {dayOfMonth}
                      </text>
                    )}
                  </g>
                );
              })}
              {/* 하단 출시일 별 */}
              <text x={releaseX - 6} y={HEADER_HEIGHT + totalRows * ROW_HEIGHT + 18} fill="#ef4444" fontSize={16} fontWeight="bold" textAnchor="middle">★</text>
            </g>

            {/* 오늘 날짜 녹색 선 (가장 앞, 전체 높이) */}
            {(() => {
              const today = new Date();
              const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
              const todayX = dateToX(todayStr);
              if (todayX >= 0 && todayX <= chartWidth) {
                const todayDay = today.getDate();
                const bottomY = HEADER_HEIGHT + totalRows * ROW_HEIGHT;
                return (
                  <>
                    <line x1={todayX} y1={0} x2={todayX} y2={totalHeight} stroke="#4caf50" strokeWidth={1.5} strokeDasharray="4 2" opacity={0.7} />
                    {/* 상단 */}
                    <text x={todayX + 4} y={14} fill="#4caf50" fontSize={8} fontWeight="bold">오늘</text>
                    <text x={todayX + 4} y={28} fill="#4caf50" fontSize={8} fontWeight="bold">{todayDay}</text>
                    {/* 하단 */}
                    <text x={todayX + 4} y={bottomY + 12} fill="#4caf50" fontSize={8} fontWeight="bold">오늘</text>
                    <text x={todayX + 4} y={bottomY + 24} fill="#4caf50" fontSize={8} fontWeight="bold">{todayDay}</text>
                  </>
                );
              }
              return null;
            })()}

            <defs>
              <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#9ca3af" />
              </marker>
              <filter id="barShadow" x="-2%" y="-10%" width="104%" height="130%">
                <feDropShadow dx="1" dy="2" stdDeviation="1.5" floodOpacity="0.2" />
              </filter>
              {/* 팀별 그라데이션 정의 */}
              {teamRowData.map(({ team }, idx) => {
                const color = TEAM_COLORS[idx % TEAM_COLORS.length];
                return (
                  <linearGradient key={`grad-${team}`} id={`grad-${idx}`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={color} stopOpacity="0.2" />
                    <stop offset="100%" stopColor={color} stopOpacity="1" />
                  </linearGradient>
                );
              })}
              <linearGradient id="grad-critical" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#66bb6a" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#66bb6a" stopOpacity="1" />
              </linearGradient>
              <linearGradient id="grad-affected" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ff9800" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#ff9800" stopOpacity="0.9" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      {/* 드래그 중 날짜 툴팁 */}
      {dragTooltip && (
        <div
          className="fixed z-50 bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg pointer-events-none"
          style={{ left: dragTooltip.x, top: dragTooltip.y }}
        >
          {dragTooltip.date}
        </div>
      )}

      {/* 리사이즈 중 날짜 툴팁 */}
      {resizeTooltip && (
        <div
          className="fixed z-50 bg-indigo-700 text-white text-xs px-2 py-1 rounded shadow-lg pointer-events-none"
          style={{ left: resizeTooltip.x, top: resizeTooltip.y }}
        >
          {resizeTooltip.date}
        </div>
      )}

      {/* 신호등 색상 선택 팝오버 */}
      {signalPopover && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setSignalPopover(null)} />
          <div
            className="fixed z-50 bg-white rounded-lg shadow-xl border p-2 flex gap-2"
            style={{ left: signalPopover.x, top: signalPopover.y }}
            onMouseLeave={() => setSignalPopover(null)}
          >
            {[
              { color: '#4caf50', label: '안심', shadow: 'rgba(76,175,80,0.4)' },
              { color: '#ffc107', label: '주의', shadow: 'rgba(255,193,7,0.4)' },
              { color: '#f44336', label: '위험', shadow: 'rgba(244,67,54,0.4)' },
            ].map(({ color, label, shadow }) => (
              <button
                key={color}
                onClick={() => {
                  updateTeamSignal(signalPopover.team, color);
                  setSignalPopover(null);
                }}
                className="flex flex-col items-center gap-1 p-1.5 rounded hover:bg-gray-100 transition-colors"
                title={label}
              >
                <div
                  className="w-5 h-5 rounded-full"
                  style={{ backgroundColor: color, boxShadow: `0 2px 8px ${shadow}` }}
                />
                <span className="text-[8px] text-gray-600">{label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

