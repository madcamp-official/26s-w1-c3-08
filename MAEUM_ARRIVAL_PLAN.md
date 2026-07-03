# 마음도착 MVP 개발 계획서

## 0. 문서 목적

이 문서는 예약 메시지 서비스 **마음도착**의 MVP를 실제 개발 가능한 단위로 정리한 전체 계획서입니다.

서비스 기획, 기술 스택, 데이터베이스 설계, API 설계, AI 필터링, 스케줄러, 인프라 운영까지 한 번에 연결해 개발 순서와 산출물을 명확히 정의합니다.

> 핵심 문장: **내가 잊고 있었던 글이, 내가 기억하지 못하는 순간에 찾아온다.**

## 0.1 최종 반영 사항

이 최종안에는 기존 MVP 계획에 더해 다음 UX 및 운영 로직을 반영합니다.

- AI Moderation 차단 시 단순 실패가 아닌 카테고리 기반의 부드러운 피드백 제공
- `getModerationFeedback(categories)` 함수를 통한 사용자 안내 문구 변환
- 비회원이 공개 링크로 메시지를 열람한 뒤 가입하면 해당 메시지가 자동으로 수신함에 귀속되는 흐름
- `/api/auth/link-message` API 추가
- 공개 열람 token을 `sessionStorage`에 보관하고 로그인 완료 후 자동 매핑
- 스케줄러는 `PENDING`에서 `SENT` 상태 변경만 담당
- 상태 변경 직후 `EventEmitter`로 `NotificationProcessor`를 분리 실행
- Nginx `proxy_read_timeout` 60초 이상 설정
- 로컬/배포 환경을 구분하는 `.env` 관리 가이드 추가
- OpenAI API 장애/타임아웃으로 AI 검사 자체가 실패하면 즉시 1회 자동 재시도
- 2회 모두 검사 실패 시 `MODERATION_FAILED` 상태로 저장하고 하루 1회 자동 재검사
- 일일 재검사에서 통과하면 다시 예약 발송 큐로 복귀
- 실제 웹서비스 구현 시 mock 파일, dummy 데이터, fake provider를 만들지 않음
- 외부 연동에 필요한 키, 도메인, redirect URI, secret은 모두 `.env`로 주입하고 사용자가 추후 제공

---

## 0.2 구현 원칙

실제 서비스 구현 단계에서는 아래 원칙을 적용합니다.

```txt
1. mock 파일을 만들지 않습니다.
2. dummy 데이터를 만들지 않습니다.
3. fake API provider 또는 fake 성공 응답을 만들지 않습니다.
4. seed 데이터는 MVP 구현 범위에서 제외합니다.
5. 외부 연동에 필요한 값은 코드에 하드코딩하지 않고 `.env`로만 주입합니다.
6. `.env.example`에는 실제 값이나 가짜 값을 넣지 않고 필요한 key 목록만 제공합니다.
7. 필수 환경 변수가 없으면 서버 시작 시 명확한 오류를 발생시킵니다.
8. 아직 실제 provider 정보가 없는 기능은 성공한 것처럼 처리하지 않고 명확한 설정 누락 오류나 미설정 상태로 표현합니다.
```

이 원칙은 카카오 OAuth, OpenAI Moderation, PostgreSQL, JWT/Cookie, 배포 도메인, Nginx, 향후 알림톡/SMS 연동에 모두 적용합니다.

## 1. 서비스 개요

### 1.1 서비스명

**마음도착**

### 1.2 서비스 한 줄 설명

오늘 작성한 마음을 미래의 특정 순간에 도착시키는 감성 중심형 예약 메시지 서비스입니다.

### 1.3 서비스 목표

마음도착의 목적은 단순한 메시지 발송이 아닙니다.

사용자가 현재의 마음, 기억, 감정, 응원, 감사, 축하를 미래의 특정 날짜까지 보관하고, 받는 사람이 예상하지 못한 순간에 그 마음을 다시 만날 수 있도록 돕는 것이 핵심입니다.

즉, 마음도착은 다음 경험을 제공합니다.

- 지금의 감정을 미래로 보관합니다.
- 빠른 메신저가 아닌 느린 소통의 가치를 제공합니다.
- 기다림과 의외성이 주는 설렘을 만듭니다.
- 따뜻하고 안전한 메시지 문화를 유지합니다.
- 비회원도 링크를 통해 마음을 받을 수 있게 해 자연스러운 유입을 만듭니다.

### 1.4 MVP 핵심 가치

MVP 단계에서는 아래 문장을 제품 경험의 중심에 둡니다.

> 오늘 쓴 마음이 가장 필요한 날, 생각하지 못한 순간에 도착하는 감성 메시지 보관함.

---

## 2. 제품 철학

## 2.1 감정의 기록과 추억 보관

마음도착은 사용자가 작성한 메시지를 즉시 소비하지 않고 미래까지 보관합니다.

이 메시지는 단순 텍스트가 아니라 사용자가 특정 시점에 남긴 감정의 기록입니다. 시간이 흐른 뒤 메시지를 다시 만나는 경험은 과거의 자신, 관계, 기억을 새롭게 바라보게 만듭니다.

## 2.2 느린 소통이 만드는 깊은 연결

기존 메신저는 즉각성과 속도를 중심으로 작동합니다.

반면 마음도착은 느리게 도착하는 메시지를 통해 더 오래 남는 소통을 지향합니다.

대상은 다음과 같습니다.

- 미래의 나
- 가족
- 연인
- 친구
- 고마웠던 사람
- 응원이 필요한 사람

## 2.3 기다림과 의외성이 주는 설렘

예약 메시지는 기다림을 전제로 합니다.

여기에 다음 옵션을 더해 감성적 경험을 강화합니다.

- 발신인 숨기기
- 도착일 숨기기
- 기간 랜덤 발송
- 도착 전 힌트 알림

MVP에서는 `발신인 숨기기`, `도착일 숨기기`를 우선 구현하고, 기간 랜덤 발송과 힌트 알림은 확장 기능으로 둡니다.

## 2.4 안전한 메시지 문화

서비스의 감성적 방향을 유지하려면 유해 메시지를 그대로 전달하지 않는 구조가 필요합니다.

따라서 메시지 저장 전 AI 기반 moderation을 수행합니다.

차단 대상 예시는 다음과 같습니다.

- 욕설
- 혐오 표현
- 위협
- 괴롭힘
- 폭력적 표현
- 자해 유도
- 성적 착취성 표현
- 과도하게 공격적이거나 모욕적인 표현

---

## 3. MVP 범위

## 3.1 MVP에서 반드시 구현할 기능

| 영역 | 기능 | 설명 |
| --- | --- | --- |
| 인증 | 카카오 소셜 로그인 | 사용자가 별도 회원가입 없이 접근 가능하도록 구현 |
| 사용자 | User 저장 | 카카오 계정 기반 사용자 생성 및 조회 |
| 메시지 작성 | 예약 메시지 생성 | 제목, 본문, 감정 태그, 수신자 정보, 예약일 저장 |
| 감성 옵션 | 발신인 숨기기 | 수신자가 발신자를 바로 알 수 없게 처리 |
| 감성 옵션 | 도착일 숨기기 | 공개 열람 화면에서 정확한 예약일 노출 제어 |
| AI 필터링 | OpenAI Moderation | 저장 전 유해성 검사 |
| AI 재시도 | 검사 실패 복구 | API 장애 시 즉시 1회 재시도, 이후 하루 1회 자동 재검사 |
| 상태 관리 | PENDING, SENT, FAILED, BLOCKED, MODERATION_FAILED | 예약, 발송 완료, 실패, 유해성 차단, 검사 실패 상태 관리 |
| 비회원 열람 | 고유 링크 | 수신자가 가입 없이 메시지를 열람할 수 있는 링크 제공 |
| 가입 유도 | CTA | 비회원 열람 후 회원가입 유도 |
| 가입 귀속 | 링크 메시지 보관 | 비회원 열람 후 가입하면 해당 메시지를 수신함에 자동 연결 |
| 스케줄러 | 예약 메시지 처리 | 5분마다 예약 시간이 지난 메시지 조회 |
| 인프라 | Nginx reverse proxy | HTTPS 요청을 내부 Node.js 서버로 전달 |

## 3.2 MVP에서 제외하거나 후순위로 둘 기능

