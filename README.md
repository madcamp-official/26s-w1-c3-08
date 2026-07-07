# 26s-w1-c3-08

## 공통과제 I : 웹 기반 프로젝트 (2인 1팀)

**목적:** 공통 과제를 함께 수행하며 웹 개발의 전체 흐름을 빠르게 익히고 협업에 적응하기

**결과물:** 예약 메시지 서비스 **매아리** MVP와 관련 기획, IA, DB 설계, 실행 문서

> 매아리 = 매 순간 아껴둔 마음의 소리

---

## 팀원

| 이름 | GitHub | 역할 |
|---|---|---|
|김윤서|westyoon| 기획 / 프론트엔드 |
|이서진|tjwls8912| 백엔드 / DB / 인프라 |

---

## 기획안

> 프로젝트 주제, 목적, 핵심 기능, 예상 사용자, 팀원별 역할 등 정리

- **주제:** 미래의 특정 시점에 도착하는 예약 메시지 서비스 `매아리`
- **이름 의미:** 매 순간 아껴둔 마음의 소리
- **목적:** 사용자가 현재의 마음, 응원, 감사, 축하, 위로를 미래의 자신 또는 타인에게 안전하게 전달할 수 있도록 돕기
- **핵심 기능:**
  - 메인 대시보드와 서비스 브랜드 이미지
  - 카카오 OAuth 로그인
  - 친구 코드와 닉네임 기반 친구 찾기, 친구 초대 링크, 친구 추가, 요청 수락/거절, 친구 목록 관리
  - 예약 메시지 작성 및 보관
  - 그룹 수신자, 이미지 첨부, 랜덤 도착, 도착 전 힌트, 메시지 테마
  - 메시지 작성 화면의 KST 기준 현재 시각 확인
  - 빠른 프리셋, 날짜 입력, 1분 단위 시간 입력, 15분 단위 quick minute 선택
  - OpenAI Moderation, 서비스 정책 guardrail prompt, 한국어 욕설/비하 표현 보강 검사
  - 예약 시간 도래 시 메시지 도착 처리
  - 친구/자기 자신 수신자는 서비스 내 수신함 도착 처리
  - 외부 수신자는 Gmail SMTP 이메일 또는 Solapi 문자로 공개 링크 발송
  - 이메일/문자 수신거부, NotificationLog 재시도, 관리자 발송 통계
  - 마음쓰기 권한용 010 휴대전화 인증, 이메일 수신 연결용 연락처 인증
  - Twilio Lookup v2 기반 휴대전화 회선 검사, IP/전화번호 rate limit, OTP 인증
  - 비회원 공개 링크 열람
  - 공개 링크 익명 답장과 메시지 신고
  - 공개 링크 열람 후 가입 시 수신함 자동 귀속
  - 발신함, 수신함, 아카이브, 미래의 나, 감정 리포트, 메시지 상세 화면
- **예상 사용자:**
  - 미래의 나에게 편지를 남기고 싶은 사용자
  - 가족, 연인, 친구에게 특정 날짜에 마음을 전하고 싶은 사용자
  - 이미 친구로 연결된 회원에게 조용히 마음을 예약하고 싶은 사용자
  - 가입 없이 공개 링크로 메시지를 먼저 확인하는 수신자

상세 기획은 `MAEARI_PLAN.md`에 정리되어 있습니다. 이 README는 2026-07-07 기준 코드에 반영된 이름 변경, 신규 `maeari` DB 전환, Gmail SMTP, Solapi SMS, Twilio Lookup 기반 휴대전화 인증, 수신거부, 친구 검색/초대 링크, 보관함 삭제, multipart 이미지 첨부, Tesseract OCR 기반 이미지 텍스트 안전 검사, 이미지 형식 allowlist, 이미지/그룹/답장/신고/관리자 기능을 함께 반영합니다.

---

## 기능 명세서

> 구현할 기능을 사용자 관점에서 정리하고, 필수 기능과 선택 기능을 구분

### 필수 기능

- [x] 메인페이지 `/` 제공
- [x] 카카오 OAuth 로그인 시작 및 callback 처리
- [x] HttpOnly cookie 기반 로그인 세션
- [x] 현재 로그인 사용자 조회
- [x] 가입 사용자별 친구 코드 생성
- [x] 친구 코드로 친구 요청 생성
- [x] 닉네임 또는 친구 코드 기반 친구 찾기
- [x] 친구 초대 링크 생성, 미리보기, 로그인 후 claim, 폐기
- [x] 친구 요청 수락, 거절, 취소
- [x] 친구 관계 soft delete
- [x] 메시지 작성 시 친구 수신자 선택
- [x] 메시지 작성 및 예약
- [x] 마음 쓰기 성공/오류 결과를 화면 중앙 팝업으로 표시하고, 성공 팝업에서 예약 상세/발신함/새 마음 쓰기/메인 이동 제공
- [x] 메시지 작성 화면 상단 KST 현재 시각 초 단위 표시
- [x] 도착 날짜와 시간을 분리하고 시/분은 1분 단위 직접 입력
- [x] 15분 단위 quick minute 버튼 제공
- [x] 타인 수신자 이메일/전화번호 중 하나 필수 검증
- [x] 메시지 작성 전 strict 010 휴대전화 인증 필수화
- [x] `/phone-verification` 전용 페이지에서 전화번호 OTP 발송/검증
- [x] Twilio Lookup v2 line type intelligence 기반 휴대전화 번호 확인
- [x] 전화번호 인증 요청 IP/연락처 rate limit 및 lock 관리
- [x] 내 정보 화면에서 연락처 인증 상태 확인, 전화번호 변경 CTA, 이메일 연결용 인증 관리
- [x] 카카오 이메일이 있으면 이메일 수신 연결용 `UserContact` 자동 upsert
- [x] 발신인 숨기기, 도착일 숨기기 옵션
- [x] OpenAI Moderation 및 한국어 욕설/비하 표현 보강 유해성 검사
- [x] 매아리 서비스 정책 guardrail prompt 기반 2차 유해성 판정
- [x] Moderation API 실패 시 즉시 재시도
- [x] 2회 검사 실패 시 `MODERATION_FAILED` 상태로 임시 보관
- [x] 하루 1회 moderation 재검사 scheduler
- [x] 예약 시간이 지난 메시지 `SENT` 처리 scheduler
- [x] `EventEmitter` 기반 `NotificationProcessor`
- [x] 외부 알림 provider 미설정 시 수신자 발송 실패 및 `NotificationLog.SKIPPED` 기록
- [x] 비회원 공개 링크 열람
- [x] 공개 링크 열람 후 가입 시 수신함 자동 귀속
- [x] 보낸 마음 목록
- [x] 받은 마음 목록
- [x] 메시지 상세 조회
- [x] 예약 메시지 취소
- [x] 예약 전/검사 실패/취소 보낸 마음 삭제 및 도착 완료/실패 보낸 마음 숨김
- [x] 받은 마음 보관함 삭제
- [x] 온보딩 답변 저장 및 건너뛰기 처리
- [x] 서비스 favicon/app icon 및 주요 화면 브랜드 이미지 적용
- [x] EC2 Nginx reverse proxy, Certbot HTTPS, PM2 운영 프로세스 구성

