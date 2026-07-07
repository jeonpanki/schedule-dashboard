# Design Document

## Overview

일정관리 대시보드는 React + TypeScript 기반 SPA로 구현하며, 프론트엔드에서 일정 계산 로직을 수행하고 브라우저 로컬 스토리지를 활용하여 데이터를 영구 저장한다. 간트 차트는 커스텀 SVG 기반 컴포넌트로 구현하고, 파워포인트 내보내기는 pptxgenjs 라이브러리를 활용한다.

## Architecture

- **프론트엔드**: React 18 + TypeScript + Vite
- **상태 관리**: Zustand (경량 상태 관리)
- **스타일링**: Tailwind CSS
- **간트 차트**: 커스텀 SVG 컴포넌트
- **파워포인트 생성**: pptxgenjs
- **데이터 저장**: localStorage (자동 저장 포함)
- **테스트**: Vitest + React Testing Library

### 디렉토리 구조

```
src/
├── components/
│   ├── GanttChart/
│   │   ├── GanttChart.tsx
│   │   ├── GanttRow.tsx
│   │   ├── DependencyArrow.tsx
│   │   ├── TimeAxis.tsx
│   │   └── DeadlineLine.tsx
│   ├── TaskPanel/
│   │   ├── TaskForm.tsx
│   │   ├── TaskList.tsx
│   │   └── DependencySelector.tsx
│   ├── ProjectPanel/
│   │   ├── ProjectForm.tsx
│   │   └── ProjectList.tsx
│   ├── FilterBar/
│   │   └── TeamFilter.tsx
│   └── ImpactPanel/
│       └── ImpactAnalysis.tsx
├── core/
│   ├── scheduler.ts
│   ├── criticalPath.ts
│   ├── impactAnalysis.ts
│   └── graphUtils.ts
├── models/
│   ├── project.ts
│   ├── task.ts
│   └── dependency.ts
├── store/
│   └── projectStore.ts
├── export/
│   └── pptxExporter.ts
├── storage/
│   └── localStorage.ts
└── App.tsx
```

## Components and Interfaces

## Data Models

```typescript
// models/project.ts
interface Project {
  id: string;
  name: string;
  releaseDate: string; // ISO date string
  teams: string[];
  createdAt: string;
  updatedAt: string;
}

// models/task.ts
type TaskType = 'duration' | 'event';
type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'delayed';

interface BaseTask {
  id: string;
  projectId: string;
  name: string;
  team: string;
  type: TaskType;
  status: TaskStatus;
  dependencies: string[]; // predecessor task IDs
  calculatedStartDate?: string;
  calculatedEndDate?: string;
  actualEndDate?: string;
}

interface DurationTask extends BaseTask {
  type: 'duration';
  duration: number; // days
}

interface EventTask extends BaseTask {
  type: 'event';
  targetDate: string; // ISO date string
}

type Task = DurationTask | EventTask;

// models/dependency.ts
interface ScheduleResult {
  taskSchedules: Map<string, TaskSchedule>;
  criticalPath: string[];
  projectFeasible: boolean;
  overdueDays: number;
}

interface TaskSchedule {
  taskId: string;
  startDate: string;
  endDate: string;
  slack: number;
  isOnCriticalPath: boolean;
}
```

### Core Module Interfaces

```typescript
// core/scheduler.ts
function calculateBackwardSchedule(tasks: Task[], releaseDate: string): ScheduleResult;
function calculateForwardPass(tasks: Task[]): Map<string, { es: string; ef: string }>;

// core/criticalPath.ts
function findCriticalPath(tasks: Task[], scheduleResult: ScheduleResult): string[];

// core/graphUtils.ts
function hasCycle(tasks: Task[], newDependency?: { from: string; to: string }): boolean;
function topologicalSort(tasks: Task[]): string[];
function getDescendants(tasks: Task[], taskId: string): string[];

// core/impactAnalysis.ts
interface DelayImpact {
  delayedTaskId: string;
  delayDays: number;
  affectedTasks: string[];
  newSchedule: ScheduleResult;
  feasible: boolean;
  overdueDays: number;
}
function analyzeDelay(tasks: Task[], taskId: string, actualEndDate: string, releaseDate: string): DelayImpact;

// export/pptxExporter.ts
function exportToPptx(tasks: Task[], schedule: ScheduleResult, filter?: string[]): Promise<void>;

// storage/localStorage.ts
function saveProject(project: Project, tasks: Task[]): void;
function loadProject(projectId: string): { project: Project; tasks: Task[] } | null;
function listProjects(): Project[];
```

### Store Interface

