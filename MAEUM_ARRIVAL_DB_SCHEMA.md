# 마음도착 MVP 최종 DB Schema

## 0. 산출물

실제 Prisma schema 파일:

- `packages/database/prisma/schema.prisma`

이 문서는 `MAEUM_ARRIVAL_PLAN.md`와 `MAEUM_ARRIVAL_IA.md`를 기준으로, 마음도착 MVP에 적합한 PostgreSQL/Prisma 데이터베이스 구조를 정리한 설계 문서입니다.

---

## 1. 설계 방향

## 1.1 핵심 판단

기존 초안처럼 `Message.receiverId` 하나만 두는 구조는 MVP의 단일 수신자 흐름에는 충분합니다.

하지만 마음도착은 다음 요구가 이미 문서에 포함되어 있습니다.

- 미래의 나에게 보내기
- 타인에게 보내기
- 비회원 공개 링크 열람
- 비회원 가입 후 수신함 자동 귀속
- 추후 그룹 전송
- 수신자별 알림 처리
- 수신자별 공개 링크와 열람 기록

따라서 최종 스키마는 `Message`와 `MessageRecipient`를 분리합니다.

```txt
Message
  -> 편지 본문, 예약일, 발신자, 숨김 옵션, AI 검사 상태

MessageRecipient
  -> 수신자별 정보, 귀속 사용자, 열람 상태, 발송 상태

MessageAccessToken
  -> 수신자별 공개 링크 token
```

이 구조를 사용하면 MVP에서는 수신자 1명만 만들면 되고, 나중에 그룹 전송을 추가할 때는 같은 `Message`에 여러 `MessageRecipient`를 붙이면 됩니다.

## 1.2 보안 판단

공개 링크 token은 bearer secret입니다. DB에 원문 token을 저장하면 DB 유출 시 공개 링크가 바로 노출됩니다.

따라서 최종 스키마는 다음 방식을 사용합니다.

```txt
1. 서버가 random token 생성
2. 사용자에게는 raw token이 포함된 URL 반환
3. DB에는 SHA-256 tokenHash만 저장
4. /arrival/[token] 요청 시 token을 hash 처리하여 조회
```

---

## 2. ERD Tree

```txt
User
├── sentMessages: Message[]
├── receivedRecipients: MessageRecipient[]
└── claimedAccessTokens: MessageAccessToken[]

Message
├── sender: User
├── recipients: MessageRecipient[]
└── moderationLogs: ModerationLog[]

MessageRecipient
├── message: Message
├── receiverUser: User?
├── accessTokens: MessageAccessToken[]
└── notifications: NotificationLog[]

MessageAccessToken
├── recipient: MessageRecipient
└── linkedUser: User?

ModerationLog
└── message: Message

NotificationLog
└── recipient: MessageRecipient
```

---

## 3. 모델별 책임

## 3.1 User

카카오 로그인 사용자를 저장합니다.

주요 필드:

- `kakaoId`: 카카오 고유 id
- `nickname`: 서비스 표시명
- `email`: 선택 이메일
- `onboardingNote`: 온보딩 질문 답변
- `lastLoginAt`: 마지막 로그인 시각
- `deletedAt`: soft delete 대비

## 3.2 Message

편지 자체의 본문과 예약 상태를 저장합니다.

주요 필드:

- `senderId`: 발신자
- `title`: 제목
- `content`: 본문
- `emotionTag`: 감정 태그
- `scheduledAt`: 예약 발송 시각
- `sentAt`: 실제 발송 처리 시각
- `isSenderHidden`: 발신인 숨김
- `isDateHidden`: 도착일 숨김
- `status`: 메시지 상태
- `moderationNextRetryAt`: AI 검사 실패 후 다음 자동 재검사 시각

## 3.3 MessageRecipient

수신자별 상태를 저장합니다.

MVP에서는 메시지 하나당 한 명의 수신자를 만들고, 그룹 전송에서는 여러 명의 수신자를 만들 수 있습니다.

주요 필드:

- `messageId`: 원본 메시지
- `receiverUserId`: 가입 후 귀속된 사용자
- `receiverType`: `SELF` 또는 `OTHER`
- `receiverName`, `receiverEmail`, `receiverPhone`: 작성 당시 수신자 snapshot
- `receiverInfo`: API 입력 원본 보존용 JSON
- `deliveryStatus`: 수신자별 발송 상태
- `readAt`: 가입자 수신함에서 읽은 시각