### 선택 기능

- [ ] 실제 카카오 알림톡 발송
- [x] Solapi SMS provider credential 연결 및 문자 발송 경로 구현
- [x] Gmail SMTP provider credential 연결 및 이메일 발송 경로 구현
- [x] 이미지 첨부
- [x] 그룹 전송
- [x] 익명 답장
- [x] 감정 리포트
- [x] 관리자 검수 화면
- [x] 기간 랜덤 발송
- [x] 도착 전 힌트 알림
- [x] 메시지 봉투/테마 선택
- [x] 받은 마음 아카이브, 복구, 일괄 삭제
- [x] 미래의 나에게 쓴 편지 모아보기
- [x] 보낸 마음, 받은 마음, 아카이브, 미래의 나 감정 태그 필터
- [x] 신고 기능
- [x] 계정 정지 정책
- [x] NotificationLog 재시도 및 발송 통계 대시보드

---

## IA 및 화면 설계서

> 서비스의 전체 페이지 구조와 페이지 간 이동 흐름; 각 페이지의 주요 UI 구성, 입력 요소, 버튼, 사용자 행동 흐름 등을 간단한 와이어프레임 형태로 정리

상세 IA는 `MAEARI_IA.md`에 정리되어 있습니다.

### 주요 페이지

- `/`: 메인 대시보드, KST 현재 시각, 주요 기능 진입
- `/login`: 카카오 로그인 진입
- `/auth/callback`: 로그인 완료 후 공개 링크 메시지 귀속 및 친구 초대 링크 claim 처리
- `/onboarding`: 첫 메시지 작성 유도
- `/write`: 전화번호 인증 여부 확인, 예약 메시지 작성, 수신자 선택, KST 현재 시각 확인, 서버 기준 +24시간 기본 도착 시각, 1분 단위 시간 설정, 작성 결과 팝업
- `/sent`: 보낸 마음 목록
- `/inbox`: 받은 마음 목록
- `/archive`: 받은 마음 아카이브
- `/future`: 미래의 나에게 쓴 편지 모음
- `/reports`: 감정 리포트
- `/admin`: 관리자 검수 및 운영 로그
- `/friends`: 친구 코드, 친구 요청, 친구 초대 링크, 친구 목록 관리
- `/friends/invite/[token]`: 친구 초대 링크 미리보기 및 로그인 후 친구 연결
- `/phone-verification`: 마음쓰기 권한을 위한 010 휴대전화 인증
- `/messages/[id]`: 메시지 상세
- `/arrival/[token]`: 비회원 공개 링크 열람
- `/arrival/link-failed`: 링크 귀속 실패 안내
- `/my`: 내 정보, 연락처 인증 상태, 전화번호 변경, 로그아웃

### 사용자 흐름

```txt
카카오 로그인
  -> 메인 대시보드
  -> 친구 추가 또는 메시지 작성
  -> 전화번호 인증 여부 확인
  -> 미인증이면 /phone-verification?next=/write 이동
  -> 수신 대상 선택: 미래의 나 / 친구 / 연락처
  -> OpenAI Moderation + 매아리 guardrail 검사
  -> 예약 메시지 저장
  -> 중앙 팝업에서 예약 상태 확인 및 공개 링크 확인
  -> Scheduler가 예약 시간에 SENT 처리
  -> 친구/자기 자신은 수신함에서 확인
  -> 외부 수신자는 예약 도착 시 이메일/SMS로 공개 링크 수신
  -> 비회원 수신자가 공개 링크 열람
  -> 수신자가 가입하면 /api/auth/link-message로 수신함 귀속
```

---

## DB 스키마

> 필요한 테이블, 주요 필드, 데이터 타입, 테이블 간 관계를 정리

상세 DB 설계는 `MAEARI_DB_SCHEMA.md`와 `packages/database/prisma/schema.prisma`에 정리되어 있습니다.

### 주요 모델

