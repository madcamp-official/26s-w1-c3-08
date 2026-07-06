# 매아리 DB Schema 및 운영 DB 상태

## 0. 기준 파일과 현재 상태

실제 Prisma schema 기준 파일:

- `packages/database/prisma/schema.prisma`

현재 운영/개발 DB 기준:

- 현재 DB 이름: `maeari`
- 현재 DB 사용자: `maeari`
- 현재 적용된 최신 migration: `20260706123000_friend_invite_links`
- Docker Postgres healthcheck 기준 DB/USER도 `maeari`로 전환 완료
- 2026-07-06 현재 주요 row count:
  - `User`: 5
  - `Message`: 30
  - `MessageRecipient`: 30
  - `MessageAccessToken`: 37
  - `NotificationLog`: 23
  - `ContactSuppression`: 1
  - `FriendRequest`: 1
  - `Friendship`: 1
  - `UserContact`: 4
  - `FriendInviteLink`: 0

신규 DB 이전 결과:

- 새 DB 이름은 `maeari`로 사용합니다.
- 기존 DB `maeum_arrival`과 임시 `maeari_dryrun` DB는 final dump 검증 후 제거했습니다.
- final dump 백업은 `backups/maeum_arrival_final_20260706_090800.dump`로 보존합니다.
- 기존 bootstrap role `maeum`은 Postgres system-required 객체 때문에 삭제할 수 없어 `NOLOGIN`으로 잠근 상태로 남깁니다.
- `PUBLIC_TOKEN_PEPPER`는 반드시 기존 값 그대로 유지합니다. 공개 링크 token hash, 수신거부 contact hash, OTP hash 정책이 이 값에 의존합니다.

---

## 1. 설계 방향

매아리는 예약 메시지 본문과 수신자별 전달 상태를 분리합니다. 메시지 하나는 한 명 또는 여러 명의 수신자를 가질 수 있고, 수신자마다 공개 링크, 알림 provider, 열람/삭제/보관 상태가 달라질 수 있기 때문입니다.

핵심 구조:

```txt
User
  -> 카카오 로그인 계정, 친구 코드, 정지/삭제 상태

UserContact
  -> 사용자가 소유 인증한 이메일/전화번호. PHONE은 마음쓰기 권한, EMAIL은 이메일 수신 연결에 사용

UserContactVerification
  -> 연락처 인증 OTP hash와 만료/시도 이력

PhoneVerificationAttempt / PhoneVerificationLock / PhoneNumberLookupCache
  -> PHONE 인증 abuse 방어, 잠금, Twilio Lookup cache

Message
  -> 편지 본문, 예약/도착 상태, 발신자, 서버가 선택한 인증 PHONE snapshot, 숨김 옵션, AI 검사 상태

MessageRecipient
  -> 수신자별 정보, 귀속 사용자, 열람 상태, 발송 상태

MessageAccessToken
  -> 수신자별 공개 링크 token hash

NotificationLog
  -> IN_APP/Gmail SMTP/Solapi 발송 이력, retry, provider id

ContactSuppression
  -> EMAIL/SMS 수신거부 연락처 HMAC hash
```

보안 원칙:

- 공개 링크 raw token은 DB에 저장하지 않습니다.
- `MessageAccessToken.tokenHash`에는 `PUBLIC_TOKEN_PEPPER` 기반 HMAC-SHA256만 저장합니다.
- 수신거부 테이블에는 raw 이메일/전화번호를 저장하지 않습니다.
- `UserContact.value`에는 사용자가 인증한 연락처 원문을 저장하지만, 메시지 snapshot에는 `maskedValue`와 `contactHash`만 저장합니다.
- 이메일/SMS 알림 본문에는 사용자가 작성한 편지 본문을 넣지 않고 열람 링크만 보냅니다.

---

## 2. ERD Tree

```txt
User
├── sentMessages: Message[]
├── receivedRecipients: MessageRecipient[]
├── claimedAccessTokens: MessageAccessToken[]
├── sentFriendRequests: FriendRequest[]
├── receivedFriendRequests: FriendRequest[]
├── friendshipsAsA: Friendship[]
├── friendshipsAsB: Friendship[]
├── createdFriendships: Friendship[]
├── submittedReports: MessageReport[]
└── contacts: UserContact[]

UserContact
├── user: User
├── verifications: UserContactVerification[]
└── sentMessages: Message[]

UserContactVerification
└── contact: UserContact

Message
├── sender: User
├── senderContact: UserContact?
├── recipients: MessageRecipient[]
├── attachments: MessageAttachment[]
├── replies: MessageReply[]
├── reports: MessageReport[]
└── moderationLogs: ModerationLog[]

MessageRecipient
├── message: Message
├── receiverUser: User?
├── accessTokens: MessageAccessToken[]
├── notifications: NotificationLog[]
├── replies: MessageReply[]
└── reports: MessageReport[]

MessageAccessToken
├── recipient: MessageRecipient
└── linkedUser: User?

NotificationLog
└── recipient: MessageRecipient

ContactSuppression
└── channel + contactHash unique

FriendRequest
├── requester: User
└── addressee: User

Friendship
├── userA: User
├── userB: User
└── createdBy: User

FriendInviteLink
└── inviter: User
```

