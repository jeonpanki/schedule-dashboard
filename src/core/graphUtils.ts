import { Task } from '../models/task';

/**
 * 의존관계 그래프에서 순환 참조(cycle)가 있는지 검사한다.
 * 선택적으로 새로운 의존관계를 추가했을 때 사이클이 발생하는지 사전 검증할 수 있다.
 */
export function hasCycle(
  tasks: Task[],
  newDependency?: { from: string; to: string }
): boolean {
  // 인접 리스트 구축 (from -> to: from이 완료되어야 to가 시작 가능)
  const adjacency = new Map<string, string[]>();
  for (const task of tasks) {
    adjacency.set(task.id, []);
  }
  for (const task of tasks) {
    for (const depId of task.dependencies) {
      // depId -> task.id: depId가 선행, task가 후행
      const edges = adjacency.get(depId);
      if (edges) {
        edges.push(task.id);
      }
    }
  }

  // 새로운 의존관계 추가 시뮬레이션
  if (newDependency) {
    const { from, to } = newDependency;
    // from이 to의 선행 태스크가 됨 → from -> to 간선 추가
    if (!adjacency.has(from)) {
      adjacency.set(from, []);
    }
    adjacency.get(from)!.push(to);
    if (!adjacency.has(to)) {
      adjacency.set(to, []);
    }
  }

  // DFS 기반 사이클 감지
  const WHITE = 0; // 미방문
  const GRAY = 1;  // 방문 중 (현재 경로에 있음)
  const BLACK = 2; // 방문 완료

  const color = new Map<string, number>();
  for (const id of adjacency.keys()) {
    color.set(id, WHITE);
  }

  function dfs(node: string): boolean {
    color.set(node, GRAY);
    const neighbors = adjacency.get(node) || [];
    for (const neighbor of neighbors) {
      const c = color.get(neighbor);
      if (c === GRAY) return true; // 사이클 발견
      if (c === WHITE && dfs(neighbor)) return true;
    }
    color.set(node, BLACK);
    return false;
  }

  for (const node of adjacency.keys()) {
    if (color.get(node) === WHITE) {
      if (dfs(node)) return true;
    }
  }

  return false;
}

/**
 * 태스크를 위상 정렬(topological sort)하여 반환한다.
 * 의존관계에 따라 선행 태스크가 먼저 오도록 정렬된다.
 * 사이클이 있으면 빈 배열을 반환한다.
 */
export function topologicalSort(tasks: Task[]): string[] {
  // 진입 차수 계산
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const task of tasks) {
    inDegree.set(task.id, 0);
    adjacency.set(task.id, []);
  }

  for (const task of tasks) {
    for (const depId of task.dependencies) {
      // depId -> task.id
      if (adjacency.has(depId)) {
        adjacency.get(depId)!.push(task.id);
      }
      inDegree.set(task.id, (inDegree.get(task.id) || 0) + 1);
    }
  }

  // Kahn's algorithm
  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const result: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);
    for (const neighbor of adjacency.get(node) || []) {
      const newDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  // 사이클이 있으면 모든 노드를 처리하지 못함
  return result.length === tasks.length ? result : [];
}

/**
 * 주어진 태스크의 모든 후속(descendant) 태스크 ID를 반환한다.
 * BFS 방식으로 의존관계 체인을 따라간다.
 */
export function getDescendants(tasks: Task[], taskId: string): string[] {
  // 인접 리스트: taskId -> 후행 태스크들
  const adjacency = new Map<string, string[]>();
  for (const task of tasks) {
    adjacency.set(task.id, []);
  }
  for (const task of tasks) {
    for (const depId of task.dependencies) {
      if (adjacency.has(depId)) {
        adjacency.get(depId)!.push(task.id);
      }
    }
  }

  // BFS
  const visited = new Set<string>();
  const queue = [taskId];
  visited.add(taskId);

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighbor of adjacency.get(current) || []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  // 자기 자신을 제외하고 반환
  visited.delete(taskId);
  return Array.from(visited);
}
