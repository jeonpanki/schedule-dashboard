# 일정관리 대시보드 (Schedule Dashboard) v1.0.2

TPM을 위한 프로젝트 일정 관리 도구입니다.  
팀별 태스크를 마일스톤으로 시각화하고, 의존관계 관리, 지연 영향 분석, PPT/이미지 내보내기를 지원합니다.

## 주요 기능

- 프로젝트 생성 및 출시일 설정
- 태스크(기간/이벤트) 추가, 수정, 삭제
- 태스크 간 선행/후행 의존관계 설정
- 간트 차트(일정 마일스톤) 시각화
- 드래그&드롭으로 일정 이동 및 리사이즈
- 팀별 신호등(안심/주의/위험) 표시
- PPT 내보내기
- 전체화면 보기 + 고해상도 이미지 다운로드
- 각주 추가 및 드래그 이동
- 데이터 내보내기/가져오기 (.dat)
- Electron 기반 Windows exe 설치 파일

## 설치 및 실행

### 개발 모드

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:5173 접속

### Windows exe 빌드

```bash
npm run build
npx electron-builder --win
```

`release/` 폴더에 설치 파일 생성

### macOS dmg 빌드 (macOS에서만 가능)

```bash
npm run build
npx electron-builder --mac
```

## 기술 스택

- React 18 + TypeScript + Vite
- Zustand (상태 관리)
- Tailwind CSS
- SVG 기반 간트 차트
- pptxgenjs (PPT 내보내기)
- Electron (데스크톱 앱)
- localStorage (데이터 저장)
