# Workout Recorder App

> 개인용 운동기록 웹앱. 헬스장에서 세트 사이 휴식 중에 음성 또는 텍스트로 빠르게 기록하고, 운동별 추이를 조회한다.
> v1 구현 완료: 2026-03-29

---

## 사용 환경

- 순환 운동(서킷) 방식: 7~8개 운동을 한 세트씩 순환, 3세트
- 세트 사이 휴식 중에 음성 또는 텍스트로 기록
- 목표 횟수를 못 채우면 즉시 수정
- 지난번 기록을 참고해 오늘 운동 강도 결정

---

## 아키텍처

```
[스마트폰 브라우저] → (Cloudflare Tunnel / workout.kikim.net) → [PC 서버]
                                                                  ├── Express (port 3000)
                                                                  ├── SQLite (workout.db)
                                                                  └── 정적 파일 (HTML/CSS/JS)
```

| 항목 | 기술 |
|------|------|
| 백엔드 | Node.js + Express 5 + better-sqlite3 |
| 프론트엔드 | 순수 HTML/CSS/JS (프레임워크 없음) |
| DB | SQLite (workout.db, 로컬 파일) |
| 음성 인식 | Web Speech API (브라우저 내장, 한국어) |
| 차트 | Chart.js (CDN) |
| 외부 접속 | Cloudflare Tunnel → workout.kikim.net |
| 원격 개발 | Claude Code CLI + Telegram 채널 연결 |

---

## 프로젝트 구조

```
workout_recoder/
├── src/
│   ├── server.js      # Express 서버 (port 3000)
│   ├── db.js          # SQLite 초기화 및 연결
│   ├── parser.js      # 운동 입력 파싱 (한글 숫자 변환 포함)
│   └── routes.js      # API 엔드포인트
├── public/
│   ├── index.html     # 메인 페이지 (SPA)
│   ├── style.css      # 다크 모드 모바일 UI
│   └── app.js         # 클라이언트 로직 (탭, 입력, 차트 등)
├── docs/
│   └── superpowers/specs/
│       └── 2026-03-29-workout-recorder-design.md  # 상세 설계 문서
├── workout.db         # SQLite 데이터 파일 (자동 생성)
├── package.json
└── workout-recorder-design-summary.md  # 이 문서
```

---

## 서버 실행 방법

```bash
cd C:/Users/kwoni/claude_workspace/workout_recoder
node src/server.js
```

`Workout Recorder running at http://localhost:3000` 출력 확인.
Cloudflare Tunnel이 실행 중이면 `workout.kikim.net`으로 외부 접속 가능.

### Telegram 채널 연결 (원격 개발)

```bash
claude --channels plugin:telegram@claude-plugins-official
```

Telegram 봇으로 코드 수정 요청을 보낼 수 있다.

---

## 데이터 모델

```sql
CREATE TABLE workouts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  exerciseName  TEXT NOT NULL,       -- 운동명: "암컬", "케이블 크로스오버"
  weight        TEXT,                -- 중량/강도: "20", "40kg", "중강도"
  reps          INTEGER,             -- 횟수: 13
  setNumber     INTEGER,             -- 세트 번호: 자동 계산
  rawText       TEXT NOT NULL,       -- 사용자 입력 원문 (항상 보존)
  createdAt     DATETIME DEFAULT (datetime('now', 'localtime')),
  date          TEXT NOT NULL        -- "2026-03-29" (세트 리셋 기준)
);
```

- `weight`는 TEXT: 숫자("20"), 단위 포함("60kg"), 텍스트("중강도") 혼합 가능
- `setNumber`: 같은 date + exerciseName의 기존 기록 수 + 1로 자동 계산 (하루 단위 리셋)
- `rawText`: 파싱 실패 시에도 원문 보존

---

## 화면 구성 (탭 4개)

### 1. 기록 탭 (메인)
- **하단 고정 입력창** + 마이크 버튼(음성 입력)
- 입력 시 운동명 자동완성 + 지난번 기록 표시 (선택 시 전체 문장 자동 입력)
- **추천 배너**: 입력창 위에 다음 운동 추천 표시 (지난 운동 순서 기반)
  - 1탭: 입력창에 추천 문장 채움
  - 더블탭: 즉시 저장
  - 모든 운동 완료 시 자동 숨김
- 파싱 미리보기 (운동: 암컬 | 중량: 20 | 횟수: 13)
- 오늘 기록이 시간순으로 표시 (세트 번호 포함)
- 항목 탭하면 수정 모달 (운동명/중량/횟수 수정, 삭제)

