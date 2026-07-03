# 26s-w1-c3-08

## 공통과제 I : 웹 기반 프로젝트 (2인 1팀)

**목적:** 공통 과제를 함께 수행하며 웹 개발의 전체 흐름을 빠르게 익히고 협업에 적응하기

**결과물:** 예약 메시지 서비스 **마음도착** MVP와 관련 기획, IA, DB 설계, 실행 문서

---

## 팀원

| 이름 | GitHub | 역할 |
|---|---|---|
|김윤서|westyoon| 기획 / 프론트엔드 |
|이서진|tjwls8912| 백엔드 / DB / 인프라 |

---

## 기획안

> 프로젝트 주제, 목적, 핵심 기능, 예상 사용자, 팀원별 역할 등 정리

- **주제:** 미래의 특정 시점에 도착하는 예약 메시지 서비스 `마음도착`
- **목적:** 사용자가 현재의 마음, 응원, 감사, 축하, 위로를 미래의 자신 또는 타인에게 안전하게 전달할 수 있도록 돕기
- **핵심 기능:**
  - 카카오 OAuth 로그인
  - 예약 메시지 작성 및 보관
  - 메시지 작성 화면의 KST 기준 현재 시각 확인
  - OpenAI Moderation 기반 유해성 검사
  - 예약 시간 도래 시 메시지 도착 처리
  - 비회원 공개 링크 열람
  - 공개 링크 열람 후 가입 시 수신함 자동 귀속
  - 발신함, 수신함, 메시지 상세 화면
- **예상 사용자:**
  - 미래의 나에게 편지를 남기고 싶은 사용자
  - 가족, 연인, 친구에게 특정 날짜에 마음을 전하고 싶은 사용자
  - 가입 없이 공개 링크로 메시지를 먼저 확인하는 수신자

상세 기획은 `MAEUM_ARRIVAL_PLAN.md`에 정리되어 있습니다.

---

## 기능 명세서

> 구현할 기능을 사용자 관점에서 정리하고, 필수 기능과 선택 기능을 구분

### 필수 기능

- [x] 카카오 OAuth 로그인 시작 및 callback 처리
- [x] HttpOnly cookie 기반 로그인 세션
- [x] 현재 로그인 사용자 조회
- [x] 메시지 작성 및 예약
- [x] 메시지 작성 화면 상단 KST 현재 시각 초 단위 표시
- [x] 발신인 숨기기, 도착일 숨기기 옵션
- [x] OpenAI Moderation 유해성 검사
- [x] Moderation API 실패 시 즉시 재시도
- [x] 2회 검사 실패 시 `MODERATION_FAILED` 상태로 임시 보관
- [x] 하루 1회 moderation 재검사 scheduler
- [x] 예약 시간이 지난 메시지 `SENT` 처리 scheduler
- [x] `EventEmitter` 기반 `NotificationProcessor`
- [x] 비회원 공개 링크 열람
- [x] 공개 링크 열람 후 가입 시 수신함 자동 귀속
- [x] 보낸 마음 목록
- [x] 받은 마음 목록
- [x] 메시지 상세 조회
- [x] 예약 메시지 취소
- [x] 온보딩 답변 저장 및 건너뛰기 처리

### 선택 기능

- [ ] 실제 카카오 알림톡 발송
- [ ] SMS fallback 발송
- [ ] 이미지 첨부
- [ ] 그룹 전송
- [ ] 익명 답장
- [ ] 감정 리포트
- [ ] 관리자 검수 화면

---

## IA 및 화면 설계서

> 서비스의 전체 페이지 구조와 페이지 간 이동 흐름; 각 페이지의 주요 UI 구성, 입력 요소, 버튼, 사용자 행동 흐름 등을 간단한 와이어프레임 형태로 정리

상세 IA는 `MAEUM_ARRIVAL_IA.md`에 정리되어 있습니다.

### 주요 페이지

