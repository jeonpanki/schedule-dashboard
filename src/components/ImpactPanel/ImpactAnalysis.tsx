import { useProjectStore } from '../../store/projectStore';

export function ImpactAnalysis() {
  const delayImpact = useProjectStore((s) => s.delayImpact);
  const tasks = useProjectStore((s) => s.tasks);

  if (!delayImpact || delayImpact.delayDays === 0) return null;

  const delayedTask = tasks.find((t) => t.id === delayImpact.delayedTaskId);
  const affectedTaskNames = delayImpact.affectedTasks
    .map((id) => tasks.find((t) => t.id === id)?.name || id);

  return (
    <div
      className={`p-4 rounded-lg border ${
        delayImpact.feasible
          ? 'bg-yellow-50 border-yellow-300'
          : 'bg-red-50 border-red-300'
      }`}
      role="alert"
      aria-live="polite"
    >
      <h3 className="font-bold text-sm mb-2">
        ⚠️ 지연 영향 분석
      </h3>
      <div className="text-sm space-y-1">
        <p>
          <span className="font-medium">지연 태스크:</span>{' '}
          {delayedTask?.name || delayImpact.delayedTaskId}
        </p>
        <p>
          <span className="font-medium">지연 일수:</span>{' '}
          <span className="text-red-600 font-bold">{delayImpact.delayDays}일</span>
        </p>
        <p>
          <span className="font-medium">영향받는 후속 태스크 ({affectedTaskNames.length}개):</span>
        </p>
        {affectedTaskNames.length > 0 && (
          <ul className="list-disc list-inside ml-2 text-xs text-gray-700">
            {affectedTaskNames.map((name, i) => (
              <li key={i}>{name}</li>
            ))}
          </ul>
        )}
        <div className="mt-2 pt-2 border-t">
          {delayImpact.feasible ? (
            <p className="text-green-700 font-medium">
              ✅ 출시일 준수 가능 (슬랙 내 흡수)
            </p>
          ) : (
            <p className="text-red-700 font-medium">
              ❌ 출시일 초과 — <span className="font-bold">{delayImpact.overdueDays}일</span> 지연 예상. 출시일 변경이 필요합니다.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