| 기능 | 후순위 이유 |
| --- | --- |
| 카카오 알림톡 실제 발송 | 비즈니스 채널, 템플릿 승인, 발송 계약 필요 |
| SMS 발송 | 비용과 외부 벤더 연동 필요 |
| 이미지 첨부 | 파일 스토리지, 이미지 moderation, 용량 정책 필요 |
| 그룹 전송 | Message와 Recipient 모델 분리 필요 |
| 익명 답장 | 악용 방지 정책과 신고 기능 필요 |
| 감정 리포트 | 충분한 데이터 축적 이후 가치가 커짐 |
| 기간 랜덤 발송 고도화 | 기본 예약 발송 안정화 후 확장 가능 |
| 관리자 검수 화면 | 초기 100명 이하에서는 로그 기반 대응 가능 |

---

## 4. 기술 스택

## 4.1 기본 요구 스택

| 영역 | 기술 |
| --- | --- |
| Frontend | Next.js, TypeScript, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| AI Integration | OpenAI Moderation API |
| Scheduler | node-cron |
| Server | AWS Lightsail Ubuntu 22.04 LTS |
| Reverse Proxy | Nginx |
| Process Manager | PM2 |

## 4.2 스택 선택 이유

### Next.js

- 빠른 화면 개발 가능
- SSR/CSR 선택 가능
- 추후 SEO가 필요한 공개 메시지 진입 페이지에 대응 가능
- TypeScript 기반으로 안정적인 개발 가능

### Express

- API 서버 구조가 단순하고 명확함
- OAuth, 미들웨어, scheduler 분리에 유리함
- MVP 규모에서 과한 프레임워크를 피할 수 있음

### PostgreSQL

- 관계형 데이터 관리에 적합
- 예약 메시지, 사용자, 열람 토큰, 상태 관리에 안정적
- Prisma와 궁합이 좋음

### Prisma

- 타입 안정성 제공
- 마이그레이션 관리가 편함
- MVP 이후 모델 확장에 유리함

### OpenAI Moderation API

- 유해성 검사 구현 속도가 빠름
- 직접 금칙어 사전을 만드는 것보다 유연함
- 메시지 저장 전 필터링 흐름에 붙이기 쉬움

### node-cron

- 단일 서버 MVP에 적합
- 별도 queue 인프라 없이 예약 작업 구현 가능
- 추후 BullMQ, SQS 등으로 대체 가능

---

## 5. 전체 아키텍처

## 5.1 Monolithic 배포 구조

MVP는 AWS Lightsail 단일 서버에서 운영합니다.

```txt
User Browser
  |
  | HTTPS
  v
Nginx :80/:443
  |
  | /api/*
  v
Express API :8080
  |
  | Prisma
  v
PostgreSQL

Nginx :80/:443
  |
  | /*
  v
Next.js Web :3000
```

## 5.2 런타임 프로세스

운영 서버에서는 PM2로 다음 프로세스를 관리합니다.

```txt
maeum-web        -> Next.js frontend server
maeum-api        -> Express API server
maeum-scheduler  -> 예약 메시지 처리 scheduler
```

## 5.3 요청 흐름

### 로그인 흐름

```txt
사용자
  -> /login
  -> 카카오 로그인 버튼 클릭
  -> Express /auth/kakao
  -> Kakao OAuth authorize
  -> Express /auth/kakao/callback
  -> User upsert
  -> session or JWT 발급
  -> frontend redirect
```

### 메시지 작성 흐름

```txt
사용자 메시지 작성
  -> Frontend validation
  -> POST /api/messages
  -> Auth middleware
  -> Request validation
  -> OpenAI Moderation 1차 검사
  -> API 실패 시 즉시 2차 검사
  -> 통과 시 PENDING 저장
  -> 공개 열람 token 생성
  -> 검사 API 2회 실패 시 MODERATION_FAILED 저장
  -> 유해성 차단 시 BLOCKED 처리 또는 저장하지 않고 차단 응답
```

### 예약 발송 흐름

```txt
node-cron 실행
  -> 현재 시각 조회
  -> scheduledAt <= now AND status = PENDING 메시지 조회
  -> PENDING 메시지를 SENT로 상태 변경
  -> message.sent event 발행
  -> NotificationProcessor가 후속 알림 처리
  -> 상태 변경 실패 시 FAILED
```

---

## 6. 프로젝트 디렉토리 구조

## 6.1 권장 구조

```txt
maeum-arrival/
├── apps/
│   ├── web/
│   │   ├── app/
│   │   │   ├── login/
│   │   │   ├── onboarding/
│   │   │   ├── write/
│   │   │   ├── inbox/
│   │   │   ├── sent/
│   │   │   ├── arrival/
│   │   │   │   └── [token]/
│   │   │   └── my/
│   │   ├── components/
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── messages/
│   │   │   └── onboarding/
│   │   ├── lib/
│   │   ├── styles/
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   └── package.json
│   │
│   └── api/
│       ├── src/
│       │   ├── app.ts
│       │   ├── server.ts
│       │   ├── scheduler.ts
│       │   ├── config/
│       │   ├── middlewares/
│       │   │   ├── auth.middleware.ts
│       │   │   ├── error.middleware.ts
│       │   │   └── validate.middleware.ts
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   │   ├── auth.controller.ts
│       │   │   │   ├── auth.routes.ts
│       │   │   │   └── kakao.service.ts
│       │   │   ├── messages/
│       │   │   │   ├── message.controller.ts
│       │   │   │   ├── message.routes.ts
│       │   │   │   ├── message.service.ts
│       │   │   │   └── message.validation.ts
│       │   │   ├── moderation/
│       │   │   │   └── moderation.service.ts
│       │   │   └── public/
│       │   │       ├── public-message.controller.ts
│       │   │       └── public-message.routes.ts
│       │   ├── jobs/
│       │   │   └── send-pending-messages.job.ts
│       │   ├── lib/
│       │   │   ├── prisma.ts
│       │   │   └── logger.ts
│       │   └── types/
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   ├── database/
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── src/
│   │   │   └── client.ts
│   │   └── package.json
│   │
│   ├── shared/
│   │   ├── src/
│   │   │   ├── enums.ts
│   │   │   ├── types.ts
│   │   │   └── validation.ts
│   │   └── package.json
│   │
│   └── config/
│       ├── eslint/
│       └── tsconfig/
│
├── infra/
│   └── nginx/
│       └── maeum-arrival.conf.template
│
├── scripts/
│   ├── deploy.sh
│   └── migrate.sh
│
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
├── .env.example
└── README.md
```

## 6.2 구조 선택 이유

- `apps/web`: 사용자 화면 전용
- `apps/api`: Express API와 scheduler 엔트리포인트
- `packages/database`: Prisma schema와 client를 중앙 관리
- `packages/shared`: frontend/backend 공통 타입 관리
- `infra/nginx`: 배포 설정 파일을 코드로 관리
- `scripts`: 서버 배포와 DB 마이그레이션 자동화 준비

---

## 7. 데이터베이스 설계

최종 운영 기준 DB 스키마는 별도 산출물로 분리했습니다.

- 설계 문서: `MAEUM_ARRIVAL_DB_SCHEMA.md`
- 실제 Prisma schema: `packages/database/prisma/schema.prisma`

최종안은 기존 단일 `Message.receiverId` 중심 초안보다 확장성을 높이기 위해 `Message`와 `MessageRecipient`를 분리합니다. MVP에서는 메시지 하나에 수신자 하나만 생성하고, 추후 그룹 전송에서는 같은 `Message`에 여러 `MessageRecipient`를 연결합니다.

## 7.1 핵심 엔티티

### User

카카오 로그인으로 생성되는 사용자입니다.

주요 책임:

- 카카오 계정 식별
- 닉네임과 이메일 저장
- 발신 메시지와 연결
- 향후 수신함과 연결

### Message

사용자가 작성한 예약 메시지입니다.

주요 책임:

- 제목과 본문 저장
- 발신자 연결
- 수신자 정보 저장
- 예약 시간 저장
- 숨김 옵션 저장
- 상태 관리

### MessageAccessToken

비회원 또는 외부 수신자가 메시지를 열람할 수 있는 고유 링크 토큰입니다.

MVP 요구사항에는 직접 언급되어 있지 않지만, 비회원 열람 링크를 안전하게 운영하려면 별도 모델로 분리하는 것이 좋습니다.