## 3.4 MessageAccessToken

비회원 공개 열람 링크와 가입 후 귀속 상태를 저장합니다.

주요 필드:

- `messageRecipientId`: 어떤 수신자에게 발급된 링크인지
- `tokenHash`: raw token의 SHA-256 hash
- `tokenPreview`: 운영자가 구분할 수 있는 짧은 preview
- `expiresAt`: 링크 만료 시각
- `openCount`: 열람 횟수
- `linkedUserId`: 가입 후 귀속된 사용자
- `linkedAt`: 귀속 완료 시각
- `revokedAt`: 링크 폐기 시각

## 3.5 ModerationLog

OpenAI Moderation 검사 이력을 저장합니다.

주요 필드:

- `attemptNo`: 메시지별 검사 시도 번호
- `status`: `APPROVED`, `BLOCKED`, `FAILED`
- `model`: 사용한 moderation model
- `inputHash`: 검사한 텍스트의 hash
- `categories`, `categoryScores`: OpenAI moderation 결과
- `feedback`: 사용자에게 보여줄 안내 문구
- `errorCode`, `errorMessage`: API 실패 원인

## 3.6 NotificationLog

`message.sent` 이벤트 이후 알림 처리 이력을 저장합니다.

MVP에서는 실제 알림톡/SMS 발송 전이라도 `IN_APP` 또는 mock log로 남길 수 있습니다.

주요 필드:

- `messageRecipientId`: 대상 수신자
- `eventType`: `MESSAGE_SENT`, `ARRIVAL_HINT`, `SYSTEM`
- `channel`: `IN_APP`, `KAKAO_ALIMTALK`, `SMS`, `EMAIL`
- `status`: `PENDING`, `SENT`, `FAILED`, `SKIPPED`
- `providerMessageId`: 외부 발송 provider id
- `payload`: 발송 payload snapshot
- `errorMessage`: 실패 원인

---

## 4. 상태 설계

## 4.1 MessageStatus

```txt
PENDING
  -> AI 검사 통과 후 예약 대기

SENT
  -> 발송 scheduler가 처리 완료

FAILED
  -> 발송 scheduler 처리 실패

BLOCKED
  -> AI 검사에서 유해 가능성 감지

MODERATION_FAILED
  -> OpenAI API 장애/timeout 등으로 검사 자체 실패
  -> 즉시 2회 시도 후에도 실패했을 때 저장
  -> publicUrl 미발급
  -> 하루 1회 자동 재검사 대상

CANCELED
  -> 발신자가 예약 취소
```

## 4.2 RecipientDeliveryStatus

```txt
WAITING
  -> 메시지는 아직 발송 전

SENT
  -> 해당 수신자에게 발송 처리 완료

FAILED
  -> 해당 수신자 알림 또는 발송 처리 실패

CANCELED
  -> 메시지 취소로 수신자 발송도 취소
```

---

## 5. 주요 흐름과 DB 변경

## 5.1 메시지 작성 성공

```txt
1. User가 /write에서 메시지 작성
2. OpenAI moderation 1차 검사
3. 통과
4. Message.status = PENDING 생성
5. MessageRecipient 1개 생성
6. MessageAccessToken 생성
7. publicUrl 반환
```

## 5.2 AI 검사 API 실패

```txt
1. OpenAI moderation 1차 검사 실패
2. 즉시 2차 자동 재시도
3. 2차도 실패
4. Message.status = MODERATION_FAILED 생성
5. MessageRecipient 생성
6. MessageAccessToken은 생성하지 않음
7. publicUrl = null 반환
8. moderationNextRetryAt = now + 1 day
```

## 5.3 하루 1회 AI 재검사

```txt
1. status = MODERATION_FAILED
2. moderationNextRetryAt <= now
3. OpenAI moderation 재검사
4. 통과 시 Message.status = PENDING
5. MessageAccessToken 생성
6. scheduledAt이 이미 지났으면 다음 발송 scheduler에서 SENT 처리
```

## 5.4 예약 발송 처리

```txt
1. 발송 scheduler가 Message 조회
2. 조건: Message.status = PENDING
3. 조건: Message.scheduledAt <= now
4. Message.status = SENT
5. Message.sentAt = now
6. 연결된 MessageRecipient.deliveryStatus = SENT
7. 연결된 MessageRecipient.deliveredAt = now
8. message.sent event 발행
9. NotificationProcessor가 NotificationLog 생성
```

