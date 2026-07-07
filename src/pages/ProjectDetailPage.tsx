import { TaskForm } from '../components/TaskPanel/TaskForm';
import { TaskList } from '../components/TaskPanel/TaskList';
import { GanttChart } from '../components/GanttChart/GanttChart';
import { ImpactAnalysis } from '../components/ImpactPanel/ImpactAnalysis';
import { useProjectStore } from '../store/projectStore';
import { exportToPptx } from '../export/pptxExporter';
import { AnnotationForm } from '../components/TaskPanel/AnnotationForm';
import { useRef } from 'react';

interface Props {
  onBack: () => void;
}

export function ProjectDetailPage({ onBack }: Props) {
  const currentProject = useProjectStore((s) => s.currentProject);
  const tasks = useProjectStore((s) => s.tasks);
  const schedule = useProjectStore((s) => s.schedule);
  const teamFilter = useProjectStore((s) => s.teamFilter);
  const updateReleaseDate = useProjectStore((s) => s.updateReleaseDate);

  if (!currentProject) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-full mx-auto px-4 py-3">
            <button
              onClick={onBack}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border rounded hover:bg-gray-50 transition-colors"
              aria-label="프로젝트 목록으로 돌아가기"
            >
              &#8592; 목록
            </button>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-8 text-center text-gray-500">
          프로젝트를 찾을 수 없습니다.
        </main>
      </div>
    );
  }

  const handleExport = async () => {
    if (!schedule) return;
    await exportToPptx(
      tasks,
      schedule,
      currentProject.releaseDate,
      currentProject.name,
      teamFilter.length > 0 ? teamFilter : undefined
    );
  };

  const ganttSectionRef = useRef<HTMLDivElement>(null);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border rounded hover:bg-gray-50 transition-colors"
              aria-label="프로젝트 목록으로 돌아가기"
            >
              &#8592; 목록
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">{currentProject.name}</h1>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>출시일:</span>
                <input
                  type="date"
                  value={currentProject.releaseDate}
                  onChange={(e) => updateReleaseDate(e.target.value)}
                  className="border rounded px-1.5 py-0.5 text-xs"
                  aria-label="출시일 변경"
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {schedule && (
              <div className={`text-xs px-2 py-1 rounded ${
                schedule.projectFeasible
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                {schedule.projectFeasible
                  ? '\u2705 출시일 준수 가능'
                  : `\u274C 출시일 초과 ${schedule.overdueDays}일`}
              </div>
            )}
            {schedule && (
              <button
                onClick={handleExport}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 flex items-center gap-1"
              >
                PPT 내보내기
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-full mx-auto px-4 py-4 space-y-4">
        {/* 지연 영향 분석 알림 */}
        <ImpactAnalysis />

        {/* 일정 마일스톤 */}
        <section className="bg-white rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-800">
              {currentProject.name} ({(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()} 기준)
            </h2>
            <button
              onClick={() => {
                const el = ganttSectionRef.current;
                if (!el) return;
                const w = window.open('', '_blank');
                if (!w) return;
                w.document.write(`<!DOCTYPE html><html><head><title>${currentProject.name} 일정</title><style>
                  * { box-sizing: border-box; }
                  body { margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #fff; }
                  .flex { display: flex; }
                  .flex-shrink-0 { flex-shrink: 0; }
                  .flex-1 { flex: 1; }
                  .overflow-hidden { overflow: hidden; }
                  .border { border: 1px solid #e5e7eb; }
                  .border-b { border-bottom: 1px solid #e5e7eb; }
                  .border-r { border-right: 1px solid #e5e7eb; }
                  .rounded { border-radius: 4px; }
                  .bg-white { background: #fff; }
                  .bg-gray-100 { background: #f3f4f6; }
                  .text-xs { font-size: 12px; }
                  .font-bold { font-weight: 700; }
                  .font-medium { font-weight: 500; }
                  .items-center { align-items: center; }
                  .justify-center { justify-content: center; }
                  .relative { position: relative; }
                  .absolute { position: absolute; }
                  .top-0 { top: 0; }
                  .bottom-0 { bottom: 0; }
                  .right-0 { right: 0; }
                  .left-0 { left: 0; }
                  .cursor-pointer { cursor: pointer; }
                  h2 { font-size: 16px; margin: 0; font-weight: bold; }
                  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
                  .download-btn { padding: 6px 12px; background: #4f46e5; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; }
                  .download-btn:hover { background: #4338ca; }
                </style></head><body>
                <div class="header">
                  <h2 id="project-title">${currentProject.name} (${(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); })()} 기준)</h2>
                  <button class="download-btn" onclick="downloadImage()">이미지 다운로드</button>
                </div>
                <div id="gantt-container"></div>
                <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
                <script>
                function downloadImage() {
                  // 제목 + 간트 전체를 캡처하기 위해 임시 wrapper 생성
                  const title = document.getElementById('project-title');
                  const container = document.getElementById('gantt-container');
                  if (!container) return;
                  const wrapper = document.createElement('div');
                  wrapper.style.background = '#fff';
                  wrapper.style.padding = '16px';
                  if (title) {
                    const titleClone = title.cloneNode(true);
                    wrapper.appendChild(titleClone);
                    wrapper.appendChild(document.createElement('br'));
                  }
                  const containerClone = container.cloneNode(true);
                  wrapper.appendChild(containerClone);
                  document.body.appendChild(wrapper);
                  
                  html2canvas(wrapper, { scale: 3, backgroundColor: '#ffffff', useCORS: true }).then(function(canvas) {
                    document.body.removeChild(wrapper);
                    const link = document.createElement('a');
                    link.download = '${currentProject.name}_' + new Date().getFullYear() + String(new Date().getMonth()+1).padStart(2,'0') + String(new Date().getDate()).padStart(2,'0') + '.png';
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                  }).catch(function(err) {
                    document.body.removeChild(wrapper);
                    alert('이미지 생성 실패: ' + err.message);
                  });
                }
                </script>
                </body></html>`);
                w.document.close();
                const clone = el.cloneNode(true) as HTMLElement;
                clone.style.width = '100%';
                w.document.getElementById('gantt-container')!.appendChild(clone);
              }}
              className="text-xs text-blue-600 hover:text-blue-800 border border-blue-300 rounded px-2 py-1 hover:bg-blue-50"
            >
              전체화면으로 보기
            </button>
          </div>

          <div ref={ganttSectionRef}>
            <GanttChart />
          </div>
        </section>

        {/* 태스크 관리 */}
        <section className="bg-white rounded-lg border p-3 space-y-2">
          <h2 className="text-sm font-bold text-gray-800">태스크 관리</h2>
          <div className="flex gap-2 items-stretch">
            <div className="flex-1 min-w-0">
              <TaskForm />
            </div>
            <div className="w-56 flex-shrink-0">
              <AnnotationForm />
            </div>
          </div>
          <TaskList />
        </section>
      </main>
    </div>
  );
}
