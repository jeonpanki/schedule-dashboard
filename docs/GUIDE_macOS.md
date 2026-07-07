# macOS 사용자 설치 및 실행 가이드

## 방법 1: 브라우저에서 바로 사용 (가장 간단)

별도 설치 없이 브라우저에서 실행할 수 있습니다.

### 1단계: 소스 다운로드

GitHub에서 ZIP 다운로드:
- https://github.com/jeonpanki/schedule-dashboard 접속
- 초록색 "Code" 버튼 클릭 → "Download ZIP" 선택
- 다운로드된 ZIP 파일 압축 해제

또는 터미널에서:
```bash
git clone https://github.com/jeonpanki/schedule-dashboard.git
cd schedule-dashboard
```

### 2단계: Node.js 설치

Node.js가 없다면 먼저 설치합니다:
- https://nodejs.org 에서 LTS 버전 다운로드 및 설치
- 또는 Homebrew 사용: `brew install node`

설치 확인:
```bash
node --version   # v18 이상
npm --version    # v9 이상
```

### 3단계: 의존성 설치

프로젝트 폴더에서:
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

Safari, Chrome 등 브라우저에서 http://localhost:5173 접속하면 바로 사용할 수 있습니다.

---

## 방법 2: macOS 데스크톱 앱으로 빌드 (dmg)

Electron 기반 네이티브 앱을 직접 빌드할 수 있습니다.

### 1단계~3단계

위 방법 1의 1~3단계와 동일합니다.

### 4단계: 빌드

```bash
npm run build
npx electron-builder --mac
```

### 5단계: 설치

`release/` 폴더에 `.dmg` 파일이 생성됩니다.
- dmg 파일을 더블클릭하여 열기
- "일정관리 대시보드" 앱을 Applications 폴더로 드래그
- Applications에서 실행

> 참고: "확인되지 않은 개발자" 경고가 나타나면:
> 시스템 설정 → 개인정보 및 보안 → "확인 없이 열기" 클릭

---

## 방법 3: 빌드된 HTML만 사용 (Node.js 설치 후)

가장 가벼운 방법으로, 빌드된 정적 파일만 사용합니다.

### 1~3단계: 위와 동일

### 4단계: 빌드만 실행

```bash
npm run build
```

### 5단계: dist 폴더 열기

```bash
open dist/index.html
```

또는 Finder에서 `dist/index.html` 파일을 브라우저로 드래그하여 열기.

> 이 방법은 간단하지만 일부 기능(파일 다운로드 등)이 제한될 수 있습니다.
> 방법 1 (개발 서버)을 권장합니다.

---

## 데이터 관리

- 데이터는 브라우저의 localStorage에 저장됩니다
- 다른 PC/브라우저로 데이터를 옮기려면:
  1. 프로젝트 목록 → "데이터 내보내기 (.dat)" 클릭
  2. 다른 환경에서 "데이터 가져오기"로 .dat 파일 로드

---

## 문제 해결

| 증상 | 해결 방법 |
|------|-----------|
| `npm: command not found` | Node.js를 먼저 설치하세요 |
| `npm install` 에러 | `rm -rf node_modules && npm install` |
| 브라우저에서 빈 화면 | 콘솔(F12)에서 에러 확인, localStorage 초기화 |
| dmg 빌드 실패 | Xcode Command Line Tools 설치: `xcode-select --install` |

---

## 최소 요구사항

- macOS 10.15 (Catalina) 이상
- Node.js 18 이상
- npm 9 이상
- 브라우저: Safari 15+, Chrome 90+, Firefox 90+
