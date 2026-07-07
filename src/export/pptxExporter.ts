import PptxGenJS from 'pptxgenjs';
import { Task } from '../models/task';
import { ScheduleResult } from '../models/dependency';
import { daysBetween, addDays } from '../core/scheduler';

/**
 * pkindex.html 디자인으로 PPT 내보내기:
 * - 흰색 바 + 검정 테두리 (rx=4 스타일)
 * - 녹색 이벤트 DOT + [M/D] 라벨
 * - 빨간 별(★) 출시일
 * - 빨간 점선 오늘 날짜
 * - 팀별 구분선
 * - 1페이지 맞춤
 */
export async function exportToPptx(
  tasks: Task[],
  schedule: ScheduleResult,
  releaseDate: string,
  projectName: string,
  filter?: string[]
): Promise<void> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';

  const slide = pptx.addSlide();
  slide.background = { color: 'FFFFFF' };

  const filteredTasks = filter && filter.length > 0
    ? tasks.filter((t) => filter.includes(t.team))
    : tasks;

  if (filteredTasks.length === 0) return;

  // 오늘
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // 날짜 범위
  const allDates: string[] = [releaseDate, todayStr];
  for (const task of filteredTasks) {
    const s = schedule.taskSchedules.get(task.id);
    if (s) { allDates.push(s.startDate, s.endDate); }
  }
  allDates.sort();
  const minDate = allDates[0];
  const maxDate = allDates[allDates.length - 1];
  const totalDays = Math.min(daysBetween(minDate, maxDate) + 7, 365);

  // 레이아웃
  const chartLeft = 1.6;
  const chartTop = 1.1;
  const chartWidth = 11.0;
  const maxChartHeight = 5.8;
  const rowHeight = Math.min(0.3, maxChartHeight / filteredTasks.length);
  const baseFontSize = Math.max(5, Math.min(8, Math.floor(rowHeight * 22)));

  // 제목
  slide.addText(`${projectName} (${todayStr} 기준)`, {
    x: 0.3, y: 0.15, w: 8, h: 0.4,
    fontSize: 13, bold: true, color: '333333',
  });

  // 전제조건 안내
  slide.addText('※ 하기 일정은 출시를 위한 예상 마일스톤이며, 전제조건 만족 시 진행 가능', {
    x: 0.3, y: 0.5, w: 10, h: 0.25,
    fontSize: 7, color: '666666', italic: true,
  });

  // 시간축 (주간 라벨)
  let prevMonth = -1;
  for (let d = 0; d < totalDays; d += 7) {
    const dateStr = addDays(minDate, d);
    const parts = dateStr.split('-');
    const month = parseInt(parts[1]);
    const day = parseInt(parts[2]);
    const x = chartLeft + (d / totalDays) * chartWidth;

    if (month !== prevMonth) {
      slide.addText(`${month}월`, {
        x, y: chartTop - 0.5, w: 0.5, h: 0.2,
        fontSize: 8, bold: true, color: '333333',
      });
      prevMonth = month;
    }
    slide.addText(`${month}/${day}`, {
      x, y: chartTop - 0.3, w: 0.5, h: 0.2,
      fontSize: 6, color: '888888',
    });
  }

  // 오늘 빨간 점선
  const todayOffset = daysBetween(minDate, todayStr);
  const chartBottom = chartTop + filteredTasks.length * rowHeight + 0.2;
  if (todayOffset >= 0 && todayOffset <= totalDays) {
    const todayX = chartLeft + (todayOffset / totalDays) * chartWidth;
    slide.addShape(pptx.ShapeType.line, {
      x: todayX, y: chartTop - 0.05, w: 0, h: chartBottom - chartTop + 0.1,
      line: { color: 'F44336', width: 1.2, dashType: 'dash' },
    });
    const [, tm, td] = todayStr.split('-');
    slide.addText(`${parseInt(tm)}/${parseInt(td)}`, {
      x: todayX - 0.15, y: chartTop - 0.4, w: 0.35, h: 0.15,
      fontSize: 6, color: 'F44336', bold: true, align: 'center',
    });
  }

  // 팀별 그룹화
  const groups = new Map<string, Task[]>();
  for (const task of filteredTasks) {
    const list = groups.get(task.team) || [];
    list.push(task);
    groups.set(task.team, list);
  }

  // 이벤트 패킹: 팀 내에서 이벤트끼리 겹치지 않으면 한 줄에 배치
  // 먼저 총 행수를 계산
  let totalRows = 0;
  const teamRowInfo: { team: string; rows: { task: Task; localRow: number }[] }[] = [];

  for (const [team, groupTasks] of groups) {
    const durationTasks = groupTasks.filter(t => t.type === 'duration');
    const eventTasks = groupTasks.filter(t => t.type === 'event');

    const rows: { task: Task; localRow: number }[] = [];
    // 기간 태스크는 각각 한 줄
    let localRow = 0;
    for (const task of durationTasks) {
      rows.push({ task, localRow });
      localRow++;
    }
    // 이벤트 패킹: 겹치지 않으면 같은 줄
    const eventSlots: { endOffset: number }[] = [];
    for (const task of eventTasks) {
      const s = schedule.taskSchedules.get(task.id);
      if (!s) continue;
      const offset = daysBetween(minDate, s.startDate);
      // 라벨 폭 추정 (약 15자 공간)
      const labelEnd = offset + 15;

      let placed = false;
      for (let si = 0; si < eventSlots.length; si++) {
        if (eventSlots[si].endOffset <= offset) {
          eventSlots[si].endOffset = labelEnd;
          rows.push({ task, localRow: localRow + si });
          placed = true;
          break;
        }
      }
      if (!placed) {
        eventSlots.push({ endOffset: labelEnd });
        rows.push({ task, localRow: localRow + eventSlots.length - 1 });
      }
    }
    const teamTotalRows = localRow + eventSlots.length;
    teamRowInfo.push({ team, rows });
    totalRows += Math.max(teamTotalRows, 1);
  }

  // 행 높이 재계산 (패킹 적용)
  const packedRowHeight = Math.min(0.3, maxChartHeight / totalRows);
  const packedFontSize = Math.max(5, Math.min(8, Math.floor(packedRowHeight * 22)));

  let globalRow = 0;
  for (const { team, rows } of teamRowInfo) {
    const teamStartRow = globalRow;
    const maxLocalRow = rows.length > 0 ? Math.max(...rows.map(r => r.localRow)) + 1 : 1;

    // 팀 라벨
    slide.addText(team, {
      x: 0.15, y: chartTop + teamStartRow * packedRowHeight,
      w: 1.35, h: maxLocalRow * packedRowHeight,
      fontSize: Math.max(6, Math.min(9, Math.floor(packedRowHeight * 28))),
      bold: true, color: '333333', valign: 'middle',
    });

    for (const { task, localRow } of rows) {
      const taskSchedule = schedule.taskSchedules.get(task.id);
      if (!taskSchedule) continue;

      const y = chartTop + (teamStartRow + localRow) * packedRowHeight;
      const startOffset = daysBetween(minDate, taskSchedule.startDate);
      const endOffset = daysBetween(minDate, taskSchedule.endDate);

      if (task.type === 'event') {
        const cx = chartLeft + (startOffset / totalDays) * chartWidth;
        slide.addShape(pptx.ShapeType.ellipse, {
          x: cx - 0.06, y: y + packedRowHeight * 0.25, w: 0.12, h: 0.12,
          fill: { color: '4CAF50' }, line: { type: 'none' },
        });
        const [, em, ed] = taskSchedule.startDate.split('-');
        slide.addText(`[${parseInt(em)}/${parseInt(ed)}] ${task.name}`, {
          x: cx + 0.1, y, w: 2.5, h: packedRowHeight,
          fontSize: packedFontSize, color: '333333', valign: 'middle',
        });
      } else {
        const barLeft = chartLeft + (startOffset / totalDays) * chartWidth;
        const barWidth = Math.max(((endOffset - startOffset) / totalDays) * chartWidth, 0.05);

        slide.addShape(pptx.ShapeType.rect, {
          x: barLeft, y: y + packedRowHeight * 0.1, w: barWidth, h: packedRowHeight * 0.8,
          fill: { color: 'FFFFFF' },
          line: { color: '333333', width: 0.75 },
          rectRadius: 0.01,
        });

        const duration = task.type === 'duration' ? task.duration : 0;
        const durationLabel = duration >= 7 ? `${Math.floor(duration / 7)}w` : `${duration}d`;

        if (barWidth > 0.6) {
          slide.addText(task.name, {
            x: barLeft + 0.03, y, w: barWidth * 0.7, h: packedRowHeight,
            fontSize: packedFontSize, color: '333333', valign: 'middle',
          });
          slide.addText(durationLabel, {
            x: barLeft + barWidth * 0.7, y, w: barWidth * 0.28, h: packedRowHeight,
            fontSize: packedFontSize, color: '666666', valign: 'middle', align: 'right',
          });
        } else {
          slide.addText(`${task.name} ${durationLabel}`, {
            x: barLeft + barWidth + 0.03, y, w: 2, h: packedRowHeight,
            fontSize: packedFontSize, color: '555555', valign: 'middle',
          });
        }
      }
    }

    globalRow += maxLocalRow;

    // 팀 구분 가로선
    const teamBottomY = chartTop + globalRow * packedRowHeight;
    slide.addShape(pptx.ShapeType.line, {
      x: chartLeft, y: teamBottomY, w: chartWidth, h: 0,
      line: { color: 'CCCCCC', width: 0.5 },
    });
  }

  // 간트 차트 전체 감싸는 테두리
  const finalBottom = chartTop + globalRow * packedRowHeight;
  slide.addShape(pptx.ShapeType.rect, {
    x: chartLeft - 0.05, y: chartTop - 0.55, w: chartWidth + 0.1, h: finalBottom - chartTop + 0.7,
    fill: { type: 'none' },
    line: { color: '999999', width: 1 },
    rectRadius: 0.02,
  });

  // 출시일 빨간 별(★) + 점선
  const releaseOffset = daysBetween(minDate, releaseDate);
  if (releaseOffset >= 0 && releaseOffset <= totalDays) {
    const releaseX = chartLeft + (releaseOffset / totalDays) * chartWidth;
    slide.addText('\u2605', {
      x: releaseX - 0.1, y: chartTop - 0.2, w: 0.2, h: 0.2,
      fontSize: 12, color: 'F44336', align: 'center', valign: 'middle',
    });
    slide.addShape(pptx.ShapeType.line, {
      x: releaseX, y: chartTop, w: 0, h: finalBottom - chartTop,
      line: { color: 'F44336', width: 0.8, dashType: 'dash' },
    });
    const [, rm, rd] = releaseDate.split('-');
    slide.addText(`[${parseInt(rm)}/${parseInt(rd)}] 출시`, {
      x: releaseX - 0.3, y: finalBottom + 0.02, w: 0.7, h: 0.15,
      fontSize: 6, color: 'F44336', align: 'center', bold: true,
    });
  }

  await pptx.writeFile({ fileName: `${projectName}_일정표.pptx` });
}