| 모델 | 설명 |
|---|---|
| `User` | 카카오 로그인 사용자, 친구 코드 |
| `UserContact` | 사용자 인증 연락처. PHONE은 마음쓰기 권한, EMAIL은 이메일 수신 연결용 contact hash |
| `UserContactVerification` | 이메일/SMS OTP 인증 코드 hash, 만료, 시도 횟수 |
| `PhoneVerificationAttempt` | PHONE 인증 요청 이력. IP/contact hash, 요청/발송/차단/실패 상태 |
| `PhoneVerificationLock` | PHONE 인증 abuse 방어용 IP/contact 잠금 |
| `PhoneNumberLookupCache` | Twilio Lookup v2 결과 cache. raw 전화번호는 저장하지 않음 |
| `FriendRequest` | 친구 코드 기반 요청, 수락/거절/취소 상태 |
| `Friendship` | 수락된 친구 관계, 중복 방지용 정렬된 user pair |
| `FriendInviteLink` | 친구 초대 링크 token hash, 만료, 사용 횟수, 폐기 상태 |
| `Message` | 예약 메시지 본문, 예약일, 발신자, 서버가 선택한 인증 PHONE snapshot, 상태, moderation 상태 |
| `MessageRecipient` | 수신자별 정보, `SELF`/`FRIEND`/`OTHER`, 수신함 귀속 상태, 열람 상태 |
| `MessageAccessToken` | 공개 링크 token hash, 열람 횟수, 가입 후 귀속 정보 |
| `ModerationLog` | OpenAI Moderation 검사 이력 |
| `NotificationLog` | 메시지 도착 이후 알림 처리, provider, idempotency, retry 이력 |
| `ContactSuppression` | 이메일/SMS 수신거부 연락처 hash, 채널별 중복 방지 |

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
| GET | `/api/time` | 서버 기준 현재 시각과 기본 예약 시각 조회 | 없음 | `{ serverNow, defaultScheduledAt }` |
| GET | `/api/me/contacts` | 연락처 인증 목록과 마음쓰기 가능 여부 조회 | 세션 쿠키 | `{ contacts, writerEligibility }` |
| POST | `/api/me/contacts` | 연락처 추가 및 OTP 발송. PHONE은 strict 010 + rate limit + Lookup guard 적용 | `{ type, value, label? }` | `{ contact, verificationSent }` |
| POST | `/api/me/contacts/:id/send-code` | OTP 재발송 | 세션 쿠키, contact id | `{ sent: true }` |
| POST | `/api/me/contacts/:id/verify` | OTP 검증 | `{ code }` | `{ contact }` |
| PATCH | `/api/me/contacts/:id` | 연락처 label/default 수정 | `{ label?, isPrimary? }` | `{ contact }` |
| DELETE | `/api/me/contacts/:id` | 연락처 삭제. 인증 완료 PHONE은 삭제 불가, 새 번호 인증으로 변경 | 세션 쿠키, contact id | `{ deleted: true }` |
| POST | `/api/auth/logout` | 로그아웃 | 세션 쿠키 | `204 No Content` |
| POST | `/api/auth/link-message` | 공개 링크 메시지를 로그인 사용자 수신함에 귀속 | `{ token }` | `{ linked, messageId, redirectTo }` |
| GET | `/api/friends` | 친구 목록 조회 | 세션 쿠키 | `{ friends }` |
| GET | `/api/friends/requests` | 받은/보낸 친구 요청 조회 | 세션 쿠키 | `{ requests: { received, sent } }` |
| GET | `/api/friends/search` | 닉네임 또는 친구 코드 기반 친구 찾기 | 세션 쿠키, `q` query | `{ candidates }` |
| POST | `/api/friends/invites` | 친구 초대 링크 생성 | 세션 쿠키 | `{ invite, inviteUrl }` |
| GET | `/api/friends/invites/active` | 활성 친구 초대 링크 목록 | 세션 쿠키 | `{ invites }` |
| GET | `/api/friends/invites/:token/preview` | 친구 초대 링크 미리보기 | 공개 token | `{ invite, availability }` |
| POST | `/api/friends/invites/:token/claim` | 로그인 후 초대 링크로 친구 연결 | 세션 쿠키, 공개 token | `{ friendship }` |
| DELETE | `/api/friends/invites/:id` | 친구 초대 링크 폐기 | 세션 쿠키, invite id | `{ revoked: true }` |
| POST | `/api/friends/requests` | 친구 코드로 요청 생성 | `{ friendCode, message? }` | `{ request }` |
| PATCH | `/api/friends/requests/:id/accept` | 친구 요청 수락 | 세션 쿠키, request id | `{ friendship }` |
| PATCH | `/api/friends/requests/:id/reject` | 친구 요청 거절 | 세션 쿠키, request id | `{ request }` |
| PATCH | `/api/friends/requests/:id/cancel` | 보낸 친구 요청 취소 | 세션 쿠키, request id | `{ request }` |
| DELETE | `/api/friends/:friendshipId` | 친구 관계 삭제 | 세션 쿠키, friendship id | `{ deleted: true }` |
| POST | `/api/messages` | 메시지 작성 및 예약 | JSON 또는 multipart `payload` + `attachments`; 서버가 인증 PHONE을 선택하고 `senderContactId`는 무시 | `{ message, publicUrl, publicUrls?, notice? }` |
| GET | `/api/messages/sent` | 보낸 마음 목록 | 세션 쿠키 | `{ messages }` |
| GET | `/api/messages/received` | 받은 마음 목록 | 세션 쿠키 | `{ messages }` |
| GET | `/api/messages/archived` | 아카이브한 받은 마음 목록 | 세션 쿠키 | `{ messages }` |
| POST | `/api/messages/bulk-delete` | 여러 보낸/받은 마음을 내 보관함에서 제거 | `{ messageIds }` | `{ deletedCount, failedCount, results }` |
| GET | `/api/messages/:id` | 메시지 상세 조회 | 세션 쿠키, message id | `{ message }` |
| POST | `/api/messages/:id/public-link` | 공개 링크 새로 생성 | 세션 쿠키, message id | `{ publicUrl }` |
| PATCH | `/api/messages/:id/cancel` | 예약 메시지 취소 | 세션 쿠키, message id | `{ canceled: true }` |
| PATCH | `/api/messages/:id/archive` | 받은 마음 아카이브 | 세션 쿠키, message id | `{ archived: true }` |
| PATCH | `/api/messages/:id/unarchive` | 받은 마음 아카이브 복구 | 세션 쿠키, message id | `{ archived: false }` |
| DELETE | `/api/messages/:id` | 보낸/받은 마음을 내 보관함에서 제거 | 세션 쿠키, message id | `{ deleted: true }` |
| GET | `/api/reports/emotions` | 월별 감정 리포트 | 세션 쿠키, `month=YYYY-MM` | `{ report }` |
| GET | `/api/admin/overview` | 관리자 운영 요약 | 관리자 세션 | `{ overview }` |
| GET | `/api/admin/moderation-logs` | 관리자 moderation 로그 | 관리자 세션 | `{ logs }` |
| GET | `/api/admin/notification-logs` | 관리자 notification 로그 | 관리자 세션 | `{ logs }` |
| GET | `/api/admin/replies` | 관리자 익명 답장 검수 목록 | 관리자 세션 | `{ replies }` |
| GET | `/api/admin/reports` | 관리자 신고 검수 목록 | 관리자 세션 | `{ reports }` |
| PATCH | `/api/admin/replies/:id/hide` | 익명 답장 숨김 처리 | 관리자 세션 | `{ hidden: true }` |
| PATCH | `/api/admin/reports/:id/review` | 신고 검토 완료/기각 | 관리자 세션 | `{ reviewed: true }` |
| PATCH | `/api/admin/users/:id/suspend` | 사용자 계정 정지 | 관리자 세션 | `{ suspended: true }` |
| PATCH | `/api/admin/users/:id/unsuspend` | 사용자 계정 정지 해제 | 관리자 세션 | `{ suspended: false }` |
| GET | `/api/public/messages/:token` | 비회원 공개 링크 메시지 조회 | 공개 token | `{ message }` |
| POST | `/api/public/messages/:token/replies` | 공개 링크 익명 답장 작성 | 공개 token, `{ content }` | `{ reply }` |
| POST | `/api/public/messages/:token/reports` | 공개 링크 메시지 신고 | 공개 token, `{ reason, details? }` | `{ report }` |
| POST | `/api/public/notification-suppressions` | 공개 링크 기반 이메일/문자 알림 수신거부 | `{ token, channel }` | `{ suppressed: true }` |
| DELETE | `/api/public/notification-suppressions` | 공개 링크 기반 이메일/문자 알림 다시 받기 | `{ token, channel }` | `{ suppressed: false }` |

---

## 배포 결과물

> 접속 가능한 링크, 실행 방법, 주요 구현 내용

- **서비스 URL:** `https://maeari.madcamp-kaist.org`
- **로컬 개발 URL:** `http://localhost:3000`
- **운영 API 경유:** `https://maeari.madcamp-kaist.org/api/*`
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

### 주요 환경 변수

로컬은 `.env.local`, 운영은 `.env.production` 또는 PM2 실행 환경에 값을 둡니다. 실제 secret은 repository에 커밋하지 않습니다.