주요 책임:

- public token 저장
- 메시지와 연결
- 만료 시간 관리
- 조회 횟수 관리

## 7.2 기본 Prisma schema 초안

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum MessageStatus {
  PENDING
  SENT
  FAILED
  BLOCKED
  MODERATION_FAILED
  CANCELED
}

model User {
  id        String    @id @default(uuid())
  kakaoId   String    @unique
  nickname  String
  email     String?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  sentMessages        Message[]            @relation("MessageSender")
  receivedMessages    Message[]            @relation("MessageReceiver")
  claimedAccessTokens MessageAccessToken[] @relation("AccessTokenClaimedBy")

  @@index([kakaoId])
}

model Message {
  id             String        @id @default(uuid())
  senderId       String
  receiverId     String?
  receiverInfo   Json
  title          String
  content        String
  emotionTag     String?
  scheduledAt    DateTime
  sentAt         DateTime?
  isSenderHidden Boolean       @default(false)
  isDateHidden   Boolean       @default(false)
  status         MessageStatus @default(PENDING)
  moderationAttemptCount Int    @default(0)
  moderationLastCheckedAt DateTime?
  moderationNextRetryAt  DateTime?
  moderationFailureReason String?
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  sender       User                 @relation("MessageSender", fields: [senderId], references: [id], onDelete: Cascade)
  receiver     User?                @relation("MessageReceiver", fields: [receiverId], references: [id], onDelete: SetNull)
  accessTokens MessageAccessToken[]

  @@index([senderId])
  @@index([receiverId])
  @@index([status, scheduledAt])
  @@index([status, moderationNextRetryAt])
}

model MessageAccessToken {
  id           String    @id @default(uuid())
  messageId    String
  token        String    @unique
  expiresAt    DateTime?
  openedAt     DateTime?
  openCount    Int       @default(0)
  linkedUserId String?
  linkedAt     DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  message    Message @relation(fields: [messageId], references: [id], onDelete: Cascade)
  linkedUser User?   @relation("AccessTokenClaimedBy", fields: [linkedUserId], references: [id], onDelete: SetNull)

  @@index([messageId])
  @@index([token])
  @@index([linkedUserId])
}
```

### Moderation 관련 필드 의미

`BLOCKED`와 `MODERATION_FAILED`는 서로 다른 상태입니다.

```txt
BLOCKED
  -> OpenAI Moderation API가 정상 응답했고 flagged=true로 판단한 상태
  -> 사용자에게 표현 수정 안내
  -> 발송하지 않음

MODERATION_FAILED
  -> OpenAI API 장애, timeout, 네트워크 오류 등으로 검사 자체가 완료되지 못한 상태
  -> 즉시 2회 시도 후에도 실패했을 때 저장
  -> 공개 링크를 발급하지 않음
  -> 하루 한 번 자동 재검사
  -> 재검사 통과 시 PENDING으로 복귀
```

검사 실패 상태의 메시지는 미검증 콘텐츠이므로 수신자에게 공개하지 않습니다. 따라서 `MessageAccessToken`은 moderation 통과 후 `PENDING`으로 전환될 때 생성하는 것을 원칙으로 합니다.

## 7.3 receiverInfo JSON 예시

MVP에서는 수신자를 완전한 User로 강제하지 않고 JSON으로 저장합니다.

다만 비회원이 공개 링크를 통해 메시지를 열람한 뒤 가입하는 경우를 위해 `Message.receiverId`를 nullable로 둡니다. 처음에는 `receiverInfo`에 수신자 정보를 저장하고, 가입 후 `/api/auth/link-message`가 성공하면 `receiverId`에 로그인한 `User.id`를 연결합니다.

```json
{
  "type": "SELF",
  "name": "미래의 나",
  "email": "<self-email>",
  "phone": null
}
```

타인에게 보내는 경우:

```json
{
  "type": "OTHER",
  "name": "<receiver-name>",
  "email": "<receiver-email>",
  "phone": "<receiver-phone>"
}
```

가입 후 메시지가 수신함에 귀속되면 DB는 다음처럼 해석됩니다.

```txt
Message.receiverInfo  -> 최초 작성자가 입력한 수신자 정보 snapshot
Message.receiverId    -> 실제 가입한 User.id
MessageAccessToken    -> 어떤 token이 어떤 User에게 귀속되었는지 기록
```

## 7.4 추후 확장 시 분리할 모델

그룹 전송과 가입자 수신함을 제대로 구현하려면 다음 모델을 추가할 수 있습니다.

- Recipient
- MessageRecipient
- Reply
- Attachment
- NotificationLog
- ModerationLog
- EmotionReport

---

## 8. 인증 설계

## 8.1 카카오 OAuth 흐름

```txt
1. 사용자가 프론트엔드에서 카카오 로그인 버튼 클릭
2. 브라우저가 /api/auth/kakao 로 이동
3. API 서버가 Kakao OAuth authorize URL로 redirect
4. 사용자가 카카오 인증 완료
5. Kakao가 /api/auth/kakao/callback?code=... 로 redirect
6. API 서버가 code로 access token 요청
7. access token으로 사용자 정보 조회
8. kakaoId 기준 User upsert
9. 자체 session cookie 또는 JWT 발급
10. 프론트엔드 메인 화면으로 redirect
11. 프론트엔드 인증 완료 페이지에서 sessionStorage의 pending arrival token 확인
12. token이 있으면 POST /api/auth/link-message 호출
13. 성공 시 해당 메시지를 로그인한 사용자의 수신함에 자동 귀속
```

주의할 점은 `sessionStorage`는 브라우저에서만 접근 가능하다는 것입니다.

따라서 Express의 `/api/auth/kakao/callback`은 로그인 처리 후 프론트엔드의 `/auth/callback` 또는 `/auth/complete`로 redirect하고, 해당 프론트엔드 페이지가 `sessionStorage`를 읽어 `/api/auth/link-message`를 호출합니다.

## 8.2 인증 방식

MVP에서는 두 가지 선택지가 있습니다.

### 선택지 A: HttpOnly Secure Cookie 기반 session

장점:

- 브라우저 환경에서 보안성이 좋음
- token을 localStorage에 저장하지 않음
- SSR과 궁합이 좋음

단점:

- session store 설계 필요

### 선택지 B: JWT Access Token

장점:

- 구현이 단순함
- API 테스트가 쉬움

단점:

- localStorage 저장 시 XSS 위험
- refresh token 정책이 필요함

### MVP 권장안

초기에는 **HttpOnly Secure Cookie + signed JWT** 방식을 권장합니다.

서버는 JWT를 쿠키에 담아 내려주고, 프론트엔드는 직접 토큰을 다루지 않습니다.

---

## 9. API 설계

## 9.1 Auth API

| Method | Endpoint | 인증 | 설명 |
| --- | --- | --- | --- |
| GET | `/api/auth/kakao` | 불필요 | 카카오 OAuth 로그인 시작 |
| GET | `/api/auth/kakao/callback` | 불필요 | 카카오 OAuth callback 처리 |
| POST | `/api/auth/link-message` | 필요 | 공개 링크로 열람한 메시지를 로그인 사용자 수신함에 귀속 |
| POST | `/api/auth/logout` | 필요 | 로그아웃 |
| GET | `/api/me` | 필요 | 현재 로그인 사용자 조회 |

## 9.2 Message API

| Method | Endpoint | 인증 | 설명 |
| --- | --- | --- | --- |
| POST | `/api/messages` | 필요 | 메시지 작성 및 예약 |
| GET | `/api/messages/sent` | 필요 | 내가 보낸 메시지 목록 |
| GET | `/api/messages/received` | 필요 | 내가 받은 메시지 목록 |
| GET | `/api/messages/:id` | 필요 | 메시지 상세 조회 |
| PATCH | `/api/messages/:id/cancel` | 필요 | 예약 메시지 취소 |

## 9.3 Public API

| Method | Endpoint | 인증 | 설명 |
| --- | --- | --- | --- |
| GET | `/api/public/messages/:token` | 불필요 | 비회원 링크로 메시지 조회 |

## 9.4 Auth Link Message API

비회원이 `/arrival/[token]`으로 메시지를 열람한 뒤 카카오 로그인을 완료하면, 프론트엔드가 이 API를 호출해 메시지를 로그인한 사용자의 수신함에 귀속합니다.

### Request

```json
{
  "token": "public-access-token"
}
```

### 처리 규칙

- 인증된 사용자만 호출할 수 있습니다.
- `MessageAccessToken.token`이 존재해야 합니다.
- token이 만료되지 않아야 합니다.
- 이미 다른 사용자에게 귀속된 token이면 `409 Conflict`를 반환합니다.
- 정상 처리 시 `Message.receiverId`를 로그인한 `User.id`로 업데이트합니다.
- `MessageAccessToken.linkedUserId`, `linkedAt`을 기록합니다.
- 같은 사용자가 같은 token으로 재호출하면 idempotent하게 성공 응답을 반환합니다.

### Response

```json
{
  "messageId": "uuid",
  "linked": true,
  "redirectTo": "/inbox"
}
```

### Error Response 예시

```json
{
  "error": {
    "code": "MESSAGE_TOKEN_ALREADY_LINKED",
    "message": "이미 다른 계정에 보관된 마음이에요."
  }
}
```

### link-message service 초안

```ts
type LinkMessageInput = {
  token: string;
  userId: string;
};

