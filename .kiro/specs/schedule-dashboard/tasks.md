# Implementation Plan

## Overview

일정관리 대시보드의 구현을 15개 태스크 그룹으로 나누어 진행한다. 데이터 모델과 핵심 알고리즘을 먼저 구현한 후, 스토어와 UI를 순차적으로 구축한다.

## Tasks

- [x] 1. 프로젝트 초기 설정: Vite + React + TypeScript 프로젝트 초기화, Tailwind CSS 설정, Zustand 설치, Vitest + React Testing Library + fast-check 설정, 디렉토리 구조 생성
- [x] 2. 데이터 모델 정의: Project 타입 정의 (models/project.ts), Task 타입 정의 - DurationTask와 EventTask (models/task.ts), ScheduleResult와 TaskSchedule 타입 정의 (models/dependency.ts)
- [x] 3. DAG 유틸리티 구현: 의존관계 그래프 구축 함수, DFS 기반 순환 참조 감지 함수, 위상 정렬 함수, 후속 태스크 탐색 함수 구현 (core/graphUtils.ts)
- [ ] 4. [PBT] 순환 참조 감지 속성 테스트: 임의의 DAG에 간선 추가 시 사이클이 정확히 감지되는지 검증 (Property 3)
- [x] 5. 역산 일정 계산 엔진: Backward pass 일정 계산 함수, Forward pass 및 슬랙 산출, 이벤트 태스크 처리(기간 0일) 구현 (core/scheduler.ts)
- [ ] 6. [PBT] 역산 일정 일관성 속성 테스트: 모든 의존관계에서 후행 태스크 시작일 >= 선행 태스크 종료일 검증 (Property 1)
- [ ] 7. [PBT] 이벤트 태스크 기간 제로 속성 테스트: 이벤트 태스크의 시작일 == 종료일 검증 (Property 9)
- [x] 8. 크리티컬 패스 계산: 크리티컬 패스 식별 함수 구현 (core/criticalPath.ts)
- [ ] 9. [PBT] 크리티컬 패스 슬랙 제로 속성 테스트: 크리티컬 패스 태스크의 슬랙이 0인지 검증 (Property 2)
- [x] 10. 지연 영향 분석: 지연 감지 함수, 영향받는 후속 태스크 산출, 일정 재계산 및 출시일 준수 여부 판정 구현 (core/impactAnalysis.ts)
- [ ] 11. [PBT] 지연 전파 정확성 속성 테스트: 지연일수만큼 후속 태스크가 밀리는지 검증 (Property 4)
- [ ] 12. [PBT] 출시일 준수 판정 속성 테스트: feasible이면 모든 태스크 종료일이 출시일 이전인지 검증 (Property 5)
- [x] 13. Zustand 스토어 구현: 프로젝트 CRUD, 태스크 CRUD (기간/이벤트), 의존관계 관리 (순환 감지 포함), 태스크 상태 관리, 팀 필터, 일정 자동 재계산 트리거 (store/projectStore.ts)
- [ ] 14. [PBT] 태스크 삭제 시 참조 무결성 속성 테스트: 삭제된 태스크 ID가 dependencies에 남지 않는지 검증 (Property 6)
- [x] 15. 로컬 스토리지 저장/복원: 프로젝트 데이터 직렬화/역직렬화, 자동 저장 (debounced), 프로젝트 목록 관리 (storage/localStorage.ts)
- [ ] 16. [PBT] 저장/복원 라운드트립 속성 테스트: load(save(project)) == project 검증 (Property 7)
- [x] 17. 프로젝트 관리 UI: 프로젝트 생성 폼, 프로젝트 목록, 출시일 변경 UI (components/ProjectPanel/)
- [x] 18. 태스크 관리 UI: 태스크 생성 폼 (기간/이벤트 구분), 태스크 목록, 의존관계 선택 UI, 태스크 상태 및 실제 완료일 입력 (components/TaskPanel/)
- [x] 19. 간트 차트 구현: 시간축, 기간 태스크 바, 이벤트 마름모 마커, 의존관계 화살표, 출시일 마감선, 팀별 행 그룹화, 크리티컬 패스 색상 강조, 지연 영향 강조, 마우스 호버 의존관계 강조, 좌측 태스크 정보 테이블 (components/GanttChart/)
- [x] 20. 팀 필터링 UI: 팀 필터 컴포넌트, 복수 팀 선택 및 전체 보기 복원 기능 (components/FilterBar/)
- [ ] 21. [PBT] 팀 필터링 정확성 속성 테스트: 필터 결과의 모든 태스크가 선택 팀에 속하는지 검증 (Property 8)
- [x] 22. 지연 영향 분석 UI: 영향 분석 패널, 영향받는 태스크 목록, 출시일 준수 여부 및 초과 일수 표시 (components/ImpactPanel/)
- [x] 23. 파워포인트 내보내기: pptxgenjs 설정, 팀별 행 및 태스크 바 생성, 크리티컬 패스 색상/이벤트 마름모, 출시일 마감선, 팀 필터 반영, .pptx 다운로드 (export/pptxExporter.ts)
- [x] 24. 앱 통합 및 레이아웃: App.tsx 메인 레이아웃 구성, 전체 컴포넌트 통합, 반응형 레이아웃, 통합 동작 확인 및 버그 수정

## Task Dependency Graph

```json
{
  "waves": [
    ["1"],
    ["2"],
    ["3"],
    ["4", "5"],
    ["6", "7", "8", "10"],
    ["9", "11", "12", "13", "15"],
    ["14", "16", "17", "18", "19", "20", "22"],
    ["21", "23"],
    ["24"]
  ]
}
```

## Notes

- PBT 태스크는 fast-check 라이브러리를 사용하여 임의 입력에 대한 속성 기반 테스트를 수행한다
- 핵심 알고리즘(core/) 구현을 먼저 완료한 후 UI 컴포넌트를 구현하는 순서로 진행한다
- 각 PBT 태스크는 해당 core 모듈 구현 직후에 작성하여 로직 정확성을 즉시 검증한다