```env
DATABASE_URL=postgresql://maeari:<password>@127.0.0.1:5432/maeari?schema=public
POSTGRES_DB=maeari
POSTGRES_USER=maeari
POSTGRES_PASSWORD=

SERVICE_DOMAIN=maeari.madcamp-kaist.org
WWW_SERVICE_DOMAIN=www.maeari.madcamp-kaist.org
WEB_ORIGIN=https://maeari.madcamp-kaist.org
SERVICE_URL=https://maeari.madcamp-kaist.org

COOKIE_DOMAIN=
COOKIE_SECURE=true

KAKAO_REDIRECT_URI=https://maeari.madcamp-kaist.org/api/auth/kakao/callback

OPENAI_MODERATION_MODEL=omni-moderation-latest
OPENAI_GUARDRAIL_MODEL=gpt-5.4-mini

PUBLIC_TOKEN_PEPPER=
UPLOAD_DIR=uploads
UPLOAD_PUBLIC_PATH=/api/uploads
MAX_ATTACHMENT_COUNT=3
MAX_ATTACHMENT_BYTES=2097152
MAX_ATTACHMENT_TOTAL_BYTES=6291456
ADMIN_KAKAO_IDS=

GMAIL_SMTP_ENABLED=true
GMAIL_SMTP_HOST=smtp.gmail.com
GMAIL_SMTP_PORT=465
GMAIL_SMTP_SECURE=true
GMAIL_SMTP_USER=
GMAIL_SMTP_APP_PASSWORD=
GMAIL_SMTP_FROM_NAME=매아리
GMAIL_SMTP_FROM_ADDRESS=
GMAIL_SMTP_CONNECTION_TIMEOUT_MS=10000

SOLAPI_SMS_ENABLED=true
SOLAPI_API_KEY=
SOLAPI_API_SECRET=
SOLAPI_SENDER_NUMBER=

PHONE_LOOKUP_ENABLED=false
PHONE_LOOKUP_PROVIDER=TWILIO
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
PHONE_LOOKUP_TIMEOUT_MS=3000
PHONE_LOOKUP_CACHE_TTL_DAYS=30

API_PROXY_TARGET=http://127.0.0.1:4000
NEXT_PUBLIC_API_BASE_URL=/api
NEXT_PUBLIC_SERVICE_URL=https://maeari.madcamp-kaist.org
```

`NEXT_PUBLIC_*` 값은 Next.js build 결과에 포함되므로 변경 후에는 web을 다시 build하고 PM2 `maeari-web`을 재시작해야 합니다. Kakao Developers에는 운영 redirect URI인 `https://maeari.madcamp-kaist.org/api/auth/kakao/callback`을 등록해야 합니다.

운영 DB는 2026-07-06에 기존 MVP 이름인 `maeum_arrival`에서 `maeari`로 전환했습니다. 기존 데이터는 final dump로 백업한 뒤 새 DB에 복원했고, `maeum_arrival`과 `maeari_dryrun` DB는 제거했습니다. 2026-07-07 기준 앱 환경변수와 PM2 프로세스는 `maeari` DB만 사용합니다. `maeum` bootstrap role은 Postgres system-required role이라 삭제할 수 없지만 `NOLOGIN` 상태이며, template DB owner는 `maeari`로 정리했습니다. DB dump는 민감 데이터이므로 `backups/`는 `.gitignore`에 포함합니다.

### 검증 명령

```bash
pnpm db:validate
pnpm typecheck
pnpm build
```

### 배포 참고

현재 운영 대상 서버는 **AWS EC2 Ubuntu 24.04 LTS / t3.medium** 기준입니다. API, Web, Scheduler는 PM2로 분리 실행하고, Nginx가 `/api/*`는 Express로, 그 외 요청은 Next.js로 프록시합니다.

Nginx 설정은 `infra/nginx/maeari.conf.template`를 사용합니다.

```bash
SERVICE_DOMAIN="<domain>" \
WWW_SERVICE_DOMAIN="<www-domain>" \
API_PORT="<api-port>" \
WEB_PORT="<web-port>" \
./scripts/render-nginx.sh
```

현재 EC2 운영 서버에는 `/etc/nginx/sites-available/default`가 활성화되어 있고, `server_name maeari.madcamp-kaist.org;`로 설정되어 있습니다. Certbot을 통해 HTTPS 인증서를 적용했으며 HTTP 요청은 HTTPS로 redirect됩니다.

운영 웹은 Next.js `output: "standalone"` 빌드 산출물로 실행합니다. standalone 서버가 정적 파일을 제공할 수 있도록 web package의 `build` script가 `.next/static`과 `public`을 standalone 경로로 복사합니다.

```bash
pnpm --filter @maeari/web build
pm2 restart maeari-web --update-env
pm2 save
```

운영 확인:

```bash
curl -I https://maeari.madcamp-kaist.org/
curl -I https://maeari.madcamp-kaist.org/icon.png
curl -I https://maeari.madcamp-kaist.org/api/health
pm2 list
```

### AI 유해성 필터링 구현 상태

유해성 검사는 세 단계로 구성되어 있습니다.

1. `detectKoreanAbuse`: 한국어 욕설, 비하어, obfuscation 일부를 로컬 규칙으로 즉시 차단합니다.
2. OpenAI Moderations API: `OPENAI_MODERATION_MODEL`로 일반 safety category를 검사합니다.
3. 매아리 guardrail prompt: Moderations API가 통과시킨 메시지도 `OPENAI_GUARDRAIL_MODEL`로 서비스 정책 기반 2차 판정을 수행합니다.

guardrail prompt는 `apps/api/src/modules/moderation/moderation-policy.ts`에 있습니다. 이 prompt는 매아리가 “수신자에게 직접 전달되는 예약 메시지 서비스”임을 설명하고, 욕설/혐오/비하/성적 모욕/사전식 욕설 목록도 수신자에게 전달되면 차단하도록 지시합니다.

guardrail 응답은 `allowed`, `categories`, `severity`, `feedback`, `rationale` JSON schema를 기준으로 파싱합니다. 이전 prompt에서 사용하던 `is_harmful`, `confidence_score`, `violation_category`, `reason` 형식도 normalize할 수 있게 해, prompt와 parser schema 불일치 때문에 정상 메시지가 `MODERATION_FAILED`로 빠지는 문제를 방지했습니다. guardrail 호출은 모델 기본 파라미터를 사용하며 불필요한 `temperature` 고정값은 제거했습니다.

차단된 메시지는 `MESSAGE_BLOCKED_BY_MODERATION`으로 저장되지 않고, 사용자에게는 offensive text를 반복하지 않는 짧은 안내 문구만 반환합니다. OpenAI 호출 실패는 즉시 재시도 후에도 실패하면 `MODERATION_FAILED`로 보관하고 scheduler가 재검사합니다.

### 브랜드 이미지 적용 상태

`images/`에 전달된 봉투 일러스트를 web asset으로 변환해 사용합니다.

- `apps/web/app/icon.png`: 브라우저 탭 favicon/app icon
- `apps/web/app/apple-icon.png`: Apple touch icon
- `apps/web/public/images/maeari-mark.png`: 헤더/공개 열람 브랜드 아이콘
- `apps/web/public/images/maeari-main-envelope.webp`: 메인 페이지 히어로 이미지
- `apps/web/public/images/maeari-login-envelope.webp`: 로그인 화면 이미지
- `apps/web/public/images/maeari-public-envelope.webp`: 공개 도착 링크 이미지