- `/login`: 카카오 로그인 진입
- `/auth/callback`: 로그인 완료 후 공개 링크 메시지 귀속 처리
- `/onboarding`: 첫 메시지 작성 유도
- `/write`: 예약 메시지 작성, KST 현재 시각 확인
- `/sent`: 보낸 마음 목록
- `/inbox`: 받은 마음 목록
- `/messages/[id]`: 메시지 상세
- `/arrival/[token]`: 비회원 공개 링크 열람
- `/arrival/link-failed`: 링크 귀속 실패 안내
- `/my`: 내 정보 및 로그아웃

### 사용자 흐름

```txt
카카오 로그인
  -> 메시지 작성
  -> OpenAI Moderation 검사
  -> 예약 메시지 저장
  -> 공개 링크 생성
  -> Scheduler가 예약 시간에 SENT 처리
  -> 수신자가 공개 링크 열람
  -> 수신자가 가입하면 /api/auth/link-message로 수신함 귀속
```

---

## DB 스키마

> 필요한 테이블, 주요 필드, 데이터 타입, 테이블 간 관계를 정리

상세 DB 설계는 `MAEUM_ARRIVAL_DB_SCHEMA.md`와 `packages/database/prisma/schema.prisma`에 정리되어 있습니다.

### 주요 모델

| 모델 | 설명 |
|---|---|
| `User` | 카카오 로그인 사용자 |
| `Message` | 예약 메시지 본문, 예약일, 발신자, 상태, moderation 상태 |
| `MessageRecipient` | 수신자별 정보, 수신함 귀속 상태, 열람 상태 |
| `MessageAccessToken` | 공개 링크 token hash, 열람 횟수, 가입 후 귀속 정보 |
| `ModerationLog` | OpenAI Moderation 검사 이력 |
| `NotificationLog` | 메시지 도착 이후 알림 처리 이력 |

### 상태 값

| 상태 | 설명 |
|---|---|
| `PENDING` | 예약 대기 |
| `SENT` | 도착 처리 완료 |
| `FAILED` | 발송 처리 실패 |
| `BLOCKED` | 유해성 검사 차단 |
| `MODERATION_FAILED` | AI 검사 자체 실패 후 재검사 대기 |
| `CANCELED` | 예약 취소 |

---

## API 문서

> API 주소, 요청 방식, 요청값, 응답값, 에러 상황을 정리

| Method | Endpoint | 설명 | 요청 | 응답 |
|---|---|---|---|---|
| GET | `/api/health` | 서버 상태 확인 | 없음 | `{ ok: true }` |
| GET | `/api/auth/kakao` | 카카오 OAuth 로그인 시작 | 없음 | 카카오 인증 페이지 redirect |
| GET | `/api/auth/kakao/callback` | 카카오 OAuth callback 처리 | `code`, `state` query | 세션 쿠키 설정 후 `/auth/callback` redirect |
| GET | `/api/me` | 현재 로그인 사용자 조회 | 세션 쿠키 | `{ user }` |
| PATCH | `/api/me/onboarding` | 온보딩 답변 저장 | `{ note }` | `{ user }` |
| POST | `/api/auth/logout` | 로그아웃 | 세션 쿠키 | `204 No Content` |
| POST | `/api/auth/link-message` | 공개 링크 메시지를 로그인 사용자 수신함에 귀속 | `{ token }` | `{ linked, messageId, redirectTo }` |
| POST | `/api/messages` | 메시지 작성 및 예약 | 제목, 본문, 수신자, 예약일, 감성 옵션 | `{ message, publicUrl, notice? }` |
| GET | `/api/messages/sent` | 보낸 마음 목록 | 세션 쿠키 | `{ messages }` |
| GET | `/api/messages/received` | 받은 마음 목록 | 세션 쿠키 | `{ messages }` |
| GET | `/api/messages/:id` | 메시지 상세 조회 | 세션 쿠키, message id | `{ message }` |
| POST | `/api/messages/:id/public-link` | 공개 링크 새로 생성 | 세션 쿠키, message id | `{ publicUrl }` |
| PATCH | `/api/messages/:id/cancel` | 예약 메시지 취소 | 세션 쿠키, message id | `{ canceled: true }` |
| GET | `/api/public/messages/:token` | 비회원 공개 링크 메시지 조회 | 공개 token | `{ message }` |

