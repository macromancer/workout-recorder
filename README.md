# Workout Recorder

개인용 운동기록 웹앱. 헬스장에서 세트 사이 휴식 중에 음성 또는 텍스트로 빠르게 기록하고, 운동별 추이를 조회한다.

## 주요 기능

- **빠른 기록**: 텍스트 또는 음성으로 운동 입력 (예: `암컬 20 13회`)
- **다음 운동 추천**: 지난 운동 순서를 학습하여 다음 운동을 배너로 추천 (탭/더블탭 저장)
- **자동완성**: 운동명 자동완성 + 지난 기록 참고
- **한글 숫자 파싱**: 음성 입력 시 "이십" → 20, "열세" → 13 자동 변환
- **추이 그래프**: 운동별 중량/횟수 변화 차트 (Chart.js)
- **지난 운동 조회**: 날짜별 기록 탐색
- **월간 달력**: 운동한 날을 한눈에 확인

## 기술 스택

| 항목 | 기술 |
|------|------|
| 백엔드 | Node.js + Express 5 + better-sqlite3 |
| 프론트엔드 | 순수 HTML/CSS/JS (프레임워크 없음) |
| DB | SQLite |
| 음성 인식 | Web Speech API (브라우저 내장, 한국어) |
| 차트 | Chart.js (CDN) |

## 시작하기

```bash
npm install
npm start
```

`http://localhost:3000`으로 접속.

## 프로젝트 구조

```
src/
  server.js      # Express 서버 (port 3000)
  db.js          # SQLite 초기화 및 연결
  parser.js      # 운동 입력 파싱 (한글 숫자 변환 포함)
  routes.js      # API 엔드포인트
public/
  index.html     # 메인 페이지 (SPA)
  style.css      # 다크 모드 모바일 UI
  app.js         # 클라이언트 로직
```

## 입력 형식

`[운동명] [중량/강도] [횟수]`

| 입력 | 운동명 | 중량 | 횟수 |
|------|--------|------|------|
| 암컬 20 13회 | 암컬 | 20 | 13 |
| 스쿼트 중강도 20회 | 스쿼트 | 중강도 | 20 |
| 랫풀다운 40kg 12회 | 랫풀다운 | 40kg | 12 |
| 푸쉬업 25회 | 푸쉬업 | - | 25 |

## API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | /api/workouts | 기록 저장 |
| GET | /api/workouts?date= | 날짜별 조회 |
| GET | /api/workouts/latest?exercise= | 특정 운동 지난 기록 |
| GET | /api/workouts/trend?exercise= | 운동별 추이 |
| GET | /api/workouts/calendar?month= | 월별 운동 날짜 |
| GET | /api/workouts/next-recommendation | 다음 운동 추천 |
| PUT | /api/workouts/:id | 기록 수정 |
| DELETE | /api/workouts/:id | 기록 삭제 |

## 설계 원칙

- 빠른 입력이 최우선
- 모바일 사용성 우선 (다크 모드, 터치 친화)
- 완벽한 파싱보다 기록 보존 우선
- 로컬 우선, 단순한 구조