### 전화번호 인증 및 마음쓰기 권한

마음쓰기 권한은 이메일 인증이 아니라 **strict 010 휴대전화 인증**으로만 부여합니다. `/write`는 연락처 선택 UI를 보여주지 않고, `/api/me/contacts`의 `writerEligibility.hasVerifiedStrictPhone`만 확인합니다. 인증된 전화번호가 없으면 상단 안내 패널과 `/phone-verification?next=/write` CTA를 보여주고 예약 버튼을 비활성화합니다.

- `/phone-verification`은 전화번호 입력, 인증번호 발송/재발송, 6자리 OTP 검증, 완료 후 안전한 `next` 이동을 담당합니다.
- 허용 입력은 `01012345678`, `010-1234-5678`, `+821012345678`, `821012345678` 계열이며 저장 포맷은 `01012345678`입니다.
- `070`, `050x`, 유선번호, 구형 `01X`, 해외번호는 `CONTACT_PHONE_INVALID`로 거부합니다.
- `PHONE_LOOKUP_ENABLED=true`이면 Twilio Lookup v2 `line_type_intelligence`를 호출해 `valid=true`, `country_code=KR`, `type=mobile`만 통과시킵니다.
- Lookup 결과는 `PhoneNumberLookupCache`에 raw 전화번호 없이 `contactHash` 기준으로 TTL cache합니다.
- 동일 연락처는 10분 내 3회 초과 요청 시 24시간 CONTACT lock, 동일 IP에서 1시간 내 서로 다른 번호 5개 초과 요청 시 1시간 IP lock을 겁니다.
- IP와 전화번호 원문은 abuse-defense 테이블에 저장하지 않고 `PUBLIC_TOKEN_PEPPER` 기반 HMAC hash만 저장합니다.
- 인증 완료된 PHONE은 사용자가 직접 삭제할 수 없고, 새 전화번호 인증이 성공한 순간 기존 active PHONE을 retire 처리합니다.
- `POST /api/messages`는 요청 body의 `senderContactId`를 보안상 무시하고, 서버가 현재 사용자의 active verified strict PHONE을 직접 선택해 `Message.senderContactId`와 `senderContactSnapshot`에 저장합니다.
- 이미 예약된 메시지는 생성 시점 snapshot을 신뢰하므로, 이후 사용자가 전화번호를 바꾸더라도 기존 예약 메시지 전달에는 영향을 주지 않습니다.

이메일 연락처는 마음쓰기 권한이 아니라 이메일로 받은 외부 메시지를 기존 사용자에게 연결하기 위한 보조 신원입니다. Kakao에서 이메일을 받은 사용자는 `UserContact(type=EMAIL, verificationSource=KAKAO)`가 자동 upsert됩니다.

### 친구 초대 링크

친구 추가는 친구 코드 검색/요청 방식과 임시 초대 링크 방식을 모두 지원합니다.

- `/friends`에서 `POST /api/friends/invites`로 24시간 유효한 1회성 초대 링크를 생성합니다.
- 초대 링크 원문 token은 DB에 저장하지 않고 `FriendInviteLink.tokenHash`에 HMAC hash만 저장합니다.
- `/friends/invite/[token]`은 비회원도 초대자 닉네임과 만료 상태를 미리 볼 수 있습니다.
- 로그인 사용자가 초대 링크를 열면 `POST /api/friends/invites/:token/claim`으로 즉시 친구 관계를 생성합니다.
- 로그인 전 초대 링크를 열면 `sessionStorage.maeari.pendingFriendInviteToken`에 token을 보관하고, `/auth/callback`에서 로그인 완료 후 자동 claim을 시도합니다.
- 이미 친구이거나 자기 자신 링크인 경우, 만료/폐기/이미 사용된 링크인 경우는 명확한 에러 코드로 처리합니다.

### SMS/이메일 발송 구현 상태

현재 저장소에는 외부 발송 provider가 실제 연동되어 있습니다.

- `Message.status = SENT` 처리 직후 `message.sent` 이벤트 발행
- `hintAt`이 지난 예약 메시지는 scheduler가 `ARRIVAL_HINT` 알림을 한 번 발송
- `NotificationProcessor`가 가입 수신자는 `IN_APP`, 외부 수신자는 `SMS` 또는 `EMAIL`로 분기
- `NotificationLog.idempotencyKey` 기반 중복 발송 방지
- Gmail SMTP와 Solapi provider 응답의 `providerMessageId`를 `NotificationLog`에 저장해 운영 추적 가능
- retryable 실패 시 `NotificationLog.PENDING` + `nextRetryAt`로 재시도 예약
- provider 미설정 시 실제 발송 성공으로 처리하지 않고 `NotificationLog.SKIPPED`, `MessageRecipient.FAILED` 기록
- 이메일은 Gmail SMTP/Nodemailer를 사용하고, 문자 알림은 Solapi Node SDK를 사용
- Gmail SMTP 또는 Solapi가 꺼져 있으면 fallback 없이 해당 채널을 `NOTIFICATION_PROVIDER_NOT_CONFIGURED`로 처리
- 예전 로컬 MVP용 SMTP alias와 외부 알림 대체 provider 경로는 제거했고, `.env.example`에도 포함하지 않습니다.
- `ContactSuppression`에 HMAC-SHA256 contact hash를 저장해 이메일/문자 수신거부를 채널별로 처리
- `preferredChannel=AUTO`는 이메일이 있으면 EMAIL, 이메일이 없고 전화번호만 있으면 SMS를 선택
- `preferredChannel=EMAIL` 또는 `SMS`는 해당 채널만 시도하며 실패 시 다른 채널로 임의 fallback하지 않음
- 이메일과 문자에는 사용자가 작성한 편지 본문을 절대 포함하지 않고 공개 열람 링크만 포함

실제 발송에 필요한 설정:

```env
GMAIL_SMTP_ENABLED=true
GMAIL_SMTP_USER=
GMAIL_SMTP_APP_PASSWORD=
GMAIL_SMTP_FROM_NAME=매아리
GMAIL_SMTP_FROM_ADDRESS=

SOLAPI_SMS_ENABLED=true
SOLAPI_API_KEY=
SOLAPI_API_SECRET=
SOLAPI_SENDER_NUMBER=
```

Solapi 발신번호와 수신번호는 `01012345678`처럼 숫자만 사용합니다. 공개 도착 링크가 포함되므로 실제 발송 타입과 과금은 SMS가 아니라 LMS로 자동 전환될 수 있습니다. 발신번호는 Solapi 콘솔에 사전 등록되어 있어야 합니다.

설정 변경 후에는 `maeari-api`와 `maeari-scheduler`를 재시작하고, 외부 수신자 메시지를 예약 발송해 `NotificationLog.status`, `provider`, `providerMessageId`, `errorCode`를 확인합니다.