### 2. 추이 탭
- 운동 선택 드롭다운
- 날짜별 중량/횟수 변화 그래프 (Chart.js, 듀얼 Y축)
- 아래에 날짜별 상세 기록

### 3. 지난 운동 탭
- 최근 운동일의 운동별 요약 (운동명, 중량, 세트별 횟수)
- ← → 버튼으로 날짜 이동

### 4. 달력 탭
- 월간 달력에 운동한 날 표시
- 날짜 선택하면 그날의 기록 표시

### UI
- 다크 모드 기본
- 모바일 최적화 (max-width: 480px, 터치 친화)
- 입력창은 하단 고정 (스크롤해도 접근 가능)

---

## 파싱 규칙

기본 패턴: `[운동명] [중량/강도] [횟수]`

| 입력 | 운동명 | 중량 | 횟수 |
|------|--------|------|------|
| 암컬 20 13회 | 암컬 | 20 | 13 |
| 스쿼트 중강도 20회 | 스쿼트 | 중강도 | 20 |
| 푸쉬업 25회 | 푸쉬업 | (없음) | 25 |
| 랫풀다운 40kg 12회 | 랫풀다운 | 40kg | 12 |
| 케이블 크로스오버 20 15회 | 케이블 크로스오버 | 20 | 15 |

### 한글 숫자 변환 (음성 입력 대응)
- "이십" → 20, "열세" → 13, "삼십오" → 35
- **독립 토큰만 변환**: "케이블"의 "이"는 변환하지 않음

### 파싱 실패 시
- 저장은 무조건 수행, rawText 보존

---

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | /api/workouts | 기록 저장 |
| GET | /api/workouts?date= | 날짜별 조회 |
| GET | /api/workouts/latest?exercise= | 특정 운동 지난 기록 |
| GET | /api/workouts/trend?exercise= | 운동별 추이 |
| GET | /api/workouts/calendar?month= | 월별 운동 날짜 |
| GET | /api/workouts/day?date= | 특정 날짜 운동별 요약 |
| GET | /api/workouts/previous-day?before= | 이전 운동일 조회 |
| GET | /api/workouts/next-day?after= | 다음 운동일 조회 |
| PUT | /api/workouts/:id | 기록 수정 |
| DELETE | /api/workouts/:id | 기록 삭제 |
| GET | /api/workouts/next-recommendation | 다음 운동 추천 |
| GET | /api/exercises | 운동명 목록 (자동완성용) |

---

## v1 제외 항목
- 로그인/회원가입
- 클라우드 동기화
- LLM 기반 파싱
- 자연어 수정 명령 ("방금 거 11회로")
- CSV 내보내기
- 네이티브 앱 배포

---

## 이후 확장 방향 (v2+)
- LLM 기반 파싱 및 자연어 수정 명령
- 세트 연속 기록
- CSV 내보내기
- 클라우드 백업/동기화
- 라이트 모드 전환

---

## 설계 원칙
- 빠른 입력이 최우선
- 모바일 사용성 우선
- 완벽한 파싱보다 기록 보존 우선
- 로컬 우선, 단순한 구조
- 실제로 매일 쓸 수 있는 MVP를 먼저 만든다

---

## 개발 이력

| 날짜 | 내용 |
|------|------|
| 2026-03-29 | 초기 설계안 작성 (다른 AI) |
| 2026-03-29 | Superpowers 브레인스토밍으로 요구사항 확정 |
| 2026-03-29 | v1 구현 완료 (서버, 파서, API, 프론트엔드 4개 탭) |
| 2026-03-29 | Cloudflare Tunnel 연결 (workout.kikim.net) |
| 2026-03-29 | 파서 버그 수정: 한글 숫자 변환이 운동명 내부 글자를 변환하는 문제 |
| 2026-03-29 | CSS MIME 타입 명시 (Cloudflare Tunnel 경유 시 모바일 CSS 미로드 대응) |
| 2026-03-29 | Claude Code CLI Telegram 채널 연결 (원격 개발용) |
| 2026-03-29 | GitHub 저장소 생성 및 코드 push (macromancer/workout-recorder) |
| 2026-03-29 | 자동완성 개선: 지난 운동 선택 시 운동명만이 아닌 전체 문장(rawText) 입력 |
| 2026-03-29 | 다음 운동 추천 기능 추가 (배너 UI, 탭/더블탭, 순서 패턴 기반) |