```typescript
// store/projectStore.ts
interface ProjectStore {
  projects: Project[];
  currentProject: Project | null;
  tasks: Task[];
  schedule: ScheduleResult | null;
  teamFilter: string[];
  delayImpact: DelayImpact | null;

  createProject(name: string, releaseDate: string): void;
  selectProject(projectId: string): void;
  updateReleaseDate(date: string): void;

  addTask(task: Omit<Task, 'id'>): void;
  updateTask(taskId: string, updates: Partial<Task>): void;
  deleteTask(taskId: string): void;
  setTaskActualEndDate(taskId: string, actualEndDate: string): void;

  addDependency(fromTaskId: string, toTaskId: string): boolean;
  removeDependency(fromTaskId: string, toTaskId: string): void;

  setTeamFilter(teams: string[]): void;
  clearTeamFilter(): void;

  recalculateSchedule(): void;
}
```

## Error Handling

- **순환 의존관계**: `addDependency` 호출 시 `hasCycle` 검증 실패 시 오류 메시지를 UI에 표시하고 의존관계 추가를 거부한다
- **잘못된 날짜 입력**: 출시일이 과거이거나 태스크 기간이 0 이하인 경우 유효성 검사 오류를 표시한다
- **로컬 스토리지 용량 초과**: 저장 실패 시 사용자에게 알림을 표시하고 데이터 정리를 권고한다
- **파워포인트 생성 실패**: pptxgenjs 오류 발생 시 사용자에게 재시도 안내를 표시한다
- **의존관계 무결성**: 태스크 삭제 시 연관된 모든 의존관계를 자동 정리하여 고아 참조를 방지한다

## Correctness Properties

### Property 1: 역산 일정 일관성 (Invariant)

**Validates: Requirements 3.3, 4.1**

모든 의존관계에서 후행 태스크의 시작일은 선행 태스크의 종료일 이후여야 한다.

```
For all (predecessor, successor) in dependencies:
  successor.startDate >= predecessor.endDate
```

### Property 2: 크리티컬 패스 슬랙 제로 (Invariant)

**Validates: Requirements 4.2, 4.3**

크리티컬 패스에 속한 모든 태스크의 슬랙은 0이어야 한다.

```
For all task in criticalPath:
  task.slack == 0
```

### Property 3: 순환 참조 불가 (Invariant)

**Validates: Requirements 3.2**

의존관계 그래프는 항상 DAG(Directed Acyclic Graph)를 유지해야 한다.

```
hasCycle(dependencyGraph) == false
```

### Property 4: 지연 전파 정확성 (Metamorphic)

**Validates: Requirements 5.3**

태스크 A가 N일 지연되고 후행 태스크 B가 A에만 의존할 경우, B의 시작일은 최소 N일 뒤로 밀려야 한다.

```
If delay(A) == N days AND B.dependencies == [A]:
  new(B.startDate) >= old(B.startDate) + N
```

### Property 5: 출시일 준수 판정 정확성 (Invariant)

**Validates: Requirements 5.4, 5.5, 5.6**

프로젝트가 feasible이면 모든 태스크의 종료일이 출시일 이전이어야 한다.

```
If projectFeasible == true:
  For all task: task.endDate <= releaseDate
```

### Property 6: 태스크 삭제 시 참조 무결성 (Invariant)

**Validates: Requirements 2.4**

삭제된 태스크 ID는 어떤 태스크의 dependencies 배열에도 존재하지 않아야 한다.

```
After delete(taskId):
  For all task: taskId NOT IN task.dependencies
```

### Property 7: 데이터 저장/복원 라운드트립 (Round-Trip)

**Validates: Requirements 9.1, 9.2**

프로젝트를 저장하고 불러온 결과는 저장 전 상태와 동일해야 한다.

```
load(save(project)) == project
```

### Property 8: 팀 필터링 정확성 (Metamorphic)

**Validates: Requirements 7.1, 7.2**

특정 팀으로 필터링한 결과의 모든 태스크는 해당 팀에 속해야 한다.

```
For all task in filter(tasks, teams):
  task.team IN teams
```

### Property 9: 이벤트 태스크 기간 제로 (Invariant)

**Validates: Requirements 2.2, 2.6**

이벤트 태스크의 시작일과 종료일은 항상 동일해야 한다.

```
For all eventTask where type == 'event':
  eventTask.startDate == eventTask.endDate
```

## Testing Strategy

- **속성 기반 테스트 (PBT)**: 핵심 알고리즘(역산 계산, 크리티컬 패스, 순환 감지, 지연 전파)에 대해 fast-check를 사용한 속성 기반 테스트 수행
- **단위 테스트**: Vitest로 각 core 모듈 함수의 단위 테스트 작성
- **컴포넌트 테스트**: React Testing Library로 UI 컴포넌트의 렌더링 및 인터랙션 테스트
- **통합 테스트**: 스토어와 core 모듈 간의 데이터 흐름 통합 테스트
- **라운드트립 테스트**: 저장/복원 기능의 데이터 무결성 검증