수신거부는 공개 도착 링크 화면에서 처리합니다. `/api/public/notification-suppressions`는 raw 이메일/전화번호를 저장하지 않고, `PUBLIC_TOKEN_PEPPER` 기반 HMAC-SHA256 hash만 `ContactSuppression`에 저장합니다. 이메일 수신거부는 이메일만, 문자 수신거부는 문자만 막는 채널별 정책입니다.

### 보관함 삭제 구현 상태

예약 메시지의 취소와 보관함 삭제는 분리되어 있습니다.

- `PATCH /api/messages/:id/cancel`은 아직 도착하지 않은 예약 메시지를 취소합니다.
- `PENDING`, `MODERATION_FAILED`, `CANCELED` 보낸 마음은 `DELETE /api/messages/:id`로 hard delete합니다.
- `SENT`, `FAILED` 보낸 마음은 `DELETE /api/messages/:id`로 `Message.senderDeletedAt`을 기록해 발신함에서만 제외합니다.
- 받은 마음은 같은 `DELETE /api/messages/:id`로 현재 사용자의 `MessageRecipient.receiverDeletedAt`을 기록해 수신함에서 제외합니다.
- 이미 도착했거나 실패한 메시지와 받은 메시지는 발송 이력, 공개 token, notification log, 감사 추적을 보존하기 위해 사용자별 soft delete를 사용합니다.
- `/sent`, `/inbox`, 메시지 상세 화면은 삭제 가능 상태일 때 `삭제` 버튼을 보여주고, 삭제된 항목은 목록에서 다시 노출하지 않습니다.
- 받은 마음은 `PATCH /api/messages/:id/archive`로 아카이브할 수 있고 `/archive`에서 복구 또는 삭제할 수 있습니다.
- `/messages/bulk-delete`와 받은 마음/아카이브 화면의 `일괄 삭제` 버튼으로 현재 보이는 여러 항목을 한 번에 보관함에서 제거할 수 있습니다.
- v1 오래된 메시지 정리 정책은 자동 hard delete가 아니라 사용자 직접 아카이브/삭제와 soft delete입니다. 발송 이력, 공개 token, moderation/notification log는 감사 추적을 위해 보존합니다.

### 2026-07-05 확장 기능 반영 요약

카카오 알림톡을 제외한 후순위 기능을 실제 코드에 반영했습니다.

- 그룹 전송: `POST /api/messages`가 `recipients` 배열을 받아 하나의 `Message`에 여러 `MessageRecipient`와 공개 token을 생성합니다.
- 이미지 첨부: `/write`에서 최대 3개의 이미지를 multipart `attachments`로 전송하고, JSON payload는 multipart field `payload`에 담습니다. 허용 형식은 `.jpg`, `.jpeg`, `.png`, `.webp`이며 MIME type은 `image/jpeg`, `image/png`, `image/webp`만 허용합니다. API는 multer memory storage에서 MIME/확장자/개수/개별 용량/총 용량을 1차 검증하고, 저장 직전 파일 매직바이트를 다시 검사해 실제 파일 내용이 JPEG/PNG/WEBP인지 확인합니다. 통과한 파일은 `UPLOAD_DIR/messages/{messageId}`에 저장하고 `/api/uploads/*`로 제공합니다. multipart parser는 `payload + 이미지 3개` 요청이 정상 통과하도록 file/field limit은 유지하면서 parts limit에 여유를 둡니다. JSON data URL payload도 service 레벨에서 처리 가능하지만, 현재 web UI의 기본 경로는 multipart입니다.
- 랜덤 도착/힌트/테마: `arrivalMode=RANDOM_WINDOW`, 도착 구간, `hintAt`, `theme`, `isReplyEnabled`를 메시지에 저장합니다.
- 도착 전 힌트: scheduler의 `sendArrivalHints` job이 `ARRIVAL_HINT` notification log를 생성하고 이메일/SMS/인앱 힌트를 보냅니다.
- 익명 답장: `/arrival/[token]`에서 수신자가 답장을 남기면 moderation 후 `MessageReply`에 저장되고, 발신자는 메시지 상세에서 확인합니다.
- 감정 리포트: `/reports`와 `GET /api/reports/emotions`에서 월별 보낸/받은 마음, 감정 분포, 상태 분포를 확인합니다.
- 관리자 검수/통계: `ADMIN_KAKAO_IDS` 기반 `/admin` 화면과 `/api/admin/*` API로 moderation log, notification log, 재시도 대상, 채널/provider별 발송 통계, 익명 답장 검수를 제공합니다.
- 신고/정지: 공개 링크와 로그인 상세 화면에서 메시지를 신고할 수 있고, 관리자는 신고를 검토하거나 발신자 계정을 정지/해제할 수 있습니다.
- 보관함 고도화: `/sent`, `/inbox`, `/archive`, `/future`에 감정 태그 필터를 적용했고, 아카이브 복구, 일괄 삭제, 미래의 나에게 쓴 편지 모음을 추가했습니다.

### 2026-07-04 코드 반영 요약

오늘 반영된 주요 변경은 다음 파일군에 걸쳐 있습니다.

- 메인/브랜드 UI: `apps/web/app/page.tsx`, `apps/web/components/AppShell.tsx`, `apps/web/app/icon.png`, `apps/web/app/apple-icon.png`, `apps/web/public/images/*`
- 메시지 작성 UX: `apps/web/app/write/page.tsx`에서 KST 현재 시각, 날짜/시간 분리 입력, 15분 quick minute, 작성 결과 팝업, 공개 링크 설명을 처리합니다.
- 친구 기능: `packages/database/prisma/schema.prisma`, `apps/api/src/modules/friends/*`, `apps/web/app/friends/page.tsx`에 친구 코드, 요청, 수락/거절/취소, 친구 삭제, 친구 수신자 선택 흐름을 추가했습니다.
- 친구 찾기: `GET /api/friends/search`와 `/friends` 검색 UI에서 닉네임 또는 친구 코드로 아직 친구가 아니고 요청 중도 아닌 사용자를 찾을 수 있습니다.
- 외부 수신/발송: `apps/api/src/processors/notification-provider.ts`, `apps/api/src/processors/notification.processor.ts`, `apps/api/src/jobs/retry-pending-notifications.job.ts`에서 Gmail SMTP, Solapi SMS, idempotency, retry, provider 미설정 실패 처리를 담당합니다.
- AI 유해성 필터링: `apps/api/src/modules/moderation/moderation.service.ts`, `apps/api/src/modules/moderation/moderation-policy.ts`에서 로컬 한국어 보강 규칙, OpenAI Moderation, 서비스 정책 guardrail prompt를 순차 적용합니다. guardrail prompt와 parser schema를 맞추고 legacy `is_harmful` 응답도 normalize하도록 안정화했습니다.
- 보관함 삭제: `packages/database/prisma/schema.prisma`, `apps/api/src/modules/messages/*`, `apps/web/app/sent/page.tsx`, `apps/web/app/inbox/page.tsx`, `apps/web/app/messages/[id]/page.tsx`에서 상태별 hard/soft delete, `senderDeletedAt`, `receiverDeletedAt`, `DELETE /api/messages/:id`, 보낸/받은 마음 삭제 버튼을 처리합니다.
- 감정 필터/운영 통계: `/sent`, `/inbox`, `/archive`, `/future`는 감정 태그 필터를 제공하고, `/admin`은 `NotificationLog` 상태/채널/provider/실패 코드/재시도 예정 통계를 보여줍니다.
- 운영 안정화: `apps/web/package.json` build script와 PM2 실행 방식을 Next.js standalone 기준으로 맞췄고, Nginx/Certbot 운영 도메인 기준 확인 절차를 문서화했습니다.