---

## 3. 모델별 책임

## 3.1 User

카카오 로그인 사용자를 저장합니다.

주요 필드:

- `kakaoId`: 카카오 고유 id
- `nickname`: 서비스 표시명
- `email`: 카카오에서 받은 선택 이메일. 이메일 수신 연결용 `UserContact` backfill 원천으로 사용합니다.
- `friendCode`: 친구 요청에 사용하는 사용자별 고유 코드
- `profileImageUrl`: 카카오 프로필 이미지
- `onboardingNote`: 온보딩 답변
- `lastLoginAt`: 마지막 로그인 시각
- `suspendedAt`, `suspensionReason`: 관리자 계정 정지 상태
- `deletedAt`: 계정 soft delete 대비

`User.email`은 로그인 provider snapshot이며, 이메일 수신 연결 판단은 인증된 `UserContact(type=EMAIL)`를 기준으로 합니다.

## 3.2 UserContact

사용자가 소유 인증한 연락처를 저장합니다. PHONE은 마음쓰기 권한 확인에만 쓰이고, 메시지 수신/전달 자체에는 직접 사용하지 않습니다. EMAIL은 비회원 이메일 수신자가 기존 사용자와 연결될 때 사용합니다.

주요 필드:

- `userId`: 연락처 소유 사용자
- `type`: `EMAIL` 또는 `PHONE`
- `value`: 정규화된 원문 연락처
  - EMAIL: trim + lowercase
  - PHONE: 숫자만 남긴 국내 번호
- `contactHash`: `PUBLIC_TOKEN_PEPPER` 기반 HMAC-SHA256
- `label`: 사용자 표시 라벨
- `isPrimary`: active verified PHONE을 하나로 유지하기 위한 내부 우선순위
- `verifiedAt`: 인증 완료 시각
- `verificationSource`: `KAKAO`, `OTP` 등 인증 출처
- `deletedAt`: 연락처 soft delete

제약:

- `@@unique([type, contactHash])`
- 같은 이메일/전화번호를 여러 사용자에게 자동 배정하지 않습니다.
- 신규 DB backfill 시 동일 이메일이 여러 사용자에게 있으면 해당 그룹은 전부 skip하고 수동 확인 대상으로 남깁니다.

## 3.3 UserContactVerification

연락처 인증 OTP 이력을 저장합니다.

주요 필드:

- `userContactId`: 인증 대상 연락처
- `codeHash`: 6자리 OTP 원문이 아니라 `PUBLIC_TOKEN_PEPPER` 기반 hash
- `status`: `PENDING`, `VERIFIED`, `EXPIRED`
- `expiresAt`: 기본 10분 만료
- `consumedAt`: 인증 완료 시각
- `attemptCount`: 잘못된 code 입력 횟수

원문 OTP는 DB에 저장하지 않습니다.

## 3.4 Message

편지 본문과 예약 상태를 저장합니다.

주요 필드:

- `senderId`: 발신자
- `senderContactId`: 발송 당시 선택한 verified `UserContact`
- `senderContactSnapshot`: `{ type, maskedValue, contactHash, label }`
- `title`, `content`: 제목과 본문
- `emotionTag`, `customEmotionTag`: 감정 태그
- `scheduledAt`: 예약 발송 시각
- `arrivalMode`: `FIXED` 또는 `RANDOM_WINDOW`
- `arrivalWindowStartAt`, `arrivalWindowEndAt`: 랜덤 도착 구간
- `hintAt`, `hintSentAt`: 도착 전 힌트 알림 예약/발송 시각
- `theme`: 공개 링크/상세 화면 테마
- `isReplyEnabled`: 공개 링크 익명 답장 허용
- `sentAt`, `canceledAt`, `failedAt`, `failureReason`
- `senderDeletedAt`: 발신자가 보낸 마음 목록에서 제거한 시각
- `isSenderHidden`, `isDateHidden`
- `status`: 메시지 전체 상태
- `moderationAttemptCount`, `moderationLastCheckedAt`, `moderationNextRetryAt`, `moderationFailureReason`, `moderationFeedback`, `moderationBlockedCategories`

