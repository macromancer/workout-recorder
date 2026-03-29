# Workout Recorder App - Design Spec

## 개요

개인용 운동기록 웹앱. 헬스장에서 세트 사이 휴식 중에 음성 또는 텍스트로 빠르게 운동을 기록하고, 운동별 추이를 조회할 수 있다.

## 사용 환경

- 순환 운동(서킷) 방식: 7~8개 운동을 한 세트씩 순환, 3세트
- 세트 사이 휴식 중에 기록
- 목표 횟수를 못 채우면 수정
- 지난번 기록을 참고해 오늘 운동 강도 결정

## 아키텍처

```
[스마트폰 브라우저] → (Cloudflare Tunnel / workout.kikim.net) → [PC 서버]
                                                                  ├── Express (port 3000)
                                                                  ├── SQLite (workout.db)
                                                                  └── 정적 파일 (HTML/CSS/JS)
```

- **백엔드**: Node.js + Express + better-sqlite3
- **프론트엔드**: 순수 HTML/CSS/JS (프레임워크 없음)
- **DB**: SQLite
- **음성 입력**: Web Speech API (브라우저 내장)
- **차트**: Chart.js (CDN)
- **외부 접속**: Cloudflare Tunnel (기 설정 완료)

## 데이터 모델

```sql
CREATE TABLE workouts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  exerciseName  TEXT NOT NULL,
  weight        TEXT,
  reps          INTEGER,
  setNumber     INTEGER,
  rawText       TEXT NOT NULL,
  createdAt     DATETIME DEFAULT CURRENT_TIMESTAMP,
  date          TEXT NOT NULL
);
```

- `weight`는 TEXT: "20", "60kg", "중강도" 등 혼합 가능
- `setNumber`: 같은 date + exerciseName의 기존 기록 수 + 1로 자동 계산
- `date`: "2026-03-29" 형식, 세트 리셋 및 조회 기준
- `rawText`: 원문 보존 (파싱 실패 시에도 기록 유지)

## 화면 구성

### 탭 구조 (4개 탭)

#### 1. 기록 탭 (메인)
- **하단 고정 입력창** + 마이크 버튼
- 입력 시 운동명 자동완성 + 지난번 기록 표시
- 파싱 미리보기 (운동: 암컬 | 중량: 20 | 횟수: 13)
- 위에 오늘 기록이 시간순으로 쌓임 (세트 번호 포함)
- 각 기록 탭하면 인라인 수정/삭제 가능

#### 2. 추이 탭
- 운동 선택 드롭다운
- 날짜별 중량/횟수 변화 그래프 (Chart.js)
- 아래에 상세 기록 테이블

#### 3. 지난 운동 탭
- 최근 운동일의 운동별 요약 (운동명, 중량, 세트별 횟수)
- 날짜 이동 가능

#### 4. 달력 탭
- 월간 달력에 운동한 날 표시
- 날짜 선택하면 그날의 기록 표시

### UI 원칙
- 다크 모드 기본
- 모바일 최적화 (터치 친화, 적절한 터치 타겟)
- 입력창은 항상 하단 고정 (기록이 많아져도 접근 가능)

## 파싱 규칙

기본 패턴: `[운동명] [중량/강도] [횟수]`

| 입력 | 운동명 | 중량 | 횟수 |
|------|--------|------|------|
| 암컬 20 13회 | 암컬 | 20 | 13 |
| 스쿼트 중강도 20회 | 스쿼트 | 중강도 | 20 |
| 푸쉬업 25회 | 푸쉬업 | (없음) | 25 |
| 랫풀다운 40kg 12회 | 랫풀다운 | 40kg | 12 |
| 벤치프레스 60 10 | 벤치프레스 | 60 | 10 |

### 파싱 로직
1. 맨 끝에서 `N회` 또는 마지막 숫자 → 횟수(reps)
2. 중간의 숫자(kg 포함 가능) 또는 텍스트("중강도") → 중량(weight)
3. 맨 앞 텍스트 → 운동명(exerciseName)

### 한글 숫자 변환 (음성 입력 대응)
- "이십" → 20, "열세" → 13, "삼십오" → 35 등

### 파싱 실패 시
- 저장은 무조건 수행, rawText 보존
- 파싱 미리보기에서 사용자가 확인 후 저장

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | /api/workouts | 기록 저장 |
| GET | /api/workouts?date= | 날짜별 조회 |
| GET | /api/workouts/latest?exercise= | 특정 운동 지난 기록 |
| GET | /api/workouts/trend?exercise= | 운동별 추이 |
| GET | /api/workouts/calendar?month= | 월별 운동 날짜 |
| PUT | /api/workouts/:id | 기록 수정 |
| DELETE | /api/workouts/:id | 기록 삭제 |
| GET | /api/exercises | 운동명 목록 (자동완성용) |

## 수정 기능
- 기록 탭에서 항목 탭 → 인라인 수정 (횟수, 중량 등)
- 자연어 수정("방금 거 11회로")은 v2 (LLM 필요)

## v1 제외 항목
- 로그인/회원가입
- 클라우드 동기화
- LLM 기반 파싱
- 자연어 수정 명령
- CSV 내보내기
- 네이티브 앱 배포

## 이후 확장 방향 (v2+)
- LLM 기반 파싱 및 자연어 수정 명령
- 세트 연속 기록
- CSV 내보내기
- 클라우드 백업/동기화
- 라이트 모드 전환
