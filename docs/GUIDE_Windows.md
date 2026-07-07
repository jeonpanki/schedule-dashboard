# Windows 사용자 설치 및 실행 가이드

## 방법 1: exe 설치 파일 사용 (가장 간단)

별도 개발 환경 없이 설치 파일만으로 바로 사용할 수 있습니다.

### 1단계: 설치 파일 받기

관리자에게 `일정관리 대시보드 Setup 1.0.2.exe` 파일을 전달받습니다.

### 2단계: 설치

1. exe 파일을 더블클릭
2. 설치 경로 선택 (기본값 권장)
3. "설치" 클릭

> Windows Defender SmartScreen 경고가 나타나면:
> "추가 정보" 클릭 → "실행" 클릭

### 3단계: 실행

- 바탕화면 또는 시작 메뉴에서 "일정관리 대시보드" 실행
- 별도 인터넷 연결 없이 로컬에서 동작합니다

---

## 방법 2: 브라우저에서 실행 (개발 서버)

소스를 다운로드하여 브라우저에서 실행할 수 있습니다.

### 1단계: Node.js 설치

- https://nodejs.org 에서 LTS 버전 다운로드 및 설치
- 설치 시 "Add to PATH" 옵션 체크

설치 확인 (PowerShell 또는 명령 프롬프트):
```bash
node --version   # v18 이상
npm --version    # v9 이상
```

### 2단계: 소스 다운로드

GitHub에서 ZIP 다운로드:
- https://github.com/jeonpanki/schedule-dashboard 접속
- 초록색 "Code" 버튼 클릭 → "Download ZIP" 선택
- 다운로드된 ZIP 파일 압축 해제

또는 Git이 설치되어 있다면:
```bash
git clone https://github.com/jeonpanki/schedule-dashboard.git
cd schedule-dashboard
```

### 3단계: 의존성 설치

프로젝트 폴더에서 PowerShell 또는 명령 프롬프트 실행:
```bash
npm install
```

### 4단계: 개발 서버 실행

```bash
npm run dev
```

터미널에 다음과 같이 표시됩니다:
```
VITE v5.x.x  ready in XXX ms
➜  Local:   http://localhost:5173/
```

### 5단계: 브라우저에서 접속

Chrome, Edge 등 브라우저에서 http://localhost:5173 접속

---

## 방법 3: exe 직접 빌드

소스에서 직접 설치 파일을 만들 수 있습니다.

### 1~3단계: 위 방법 2와 동일

### 4단계: 빌드

```bash
npm run build
npx electron-builder --win
```

### 5단계: 설치

`release/` 폴더에 `일정관리 대시보드 Setup x.x.x.exe` 파일이 생성됩니다.
이 파일을 다른 PC에 배포하여 설치할 수 있습니다.

---

## 데이터 관리

- 데이터는 앱 내 localStorage에 저장됩니다
- **다른 PC로 데이터 이동:**
  1. 프로젝트 목록 → "데이터 내보내기 (.dat)" 클릭 → 파일 저장
  2. 다른 PC에서 "데이터 가져오기" → .dat 파일 선택
- **브라우저 ↔ exe 앱 간 데이터 이동도 동일한 방법으로 가능**

---

## 문제 해결

| 증상 | 해결 방법 |
|------|-----------|
| exe 설치 시 SmartScreen 경고 | "추가 정보" → "실행" 클릭 |
| `npm` 명령어 인식 안됨 | Node.js 재설치 후 터미널 재시작 |
| 실행 정책 오류 (PowerShell) | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` 실행 |
| `npm install` 에러 | `rmdir /s /q node_modules` 후 `npm install` 재시도 |
| 프로젝트 데이터가 안 보임 | "데이터 가져오기"로 .dat 파일 로드 |
| 빌드 시 esbuild EPERM 에러 | 다른 터미널에서 실행 중인 vite 종료 후 재시도 |

---

## 최소 요구사항

- Windows 10 이상
- Node.js 18 이상 (방법 2, 3만 해당)
- npm 9 이상 (방법 2, 3만 해당)
- 브라우저: Chrome 90+, Edge 90+, Firefox 90+
- 디스크 공간: 약 200MB (exe 설치 시)