삭제 정책:

- 발신자 삭제:
  - `PENDING`, `MODERATION_FAILED`, `CANCELED`: hard delete
  - `SENT`, `FAILED`: `senderDeletedAt` soft delete
- 수신자 삭제:
  - `MessageRecipient.receiverDeletedAt` soft delete

## 3.5 MessageRecipient

수신자별 상태를 저장합니다.

주요 필드:

- `messageId`: 원본 메시지
- `receiverUserId`: 가입 후 귀속된 사용자
- `receiverType`: `SELF`, `FRIEND`, `OTHER`
- `receiverName`, `receiverEmail`, `receiverPhone`: 작성 당시 수신자 snapshot
- `receiverInfo`: API 입력 원본 보존용 JSON
- `deliveryStatus`: 수신자별 발송 상태
- `deliveredAt`, `readAt`
- `receiverDeletedAt`: 받은 마음 목록에서 제거한 시각
- `receiverArchivedAt`: 받은 마음 아카이브 시각

외부 수신자 정책:

- `OTHER`는 `receiverEmail` 또는 `receiverPhone` 중 하나가 필수입니다.
- `preferredChannel=AUTO`: 이메일이 있으면 EMAIL, 이메일이 없고 전화번호만 있으면 SMS.
- `preferredChannel=EMAIL`: 이메일 필수, SMS fallback 없음.
- `preferredChannel=SMS`: 전화번호 필수, EMAIL fallback 없음.

## 3.6 MessageAttachment

첨부 이미지 metadata를 저장합니다. 파일 자체는 `UPLOAD_DIR` 아래에 저장하고, API가 `UPLOAD_PUBLIC_PATH`로 정적 제공하는 public URL을 DB에 저장합니다.

주요 필드:

- `messageId`
- `publicUrl`
- `storageKey`
- `originalName`
- `mimeType`
- `sizeBytes`

## 3.7 MessageReply

공개 링크를 열람한 수신자의 익명 답장을 저장합니다.

주요 필드:

- `messageId`
- `messageRecipientId`
- `content`
- `senderDisplayName`
- `isAnonymous`
- `status`: `VISIBLE`, `HIDDEN`, `DELETED`
- `moderationInputHash`, `moderationCategories`
- `hiddenAt`, `hiddenReason`

답장도 저장 전 AI moderation을 통과해야 합니다.

## 3.8 MessageAccessToken

비회원 공개 열람 링크와 가입 후 귀속 상태를 저장합니다.

주요 필드:

- `messageRecipientId`
- `tokenHash`: raw token의 HMAC-SHA256 hash
- `tokenPreview`: 운영 구분용 짧은 preview
- `expiresAt`
- `firstOpenedAt`, `lastOpenedAt`, `openCount`
- `linkedUserId`, `linkedAt`
- `revokedAt`

공개 링크 열람 조건:

- token hash가 존재해야 합니다.
- token이 revoke/expire되지 않아야 합니다.
- `Message.status = SENT`여야 합니다.
- 해당 token의 `MessageRecipient.deliveryStatus = SENT`여야 합니다.

## 3.9 ModerationLog

OpenAI moderation 검사 이력을 저장합니다.

주요 필드:

- `messageId`
- `attemptNo`
- `provider`
- `model`
- `status`: `APPROVED`, `BLOCKED`, `FAILED`
- `inputHash`
- `categories`, `categoryScores`
- `feedback`
- `errorCode`, `errorMessage`
- `checkedAt`

## 3.10 NotificationLog

알림 provider 처리 이력을 저장합니다.

주요 필드:

- `messageRecipientId`
- `eventType`: `MESSAGE_SENT`, `ARRIVAL_HINT`, `SYSTEM`
- `channel`: `IN_APP`, `KAKAO_ALIMTALK`, `SMS`, `EMAIL`
- `status`: `PENDING`, `SENT`, `FAILED`, `SKIPPED`
- `provider`: `in_app`, `gmail_smtp`, `solapi`, `contact_suppression` 등
- `idempotencyKey`: 같은 수신자/이벤트/channel 중복 발송 방지
- `attemptCount`
- `providerMessageId`
- `payload`
- `errorCode`, `errorMessage`
- `scheduledAt`, `nextRetryAt`, `attemptedAt`, `sentAt`

상태 동기화:

- 하나 이상의 recipient가 `SENT`이면 `Message.status = SENT` 유지.
- 모든 recipient가 `FAILED` 또는 `CANCELED`이고 retry 가능한 `NotificationLog.PENDING`이 없으면 `Message.status = FAILED`.
- 모든 실패 원인이 `CONTACT_SUPPRESSED`이면 `Message.failureReason = CONTACT_SUPPRESSED`.

## 3.11 ContactSuppression

이메일 또는 문자 알림 수신거부 연락처 hash를 저장합니다.

주요 필드:

- `channel`: `EMAIL` 또는 `SMS`
- `contactHash`: 정규화 연락처의 HMAC-SHA256 hash
- `sourceMessageRecipientId`
- `reason`
- `createdAt`

정책:

- `POST /api/public/notification-suppressions`: row upsert, 수신거부.
- `DELETE /api/public/notification-suppressions`: row delete, 재구독.
- 이메일 수신거부는 EMAIL만 막고, 문자 수신거부는 SMS만 막습니다.

## 3.12 MessageReport

메시지 신고와 관리자 검토 상태를 저장합니다.

주요 필드:

- `messageId`
- `messageRecipientId`
- `reporterUserId`
- `reason`, `details`
- `status`: `PENDING`, `REVIEWED`, `DISMISSED`
- `reviewedAt`, `reviewNote`

## 3.13 FriendRequest

친구 코드 기반 친구 요청을 저장합니다.

주요 필드:

- `requesterId`
- `addresseeId`
- `status`: `PENDING`, `ACCEPTED`, `REJECTED`, `CANCELED`, `EXPIRED`
- `message`
- `expiresAt`, `respondedAt`

## 3.14 Friendship

수락된 친구 관계를 저장합니다.

주요 필드:

- `userAId`, `userBId`: 중복 방지를 위해 정렬된 사용자 pair
- `createdById`
- `deletedAt`

`@@unique([userAId, userBId])`로 중복 관계 생성을 막습니다.

## 3.15 FriendInviteLink

친구 초대 링크를 저장합니다.

주요 필드:

- `inviterId`: 초대 링크를 만든 사용자
- `tokenHash`: raw token을 저장하지 않고 `PUBLIC_TOKEN_PEPPER` 기반 HMAC-SHA256만 저장
- `tokenPreview`: UI에서 식별을 돕는 짧은 preview
- `expiresAt`: 기본 24시간 유효
- `maxClaims`: v1 기본 1회 사용
- `claimCount`: claim 완료 횟수
- `revokedAt`: 사용자가 폐기한 시각

정책:

- `/friends`에서 링크를 만들면 원문 token은 응답 URL에만 포함합니다.
- `/friends/invite/[token]`은 token hash로 초대 링크를 찾아 초대자와 만료 상태를 보여줍니다.
- 로그인 사용자가 claim하면 기존 친구 관계/자기 자신/만료/폐기/사용 완료 여부를 검사하고 `Friendship`을 생성합니다.
- 로그인 전 초대 링크를 열면 frontend가 `sessionStorage.maeari.pendingFriendInviteToken`에 token을 저장하고, `/auth/callback`에서 claim을 재시도합니다.

## 3.16 PhoneVerificationAttempt

PHONE 인증 요청 이력을 저장합니다. 원본 IP와 전화번호는 저장하지 않습니다.

주요 필드:

- `userId`
- `ipHash`: `PUBLIC_TOKEN_PEPPER` 기반 HMAC hash
- `contactHash`: strict normalized phone의 HMAC hash
- `status`: `REQUESTED`, `SENT`, `BLOCKED`, `SEND_FAILED`
- `reason`
- `createdAt`

정책:

- guard 통과 직후 `REQUESTED`로 생성합니다.
- Solapi OTP 발송 성공 시 `SENT`, provider 실패 시 `SEND_FAILED`, rate limit/Lookup 차단 시 `BLOCKED`로 기록합니다.
- rate limit 집계는 `REQUESTED`/`SENT` 중심으로 수행해 실제 발송 실패를 성공 요청처럼 과도하게 카운트하지 않습니다.

## 3.17 PhoneVerificationLock

PHONE 인증 abuse 방어용 잠금 상태를 저장합니다.

주요 필드:

- `scope`: `IP` 또는 `CONTACT`
- `scopeHash`: IP hash 또는 contact hash
- `reason`: `CONTACT_RATE_LIMIT`, `IP_DISTINCT_CONTACT_RATE_LIMIT` 등
- `lockedUntil`

정책:

- 동일 연락처는 10분 내 3회 초과 요청 시 24시간 CONTACT lock입니다.
- 동일 IP에서 1시간 내 서로 다른 전화번호 5개 초과 요청 시 1시간 IP lock입니다.
- 유효 lock이 있으면 OTP row와 Solapi 발송을 만들지 않고 429를 반환합니다.

## 3.18 PhoneNumberLookupCache

Twilio Lookup v2 결과 cache입니다. Lookup 비용을 줄이되 raw 전화번호와 raw provider response는 저장하지 않습니다.

주요 필드:

- `provider`: v1은 `TWILIO`
- `contactHash`
- `valid`
- `lineType`
- `carrierName`
- `allowed`
- `reason`
- `checkedAt`, `expiresAt`

정책:

- `PHONE_LOOKUP_ENABLED=true`일 때만 사용합니다.
- 통과 조건은 `valid=true`, `country_code=KR`, `line_type_intelligence.type=mobile`입니다.
- landline, fixedVoip, nonFixedVoip, unknown, invalid는 `CONTACT_PHONE_INVALID`로 차단합니다.
- timeout, network error, 5xx는 cache하지 않고 `PHONE_LOOKUP_UNAVAILABLE`로 fail-closed 처리합니다.
- 기본 cache TTL은 30일입니다.

---

## 4. 주요 상태

## 4.1 MessageStatus

```txt
PENDING
  -> AI 검사 통과 후 예약 대기

SENT
  -> 발송 scheduler가 due message를 처리했고, 하나 이상의 recipient가 도착 가능

FAILED
  -> scheduler/provider/suppression 결과 전체 수신자 도착 실패

BLOCKED
  -> AI 검사에서 유해 가능성 감지

MODERATION_FAILED
  -> OpenAI API 장애/timeout 등으로 검사 자체 실패
  -> publicUrl 미발급
  -> 자동 재검사 대상

CANCELED
  -> 발신자가 예약 취소
```

## 4.2 RecipientDeliveryStatus

```txt
WAITING
  -> 메시지는 아직 발송 전

SENT
  -> 해당 수신자가 열람 가능한 상태

FAILED
  -> 해당 수신자 알림 또는 도착 처리 실패

CANCELED
  -> 메시지 취소로 수신자 발송도 취소
```

---

## 5. 주요 흐름과 DB 변경

## 5.1 연락처 인증과 마음쓰기 권한

```txt
1. /phone-verification 또는 /my에서 UserContact 추가
2. EMAIL은 이메일 수신 연결용으로 Gmail SMTP OTP 또는 Kakao email upsert 사용
3. PHONE은 마음쓰기 권한용으로 strict 010 정규화
4. PHONE이면 PhoneVerificationAttempt/Lock pre-flight 수행
5. PHONE_LOOKUP_ENABLED=true이면 Twilio Lookup v2 mobile 여부 확인
6. UserContactVerification 생성
7. EMAIL은 Gmail SMTP, PHONE은 Solapi로 OTP 발송
8. 사용자가 6자리 code 입력
9. code hash 검증
10. EMAIL verifiedAt = now
11. PHONE verifiedAt = now, isPrimary = true
12. 기존 active verified PHONE은 deletedAt = now, isPrimary = false로 retire
```

카카오 로그인 시 `User.email`이 있으면 `UserContact(type=EMAIL, verificationSource=KAKAO)`로 자동 upsert합니다. 이메일 인증은 마음쓰기 권한을 주지 않고, 외부 이메일 수신 메시지를 기존 계정에 연결하는 용도로 사용합니다.

verified PHONE은 사용자가 직접 삭제할 수 없습니다. 전화번호 변경은 새 PHONE OTP 인증이 완전히 성공한 시점에만 원자적으로 완료됩니다.

## 5.2 메시지 작성 성공

```txt
1. /write가 GET /api/me/contacts로 writerEligibility.hasVerifiedStrictPhone 확인
2. 인증 PHONE이 없으면 /phone-verification?next=/write로 유도
3. POST /api/messages 요청
4. 서버가 senderContactId payload를 무시하고 active verified strict PHONE 직접 조회
5. OpenAI moderation + guardrail 검사
6. 통과
7. Message.status = PENDING 생성
8. Message.senderContactId, senderContactSnapshot 저장
9. 단일 또는 그룹 수신자 수만큼 MessageRecipient 생성
10. 첨부 이미지가 있으면 MessageAttachment 생성
11. 수신자별 MessageAccessToken 생성
12. publicUrl/publicUrls 반환
```

## 5.3 AI 검사 API 실패