수신자가 여러 명인 그룹 전송으로 확장되더라도 `Message`는 한 번만 예약 처리하고, 수신자별 성공/실패는 `MessageRecipient.deliveryStatus`와 `NotificationLog`로 추적합니다.

## 5.5 비회원 링크 열람

```txt
1. /arrival/[token] 접근
2. token을 SHA-256 hash 처리
3. MessageAccessToken.tokenHash 조회
4. openCount 증가
5. firstOpenedAt 또는 lastOpenedAt 갱신
6. 메시지 표시
```

## 5.6 비회원 가입 후 수신함 귀속

```txt
1. /auth/callback에서 sessionStorage token 확인
2. POST /api/auth/link-message
3. tokenHash로 MessageAccessToken 조회
4. MessageRecipient.receiverUserId = currentUser.id
5. MessageAccessToken.linkedUserId = currentUser.id
6. MessageAccessToken.linkedAt = now
7. /inbox에서 조회 가능
```

---

## 6. 주요 조회 최적화

## 6.1 발송 scheduler

사용 인덱스:

```txt
Message @@index([status, scheduledAt])
```

조회 조건:

```txt
status = PENDING
scheduledAt <= now
```

## 6.2 AI 재검사 scheduler

사용 인덱스:

```txt
Message @@index([status, moderationNextRetryAt])
```

조회 조건:

```txt
status = MODERATION_FAILED
moderationNextRetryAt <= now
```

## 6.3 수신함

사용 인덱스:

```txt
MessageRecipient @@index([receiverUserId, readAt])
```

조회 조건:

```txt
receiverUserId = currentUser.id
```

## 6.4 공개 링크 조회

사용 인덱스:

```txt
MessageAccessToken tokenHash @unique
```

조회 조건:

```txt
tokenHash = sha256(routeToken)
revokedAt IS NULL
expiresAt IS NULL OR expiresAt > now
```

---

## 7. Prisma Schema 위치

최종 schema는 아래 파일에 작성되어 있습니다.

```txt
packages/database/prisma/schema.prisma
```

이 파일을 기준으로 다음 명령을 실행하면 됩니다.

```bash
npx prisma generate --schema packages/database/prisma/schema.prisma
npx prisma migrate dev --schema packages/database/prisma/schema.prisma --name init
```

---

## 8. 구현 시 주의 사항

## 8.1 receiverInfo API 호환

API 요청은 기존 계획처럼 `receiverInfo`를 받을 수 있습니다.

백엔드는 이를 그대로 `MessageRecipient.receiverInfo`에 저장하고, 동시에 다음 구조화 필드로 분해합니다.

```txt
receiverInfo.name  -> MessageRecipient.receiverName
receiverInfo.email -> MessageRecipient.receiverEmail
receiverInfo.phone -> MessageRecipient.receiverPhone
receiverInfo.type  -> MessageRecipient.receiverType
```

## 8.2 SELF 메시지

미래의 나에게 보내는 메시지는 다음처럼 저장합니다.

```txt
Message.senderId = currentUser.id
MessageRecipient.receiverUserId = currentUser.id
MessageRecipient.receiverType = SELF
```

## 8.3 token 원문 저장 금지

DB에는 raw token을 저장하지 않습니다.

```txt
rawToken -> 사용자 URL에만 포함
sha256(rawToken) -> MessageAccessToken.tokenHash
```

## 8.4 MODERATION_FAILED 공개 금지

`MODERATION_FAILED` 상태의 메시지는 안전 검사를 통과하지 않았으므로 다음을 금지합니다.

- publicUrl 발급
- `/arrival/[token]` 열람
- NotificationProcessor 알림 발송

---

## 9. MVP 이후 확장

이 스키마는 아래 기능을 큰 구조 변경 없이 확장할 수 있습니다.

- 그룹 전송: `MessageRecipient` 여러 개 생성
- 카카오 알림톡: `NotificationLog.channel = KAKAO_ALIMTALK`
- SMS fallback: `NotificationLog.channel = SMS`
- 도착 전 힌트: `NotificationEventType.ARRIVAL_HINT`
- 익명 답장: `Reply` 모델 추가
- 이미지 첨부: `MessageAttachment` 모델 추가
- 감정 리포트: `Message.emotionTag`, `MessageRecipient.readAt` 기반 집계