---

## 배포 결과물

> 접속 가능한 링크, 실행 방법, 주요 구현 내용

- **서비스 URL:** 미배포
- **실행 방법:**

```bash
pnpm install

# .env.local 값을 실제 환경에 맞게 채운 뒤 실행
docker compose up -d postgres

pnpm db:generate
pnpm db:migrate

pnpm dev:api
pnpm dev:web
pnpm dev:scheduler
```

### 검증 명령

```bash
pnpm db:validate
pnpm typecheck
pnpm build
```

### 배포 참고

Nginx 설정은 `infra/nginx/maeum-arrival.conf.template`를 사용합니다.

```bash
SERVICE_DOMAIN="<domain>" \
WWW_SERVICE_DOMAIN="<www-domain>" \
API_PORT="<api-port>" \
WEB_PORT="<web-port>" \
./scripts/render-nginx.sh
```

---

## 회고 문서

> 개발 과정에서의 어려움, 해결 방법, 역할 분담, 다음에 개선할 점 (KPT 방법론 참고)

### Keep

- 기획, IA, DB schema를 먼저 정리하고 구현 범위를 명확히 나누었다.
- mock, dummy, fake provider 없이 실제 연동 구조를 기준으로 설계했다.
- 메시지와 수신자를 분리해 이후 그룹 전송 확장 가능성을 확보했다.

### Problem

- 카카오 OAuth는 Kakao Developers의 Redirect URI가 정확히 등록되어야 로컬과 배포 환경에서 정상 동작한다.
- 실제 알림톡/SMS 발송은 외부 provider 계약과 템플릿 승인 이후 확장해야 한다.
- OpenAI, Kakao, DB 등 필수 환경 변수는 `.env.local` 또는 `.env.production`에 실제 값이 들어가야 서버가 시작된다.

### Try

- 로컬에서는 `http://localhost:3000/api/auth/kakao/callback`을 Kakao Developers Redirect URI에 등록해 로그인 흐름을 확인한다.
- 운영 배포 전 `pnpm typecheck`, `pnpm build`, `pnpm db:deploy`, `nginx -t`를 순서대로 검증한다.
- 알림톡/SMS를 붙일 때는 `NotificationLog`의 `SKIPPED` 기록을 실제 provider 응답 기반 `SENT`/`FAILED` 처리로 확장한다.

---

## 참고 자료

- [SDD(스펙 주도 개발) 이해하기](https://news.hada.io/topic?id=21338)
- [Software Design Document Best Practices](https://www.atlassian.com/work-management/project-management/design-document)
- [IA 정보구조도 작성 방법](https://brunch.co.kr/@nyonyo/7)
- [기획자 화면설계서 작성법](https://brunch.co.kr/@soup/10)
- [Figma 와이어프레임 가이드](https://www.figma.com/ko-kr/resource-library/what-is-wireframing/)
- [무료 Figma 와이어프레임 키트](https://www.figma.com/ko-kr/templates/wireframe-kits/)
- [ERD/DB 설계 총정리](https://inpa.tistory.com/entry/DB-%F0%9F%93%9A-%EB%8D%B0%EC%9D%B4%ED%84%B0-%EB%AA%A8%EB%8D%B8%EB%A7%81-%EA%B0%9C%EB%85%90-ERD-%EB%8B%A4%EC%9D%B4%EC%96%B4%EA%B7%B8%EB%9E%A8)
- [API 명세서 작성 가이드라인](https://velog.io/@sebinChu/BackEnd-API-%EB%AA%85%EC%84%B8%EC%84%9C-%EC%9E%91%EC%84%B1-%EA%B0%80%EC%9D%B4%EB%93%9C-%EB%9D%BC%EC%9D%B8)
- [좋은 README 작성하는 방법](https://velog.io/@sabo/good-readme)
- [단기 프로젝트 회고 KPT 방법론](https://velog.io/@habwa/%EB%8B%A8%EA%B8%B0-%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8-%ED%9A%8C%EA%B3%A0-KPT-%EB%B0%A9%EB%B2%95%EB%A1%A0)