```txt
1. OpenAI moderation 검사 실패
2. 즉시 재시도
3. 재시도도 실패
4. Message.status = MODERATION_FAILED 생성
5. MessageRecipient 생성
6. MessageAccessToken은 생성하지 않음
7. moderationNextRetryAt 기록
```

## 5.4 예약 발송 처리

```txt
1. scheduler가 Message.status = PENDING AND scheduledAt <= now 조회
2. Message.status = SENT, sentAt = now
3. message.sent event 발행
4. NotificationProcessor가 수신자별 channel 결정
5. NotificationLog 생성 또는 재사용
6. provider 성공 시 MessageRecipient.deliveryStatus = SENT
7. provider 실패, 수신거부 또는 미설정이면 MessageRecipient.deliveryStatus = FAILED
8. 전체 recipient 상태를 보고 Message.status 최종 동기화
```

## 5.5 비회원 링크 열람

```txt
1. /arrival/[token] 접근
2. raw token을 PUBLIC_TOKEN_PEPPER 기반 HMAC-SHA256으로 hash
3. MessageAccessToken.tokenHash 조회
4. token revoke/expire 확인
5. Message.status = SENT 확인
6. MessageRecipient.deliveryStatus = SENT 확인
7. openCount, firstOpenedAt, lastOpenedAt 갱신
8. 메시지 표시
```

## 5.6 비회원 가입 후 수신함 귀속

```txt
1. /auth/callback에서 sessionStorage token 확인
2. POST /api/auth/link-message
3. tokenHash로 MessageAccessToken 조회
4. MessageRecipient.receiverUserId = currentUser.id
5. MessageAccessToken.linkedUserId = currentUser.id
6. MessageAccessToken.linkedAt = now
```

## 5.7 이메일/문자 수신거부와 재구독

```txt
수신거부
1. /arrival/[token]에서 알림 다시 받지 않기 클릭
2. POST /api/public/notification-suppressions
3. tokenHash로 MessageAccessToken 조회
4. channel별 receiverEmail 또는 receiverPhone 정규화
5. contactHash 생성
6. ContactSuppression upsert

재구독
1. /arrival/[token]에서 알림 다시 받기 클릭
2. DELETE /api/public/notification-suppressions
3. 같은 channel/contactHash row 삭제
```

## 5.8 보관함에서 제거

```txt
발신자
- PENDING, MODERATION_FAILED, CANCELED: DELETE /api/messages/:id -> Message hard delete
- SENT, FAILED: DELETE /api/messages/:id -> Message.senderDeletedAt = now

수신자
- DELETE /api/messages/:id -> MessageRecipient.receiverDeletedAt = now

아카이브
- PATCH /api/messages/:id/archive -> receiverArchivedAt = now
- PATCH /api/messages/:id/unarchive -> receiverArchivedAt = null
```

---

## 6. 주요 조회 최적화

```txt
발송 scheduler
  Message @@index([status, scheduledAt])

힌트 scheduler
  Message @@index([status, hintAt])

AI 재검사 scheduler
  Message @@index([status, moderationNextRetryAt])

발신함
  Message @@index([senderId, createdAt])
  Message @@index([senderId, senderDeletedAt])

수신함/보관함
  MessageRecipient @@index([receiverUserId, readAt])
  MessageRecipient @@index([receiverUserId, receiverDeletedAt])
  MessageRecipient @@index([receiverUserId, receiverArchivedAt])

공개 링크
  MessageAccessToken.tokenHash @unique

수신거부
  ContactSuppression @@unique([channel, contactHash])

사용자 인증 연락처
  UserContact @@unique([type, contactHash])
  UserContact @@index([userId, type, deletedAt])
  UserContact @@index([userId, isPrimary])
```

---

## 7. 신규 DB 생성 및 기존 데이터 마이그레이션 완료 기록

## 7.1 전략

2026-07-06 운영 DB는 dual-write 없이 짧은 maintenance window 방식으로 `maeum_arrival`에서 `maeari`로 이전했습니다.

순서:

```txt
백업
-> dry-run DB 복원
-> 최신 migration 적용
-> UserContact backfill dry-run/apply
-> 검증
-> 실제 DB 생성/복원
-> DATABASE_URL 전환
-> PM2 재시작
```

실제 전환 결과:

- `maeari` DB 생성 및 기존 데이터 복원 완료
- `maeari` role 생성 및 Docker Postgres healthcheck 기준 user로 전환 완료
- `maeum_arrival` DB 삭제 완료
- `maeari_dryrun` DB 삭제 완료
- `maeum` bootstrap role은 system-required 객체 때문에 삭제 불가하여 `NOLOGIN`으로 잠금
- final dump: `backups/maeum_arrival_final_20260706_090800.dump`
- `backups/`는 `.gitignore`에 포함