### 2026-07-06 추가 반영 요약

전화번호 인증, 친구 초대 링크, 첨부 업로드, 신규 DB 전환까지 운영 상태에 반영했습니다.

- 전화번호 인증 필수화: `apps/web/app/phone-verification/page.tsx`, `apps/web/app/write/page.tsx`, `apps/api/src/modules/contacts/*`에서 strict 010 휴대전화 인증을 마음쓰기 전제 조건으로 적용했습니다.
- Twilio Lookup/abuse defense: `PhoneVerificationAttempt`, `PhoneVerificationLock`, `PhoneNumberLookupCache`와 `phone-verification-guard.ts`로 Lookup cache, IP/contact lock, fail-closed lookup 정책을 구현했습니다.
- 연락처 선택 UI 제거: `/write`에서 연락처 select와 masked value 노출을 제거하고, 서버가 인증 PHONE을 직접 선택하도록 `POST /api/messages` 정책을 바꿨습니다.
- 친구 초대 링크: `FriendInviteLink`, `/api/friends/invites/*`, `/friends/invite/[token]`, `/auth/callback`의 pending invite token 처리로 로그인 후 즉시 친구 연결이 가능해졌습니다.
- 첨부 업로드: `multer` 기반 multipart parser와 `MAX_ATTACHMENT_TOTAL_BYTES`를 추가해 이미지 첨부 실패 원인을 구체적인 error code로 반환합니다. `payload + 이미지 3개` multipart 요청은 허용하고, 이미지 4개 이상은 `TOO_MANY_ATTACHMENTS`로 차단합니다. 업로드 allowlist는 `.jpg`, `.jpeg`, `.png`, `.webp`로 고정했고, 프론트 `accept`, 클라이언트 검증, API MIME/확장자 검증, service 매직바이트 검증을 모두 같은 정책으로 맞췄습니다.
- 작성 결과 팝업: `/write`의 성공/오류 notice를 화면 상단 인라인 알림 대신 `WriteNoticeDialog` 중앙 팝업으로 띄웁니다. 성공 시 제목, 수신자, 도착 예정 시각, 공개 링크, 예약 상세/보낸 마음/새 마음 쓰기/메인 이동 액션을 팝업 안에서 제공합니다.
- 운영 DB 전환: Docker Postgres의 운영 DB/USER를 `maeari`로 전환하고, 기존 `maeum_arrival` 데이터는 final dump 후 새 DB에 복원했습니다.
- 문서 보호: 운영 dump가 git에 올라가지 않도록 `backups/`를 `.gitignore`에 추가했습니다.

---

## 회고 문서

> 개발 과정에서의 어려움, 해결 방법, 역할 분담, 다음에 개선할 점 (KPT 방법론 참고)

### Keep

- 기획, IA, DB schema를 먼저 정리하고 구현 범위를 명확히 나누었다.
- mock, dummy, fake provider 없이 실제 연동 구조를 기준으로 설계했다.
- 메시지와 수신자를 분리해 이후 그룹 전송 확장 가능성을 확보했다.
- 친구 관계, 외부 연락처, 공개 링크를 모두 `MessageRecipient` 중심으로 처리해 수신자 식별 방식을 확장 가능하게 유지했다.
- 운영 도메인, HTTPS, PM2, Nginx 상태를 curl과 로그로 확인하며 배포 문제를 단계적으로 좁혔다.

### Problem

- 카카오 OAuth는 Kakao Developers의 Redirect URI가 정확히 등록되어야 로컬과 배포 환경에서 정상 동작한다.
- `.env.local`을 바꿔도 실행 중인 API 프로세스가 재시작되지 않으면 예전 `KAKAO_REDIRECT_URI`, `WEB_ORIGIN`을 계속 사용한다.
- Next.js 개발 서버를 운영 포트에 그대로 띄우면 `.next` 캐시와 devtools manifest가 꼬여 CSS/JS 404 또는 500이 발생할 수 있다.
- Moderations API만 사용하면 서비스 맥락이 충분히 전달되지 않아 사전식 욕설/비하 표현 목록이 통과할 수 있다.
- guardrail prompt와 parser의 JSON schema가 어긋나면 정상 메시지도 `MODERATION_FAILED`로 밀릴 수 있다.
- 알림톡은 비즈니스 채널과 템플릿 승인이 필요해 후순위이며, 현재 외부 알림은 Gmail SMTP 이메일과 Solapi 문자로 처리한다.
- OpenAI, Kakao, DB 등 필수 환경 변수는 `.env.local` 또는 `.env.production`에 실제 값이 들어가야 서버가 시작된다.

### Try

- 로컬에서는 `http://localhost:3000/api/auth/kakao/callback`을 Kakao Developers Redirect URI에 등록해 로그인 흐름을 확인한다.
- 운영에서는 `https://maeari.madcamp-kaist.org/api/auth/kakao/callback`을 Kakao Developers Redirect URI에 등록한다.
- 운영 배포 전 `pnpm typecheck`, `pnpm build`, `pnpm db:deploy`, `nginx -t`를 순서대로 검증한다.
- 운영 web은 `next dev`가 아니라 standalone production server로 실행한다.
- `.env` 변경 후 API/scheduler/web 중 어떤 프로세스가 해당 env를 읽는지 구분해 재시작한다.
- 유해성 필터링은 Moderations API 단독이 아니라 서비스 정책 prompt와 로컬 한국어 보강 규칙을 함께 테스트한다.
- guardrail prompt schema와 parser schema를 함께 관리하고, legacy 응답 normalize test와 실제 OpenAI smoke test를 배포 전 확인한다.
- 보관함 삭제는 발신자 상태별 hard/soft delete와 수신자 `receiverDeletedAt` 기반 숨김을 구분해 유지한다.
- 오래된 메시지 정리는 자동 삭제보다 사용자 직접 아카이브/삭제와 감사 로그 보존을 우선한다.
- 알림톡을 붙일 때도 현재 `NotificationLog`의 provider 응답 기반 `SENT`/`FAILED`/`SKIPPED` 정책과 중복 방지 구조를 그대로 확장한다.

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

---

## 2026-07-06 신규 기능 구현 현황