export async function linkMessageToUser({ token, userId }: LinkMessageInput) {
  const accessToken = await prisma.messageAccessToken.findUnique({
    where: { token },
    include: { message: true },
  });

  if (!accessToken) {
    throw new AppError("MESSAGE_TOKEN_NOT_FOUND", "도착한 마음을 찾을 수 없어요.", 404);
  }

  if (accessToken.expiresAt && accessToken.expiresAt < new Date()) {
    throw new AppError("MESSAGE_TOKEN_EXPIRED", "이 마음을 보관할 수 있는 시간이 지났어요.", 410);
  }

  if (accessToken.linkedUserId && accessToken.linkedUserId !== userId) {
    throw new AppError("MESSAGE_TOKEN_ALREADY_LINKED", "이미 다른 계정에 보관된 마음이에요.", 409);
  }

  if (accessToken.linkedUserId === userId && accessToken.message.receiverId === userId) {
    return {
      messageId: accessToken.messageId,
      linked: true,
      redirectTo: "/inbox",
    };
  }

  const linked = await prisma.$transaction(async (tx) => {
    await tx.message.update({
      where: { id: accessToken.messageId },
      data: { receiverId: userId },
    });

    await tx.messageAccessToken.update({
      where: { token },
      data: {
        linkedUserId: userId,
        linkedAt: new Date(),
      },
    });

    return {
      messageId: accessToken.messageId,
      linked: true,
      redirectTo: "/inbox",
    };
  });

  return linked;
}
```

## 9.5 메시지 작성 Request 예시

```json
{
  "receiverInfo": {
    "type": "OTHER",
    "name": "<receiver-name>",
    "email": "<receiver-email>",
    "phone": null
  },
  "title": "언젠가 너에게 도착할 말",
  "content": "오늘의 고마움을 미래의 너에게 남겨두고 싶어.",
  "emotionTag": "고마움",
  "scheduledAt": "2026-12-25T09:00:00.000Z",
  "isSenderHidden": false,
  "isDateHidden": true
}
```

## 9.6 메시지 작성 Response 예시

```json
{
  "message": {
    "id": "uuid",
    "title": "언젠가 너에게 도착할 말",
    "status": "PENDING",
    "scheduledAt": "2026-12-25T09:00:00.000Z",
    "isSenderHidden": false,
    "isDateHidden": true
  },
  "publicUrl": "https://${SERVICE_DOMAIN}/arrival/<public-token>"
}
```

위 응답은 AI 검사를 통과한 경우입니다. OpenAI API 장애로 2회 모두 검사에 실패하면 메시지는 `MODERATION_FAILED`로 임시 저장되고 `publicUrl`은 `null`로 반환합니다.

---

## 10. AI 유해성 필터링 설계

## 10.1 목적

마음도착은 따뜻한 메시지 경험을 핵심 가치로 삼습니다.

따라서 메시지가 DB에 저장되기 전 OpenAI Moderation API를 호출하여 유해성을 검사합니다.

## 10.2 검사 대상

아래 필드를 하나의 moderation input으로 묶어 검사합니다.

- title
- content
- emotionTag

수신자 이름이나 연락처는 개인정보가 포함될 수 있으므로 moderation 대상에 넣지 않는 것을 권장합니다.

## 10.3 차단 기준

OpenAI Moderation 결과에서 `flagged = true`인 경우 저장하지 않습니다.

또는 운영 정책상 특정 카테고리만 강하게 차단할 수 있습니다.

예시:

- hate
- hate/threatening
- harassment
- harassment/threatening
- self-harm
- self-harm/intent
- self-harm/instructions
- sexual/minors
- violence
- violence/graphic

## 10.4 차단 UX 피드백 정책

Moderation 결과가 `flagged = true`인 경우 사용자에게 내부 카테고리명을 그대로 노출하지 않습니다.

대신 `categories` 결과를 해석해 모호하지만 충분히 행동 가능한 안내 문구로 변환합니다. 목표는 사용자가 왜 막혔는지 대략 이해하고, 더 안전하고 따뜻한 표현으로 다시 작성할 수 있게 돕는 것입니다.

### getModerationFeedback 함수 초안

```ts
type ModerationCategories = Record<string, boolean>;

export function getModerationFeedback(categories: ModerationCategories): string {
  const hasAny = (...keys: string[]) => keys.some((key) => categories[key]);

  if (hasAny("hate", "hate/threatening", "harassment", "harassment/threatening")) {
    return "상대방에게 상처를 줄 수 있는 표현이 포함되어 있어요. 조금 더 부드러운 말로 바꿔볼까요?";
  }

  if (hasAny("self-harm", "self-harm/intent", "self-harm/instructions", "violence", "violence/graphic")) {
    return "더 따뜻하고 안전한 표현으로 다듬어보는 건 어떨까요?";
  }

  if (hasAny("sexual", "sexual/minors")) {
    return "받는 사람이 편안하게 읽을 수 있도록 표현을 조금 더 조심스럽게 다듬어 주세요.";
  }

  return "이 메시지는 그대로 전달하기 어려운 표현을 포함하고 있어요. 조금 더 따뜻한 말로 다시 적어볼까요?";
}
```

### Moderation service 응답 형태

```ts
type ModerationResult =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      feedback: string;
      blockedCategories: string[];
    }
  | {
      allowed: "unavailable";
      retryAfter: Date;
      reason: string;
    };
```

`blockedCategories`는 서버 로그와 운영 진단용으로만 사용하고, 프론트엔드에는 `feedback`만 노출합니다.

### Moderation service 초안

```ts
import OpenAI from "openai";
import { config } from "../../config";
import { getModerationFeedback } from "./moderation-feedback";

const openai = new OpenAI({
  apiKey: config.openaiApiKey,
});

export async function moderateMessage(input: {
  title: string;
  content: string;
  emotionTag?: string | null;
}): Promise<ModerationResult> {
  const text = [input.title, input.content, input.emotionTag]
    .filter(Boolean)
    .join("\n\n");

  const response = await openai.moderations.create({
    model: config.openaiModerationModel,
    input: text,
  });

  const result = response.results[0];

  if (!result?.flagged) {
    return { allowed: true };
  }

  const categories = result.categories as unknown as Record<string, boolean>;
  const blockedCategories = Object.entries(categories)
    .filter(([, blocked]) => blocked)
    .map(([category]) => category);

  return {
    allowed: false,
    feedback: getModerationFeedback(categories),
    blockedCategories,
  };
}
```

### 즉시 재시도 wrapper 초안

OpenAI API 장애, timeout, 네트워크 오류처럼 검사 자체가 실패한 경우에는 즉시 한 번 더 시도합니다. `flagged=true`는 검사 성공 결과이므로 재시도 대상이 아닙니다.

```ts
const MODERATION_MAX_ATTEMPTS = 2;