## 7.2 사전 점검

```bash
pnpm db:validate
pnpm --filter @maeari/api typecheck
pnpm --filter @maeari/web typecheck
node scripts/backfill-user-contacts.js --dry-run
```

이전 당시 구형 DB에는 `UserContact` 계열 테이블이 없을 수 있었기 때문에, 백필 스크립트는 테이블 존재 여부를 확인하고 `pnpm db:deploy` 후 다시 실행하라는 안내를 출력하도록 설계했습니다. 현재 운영 DB에는 최신 migration이 적용되어 해당 테이블들이 존재합니다.

## 7.3 Nginx 유지보수 페이지 설치

PM2 API/Web을 중단한 maintenance window 동안 기본 502/504 화면이 보이지 않도록 Nginx error fallback을 유지합니다.

설정 파일:

- `infra/nginx/maeari.conf.template`
- `infra/nginx/maintenance.html`

운영 설치:

```bash
sudo install -m 0644 infra/nginx/maintenance.html /usr/share/nginx/html/maeari-maintenance.html
./scripts/render-nginx.sh > /tmp/maeari.conf
sudo cp /tmp/maeari.conf /etc/nginx/sites-available/default
sudo nginx -t
sudo systemctl reload nginx
```

이 fallback은 영구 안전장치입니다. upstream이 비정상 중단되어도 Nginx는 `/maeari-maintenance.html`을 503으로 반환합니다.

## 7.4 기존 DB 백업

```bash
export OLD_DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/maeum_arrival"
mkdir -p backups
pg_dump --format=custom --no-owner --no-acl "$OLD_DATABASE_URL" \
  > backups/maeum_arrival_$(date +%Y%m%d_%H%M%S).dump
```

## 7.5 Dry-run DB 검증

```bash
export DRYRUN_DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/maeari_dryrun"
createdb maeari_dryrun
pg_restore --no-owner --no-acl --dbname "$DRYRUN_DATABASE_URL" backups/maeum_arrival_*.dump
DATABASE_URL="$DRYRUN_DATABASE_URL" pnpm db:deploy
DATABASE_URL="$DRYRUN_DATABASE_URL" node scripts/backfill-user-contacts.js --dry-run
DATABASE_URL="$DRYRUN_DATABASE_URL" node scripts/backfill-user-contacts.js --apply
```

검증 SQL:

```sql
SELECT count(*) FROM "UserContact";
SELECT count(*) FROM "UserContact" WHERE "verifiedAt" IS NOT NULL;
SELECT count(*) FROM "Message" WHERE "senderContactId" IS NULL;
SELECT count(*) FROM "ContactSuppression";
SELECT count(*) FROM "MessageAccessToken";
SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY started_at;
```

## 7.6 실제 cutover

쓰기 중단:

```bash
pm2 stop maeari-scheduler
pm2 stop maeari-api
```

최종 백업과 새 DB 복원:

```bash
export NEW_DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/maeari"
pg_dump --format=custom --no-owner --no-acl "$OLD_DATABASE_URL" > backups/maeum_arrival_final.dump
createdb maeari
pg_restore --no-owner --no-acl --dbname "$NEW_DATABASE_URL" backups/maeum_arrival_final.dump
DATABASE_URL="$NEW_DATABASE_URL" pnpm db:deploy
DATABASE_URL="$NEW_DATABASE_URL" node scripts/backfill-user-contacts.js --apply
```

환경 전환:

```bash
# .env.local 또는 .env.production의 DATABASE_URL을 NEW_DATABASE_URL로 변경
pm2 restart maeari-api --update-env
pm2 restart maeari-scheduler --update-env
pm2 restart maeari-web --update-env
pm2 save
```

운영 검증:

```bash
curl -I https://maeari.madcamp-kaist.org/
curl -I https://maeari.madcamp-kaist.org/api/health
```

수동 확인:

- `/my`에서 연락처 인증 상태와 전화번호 변경 CTA가 보이는지 확인합니다.
- `/write`에서 verified strict PHONE이 없으면 `/phone-verification?next=/write`로 유도되는지 확인합니다.
- verified strict PHONE이 있으면 별도 연락처 선택 없이 예약 가능한지 확인합니다.
- 기존 공개 링크가 여전히 열리는지 확인합니다.
- 기존 수신거부 연락처는 계속 `CONTACT_SUPPRESSED` 처리되는지 확인합니다.