- 첨부 이미지 유해성 검사는 `tesseract.js` OCR로 이미지 속 텍스트를 추출한 뒤 기존 OpenAI moderation/guardrail 입력에 합쳐 검사합니다. v1 지원 이미지는 `.jpg`, `.jpeg`, `.png`, `.webp`이며 GIF는 OCR 안정성 때문에 업로드 단계에서 제외합니다.
- 공개 도착 링크 답장은 생성 직후 `REPLY_RECEIVED` 이벤트를 발생시키며, 발신자에게 앱 내 알림과 인증 이메일 알림을 보냅니다. 이메일에는 원문/답장 내용이 포함되지 않고 `/messages/:id` 링크만 포함됩니다.
- `/sent`에는 `보낸 마음 / 답장함` 탭이 추가되었습니다. 답장함은 새 답장, 읽음 상태, 발신자 화면 삭제를 지원합니다.
- 공개 링크 공유는 기존 URL token 구조를 유지하되 웹에서 QR로 렌더링합니다. 마음쓰기 완료 모달, 보낸 마음, 메시지 상세 화면에서 QR 표시/링크 복사/QR 저장이 가능합니다.
- 이메일/전화번호 인증 성공 후 기존 비회원 수신 메시지를 현재 회원의 받은 마음으로 자동 연결합니다. 외부 알림 실패로 `FAILED`가 된 단일 수신 메시지는 내부 수신으로 복구 가능한 경우 `SENT`로 복구합니다.
- `마음나무` 기능이 추가되었습니다. 회원은 `/tree`에서 도착 시점을 정한 공개 링크/QR을 만들고, 비회원은 `/tree/[token]`에서 편지를 남깁니다. 스케줄러가 도착 시점에 제출물을 일괄 공개하고 owner에게 앱/이메일 알림을 보냅니다.

### 추가 환경 변수

```env
IMAGE_OCR_MODERATION_ENABLED=true
IMAGE_OCR_LANGUAGES=kor+eng
IMAGE_OCR_TIMEOUT_MS=8000
IMAGE_OCR_MAX_TEXT_CHARS=4000
```

### DB Migration 적용 상태

- 2026-07-07 기준 운영 `maeari` DB에 `20260706150000_ocr_replies_qr_collections` migration을 적용했습니다.
- `prisma migrate status` 결과: `Database schema is up to date!`
- 새 migration에는 OCR 필드, 답장 알림 필드, `NotificationLog` target 확장, `MessageCollection`, `MessageCollectionSubmission`이 포함됩니다.

배포/재시작 전 확인 명령:

```bash
pnpm db:validate
pnpm db:deploy
pnpm --filter @maeari/api build
pnpm --filter @maeari/web build
```

## 2026-07-07 운영 보강 반영

### OCR 설정과 동작 방식

현재 이미지 텍스트 추출은 API 서버 내부의 `tesseract.js`로 처리합니다.

- 구현 파일: `apps/api/src/modules/moderation/image-ocr.service.ts`
- 호출 방식: `Tesseract.recognize(buffer, IMAGE_OCR_LANGUAGES, ...)`
- 기본 언어: `kor+eng`
- OCR 결과 저장 위치: `MessageAttachment.ocrStatus`, `ocrText`, `ocrConfidence`, `ocrError`, `ocrCheckedAt`
- 검사 흐름: 업로드 이미지 검증 → OCR 텍스트 추출 → 메시지 본문/제목/감정 태그와 OCR 텍스트 병합 → 기존 OpenAI moderation/guardrail 검사
- OCR 실패/timeout 정책: 메시지를 바로 발송하지 않고 `MODERATION_FAILED`로 저장하며, moderation retry job이 저장된 첨부 파일로 OCR을 다시 시도합니다.
- 범위 제한: v1은 이미지 안의 텍스트만 검사합니다. 이미지 장면 자체의 선정성/폭력성/상징물 판별은 Vision moderation이 아니므로 범위 밖입니다.

운영 `.env.local` 또는 `.env.production`에 설정할 값:

```env
IMAGE_OCR_MODERATION_ENABLED=true
IMAGE_OCR_LANGUAGES=kor+eng
IMAGE_OCR_TIMEOUT_MS=8000
IMAGE_OCR_MAX_TEXT_CHARS=4000
```

설정 변경 후 적용 순서:

```bash
pnpm --filter @maeari/api build
pm2 restart maeari-api --update-env
pm2 restart maeari-scheduler --update-env
pm2 save
curl -I http://127.0.0.1:4000/api/health
curl -I https://maeari.madcamp-kaist.org/api/health
```

### 첨부 이미지 형식 제한

이미지 업로드 허용 정책은 네 단계로 적용합니다.

1. `/write` 파일 선택창 `accept`
   - `.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp`
2. `/write` 클라이언트 검증
   - `file.type`이 `image/jpeg`, `image/png`, `image/webp` 중 하나인지 확인
   - 파일명이 `.jpg`, `.jpeg`, `.png`, `.webp` 중 하나로 끝나는지 확인
3. API multipart middleware 검증
   - multer `fileFilter`에서 MIME type과 원본 파일 확장자를 함께 확인
4. API service 저장 직전 검증
   - JPEG magic bytes: `FF D8 FF`
   - PNG magic bytes: `89 50 4E 47 0D 0A 1A 0A`
   - WEBP magic bytes: `RIFF....WEBP`

이 정책 덕분에 확장자만 바꾼 파일이나 잘못된 MIME으로 우회하는 요청을 저장 단계에서 다시 차단합니다. 형식 오류는 `ATTACHMENT_TYPE_UNSUPPORTED`로 반환하고, 4개 이상 첨부는 `TOO_MANY_ATTACHMENTS`, 개별/총 용량 초과는 `ATTACHMENT_TOO_LARGE` 또는 `ATTACHMENTS_TOO_LARGE`로 반환합니다.

### 운영 DB와 PM2 상태

- 현재 앱 환경변수는 `DATABASE_URL=.../maeari?schema=public`, `POSTGRES_DB=maeari`, `POSTGRES_USER=maeari` 기준입니다.
- 기존 `maeum_arrival` DB와 `maeari_dryrun` DB는 제거되어 운영 DB 목록에는 `maeari`만 남아 있습니다.
- `maeum` role은 Postgres bootstrap role이라 삭제할 수 없지만 `NOLOGIN` 상태입니다. 앱이 사용하는 client connection은 0개이며, Postgres 내부 system process 하나가 bootstrap role 이름으로 보일 수 있습니다.
- `template0`, `template1` owner는 `maeari`로 정리했습니다.
- PM2에는 `maeari-api`, `maeari-scheduler`, `maeari-web`이 online 상태로 유지되어야 합니다.
- 최근 OCR import 오류는 `tesseract.js` v7의 default export 방식에 맞춰 `import Tesseract from "tesseract.js"`로 수정했고, API/Web build 후 PM2 재시작과 health check를 완료했습니다.