export async function moderateMessageWithRetry(input: {
  title: string;
  content: string;
  emotionTag?: string | null;
}): Promise<ModerationResult> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MODERATION_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await moderateMessage(input);
    } catch (error) {
      lastError = error;

      if (attempt < MODERATION_MAX_ATTEMPTS) {
        await sleep(500);
      }
    }
  }

  return {
    allowed: "unavailable",
    retryAfter: addDays(new Date(), 1),
    reason: getModerationFailureReason(lastError),
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getModerationFailureReason(error: unknown) {
  if (error instanceof Error) {
    return error.message.slice(0, 500);
  }

  return "unknown moderation error";
}
```

### 차단 응답 예시

```json
{
  "error": {
    "code": "MESSAGE_BLOCKED_BY_MODERATION",
    "message": "상대방에게 상처를 줄 수 있는 표현이 포함되어 있어요. 조금 더 부드러운 말로 바꿔볼까요?"
  }
}
```

## 10.5 검사 실패 처리 정책

OpenAI API 호출이 실패했을 때 정책을 정해야 합니다.

### 구분 기준

```txt
flagged=true
  -> AI 검사는 성공했지만 유해 가능성이 감지됨
  -> BLOCKED 또는 저장 차단
  -> 사용자가 문구를 수정해야 함

API failure
  -> AI 검사 자체가 완료되지 않음
  -> 즉시 2회까지 자동 시도
  -> 2회 모두 실패하면 MODERATION_FAILED
  -> 하루 1회 자동 재검사
```

### 정책 A: Fail Closed

AI 검사 실패 시 메시지 저장을 막습니다.

장점:

- 안전성 우선

단점:

- OpenAI 장애 시 사용자가 메시지를 작성할 수 없음

### 정책 B: Fail Open

AI 검사 실패 시 메시지를 저장합니다.

장점:

- 사용자 경험 유지

단점:

- 유해 메시지가 통과될 수 있음

### 최종 권장안: Fail Safe Queue

마음도착의 서비스 철학상 유해성 검사를 통과하지 못한 메시지는 수신자에게 전달하지 않습니다.

다만 OpenAI API 장애처럼 검사 자체가 실패한 경우 사용자의 작성 내용을 완전히 잃지 않도록 `MODERATION_FAILED` 상태로 보관합니다.

정책은 다음과 같습니다.

```txt
1. 사용자가 메시지 작성
2. OpenAI Moderation 1차 검사
3. API 실패 시 500ms 후 2차 검사
4. 2차도 API 실패 시 Message.status = MODERATION_FAILED
5. publicUrl은 발급하지 않음
6. 사용자에게 "안전 검사를 잠시 완료하지 못했어요" 상태 표시
7. 하루 한 번 moderation retry job이 재검사
8. 재검사 통과 시 Message.status = PENDING
9. scheduledAt이 이미 지난 경우 다음 발송 scheduler tick에서 SENT 처리
10. 재검사에서 flagged=true면 BLOCKED 처리하고 사용자 수정 안내
```

응답 메시지 예시:

```txt
지금은 메시지 안전 검사를 완료하지 못했어요.
작성한 마음은 임시로 보관했고, 하루에 한 번 자동으로 다시 검사할게요.
```

### 검사 실패 저장 응답 예시

```json
{
  "message": {
    "id": "uuid",
    "title": "언젠가 너에게 도착할 말",
    "status": "MODERATION_FAILED",
    "moderationNextRetryAt": "2026-07-04T09:00:00.000Z"
  },
  "publicUrl": null,
  "notice": "안전 검사를 잠시 완료하지 못했어요. 하루에 한 번 자동으로 다시 검사할게요."
}
```

### 메시지 작성 service 처리 분기

```ts
const moderation = await moderateMessageWithRetry({
  title: input.title,
  content: input.content,
  emotionTag: input.emotionTag,
});

if (moderation.allowed === false) {
  throw new AppError("MESSAGE_BLOCKED_BY_MODERATION", moderation.feedback, 422);
}

if (moderation.allowed === "unavailable") {
  const message = await prisma.message.create({
    data: {
      senderId: userId,
      receiverInfo: input.receiverInfo,
      title: input.title,
      content: input.content,
      emotionTag: input.emotionTag,
      scheduledAt: input.scheduledAt,
      isSenderHidden: input.isSenderHidden,
      isDateHidden: input.isDateHidden,
      status: "MODERATION_FAILED",
      moderationAttemptCount: 2,
      moderationLastCheckedAt: new Date(),
      moderationNextRetryAt: moderation.retryAfter,
      moderationFailureReason: moderation.reason,
    },
  });

  return {
    message,
    publicUrl: null,
    notice: "안전 검사를 잠시 완료하지 못했어요. 하루에 한 번 자동으로 다시 검사할게요.",
  };
}

const message = await prisma.message.create({
  data: {
    senderId: userId,
    receiverInfo: input.receiverInfo,
    title: input.title,
    content: input.content,
    emotionTag: input.emotionTag,
    scheduledAt: input.scheduledAt,
    isSenderHidden: input.isSenderHidden,
    isDateHidden: input.isDateHidden,
    status: "PENDING",
    moderationAttemptCount: 1,
    moderationLastCheckedAt: new Date(),
    accessTokens: {
      create: {
        token: createPublicToken(),
      },
    },
  },
});
```

---

## 11. 스케줄러 설계

## 11.1 기본 조건

발송 스케줄러는 5분마다 실행합니다.

```txt
*/5 * * * *
```

AI 검사 실패 재검사 스케줄러는 하루 한 번 실행합니다.

```txt
0 3 * * *
```

## 11.2 조회 조건

발송 스케줄러 조회 조건:

```txt
status = PENDING
scheduledAt <= now
```

AI 검사 실패 재검사 조회 조건:

```txt
status = MODERATION_FAILED
moderationNextRetryAt <= now
```

## 11.3 처리 흐름

```txt
1. scheduler tick 시작
2. in-memory lock 확인
3. PENDING 메시지 조회
4. 각 메시지를 처리
5. scheduler는 메시지 상태를 SENT로 변경
6. 상태 변경 직후 message.sent event 발행
7. NotificationProcessor가 event를 받아 알림 처리
8. 처리 중 오류 발생 시 FAILED 또는 notification 실패 로그 기록
9. lock 해제
```

스케줄러의 책임은 `PENDING`에서 `SENT`로 상태를 변경하는 데 한정합니다. 실제 카카오 알림톡, SMS, 이메일, 내부 알림 저장은 `NotificationProcessor`가 담당합니다.

## 11.4 중복 실행 방지

단일 서버에서는 in-memory lock으로 충분합니다.

```txt
isRunning = true 인 동안 다음 cron tick은 skip
```

추후 서버가 2대 이상이 되면 다음 방식으로 전환합니다.

- PostgreSQL advisory lock
- Redis lock
- BullMQ
- AWS SQS

## 11.5 EventEmitter 기반 알림 분리 구조

MVP에서는 실제 카카오 알림톡/SMS 발송을 구현하지 않습니다. 대신 `NotificationProcessor`는 `message.sent` 이벤트를 받아 서비스 내부 알림 이력과 공개 링크 발송 준비 상태를 기록합니다. 외부 알림 provider 정보가 `.env`에 제공되기 전까지는 fake 발송 성공을 만들지 않습니다.

```ts
import { EventEmitter } from "node:events";

export const domainEvents = new EventEmitter();

export const MESSAGE_SENT_EVENT = "message.sent";

export type MessageSentEventPayload = {
  messageId: string;
  receiverId: string | null;
  publicToken: string | null;
  sentAt: Date;
};
```

### Scheduler 책임

```ts
const updated = await prisma.$transaction(async (tx) => {
  return tx.message.update({
    where: { id: message.id },
    data: {
      status: "SENT",
      sentAt: new Date(),
    },
    select: {
      id: true,
      receiverId: true,
      sentAt: true,
      accessTokens: {
        select: { token: true },
        take: 1,
      },
    },
  });
});

domainEvents.emit(MESSAGE_SENT_EVENT, {
  messageId: updated.id,
  receiverId: updated.receiverId,
  publicToken: updated.accessTokens[0]?.token ?? null,
  sentAt: updated.sentAt ?? new Date(),
});
```

### NotificationProcessor 책임

```ts
domainEvents.on(MESSAGE_SENT_EVENT, async (payload) => {
  await notificationProcessor.handleMessageSent(payload);
});
```

`NotificationProcessor`는 다음 작업을 담당합니다.

- 가입 수신자에게 서비스 내 알림 생성
- 비회원 수신자에게 공개 링크 발송 준비
- 추후 카카오 알림톡 또는 SMS 발송
- NotificationLog 저장
- 알림 실패 시 메시지 상태를 되돌리지 않고 알림 실패 로그만 남김

## 11.6 AI 검사 실패 재검사 Job

`MODERATION_FAILED` 상태의 메시지는 OpenAI API 장애 또는 timeout으로 검사 자체가 완료되지 못한 메시지입니다. 이 메시지는 아직 안전 검사를 통과하지 않았으므로 공개 링크를 발급하지 않고 발송하지 않습니다.

하루 한 번 재검사 job이 실행되며, 결과에 따라 다음처럼 처리합니다.

```txt
MODERATION_FAILED
├── 재검사 통과
│   ├── Message.status = PENDING
│   ├── MessageAccessToken 생성
│   ├── moderationFailureReason 초기화
│   └── scheduledAt이 이미 지났다면 다음 5분 scheduler에서 SENT 처리
│
├── 재검사에서 flagged=true
│   ├── Message.status = BLOCKED
│   ├── moderationFailureReason에 feedback 저장
│   └── 발송하지 않음
│
└── 재검사 API 실패
    ├── Message.status = MODERATION_FAILED 유지
    ├── moderationAttemptCount 증가
    ├── moderationLastCheckedAt 갱신
    └── moderationNextRetryAt = now + 1 day
```

### 재검사 job 초안

```ts
export async function retryFailedModerationMessages() {
  const messages = await prisma.message.findMany({
    where: {
      status: "MODERATION_FAILED",
      moderationNextRetryAt: {
        lte: new Date(),
      },
    },
    take: 50,
    orderBy: {
      moderationNextRetryAt: "asc",
    },
  });

  for (const message of messages) {
    const moderation = await moderateMessageWithRetry({
      title: message.title,
      content: message.content,
      emotionTag: message.emotionTag,
    });

    if (moderation.allowed === true) {
      await prisma.message.update({
        where: { id: message.id },
        data: {
          status: "PENDING",
          moderationLastCheckedAt: new Date(),
          moderationNextRetryAt: null,
          moderationFailureReason: null,
          accessTokens: {
            create: {
              token: createPublicToken(),
            },
          },
        },
      });

      continue;
    }

    if (moderation.allowed === false) {
      await prisma.message.update({
        where: { id: message.id },
        data: {
          status: "BLOCKED",
          moderationLastCheckedAt: new Date(),
          moderationNextRetryAt: null,
          moderationFailureReason: moderation.feedback,
        },
      });

      continue;
    }

    await prisma.message.update({
      where: { id: message.id },
      data: {
        moderationAttemptCount: {
          increment: 2,
        },
        moderationLastCheckedAt: new Date(),
        moderationNextRetryAt: moderation.retryAfter,
        moderationFailureReason: moderation.reason,
      },
    });
  }
}
```

---

## 12. 프론트엔드 화면 설계

## 12.1 주요 화면

| 화면 | 경로 | 설명 |
| --- | --- | --- |
| 로그인 | `/login` | 카카오 로그인 진입 |
| 온보딩 | `/onboarding` | 감성 질문 및 첫 작성 유도 |
| 메시지 작성 | `/write` | 편지 작성, 예약일, 옵션 설정 |
| 발신함 | `/sent` | 내가 보낸 메시지 관리 |
| 수신함 | `/inbox` | 내가 받은 메시지 목록 |
| 공개 열람 | `/arrival/[token]` | 비회원 메시지 확인 |
| 마이페이지 | `/my` | 내 정보와 로그아웃 |

## 12.2 메시지 작성 화면 구성

필수 입력:

- 수신 대상
- 수신자 이름
- 제목
- 본문
- 감정 태그
- 예약 날짜/시간

옵션:

- 발신인 숨기기
- 도착일 숨기기

상태:

- 작성 중
- AI 검사 중
- AI 검사 재시도 중
- AI 검사 실패
- 자동 재검사 대기
- 예약 완료
- 유해성 차단
- 서버 오류

AI 검사 실패 상태에서는 `publicUrl`을 보여주지 않습니다. 대신 “작성한 마음은 임시로 보관했고, 하루에 한 번 자동으로 다시 검사할게요.” 안내와 함께 발신함으로 이동할 수 있게 합니다.

## 12.3 공개 열람 화면 구성

수신자가 링크로 들어오면 다음 흐름을 제공합니다.

```txt
1. 오늘, 누군가의 마음이 도착했어요.
2. 지금 열어볼까요?
3. 메시지 열람
4. 발신인 숨김 여부 반영
5. 도착일 숨김 여부 반영
6. 회원가입 CTA 표시
```

CTA 문구 예시:

```txt
이 마음을 오래 보관하고 싶다면 마음도착에 저장해 보세요.
```

## 12.4 비회원 열람 후 가입 연결 플로우

비회원이 공개 열람 링크 `/arrival/[token]`으로 들어온 뒤 카카오 로그인을 하면, 열람 중이던 메시지가 자동으로 새 계정의 수신함에 들어와야 합니다.

### 프론트엔드 처리 흐름

```txt
1. /arrival/[token] 접속
2. token을 sessionStorage에 저장
3. 사용자가 "마음 보관하기" 또는 "카카오로 시작하기" 클릭
4. /api/auth/kakao 로 이동
5. 카카오 로그인 완료
6. /api/auth/kakao/callback 처리 후 frontend /auth/callback 으로 redirect
7. /auth/callback 페이지에서 sessionStorage token 확인
8. token이 있으면 POST /api/auth/link-message 호출
9. 성공하면 sessionStorage token 삭제
10. /inbox 로 이동
```

### `/arrival/[token]` token 저장 예시

```ts
"use client";

import { useEffect } from "react";

type ArrivalTokenCaptureProps = {
  token: string;
};

export function ArrivalTokenCapture({ token }: ArrivalTokenCaptureProps) {
  useEffect(() => {
    if (token) {
      sessionStorage.setItem("maeum.pendingArrivalToken", token);
    }
  }, [token]);

  return null;
}
```

### `/auth/callback` 연결 예시

```ts
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const PENDING_TOKEN_KEY = "maeum.pendingArrivalToken";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    async function linkPendingMessage() {
      const token = sessionStorage.getItem(PENDING_TOKEN_KEY);

      if (!token) {
        router.replace("/write");
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/link-message`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      if (response.ok) {
        sessionStorage.removeItem(PENDING_TOKEN_KEY);
        router.replace("/inbox");
        return;
      }

      router.replace("/arrival/link-failed");
    }

    void linkPendingMessage();
  }, [router]);

  return null;
}
```

### 백엔드 매핑 규칙

`/api/auth/link-message`는 token으로 `MessageAccessToken`을 찾은 뒤 연결된 `Message`의 `receiverId`를 현재 로그인한 사용자로 업데이트합니다.

```txt
MessageAccessToken.token
  -> MessageAccessToken.messageId
  -> Message.receiverId = currentUser.id
  -> MessageAccessToken.linkedUserId = currentUser.id
  -> MessageAccessToken.linkedAt = now
```

이렇게 하면 비회원 링크로 받은 메시지도 가입 직후 수신함에서 자연스럽게 다시 볼 수 있습니다.

---

## 13. 인프라 설계

## 13.1 서버 환경

| 항목 | 값 |
| --- | --- |
| Provider | AWS Lightsail |
| OS | Ubuntu 22.04 LTS |
| RAM | 2GB |
| Web Port | `${WEB_PORT}` |
| API Port | `${API_PORT}` |
| DB | PostgreSQL local or managed |
| Proxy | Nginx |

## 13.2 Nginx 라우팅 정책

```txt
https://${SERVICE_DOMAIN}/*
  -> localhost:${WEB_PORT}

https://${SERVICE_DOMAIN}/api/*
  -> localhost:${API_PORT}/api/*
```

Nginx는 OpenAI API 호출, 카카오 OAuth callback, 느린 모바일 네트워크 상황을 고려해 `proxy_read_timeout`을 60초 이상으로 설정합니다.

Nginx 설정 파일에는 실제 도메인을 직접 쓰지 않습니다. `infra/nginx/maeum-arrival.conf.template` 형태로 관리하고, 배포 시 `.env.production`의 값을 사용해 `envsubst` 또는 배포 스크립트에서 치환합니다.

### Nginx site config template 초안

```nginx
server {
    listen 80;
    server_name ${SERVICE_DOMAIN} ${WWW_SERVICE_DOMAIN};

    client_max_body_size 2m;

    location /api/ {
        proxy_pass http://127.0.0.1:${API_PORT}/api/;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 15s;
        proxy_send_timeout 75s;
        proxy_read_timeout 75s;
    }

    location / {
        proxy_pass http://127.0.0.1:${WEB_PORT};
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_connect_timeout 15s;
        proxy_send_timeout 75s;
        proxy_read_timeout 75s;
    }
}
```

## 13.3 HTTPS

Certbot을 사용합니다.

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d "$SERVICE_DOMAIN" -d "$WWW_SERVICE_DOMAIN"
```

## 13.4 PM2 프로세스

```bash
pm2 start apps/api/dist/server.js --name maeum-api
pm2 start apps/api/dist/scheduler.js --name maeum-scheduler
pm2 start apps/web/.next/standalone/server.js --name maeum-web
pm2 save
pm2 startup
```

---

## 14. 환경 변수 설계

## 14.1 공통 환경 변수

`.env.example`에는 아래 key만 두고 값은 비워둡니다. 실제 값은 `.env.local` 또는 `.env.production`에 사용자가 직접 제공합니다.

```env
NODE_ENV=
DATABASE_URL=
SERVICE_DOMAIN=
WWW_SERVICE_DOMAIN=

POSTGRES_DB=
POSTGRES_USER=
POSTGRES_PASSWORD=
```

## 14.2 API 환경 변수

```env
API_PORT=
WEB_PORT=
WEB_ORIGIN=
SERVICE_URL=
JWT_SECRET=
COOKIE_DOMAIN=
COOKIE_SECURE=

KAKAO_CLIENT_ID=
KAKAO_CLIENT_SECRET=
KAKAO_REDIRECT_URI=

OPENAI_API_KEY=
OPENAI_MODERATION_MODEL=

PUBLIC_TOKEN_PEPPER=
DELIVERY_CRON=
MODERATION_RETRY_CRON=
MODERATION_MAX_ATTEMPTS=
```

## 14.3 Web 환경 변수

```env
NEXT_PUBLIC_API_BASE_URL=
NEXT_PUBLIC_SERVICE_URL=
```

## 14.4 .env 파일 관리 가이드

환경 변수 파일은 로컬과 배포를 분리합니다.

```txt
.env.example       -> 커밋 가능, key 목록만 포함하고 값은 비움
.env.local         -> 로컬 개발용, 커밋 금지
.env.production    -> 서버 배포용, 커밋 금지
```

`.gitignore`에는 다음 값을 포함합니다.

```gitignore
.env
.env.local
.env.production
apps/*/.env
apps/*/.env.local
packages/*/.env
```

`.env.local` 또는 `.env.production` 값이 제공되기 전에는 실제 서버 실행이 성공한 것처럼 보이면 안 됩니다. 구현 코드는 빌드 가능해야 하지만, 런타임 시작 시 필수 환경 변수가 없으면 `requireEnv` 단계에서 명확히 실패해야 합니다.

금지 사항:

- 코드에 임시 API key를 넣기
- 코드에 임시 도메인을 넣기
- fake Kakao 사용자 만들기
- fake OpenAI moderation 결과 만들기
- dummy 메시지/사용자 seed 만들기
- 외부 provider 호출이 성공한 것처럼 DB에 기록하기

### API 환경 로딩 코드 예시

```ts
import path from "node:path";
import dotenv from "dotenv";

const envFile =
  process.env.NODE_ENV === "production"
    ? ".env.production"
    : ".env.local";

dotenv.config({
  path: path.resolve(process.cwd(), envFile),
});

export const config = {
  nodeEnv: requireEnv("NODE_ENV"),
  apiPort: requireNumberEnv("API_PORT"),
  webPort: requireNumberEnv("WEB_PORT"),
  serviceDomain: requireEnv("SERVICE_DOMAIN"),
  wwwServiceDomain: requireEnv("WWW_SERVICE_DOMAIN"),
  webOrigin: requireEnv("WEB_ORIGIN"),
  serviceUrl: requireEnv("SERVICE_URL"),
  databaseUrl: requireEnv("DATABASE_URL"),
  jwtSecret: requireEnv("JWT_SECRET"),
  cookieDomain: requireEnv("COOKIE_DOMAIN"),
  cookieSecure: requireBooleanEnv("COOKIE_SECURE"),
  kakaoClientId: requireEnv("KAKAO_CLIENT_ID"),
  kakaoClientSecret: requireEnv("KAKAO_CLIENT_SECRET"),
  kakaoRedirectUri: requireEnv("KAKAO_REDIRECT_URI"),
  openaiApiKey: requireEnv("OPENAI_API_KEY"),
  openaiModerationModel: requireEnv("OPENAI_MODERATION_MODEL"),
  publicTokenPepper: requireEnv("PUBLIC_TOKEN_PEPPER"),
  deliveryCron: requireEnv("DELIVERY_CRON"),
  moderationRetryCron: requireEnv("MODERATION_RETRY_CRON"),
  moderationMaxAttempts: requireNumberEnv("MODERATION_MAX_ATTEMPTS"),
};

function requireEnv(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function requireNumberEnv(key: string): number {
  const value = Number(requireEnv(key));

  if (!Number.isFinite(value)) {
    throw new Error(`Environment variable must be a number: ${key}`);
  }

  return value;
}

function requireBooleanEnv(key: string): boolean {
  const value = requireEnv(key);

  if (value !== "true" && value !== "false") {
    throw new Error(`Environment variable must be "true" or "false": ${key}`);
  }

  return value === "true";
}
```

### 운영 서버 권장 방식

운영 서버에서는 `.env.production` 파일 권한을 제한합니다.

```bash
chmod 600 .env.production
```

PM2 실행 시에는 `NODE_ENV=production`을 명시합니다.

```bash
NODE_ENV=production pm2 start apps/api/dist/server.js --name maeum-api
NODE_ENV=production pm2 start apps/api/dist/scheduler.js --name maeum-scheduler
NODE_ENV=production pm2 start apps/web/.next/standalone/server.js --name maeum-web
```

---

## 15. 보안 계획

## 15.1 인증 보안

- HttpOnly cookie 사용
- Secure cookie는 production에서 활성화
- SameSite=Lax 또는 Strict 적용
- JWT secret은 충분히 긴 랜덤 값 사용
- JWT secret, Kakao secret, OpenAI key, token pepper는 코드에 하드코딩하지 않고 `.env`에서만 로드

## 15.2 API 보안

- request body size 제한
- CORS origin 제한
- helmet 적용
- rate limit 적용
- Prisma 사용으로 SQL injection 방지

## 15.3 공개 링크 보안

- message id를 URL에 직접 노출하지 않음
- random token 사용
- raw public token은 DB에 저장하지 않고 hash 값만 저장
- token hash pepper는 `PUBLIC_TOKEN_PEPPER` 환경 변수로만 주입
- token 만료 정책 추가 가능
- openCount 저장
- 열람 로그 확장 가능

## 15.4 개인정보

- MVP에서는 최소 정보만 저장
- phone/email은 필요할 때만 수집
- 관리자 화면에서 본문 노출 제한
- 로그에 메시지 본문을 남기지 않음

---

## 16. 개발 단계별 계획

## Step 1. 프로젝트 구조 및 DB 설계

### 목표

개발의 기반이 되는 monorepo 구조와 Prisma schema를 만든다.

### 작업 항목

- 프로젝트 루트 package 구성
- `apps/web` 생성
- `apps/api` 생성
- `packages/database` 생성
- `packages/shared` 생성
- PostgreSQL 연결 설정
- Prisma schema 작성
- 비회원 메시지 가입 귀속을 위한 `receiverId`, `linkedUserId`, `linkedAt` 설계
- 값이 비어 있는 `.env.example` 작성
- `.env.local`, `.env.production`은 생성하지 않고 사용자가 직접 제공하도록 안내
- 로컬 개발용 `docker-compose.yml` 작성 시 `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`를 `.env`에서만 참조
- mock 파일, dummy 데이터, seed 파일 생성 금지

### 산출물

- 디렉토리 구조
- `schema.prisma`
- `.env.example`
- `docker-compose.yml`

### 완료 기준

- `prisma generate` 성공
- `prisma migrate dev` 성공
- User와 Message 관계가 정상 생성
- Message.sender, Message.receiver 관계가 정상 생성
- 공개 링크 token과 가입 사용자 귀속 정보를 저장할 수 있음
- AI 검사 실패 상태와 재검사 예약 시각을 저장할 수 있음
- Message status enum 정상 사용 가능
- `.env.example`에는 key만 있고 실제 값이나 가짜 값이 없음
- mock/dummy/seed 파일이 없음

---

## Step 2. AI 필터링 및 메시지 작성 API

### 목표

사용자가 작성한 메시지를 저장하기 전에 AI 유해성 검사를 수행하고, 통과한 메시지만 예약 상태로 저장한다.

### 작업 항목

- Express app 기본 구성
- Prisma client 연결
- auth middleware 초안
- message validation 작성
- OpenAI moderation service 작성
- `getModerationFeedback(categories)` 작성
- `moderateMessageWithRetry` 작성
- message service 작성
- POST `/api/messages` 구현
- POST `/api/auth/link-message` 구현
- public access token 생성 로직 구현
- 에러 핸들링 middleware 구현
- OpenAI/Kakao/JWT/DB 값은 모두 config loader를 통해 `.env`에서만 읽도록 구현
- OpenAI 응답을 fake success로 대체하는 코드 작성 금지

### 산출물

- `moderation.service.ts`
- `moderation-feedback.ts`
- `moderation-retry.ts`
- `message.validation.ts`
- `message.service.ts`
- `message.controller.ts`
- `message.routes.ts`
- `link-message.service.ts`
- `auth.routes.ts`

### 완료 기준

- 정상 메시지는 `PENDING` 상태로 저장됨
- 유해 메시지는 DB에 저장되지 않음
- 유해 메시지는 categories 기반의 친절한 UX 문구를 반환함
- OpenAI API 실패 시 즉시 1회 자동 재시도
- 2회 모두 검사 실패 시 `MODERATION_FAILED` 상태로 저장하고 검사 실패 UX를 반환
- `MODERATION_FAILED` 메시지는 publicUrl을 발급하지 않음
- `OPENAI_API_KEY`가 없으면 서버 시작 또는 요청 처리 시 명확한 설정 오류를 반환함
- mock moderation 결과를 사용하지 않음
- 공개 열람 URL token 생성 가능
- 공개 링크로 열람한 메시지가 가입 후 로그인 사용자 수신함에 귀속됨

---

## Step 3. 스케줄러 로직

### 목표

예약 시간이 지난 메시지를 주기적으로 찾아 `SENT` 상태로 변경한다.

### 작업 항목

- `node-cron` 설치
- scheduler entrypoint 작성
- pending message job 작성
- failed moderation retry job 작성
- DB 조회 조건 구현
- 상태 변경 트랜잭션 작성
- `EventEmitter` 기반 domain event 작성
- `NotificationProcessor` 작성
- 실패 처리 구현
- 중복 실행 방지 lock 추가
- 로그 출력
- 실제 외부 알림 provider 정보가 없는 상태에서 알림 발송 성공으로 기록하지 않음

### 산출물

- `scheduler.ts`
- `send-pending-messages.job.ts`
- `retry-failed-moderation.job.ts`
- `domain-events.ts`
- `notification.processor.ts`

### 완료 기준

- 5분마다 job 실행
- `scheduledAt <= now`인 `PENDING` 메시지가 `SENT`로 변경됨
- 스케줄러는 알림 발송을 직접 처리하지 않음
- `SENT` 변경 직후 `message.sent` event가 발행됨
- `NotificationProcessor`가 event를 받아 후속 알림 처리를 수행함
- 하루 한 번 `MODERATION_FAILED` 메시지를 재검사함
- 재검사 통과 시 `PENDING`으로 복귀하고 공개 링크를 발급함
- 재검사에서 유해성 차단 시 `BLOCKED`로 전환함
- 오류 발생 시 `FAILED` 처리
- 같은 job이 겹쳐 실행되지 않음
- NotificationProcessor는 fake provider나 dummy 알림 파일 없이 동작함

---

## Step 4. Nginx 인프라 설정

### 목표

도메인으로 들어온 HTTPS 요청을 Next.js와 Express API로 안정적으로 전달한다.

### 작업 항목

- `infra/nginx/maeum-arrival.conf.template` 작성
- `/api` proxy 설정
- frontend proxy 설정
- websocket upgrade header 설정
- `proxy_read_timeout` 60초 이상 설정
- proxy timeout 설정
- client body size 설정
- SSL 인증서 적용 위치 주석 작성
- 로컬/배포 `.env` 파일 구분 가이드 작성
- 도메인, HTTPS, cookie, upstream port 값은 하드코딩하지 않고 배포 환경 변수 또는 Nginx 변수로 분리

### 산출물

- Nginx site config template
- `.env.example`
- `.gitignore` env 규칙
- API config loader 초안

### 완료 기준

- `.env.production` 값으로 렌더링한 뒤 `nginx -t` 통과 가능한 설정
- `/api/*` 요청은 Express 서버로 전달
- 그 외 요청은 Next.js 서버로 전달
- HTTPS 적용 가능
- 운영 환경에서 `.env.production`을 기준으로 서버 실행 가능
- 운영 secret이나 실제 도메인 값이 repository에 커밋되지 않음

---

## 17. MVP 이후 확장 계획

## Phase 2. 실제 알림 발송

- 카카오 알림톡 연동
- SMS fallback 연동
- NotificationLog 모델 추가
- 발송 실패 재시도 정책 추가

## Phase 3. 감성 기능 강화

- 기간 랜덤 발송
- 도착 전 힌트 알림
- 익명 답장
- 메시지 봉투/테마 선택

## Phase 4. 보관함 고도화

- 감정 태그 기반 필터
- 월별 감정 리포트
- 받은 메시지 아카이브
- 미래의 나에게 쓴 편지 모아보기

## Phase 5. 운영 도구

- 관리자 페이지
- 유해 메시지 moderation log
- 신고 기능
- 계정 정지 정책
- 발송 통계 대시보드

---

## 18. 예상 리스크와 대응

| 리스크 | 설명 | 대응 |
| --- | --- | --- |
| OpenAI API 장애 | 메시지 작성이 막힐 수 있음 | Fail Closed 정책과 재시도 안내 |
| Kakao OAuth 설정 오류 | 로그인 불가 | 개발/운영 redirect URI 분리 |
| 예약 job 중복 실행 | 메시지 중복 발송 가능 | in-memory lock, 추후 DB lock |
| 공개 링크 유출 | 누구나 열람 가능 | 충분히 긴 token, 만료 정책 |
| 2GB RAM 한계 | Next.js, API, DB 동시 운영 부담 | PM2 memory limit, swap, managed DB 고려 |
| 알림톡 미연동 | 실제 수신 알림 부족 | MVP에서는 링크 공유 기반으로 시작 |

---

## 19. 개발 우선순위

1. DB schema와 프로젝트 구조를 먼저 확정한다.
2. 카카오 로그인보다 메시지 생성 도메인 모델을 먼저 안정화한다.
3. 메시지 작성 API에는 반드시 AI moderation을 포함한다.
4. 예약 스케줄러는 실제 알림 발송 전까지 상태 변경 중심으로 구현한다.
5. 비회원 열람 링크를 초기에 설계해 바이럴 유입의 기반을 만든다.
6. Nginx와 PM2 설정은 MVP 배포 가능한 수준으로 단순하게 유지한다.

---

## 20. 최종 실행 순서

```txt
1. Step 1: 프로젝트 구조 및 Prisma DB 설계
2. Step 2: AI 필터링 및 메시지 작성 API
3. Step 3: 예약 메시지 scheduler
4. Step 4: Nginx reverse proxy 설정
5. 로컬 테스트
6. Lightsail 배포
7. HTTPS 적용
8. 카카오 OAuth 운영 redirect URI 등록
9. 소규모 사용자 테스트
10. 알림톡/SMS 연동 검토
```

---

## 21. 다음 작업

이 계획서를 기준으로 실제 개발은 다음 순서로 진행합니다.

**다음 단계: Step 1. 프로젝트 구조 및 DB 설계**

Step 1에서 작성할 실제 파일은 다음과 같습니다.

- `package.json`
- `pnpm-workspace.yaml`
- `packages/database/prisma/schema.prisma`
- `.env.example`
- `docker-compose.yml`