## 7.7 Rollback

신규 DB 전환 후 기존 DB `maeum_arrival`은 제거했습니다. rollback이 필요하면 final dump를 새 rollback DB로 복원한 뒤 `DATABASE_URL`을 되돌립니다.

문제가 있으면:

```bash
# final dump에서 rollback DB를 새로 복원한 뒤 DATABASE_URL을 rollback DB로 변경
pm2 restart maeari-api --update-env
pm2 restart maeari-scheduler --update-env
pm2 restart maeari-web --update-env
```

rollback 이후 현재 `maeari` DB에 들어간 write는 자동 병합하지 않습니다. 필요하면 `maeari` DB delta를 별도 확인한 뒤 수동 병합합니다.

---

## 8. UserContact 백필 정책

백필 스크립트:

- `scripts/backfill-user-contacts.js`

실행 방식:

```bash
node scripts/backfill-user-contacts.js --dry-run
node scripts/backfill-user-contacts.js --apply
```

정책:

- 기본 실행은 dry-run입니다.
- `.env`, `.env.local`을 읽되, 쉘의 `DATABASE_URL`이 있으면 쉘 값을 우선합니다.
- `User.email`이 비어 있으면 skip합니다.
- 이메일은 `trim().toLowerCase()`로 정규화합니다.
- 같은 normalized email/contactHash가 여러 user에 걸쳐 있으면 자동 승자를 고르지 않고 모두 skip합니다.
- 이미 같은 user의 `UserContact`가 있으면 verified/reactivate/update만 수행합니다.
- 이미 다른 user가 같은 `type/contactHash`를 소유하면 skip하고 계속 진행합니다.
- 정상 대상은 `UserContact(type=EMAIL, verificationSource=KAKAO, verifiedAt=now, label="카카오 이메일")`로 생성/갱신합니다.
- 사용자에게 primary contact가 없으면 첫 verified contact를 `isPrimary=true`로 설정합니다.
- 기존 `Message.senderContactId IS NULL` 메시지는 sender의 primary verified contact로 backfill합니다.
- `senderContactSnapshot`에는 `{ type, maskedValue, contactHash, label }`만 저장합니다.
- 로그에는 raw 이메일을 출력하지 않고 masked email만 출력합니다.
- idempotent하게 설계해 여러 번 실행해도 중복 row를 만들지 않습니다.

---

## 9. 구현 시 주의 사항

## 9.1 token 원문 저장 금지

```txt
rawToken -> 사용자 URL에만 포함
hmacSha256(PUBLIC_TOKEN_PEPPER, rawToken) -> MessageAccessToken.tokenHash
```

## 9.2 수신거부 연락처 원문 저장 금지

```txt
email -> trim + lowercase -> HMAC-SHA256 -> ContactSuppression.contactHash
phone -> digits only -> HMAC-SHA256 -> ContactSuppression.contactHash
```

## 9.3 PUBLIC_TOKEN_PEPPER 유지

새 DB에서도 `PUBLIC_TOKEN_PEPPER`를 바꾸면 안 됩니다.

깨지는 것:

- 기존 공개 링크 조회
- 기존 수신거부 hash 매칭
- 기존/신규 OTP hash 정책 일관성

## 9.4 MODERATION_FAILED 공개 금지

`MODERATION_FAILED` 상태의 메시지는 안전 검사를 통과하지 않았으므로 다음을 금지합니다.

- publicUrl 발급
- `/arrival/[token]` 열람
- NotificationProcessor 알림 발송

## 9.5 Nginx 유지보수 fallback

`error_page 502 503 504 =503 /maeari-maintenance.html`은 maintenance window뿐 아니라 예기치 못한 upstream 장애에도 사용자에게 정적 점검 안내를 보여주기 위한 영구 설정입니다.

---

## 10. 향후 고도화

- 카카오 알림톡은 `NotificationLog.channel = KAKAO_ALIMTALK`에 provider만 추가합니다.
- SMS provider는 Solapi 외 provider dispatcher를 추가할 수 있습니다.
- 이메일 provider는 Gmail SMTP에서 SES/SendGrid/Resend로 교체할 수 있습니다.
- 수신거부 관리자 해제, abuse 대응, 연락처 기반 차단 정책을 추가할 수 있습니다.
- 친구 차단, 친구 초대 링크, 연락처 기반 추천을 추가할 수 있습니다.
- 대량 데이터 이전이 필요해지면 maintenance window 대신 read-only mode, dual-write, CDC 기반 이전을 검토합니다.
