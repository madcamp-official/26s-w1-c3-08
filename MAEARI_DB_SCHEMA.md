# 매아리 DB Schema 및 운영 DB 상태

## 0. 기준 파일과 현재 상태

실제 Prisma schema 기준 파일:

- `packages/database/prisma/schema.prisma`

현재 운영/개발 DB 기준:

- 현재 DB 이름: `maeari`
- 현재 DB 사용자: `maeari`
- 현재 적용된 최신 migration: `20260706150000_ocr_replies_qr_collections`
- Docker Postgres healthcheck 기준 DB/USER도 `maeari`로 전환 완료
- 2026-07-07 현재 주요 row count:
  - `User`: 6
  - `Message`: 34
  - `MessageRecipient`: 34
  - `MessageAccessToken`: 43
  - `NotificationLog`: 25
  - `ContactSuppression`: 1
  - `FriendRequest`: 1
  - `Friendship`: 1
  - `UserContact`: 5
  - `FriendInviteLink`: 0
  - `MessageAttachment`: 4
  - `MessageReply`: 1
  - `MessageCollection`: 0
  - `MessageCollectionSubmission`: 0

신규 DB 이전 결과:

- 새 DB 이름은 `maeari`로 사용합니다.
- 기존 DB `maeum_arrival`과 임시 `maeari_dryrun` DB는 final dump 검증 후 제거했습니다.
- final dump 백업은 `backups/maeum_arrival_final_20260706_090800.dump`로 보존합니다.
- 2026-07-07 기준 앱 환경변수와 PM2 프로세스는 `maeari` DB만 사용합니다.
- 기존 bootstrap role `maeum`은 Postgres system-required role이라 삭제할 수 없지만 `NOLOGIN` 상태이며, template DB owner는 `maeari`로 정리했습니다.
- `PUBLIC_TOKEN_PEPPER`는 반드시 기존 값 그대로 유지합니다. 공개 링크 token hash, 수신거부 contact hash, OTP hash 정책이 이 값에 의존합니다.
- 2026-07-07 Figma 기반 UI 리디자인은 presentation layer 변경이므로 DB migration을 추가하지 않습니다. 현재 schema 기준선은 그대로 `20260706150000_ocr_replies_qr_collections`입니다.

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
  -> IN_APP/Gmail SMTP/Solapi 발송 이력, 답장/마음나무 알림, retry, provider id

ContactSuppression
  -> EMAIL/SMS 수신거부 연락처 HMAC hash

MessageCollection / MessageCollectionSubmission
  -> 마음나무 공개 수집 링크와 비회원 제출 편지
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
├── contacts: UserContact[]
├── messageCollections: MessageCollection[]
└── targetNotifications: NotificationLog[]

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
├── recipient: MessageRecipient?
├── targetUser: User?
├── reply: MessageReply?
└── collection: MessageCollection?

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

MessageCollection
├── owner: User
├── submissions: MessageCollectionSubmission[]
└── notifications: NotificationLog[]

MessageCollectionSubmission
└── collection: MessageCollection
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
- `senderContactId`: 메시지 생성 시 서버가 직접 선택한 active verified strict PHONE `UserContact`
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

허용되는 첨부 형식은 `.jpg`, `.jpeg`, `.png`, `.webp`입니다. DB에는 브라우저 확장자 자체를 별도 enum으로 저장하지 않고, 검증을 통과한 MIME type을 `mimeType`에 저장합니다.

```txt
허용 MIME:
- image/jpeg
- image/png
- image/webp
```

서버 저장 전 검증 계층:

- multer `fileFilter`: MIME type과 original file name 확장자 검사
- validation schema: JSON data URL payload의 `fileName` 확장자 검사
- service 저장 직전: 파일 buffer magic bytes 검사
- OCR service: OCR 가능한 MIME type인지 재확인

주요 필드:

- `messageId`
- `publicUrl`
- `storageKey`
- `originalName`
- `mimeType`
- `sizeBytes`
- `ocrStatus`: `SKIPPED`, `EXTRACTED`, `FAILED`
- `ocrText`: OCR로 추출한 텍스트
- `ocrConfidence`: Tesseract confidence
- `ocrError`: OCR 실패/timeout/미지원 형식 사유
- `ocrCheckedAt`: OCR 확인 시각

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
- `senderReadAt`: 발신자가 답장을 읽은 시각
- `senderDeletedAt`: 발신자가 답장함에서 해당 답장을 숨긴 시각
- `notifiedAt`: `REPLY_RECEIVED` 알림 생성/발송 처리가 완료된 시각
- `hiddenAt`, `hiddenReason`

답장도 저장 전 AI moderation을 통과해야 합니다.

알림 정책:

- 답장이 생성되면 `message.reply.created` domain event가 발생합니다.
- `NotificationProcessor`는 발신자에게 `REPLY_RECEIVED` `IN_APP` notification을 생성합니다.
- 발신자에게 verified EMAIL 연락처가 있으면 이메일 알림도 생성합니다.
- 답장 알림 이메일에는 원문 메시지나 답장 본문을 넣지 않고 `/messages/:id` 링크만 포함합니다.
- `/sent` 답장함은 `senderReadAt`과 `senderDeletedAt`을 사용해 읽음/삭제 상태를 발신자 화면에만 반영합니다.

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
- `targetUserId`: 수신자 row가 없는 앱 내 알림, 답장 알림, 마음나무 알림의 대상 사용자
- `messageReplyId`: `REPLY_RECEIVED` 알림이 가리키는 답장
- `messageCollectionId`: `COLLECTION_DELIVERED` 알림이 가리키는 마음나무
- `eventType`: `MESSAGE_SENT`, `ARRIVAL_HINT`, `REPLY_RECEIVED`, `COLLECTION_DELIVERED`, `SYSTEM`
- `channel`: `IN_APP`, `KAKAO_ALIMTALK`, `SMS`, `EMAIL`
- `status`: `PENDING`, `SENT`, `FAILED`, `SKIPPED`
- `provider`: `in_app`, `gmail_smtp`, `solapi`, `contact_suppression` 등
- `idempotencyKey`: 같은 수신자/이벤트/channel 중복 발송 방지
- `attemptCount`
- `providerMessageId`: Gmail SMTP message id, Solapi message id 또는 group id
- `payload`
- `errorCode`, `errorMessage`
- `scheduledAt`, `nextRetryAt`, `attemptedAt`, `sentAt`

관계 정책:

- 일반 메시지 도착/힌트 알림은 `messageRecipientId`를 사용합니다.
- 앱 내 답장 알림은 `targetUserId`와 `messageReplyId`를 사용합니다.
- 마음나무 도착 알림은 `targetUserId`와 `messageCollectionId`를 사용합니다.
- 외부 provider 호출이 필요 없는 `IN_APP` 알림도 같은 테이블에 남겨 사용자 알림과 운영 통계를 한 곳에서 추적합니다.

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
- EMAIL은 trim + lowercase, SMS는 숫자만 남긴 국내 번호를 정규화한 뒤 `PUBLIC_TOKEN_PEPPER` HMAC hash로 저장합니다.

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

## 3.19 MessageCollection

`마음나무` 공개 수집 링크의 상위 단위입니다. 회원이 하나의 공개 링크를 만들고, 비회원이 그 링크에 편지를 남기면 지정한 도착 시점에 owner에게 일괄 공개됩니다.

주요 필드:

- `ownerId`: 마음나무를 만든 로그인 사용자
- `tokenHash`: raw token을 저장하지 않는 공개 링크 hash
- `tokenPreview`: 운영/화면 식별용 짧은 preview
- `title`, `description`: 마음나무 제목과 안내문
- `scheduledAt`: 제출물을 owner에게 공개할 시각
- `status`: `ACTIVE`, `DELIVERED`, `CANCELED`
- `deliveredAt`, `canceledAt`

정책:

- 생성자는 마음쓰기와 동일하게 verified strict PHONE이 필요합니다.
- raw token은 생성 응답의 `collectionUrl`에만 포함하고 DB에는 저장하지 않습니다.
- `scheduledAt`이 지나면 `deliverDueMessageCollections` job이 `DELIVERED`로 전환합니다.
- visible 제출물이 1개 이상 있으면 owner에게 `COLLECTION_DELIVERED` 앱 내 알림과 이메일 알림을 생성합니다.

## 3.20 MessageCollectionSubmission

비회원이 `/tree/[token]`에서 남긴 마음나무 제출물입니다.

주요 필드:

- `collectionId`: 소속 마음나무
- `senderDisplayName`: 비회원이 선택적으로 남긴 표시명
- `content`: 제출 텍스트
- `status`: `VISIBLE`, `BLOCKED`, `HIDDEN`, `DELETED`
- `moderationInputHash`, `moderationCategories`, `moderationFeedback`
- `ipHash`: 원본 IP 대신 `PUBLIC_TOKEN_PEPPER` HMAC hash
- `deliveredAt`, `ownerReadAt`
- `hiddenAt`, `hiddenReason`

정책:

- v1 마음나무 제출은 텍스트만 지원합니다.
- 제출 저장 전 기존 OpenAI moderation + 매아리 guardrail을 통과해야 합니다.
- 동일 IP hash는 collection당 시간당 5개 제출로 제한합니다.
- 도착 전 owner 화면에는 제출 개수만 노출하고, `DELIVERED` 이후에만 본문을 보여줍니다.

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
5. 첨부 이미지가 있으면 MIME/확장자/용량/매직바이트 검사
6. 첨부 이미지가 있으면 Tesseract OCR로 이미지 속 텍스트 추출
7. 제목/본문/감정 태그/첨부 OCR 텍스트를 합쳐 OpenAI moderation + guardrail 검사
8. 통과
9. Message.status = PENDING 생성
10. Message.senderContactId, senderContactSnapshot 저장
11. 단일 또는 그룹 수신자 수만큼 MessageRecipient 생성
12. 첨부 이미지가 있으면 MessageAttachment와 OCR 결과 저장
13. 수신자별 MessageAccessToken 생성
14. publicUrl/publicUrls 반환
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

첨부 OCR 실패/timeout도 미검증 콘텐츠가 수신자에게 전달되지 않도록 같은 `MODERATION_FAILED` 흐름을 사용합니다. retry job은 저장된 첨부 파일을 다시 읽어 OCR을 재시도한 뒤 moderation 입력을 재구성합니다.

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

## 5.9 익명 답장 알림과 답장함

```txt
1. /arrival/[token]에서 수신자가 답장 작성
2. 답장 content moderation 통과
3. MessageReply.status = VISIBLE 생성
4. message.reply.created event 발행
5. NotificationProcessor가 발신자 targetUserId로 REPLY_RECEIVED IN_APP NotificationLog 생성
6. 발신자의 verified EMAIL이 있으면 Gmail SMTP EMAIL NotificationLog 생성 및 발송
7. 답장 이메일에는 원문/답장 본문을 넣지 않고 /messages/:id 링크만 포함
8. /sent 답장함은 GET /api/messages/sent/replies로 읽음/삭제 가능한 답장 목록 표시
```

## 5.10 마음나무 도착 처리

```txt
1. 로그인 회원이 /tree에서 MessageCollection 생성
2. raw token은 /tree/[token] URL에만 포함하고 DB에는 tokenHash 저장
3. 비회원이 /tree/[token]에서 텍스트 편지 제출
4. IP hash rate limit 확인
5. 제출 content moderation 통과 시 MessageCollectionSubmission.VISIBLE 저장
6. scheduler가 ACTIVE AND scheduledAt <= now collection 조회
7. MessageCollection.status = DELIVERED, deliveredAt 기록
8. VISIBLE submission.deliveredAt 기록
9. 제출물이 있으면 owner에게 COLLECTION_DELIVERED IN_APP + EMAIL 알림 생성
10. owner는 /tree 상세에서 도착 후 제출 본문 열람
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

마음나무
  MessageCollection @@index([ownerId, status, scheduledAt])
  MessageCollection @@index([status, scheduledAt])
  MessageCollectionSubmission @@index([collectionId, status, createdAt])
  MessageCollectionSubmission @@index([collectionId, ipHash, createdAt])
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
- `maeum` bootstrap role은 system-required role이라 삭제 불가하지만 `NOLOGIN` 상태이며, template DB owner는 `maeari`로 정리 완료
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
- 친구 차단, 반복/다회성 초대 링크, 연락처 기반 추천을 추가할 수 있습니다.
- 대량 데이터 이전이 필요해지면 maintenance window 대신 read-only mode, dual-write, CDC 기반 이전을 검토합니다.

---

## 11. 2026-07-06 신규 스키마 반영

적용 migration:

- `20260706150000_ocr_replies_qr_collections`
- 2026-07-07 운영 `maeari` DB 기준 `prisma migrate status` 결과: `Database schema is up to date!`

### 11.1 이미지 OCR

- `AttachmentOcrStatus`
  - `SKIPPED`
  - `EXTRACTED`
  - `FAILED`
- `MessageAttachment` 추가 필드
  - `ocrStatus`
  - `ocrText`
  - `ocrConfidence`
  - `ocrError`
  - `ocrCheckedAt`

용도:

- 이미지 안의 글자를 `tesseract.js`로 OCR 추출해 기존 메시지 유해성 검사 입력에 포함합니다.
- API 구현은 `Tesseract.recognize(buffer, IMAGE_OCR_LANGUAGES, ...)`를 사용합니다.
- 기본 언어는 `kor+eng`이며, 운영 env로 timeout과 최대 OCR 텍스트 길이를 조절합니다.
- OCR 실패 시 메시지는 `MODERATION_FAILED`로 대기하고 retry job이 저장된 첨부 파일을 다시 OCR 검사합니다.
- OCR은 이미지 장면 자체가 아니라 이미지 내부 텍스트만 검사합니다.

OCR 관련 env:

```env
IMAGE_OCR_MODERATION_ENABLED=true
IMAGE_OCR_LANGUAGES=kor+eng
IMAGE_OCR_TIMEOUT_MS=8000
IMAGE_OCR_MAX_TEXT_CHARS=4000
```

첨부 형식 정책:

- 허용 확장자: `.jpg`, `.jpeg`, `.png`, `.webp`
- 허용 MIME: `image/jpeg`, `image/png`, `image/webp`
- GIF/HEIC/PDF/텍스트 파일은 업로드 단계에서 차단합니다.
- 확장자와 MIME type뿐 아니라 파일 header magic bytes까지 검사해 저장 전 최종 차단합니다.

### 11.2 답장 알림

- `NotificationEventType`
  - `REPLY_RECEIVED`
  - `COLLECTION_DELIVERED`
- `MessageReply` 추가 필드
  - `senderReadAt`
  - `senderDeletedAt`
  - `notifiedAt`
- `NotificationLog` 확장
  - `messageRecipientId`는 기존 메시지 도착 알림에서는 계속 사용하지만, 답장/마음나무 알림을 위해 optional로 변경되었습니다.
  - `targetUserId`, `messageReplyId`, `messageCollectionId`가 추가되어 수신자 row가 없는 앱/이메일 알림도 기록할 수 있습니다.

### 11.3 마음나무

- `MessageCollectionStatus`
  - `ACTIVE`
  - `DELIVERED`
  - `CANCELED`
- `MessageCollectionSubmissionStatus`
  - `VISIBLE`
  - `BLOCKED`
  - `HIDDEN`
  - `DELETED`
- `MessageCollection`
  - owner가 만든 공개 수집 링크입니다.
  - `tokenHash`만 저장하며 raw token은 응답 시점에만 제공합니다.
  - `scheduledAt`이 지나면 scheduler가 `DELIVERED`로 전환합니다.
- `MessageCollectionSubmission`
  - 비회원이 공개 링크에서 남긴 텍스트 편지입니다.
  - 원본 IP는 저장하지 않고 `PUBLIC_TOKEN_PEPPER` 기반 `ipHash`만 저장합니다.
  - 도착 전 owner 화면에는 개수만 보이고, 도착 후 내용이 공개됩니다.

### 11.4 연락처 인증 후 수신 연결

- 별도 테이블 추가 없이 `UserContact` 인증 성공 시 `MessageRecipient.receiverEmail` 또는 `receiverPhone`과 매칭합니다.
- 미연결 OTHER 수신자만 현재 user의 `receiverUserId`로 연결합니다.
- 활성 `MessageAccessToken.linkedUserId`도 함께 채워 받은 마음 보관함과 공개 링크 보관 흐름을 일관되게 유지합니다.

---

## 12. 현재 schema 운영 기준선

- DB 이름/사용자: `maeari`
- 최신 적용 migration: `20260706150000_ocr_replies_qr_collections`
- 앱 환경변수: `DATABASE_URL`은 `maeari` DB, `POSTGRES_DB=maeari`, `POSTGRES_USER=maeari` 기준입니다.
- 기존 DB: `maeum_arrival`, `maeari_dryrun`은 제거되었습니다.
- 기존 role: `maeum`은 Postgres bootstrap role이라 삭제할 수 없지만 `NOLOGIN` 상태이며, 앱 client connection은 0개입니다.
- template DB: `template0`, `template1` owner는 `maeari`로 정리했습니다.
- 주요 신규 테이블:
  - `MessageCollection`
  - `MessageCollectionSubmission`
- 주요 확장 테이블:
  - `MessageAttachment`: OCR 결과 필드
  - `MessageReply`: 발신자 읽음/삭제/알림 필드
  - `NotificationLog`: `targetUserId`, `messageReplyId`, `messageCollectionId`
- 기존 token/hash 정책:
  - 공개 링크 token은 raw token을 저장하지 않고 `tokenHash`만 저장합니다.
  - IP/연락처/수신거부/OTP 관련 hash는 `PUBLIC_TOKEN_PEPPER` 유지가 필수입니다.

---

## 13. 2026-07-07 UI 리디자인과 DB 영향

Figma 기반 UI 리디자인은 `apps/web`의 layout, style, component composition 변경입니다. Prisma schema, migration, API response shape는 변경하지 않습니다.

영향 없음으로 확인한 영역:

- `Message`, `MessageRecipient`, `MessageAccessToken` 생성/조회 payload shape
- `UserContact`, `PhoneVerificationAttempt`, `PhoneVerificationLock`, `PhoneNumberLookupCache` 기반 전화번호 인증과 마음쓰기 권한 정책
- `MessageAttachment`의 OCR 결과 필드와 파일 metadata
- `MessageReply`의 답장함 읽음/삭제/알림 필드
- `NotificationLog`의 message/reply/collection notification 기록
- `MessageCollection`, `MessageCollectionSubmission` 마음나무 공개 수집 schema
- `ContactSuppression` 기반 이메일/SMS 수신거부와 재구독 정책

UI가 새로 읽거나 강조해서 보여주는 DB 흐름:

- 홈 대시보드 `/`
  - `/messages/sent`를 통해 `Message.status = PENDING`인 보낸 마음을 가까운 `scheduledAt` 순으로 보여줍니다.
  - `/messages/received`를 통해 현재 사용자에게 귀속된 최근 `MessageRecipient`를 보여줍니다.
  - 데이터가 없거나 아직 로딩 중인 경우 DB row를 만들지 않고 frontend fallback card만 표시합니다.
- AppShell
  - `/me` API로 현재 사용자 nickname/admin 여부만 조회합니다.
  - navigation, sidebar 이미지, 오늘의 한 줄은 DB에 저장하지 않는 presentation layer입니다.
- 목록/상세 화면
  - `StatusPill`, `EmotionPill`, `LetterThumb` 등은 기존 enum/string 값을 UI label과 thumbnail로 변환할 뿐 DB 값을 변경하지 않습니다.
- QR 공유
  - `QrShare`는 기존 `MessageAccessToken` 또는 `MessageCollection.tokenHash`에서 생성된 공개 URL을 클라이언트에서 QR로 렌더링합니다.
  - QR 이미지는 DB에 저장하지 않습니다.
- Figma asset
  - `maeari-hero-floral.png`, `maeari-sidebar-sky.png`, `maeari-card-letter.png` 등은 `apps/web/public/images` 정적 asset입니다.
  - asset 선택은 DB migration 대상이 아닙니다.

따라서 2026-07-07 UI 리디자인 이후에도 schema 기준선은 계속 `20260706150000_ocr_replies_qr_collections`입니다. UI 리디자인 배포에는 새 Prisma migration이 필요하지 않습니다. 필요한 검증은 `pnpm --filter @maeari/web typecheck`, `pnpm --filter @maeari/web build`, 주요 route 수동 smoke test입니다. 새로운 migration이 필요한 경우는 UI-only 변경이 아니라 새 상태, 새 relation, 새 감사 로그, 새 provider 식별자처럼 서버 데이터 계약이 추가될 때입니다.

변경 없음:

- `User`, `Message`, `MessageRecipient`, `MessageAccessToken`
- `NotificationLog`, `ContactSuppression`
- `UserContact`, `UserContactVerification`
- `PhoneVerificationAttempt`, `PhoneVerificationLock`, `PhoneNumberLookupCache`
- `MessageAttachment`, `MessageReply`
- `MessageCollection`, `MessageCollectionSubmission`

UI가 읽는 주요 DB-backed 상태:

| 화면 | DB-backed 상태 | 비고 |
| --- | --- | --- |
| `/` | `Message`, `MessageRecipient` | 최근 마음, 곧 도착할 마음, quick card 진입 |
| `/write` | `UserContact.writerEligibility`, `Friendship`, `MessageRecipient` | 발신 연락처 raw 값은 노출하지 않고 verified strict PHONE 여부만 사용 |
| `/sent` | `Message.senderDeletedAt`, `MessageReply.senderReadAt`, `MessageReply.senderDeletedAt` | 보낸 마음과 답장함 탭 |
| `/inbox` | `MessageRecipient.receiverDeletedAt`, `receiverArchivedAt` | 받은 마음 목록, 아카이브/삭제 |
| `/arrival/[token]` | `MessageAccessToken`, `MessageRecipient`, `ContactSuppression` | 공개 링크 열람, 답장, 신고, 수신거부/재구독 |
| `/friends` | `FriendRequest`, `Friendship`, `FriendInviteLink` | 친구 요청과 초대 링크 |
| `/my` | `UserContact`, `UserContactVerification` | 전화번호 인증 상태와 이메일 연결용 인증 |
| `/tree` | `MessageCollection`, `MessageCollectionSubmission` | 마음나무 생성, QR 공유, 제출물 공개 |
| `/admin` | `ModerationLog`, `NotificationLog`, `MessageReport` | 운영 통계와 검수 |

프론트엔드 리디자인에서 지켜야 할 DB 관련 원칙:

- `senderContactId`는 여전히 프론트에서 신뢰하지 않습니다. `/write` UI에서 보내지 않으며, 악의적으로 보내도 서버가 무시합니다.
- QR은 `MessageAccessToken` 또는 `MessageCollection.tokenHash`가 보호하는 기존 URL을 시각화할 뿐 DB에 별도 QR 값을 저장하지 않습니다.
- 이미지 첨부 allowlist는 validation 정책이며 schema enum을 추가하지 않습니다. 실제 파일 type은 `MessageAttachment.mimeType` 문자열과 저장 전 magic bytes 검사로 관리합니다.
- UI에서 발신자/수신자 삭제를 눌러도 이미 도착한 메시지는 감사 추적을 위해 soft delete 필드를 사용합니다.
- Figma 화면에 없는 신규 상태가 필요해 보이더라도, 먼저 기존 enum/status로 표현 가능한지 확인한 뒤 schema migration을 결정합니다.

---

## 14. 2026-07-07 코드 수정과 DB 영향 상세

최근 반영된 UI 리디자인, 첨부 형식 제한, OCR 운영 보강은 대부분 application layer 변경입니다. 현재 기준으로 새 Prisma migration이 필요한 변경과 필요하지 않은 변경을 아래처럼 구분합니다.

## 14.1 Migration이 이미 반영된 영역

`20260706150000_ocr_replies_qr_collections`까지의 migration으로 다음 schema 변경은 이미 운영 `maeari` DB에 들어가 있습니다.

| 영역 | DB 반영 내용 | 사용하는 기능 |
| --- | --- | --- |
| 이미지 OCR | `MessageAttachment.ocrStatus`, `ocrText`, `ocrConfidence`, `ocrError`, `ocrCheckedAt` | 첨부 이미지 텍스트 추출과 moderation retry |
| 답장함 | `MessageReply.senderReadAt`, `senderDeletedAt`, `notifiedAt` | `/sent` 답장함 읽음/삭제, 답장 알림 처리 |
| 알림 확장 | `NotificationLog.targetUserId`, `messageReplyId`, `messageCollectionId` | 답장 알림, 마음나무 도착 알림, 수신자 row 없는 앱 내 알림 |
| 마음나무 | `MessageCollection`, `MessageCollectionSubmission` | 공개 수집 링크, 비회원 제출, scheduled delivery |
| 전화번호 인증 방어 | `PhoneVerificationAttempt`, `PhoneVerificationLock`, `PhoneNumberLookupCache` | strict 010 인증, Lookup cache, IP/contact lock |
| 발신 연락처 snapshot | `Message.senderContactId`, `senderContactSnapshot` | 마음쓰기 권한 검증과 생성 시점 인증 기록 |
| 수신거부 | `ContactSuppression` | EMAIL/SMS 알림 수신거부와 재구독 |

## 14.2 Migration이 필요 없는 영역

다음 변경은 schema를 바꾸지 않습니다.

| 변경 | DB 영향 없음인 이유 |
| --- | --- |
| Figma 기반 UI 리디자인 | route와 API contract는 그대로이고, `apps/web` layout/style/component composition만 변경 |
| `figma-panel`, `maeari-action`, `maeari-chip` 등 CSS class 추가 | 정적 CSS와 JSX className 변경이며 DB row/column 없음 |
| AppShell sidebar/topbar/mobile bottom nav | 사용자 navigation presentation이며 저장 상태 없음 |
| 홈 dashboard 실제 데이터 표시 | 기존 `/messages/sent`, `/messages/received` API 결과를 읽어 화면에 재배치 |
| QR 표시 디자인 변경 | 기존 공개 URL을 client에서 QR로 렌더링하며 QR binary나 URL을 DB에 따로 저장하지 않음 |
| 첨부 허용 확장자를 `.jpg/.jpeg/.png/.webp`로 제한 | validation 정책이며 `MessageAttachment.mimeType` 문자열에 통과한 MIME만 저장 |
| Next standalone static asset copy | build/deploy 절차이며 schema와 무관 |
| mobile H1 줄바꿈, grid clipping 수정 | CSS/layout 안정화이며 schema와 무관 |

## 14.3 첨부 allowlist와 DB 저장 값

첨부 형식 제한은 다음 흐름으로 DB 저장 전에 끝납니다.

```txt
Frontend file input
  -> accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"

Frontend validation
  -> file.type in image/jpeg | image/png | image/webp
  -> file.name endsWith .jpg | .jpeg | .png | .webp

API multer middleware
  -> MIME allowlist
  -> originalname extension allowlist
  -> count/size/total size limit

Message service
  -> magic bytes 검사
  -> 통과 시 uploads/messages/{messageId} 저장
  -> MessageAttachment row 생성
```

DB에 저장되는 값:

- `originalName`: 사용자가 올린 원래 파일명
- `mimeType`: 검증 통과 MIME. 현재 허용값은 `image/jpeg`, `image/png`, `image/webp`
- `sizeBytes`: 파일 크기
- `storageKey`: 서버 저장 경로 key
- `publicUrl`: `/api/uploads/*` 공개 경로
- `ocrStatus`와 OCR 결과 필드

DB에 저장하지 않는 값:

- 별도 extension enum
- raw file buffer
- OCR provider raw response 전문
- 이미지 장면 자체에 대한 vision 분석 결과

따라서 허용 형식이 바뀌면 우선 validation 상수를 고치고, `mimeType`을 enum처럼 강제하고 싶을 때만 Prisma schema 변경을 검토합니다.

## 14.4 UI가 읽는 상태와 쓰는 상태 분리

새 UI는 기존 DB-backed 상태를 더 많이 보여주지만, 표시 목적의 값은 DB에 만들지 않습니다.

```txt
Display-only
├── sidebar 오늘의 한 줄
├── card thumbnail asset 선택
├── status/emotion pill 색상
├── QR canvas/image download
├── dashboard fallback card
└── mobile bottom nav active state

Persisted
├── Message.status
├── Message.senderDeletedAt
├── MessageRecipient.deliveryStatus
├── MessageRecipient.receiverArchivedAt
├── MessageRecipient.receiverDeletedAt
├── MessageReply.senderReadAt
├── MessageReply.senderDeletedAt
├── ContactSuppression row
├── NotificationLog status/provider/error
├── MessageCollection.status
└── MessageCollectionSubmission.status
```

이 구분을 유지하면 Figma 화면 조정, 문구 변경, CTA 위치 변경이 DB migration으로 번지는 일을 막을 수 있습니다.

## 14.5 운영 검증 SQL

UI와 application layer 변경 후 DB 상태를 확인할 때는 row count보다 “상태가 꼬이지 않았는지”를 우선 봅니다.

```sql
-- 최신 migration 확인
SELECT migration_name, finished_at
FROM "_prisma_migrations"
ORDER BY finished_at DESC
LIMIT 5;

-- 첨부 MIME allowlist 밖 값이 저장됐는지 확인
SELECT "mimeType", count(*)
FROM "MessageAttachment"
GROUP BY "mimeType";

-- OCR 실패/대기 상태 확인
SELECT "ocrStatus", count(*)
FROM "MessageAttachment"
GROUP BY "ocrStatus";

-- 답장함에서 발신자 삭제 처리된 답장 확인
SELECT count(*)
FROM "MessageReply"
WHERE "senderDeletedAt" IS NOT NULL;

-- 마음나무 상태 분포 확인
SELECT status, count(*)
FROM "MessageCollection"
GROUP BY status;

-- 외부 알림 실패/수신거부 상태 확인
SELECT status, "errorCode", count(*)
FROM "NotificationLog"
GROUP BY status, "errorCode"
ORDER BY count(*) DESC;
```

이 SQL은 raw token, raw IP, raw OTP, 수신거부 원본 연락처를 노출하지 않습니다.

## 15. 2026-07-07 최종 DB 동기화 메모

이 섹션은 현재 코드 수정이 DB에 어떤 영향을 주는지 최종 확인하기 위한 운영 메모입니다.

## 15.1 현재 최신 migration 기준

현재 schema 기준선은 다음 migration까지입니다.

```txt
20260706150000_ocr_replies_qr_collections
```

이 migration까지 포함된 주요 변경:

- `MessageAttachment` OCR 필드
- `NotificationEventType.REPLY_RECEIVED`
- `NotificationEventType.COLLECTION_DELIVERED`
- `NotificationLog.targetUserId`
- `NotificationLog.messageReplyId`
- `NotificationLog.messageCollectionId`
- `MessageReply.senderReadAt`
- `MessageReply.senderDeletedAt`
- `MessageReply.notifiedAt`
- `MessageCollection`
- `MessageCollectionSubmission`

Figma UI 리디자인은 DB migration을 추가하지 않습니다. UI에서 쓰는 hero 이미지, sidebar 문구, QR canvas, status pill 색상, mobile bottom nav active state는 모두 표시 전용 상태입니다.

## 15.2 DB에 저장되는 값과 저장하지 않는 값

| 영역 | 저장하는 값 | 저장하지 않는 값 |
| --- | --- | --- |
| 공개 링크 | `tokenHash`, `tokenPreview`, 열람/귀속 시각 | raw token |
| 수신거부 | channel, `contactHash`, source recipient, reason | raw email, raw phone |
| PHONE abuse defense | `ipHash`, `contactHash`, lock scope, reason, expires | raw IP, raw phone, Twilio raw response |
| OTP | `codeHash`, 만료, 시도 횟수 | raw 6자리 code |
| 첨부 | public URL, storage key, MIME, size, OCR result | raw buffer, extension enum, Vision 분석 결과 |
| 답장 알림 | `MessageReply`, `NotificationLog` target/reply 관계 | 이메일 본문에 원문/답장 내용 |
| 마음나무 | collection token hash, 제출 본문, 제출 IP hash | collection raw token, raw IP |
| UI 리디자인 | 없음 | panel 색상, 카드 이미지 선택, QR bitmap |

## 15.3 첨부 allowlist와 DB 정합성

첨부 허용 정책은 DB enum이 아니라 application validation으로 강제합니다.

```txt
허용 확장자:
- .jpg
- .jpeg
- .png
- .webp

허용 MIME:
- image/jpeg
- image/png
- image/webp
```

DB에는 검증을 통과한 `mimeType` 문자열이 저장됩니다. 운영 중 아래 쿼리로 allowlist 밖 값이 저장됐는지 확인할 수 있습니다.

```sql
SELECT "mimeType", count(*)
FROM "MessageAttachment"
GROUP BY "mimeType"
ORDER BY "mimeType";
```

allowlist 밖 MIME이 보인다면 API validation 또는 이전 데이터 유입 경로를 먼저 확인합니다. 현재 web 기본 경로는 multipart form-data이며, service는 저장 직전 magic bytes를 다시 검사합니다.

## 15.4 메시지 상태와 알림 상태 정합성

외부 발송이 suppression 또는 provider 미설정으로 실패한 경우에도 앱이 “도착 완료”처럼 보이면 안 됩니다. 현재 정합성 정책은 다음과 같습니다.

```txt
MessageRecipient.deliveryStatus
├── WAITING: 아직 도착 처리 전
├── SENT: 수신자가 열람 가능한 상태
├── FAILED: 해당 수신자에게 도착 불가
└── CANCELED: 메시지 취소

Message.status
├── 하나 이상의 recipient가 SENT이면 SENT 유지
├── 모든 recipient가 FAILED/CANCELED이고 retry 가능한 NotificationLog가 없으면 FAILED
└── 모든 실패 원인이 CONTACT_SUPPRESSED이면 failureReason = CONTACT_SUPPRESSED
```

공개 링크 열람은 `Message.status = SENT`만 보지 않고, 해당 token의 `MessageRecipient.deliveryStatus = SENT`도 함께 확인해야 합니다.

## 15.5 연락처 인증 후 과거 OTHER 수신 연결

이메일/전화번호 인증 성공 후 과거 비회원 수신 메시지 연결은 `MessageRecipient`와 `MessageAccessToken`을 갱신합니다.

```txt
verify contact success
├── normalize contact
├── hash contact
├── receiverEmail 또는 receiverPhone matching
├── receiverUserId 비어 있거나 현재 user인 row만 갱신
├── 다른 user에게 연결된 row는 건드리지 않음
├── active access token linkedUserId 갱신
└── 내부 받은 마음에 표시 가능
```

EMAIL suppression은 외부 이메일 알림만 막습니다. 이미 인증된 사용자에게 앱 내 받은 마음으로 연결되는 흐름은 유지합니다.

## 15.6 신규 DB 전환 이후 운영 기준

- 운영 DB 이름은 `maeari`입니다.
- 운영 DB user도 `maeari`입니다.
- 기존 MVP DB 이름 `maeum_arrival`은 더 이상 앱 연결에 사용하지 않습니다.
- final dump는 rollback용으로 보존합니다.
- `PUBLIC_TOKEN_PEPPER`는 절대 교체하지 않습니다.
- schema 변경 후에는 `pnpm db:validate`, `pnpm db:deploy`, `prisma migrate status`를 새 `DATABASE_URL` 기준으로 확인합니다.

운영 검증 예시:

```bash
DATABASE_URL="$DATABASE_URL" pnpm db:validate
DATABASE_URL="$DATABASE_URL" pnpm prisma migrate status --schema packages/database/prisma/schema.prisma
```

서비스 smoke check:

```bash
curl -I https://maeari.madcamp-kaist.org/
curl -I https://maeari.madcamp-kaist.org/api/health
```

## 16. 2026-07-07 최신 코드 변경과 DB 영향 정리

이 섹션은 지금까지의 코드 변경이 DB schema와 운영 데이터에 어떤 의미를 갖는지 최종적으로 정리합니다. 핵심은 **OCR/답장함/마음나무는 migration이 들어간 기능이고, Figma UI 리디자인과 첨부 allowlist 세부 조정은 application layer 변경**이라는 점입니다.

## 16.1 현재 DB 기준선

현재 Prisma schema 기준선:

```txt
packages/database/prisma/schema.prisma
└── latest migration: 20260706150000_ocr_replies_qr_collections
```

운영 기준:

```txt
DATABASE_URL -> maeari DB
POSTGRES_DB -> maeari
POSTGRES_USER -> maeari
old DB maeum_arrival -> removed after final dump
dry-run DB maeari_dryrun -> removed after validation
```

현재 최신 migration에 포함된 영역:

| 영역 | DB 변경 |
| --- | --- |
| 이미지 OCR | `AttachmentOcrStatus`, `MessageAttachment.ocrStatus`, `ocrText`, `ocrConfidence`, `ocrError`, `ocrCheckedAt` |
| 답장함 | `MessageReply.senderReadAt`, `senderDeletedAt`, `notifiedAt` |
| 답장 알림 | `NotificationEventType.REPLY_RECEIVED`, `NotificationLog.messageReplyId`, `targetUserId` |
| 마음나무 | `MessageCollectionStatus`, `MessageCollectionSubmissionStatus`, `MessageCollection`, `MessageCollectionSubmission` |
| 마음나무 알림 | `NotificationEventType.COLLECTION_DELIVERED`, `NotificationLog.messageCollectionId` |
| 전화번호 인증 방어 | `PhoneVerificationAttempt`, `PhoneVerificationLock`, `PhoneNumberLookupCache` |
| 수신거부 | `ContactSuppression` |

## 16.2 DB migration이 필요 없는 최신 변경

아래 변경은 DB schema를 추가로 바꾸지 않습니다.

| 변경 | 이유 |
| --- | --- |
| Figma 기반 UI 리디자인 | JSX/CSS/component composition 변경입니다. DB-backed state는 그대로 읽습니다. |
| palette/token 변경 | `globals.css`, className, component prop 수준입니다. |
| AppShell/sidebar/mobile bottom nav | route navigation 표시 변경입니다. |
| QR 표시 | 기존 `publicUrl`/`collectionUrl`을 client에서 QR canvas로 렌더링합니다. QR bitmap은 DB에 저장하지 않습니다. |
| 첨부 확장자 `.jpg/.jpeg/.png/.webp` 제한 | application validation 정책입니다. DB에는 검증 통과 MIME string만 저장합니다. |
| web multipart UI 개선 | 요청 encoding 변경이며, DB row 구조는 `MessageAttachment` 그대로입니다. |
| standalone static asset 복사 | 배포/빌드 절차입니다. |

## 16.3 첨부 이미지 DB 저장 정책

이미지 첨부는 DB에 raw file buffer를 저장하지 않습니다.

```txt
MessageAttachment
├── id
├── messageId
├── storageKey
├── publicUrl
├── originalName
├── mimeType
├── sizeBytes
├── ocrStatus
├── ocrText
├── ocrConfidence
├── ocrError
├── ocrCheckedAt
└── createdAt
```

저장되는 값:

- storage key
- public URL
- 원본 파일명
- 검증 통과 MIME
- byte size
- OCR status/result

저장하지 않는 값:

- 이미지 raw buffer
- 사용자가 제출한 data URL 원문
- OCR provider raw response 전문
- Vision model 분석 결과
- 별도 extension enum

현재 application allowlist:

```txt
allowed extensions
├── .jpg
├── .jpeg
├── .png
└── .webp

allowed MIME
├── image/jpeg
├── image/png
└── image/webp
```

정합성 확인 SQL:

```sql
SELECT "mimeType", count(*)
FROM "MessageAttachment"
GROUP BY "mimeType"
ORDER BY "mimeType";
```

allowlist 밖 MIME이 보이면 다음 순서로 확인합니다.

1. 이전 데이터인지 확인
2. `message-upload.middleware.ts`의 multer `fileFilter` 확인
3. `message.validation.ts`의 attachment schema 확인
4. `message.service.ts`의 magic bytes 검사 확인
5. web에서 multipart가 아닌 legacy JSON data URL 경로로 들어온 요청 여부 확인

## 16.4 OCR과 moderation 상태 정합성

OCR은 메시지 저장 전 또는 moderation retry에서 실행됩니다.

```txt
create message with attachments
├── attachment validation
├── OCR
│   ├── PASSED: text/confidence 저장
│   ├── SKIPPED: OCR disabled or no text 대상
│   └── FAILED: error 저장
├── moderation input = title + content + emotion + OCR text
├── moderation allowed
│   └── Message.status = PENDING
├── moderation blocked
│   └── Message.status = BLOCKED
└── moderation unavailable or OCR failed
    └── Message.status = MODERATION_FAILED
```

운영 확인 SQL:

```sql
SELECT "ocrStatus", count(*)
FROM "MessageAttachment"
GROUP BY "ocrStatus";

SELECT status, "moderationFailureReason", count(*)
FROM "Message"
GROUP BY status, "moderationFailureReason"
ORDER BY count(*) DESC;
```

OCR 실패 메시지는 공개 링크로 열람 가능해지면 안 됩니다. 공개 링크 조회는 message status와 recipient delivery status를 모두 확인해야 합니다.

## 16.5 답장함과 NotificationLog 관계

익명 답장은 `MessageReply`에 저장되고, 발신자 알림은 `NotificationLog`에 남습니다.

```txt
MessageReply
├── messageId
├── recipientId
├── content
├── isAnonymous
├── status
├── senderReadAt
├── senderDeletedAt
└── notifiedAt

NotificationLog
├── eventType = REPLY_RECEIVED
├── targetUserId = original message sender
├── messageReplyId = reply id
├── channel = IN_APP or EMAIL
└── provider = in_app or gmail_smtp
```

정책:

- 답장함 삭제는 `MessageReply.senderDeletedAt`으로 발신자 화면에서만 숨깁니다.
- 답장 본문은 이메일 알림에 포함하지 않습니다.
- 발신자에게 verified EMAIL이 없으면 IN_APP만 생성합니다.
- `notifiedAt`은 답장 알림 처리 완료 여부를 판단하는 marker입니다.

운영 확인 SQL:

```sql
SELECT count(*)
FROM "MessageReply"
WHERE "senderDeletedAt" IS NULL;

SELECT "eventType", channel, status, count(*)
FROM "NotificationLog"
WHERE "eventType" = 'REPLY_RECEIVED'
GROUP BY "eventType", channel, status;
```

## 16.6 마음나무 데이터 모델과 공개 링크

마음나무는 일반 `Message`가 아니라 별도 collection 모델을 사용합니다.

```txt
MessageCollection
├── ownerId
├── tokenHash
├── tokenPreview
├── title
├── description
├── scheduledAt
├── status
├── deliveredAt
└── canceledAt

MessageCollectionSubmission
├── collectionId
├── senderDisplayName
├── content
├── status
├── moderationInputHash
├── moderationCategories
├── moderationFeedback
├── ipHash
├── deliveredAt
└── ownerReadAt
```

저장하지 않는 값:

- 마음나무 raw token
- 비회원 제출자의 raw IP
- 제출자 연락처
- 첨부 파일

운영 확인 SQL:

```sql
SELECT status, count(*)
FROM "MessageCollection"
GROUP BY status;

SELECT status, count(*)
FROM "MessageCollectionSubmission"
GROUP BY status;
```

## 16.7 연락처 인증 후 과거 OTHER 수신 연결

연락처 인증 성공 시 과거 비회원 수신 메시지를 연결합니다.

```txt
verify UserContact
├── EMAIL
│   ├── normalize email
│   ├── hash contact
│   └── match MessageRecipient.receiverEmail
└── PHONE
    ├── normalize phone
    ├── hash contact
    └── match MessageRecipient.receiverPhone
```

갱신 대상:

- `MessageRecipient.receiverUserId`
- active `MessageAccessToken.linkedUserId`
- 내부 받은 마음 노출 상태

건드리지 않는 대상:

- 다른 user에게 이미 연결된 수신자
- 취소/차단되어 복구하면 안 되는 메시지
- raw 공개 token
- 기존 메시지의 `senderContactSnapshot`

EMAIL suppression은 외부 이메일 알림만 막습니다. 인증된 회원에게 앱 내 받은 마음으로 연결되는 것은 suppression과 별개입니다.

## 16.8 UI 리디자인과 DB state mapping

새 UI는 DB state를 새 방식으로 보여주지만, 표시 목적의 새 column을 만들지 않습니다.

| UI 요소 | 원천 데이터 |
| --- | --- |
| 메시지 상태 badge | `Message.status`, `MessageRecipient.deliveryStatus` |
| 감정 pill | `Message.emotionTag`, `customEmotionTag` |
| 받은 마음 읽음 상태 | `MessageRecipient.readAt` |
| 받은 마음 보관 상태 | `MessageRecipient.receiverArchivedAt` |
| 받은 마음 삭제 상태 | `MessageRecipient.receiverDeletedAt` |
| 보낸 마음 숨김 | `Message.senderDeletedAt` |
| 답장함 읽음 | `MessageReply.senderReadAt` |
| 답장함 삭제 | `MessageReply.senderDeletedAt` |
| EMAIL/SMS 수신거부 상태 | `ContactSuppression.channel + contactHash` |
| PHONE 작성 권한 | active verified strict `UserContact(type=PHONE)` |
| 마음나무 도착 상태 | `MessageCollection.status`, `deliveredAt` |
| QR | DB 저장값이 아니라 `publicUrl` 또는 `collectionUrl` client rendering |

이 mapping을 유지하면 UI를 다시 조정해도 DB migration 없이 안전하게 변경할 수 있습니다.

## 16.9 신규 DB 운영 시 주의사항

- 새 DB에서도 `PUBLIC_TOKEN_PEPPER`를 바꾸면 기존 공개 링크, 연락처 hash, 수신거부, OTP 검증이 깨질 수 있습니다.
- `maeum_arrival`이라는 이전 DB 이름을 앱 env에 다시 넣지 않습니다.
- DB dump는 민감 데이터이므로 `backups/`는 git에 올리지 않습니다.
- migration 적용 전에는 `pnpm db:validate`를 먼저 실행합니다.
- schema drift 확인은 실제 운영 `DATABASE_URL` 기준으로 수행합니다.

검증 명령:

```bash
DATABASE_URL="$DATABASE_URL" pnpm db:validate
DATABASE_URL="$DATABASE_URL" pnpm prisma migrate status --schema packages/database/prisma/schema.prisma
```

최종 smoke check:

```bash
curl -I https://maeari.madcamp-kaist.org/api/health
curl -I https://maeari.madcamp-kaist.org/
```

## 17. 2026-07-07 최종 Schema 동기화

이 장은 현재 코드가 기대하는 DB 구조와 UI-only 변경을 분리해 기록합니다. 최신 UI 리디자인은 DB schema를 바꾸지 않지만, OCR/답장/마음나무/전화번호 guard 기능은 이미 Prisma schema와 migration에 반영되어 있습니다.

## 17.1 현재 기준선

```txt
Database name: maeari
Latest migration: 20260706150000_ocr_replies_qr_collections
Prisma schema: packages/database/prisma/schema.prisma
Generated client: packages/database/generated/client
```

운영 기준:

- `.env.local` 또는 production env의 `DATABASE_URL`은 `maeari` DB를 가리켜야 합니다.
- 이전 MVP 이름인 `maeum_arrival` 또는 `maeum` user를 새 운영 env에 다시 넣지 않습니다.
- `PUBLIC_TOKEN_PEPPER`는 기존 hash/token 계열 데이터와 연결되므로 임의 변경하지 않습니다.

## 17.2 최신 enum 목록과 사용처

| Enum | 값 | 사용처 |
| --- | --- | --- |
| `MessageStatus` | `PENDING`, `SENT`, `FAILED`, `BLOCKED`, `MODERATION_FAILED`, `CANCELED` | 메시지 전체 lifecycle |
| `RecipientDeliveryStatus` | `WAITING`, `SENT`, `FAILED`, `CANCELED` | 수신자별 도착 상태 |
| `AttachmentOcrStatus` | `SKIPPED`, `EXTRACTED`, `FAILED` | 첨부 이미지 OCR 상태 |
| `NotificationChannel` | `IN_APP`, `KAKAO_ALIMTALK`, `SMS`, `EMAIL` | 알림 채널 |
| `NotificationEventType` | `MESSAGE_SENT`, `ARRIVAL_HINT`, `REPLY_RECEIVED`, `COLLECTION_DELIVERED`, `SYSTEM` | 알림 event type |
| `NotificationStatus` | `PENDING`, `SENT`, `FAILED`, `SKIPPED` | provider 발송 상태 |
| `UserContactType` | `EMAIL`, `PHONE` | 인증 연락처 유형 |
| `UserContactVerificationStatus` | `PENDING`, `VERIFIED`, `EXPIRED` | OTP 검증 상태 |
| `PhoneVerificationAttemptStatus` | `REQUESTED`, `SENT`, `BLOCKED`, `SEND_FAILED` | 전화번호 인증 요청 이력 |
| `PhoneVerificationLockScope` | `IP`, `CONTACT` | rate limit lock scope |
| `MessageReplyStatus` | `VISIBLE`, `HIDDEN`, `DELETED` | 답장 공개/관리자 상태 |
| `MessageCollectionStatus` | `ACTIVE`, `DELIVERED`, `CANCELED` | 마음나무 lifecycle |
| `MessageCollectionSubmissionStatus` | `VISIBLE`, `BLOCKED`, `HIDDEN`, `DELETED` | 마음나무 제출물 상태 |

## 17.3 핵심 모델별 최신 의미

### UserContact

`UserContact`는 로그인 계정이 소유한 인증 연락처입니다.

```txt
UserContact
├── type = PHONE
│   ├── 마음쓰기 권한
│   ├── strict 010 인증 필요
│   ├── verified PHONE 직접 삭제 불가
│   └── 새 번호 인증 성공 시 기존 번호 retire
└── type = EMAIL
    ├── 이메일 OTP 또는 Kakao email 기반 verified
    ├── 비회원 이메일 수신 메시지 연결
    └── 마음쓰기 권한은 부여하지 않음
```

주의:

- `value`에는 정규화된 연락처가 저장됩니다. 새 abuse-defense 테이블에는 raw 연락처를 저장하지 않습니다.
- `contactHash`는 `PUBLIC_TOKEN_PEPPER` 기반 HMAC입니다.
- `@@unique([type, contactHash])` 때문에 같은 연락처는 여러 계정에 동시에 active ownership될 수 없습니다.

### PhoneVerificationAttempt / PhoneVerificationLock / PhoneNumberLookupCache

전화번호 abuse-defense 전용 테이블입니다.

```txt
PhoneVerificationAttempt
├── userId?
├── ipHash
├── contactHash
├── status
├── reason
└── createdAt
```

```txt
PhoneVerificationLock
├── scope = IP | CONTACT
├── scopeHash
├── reason
└── lockedUntil
```

```txt
PhoneNumberLookupCache
├── provider = TWILIO
├── contactHash
├── valid
├── lineType
├── carrierName?
├── allowed
├── reason?
├── checkedAt
└── expiresAt
```

저장 금지:

- raw IP
- raw 전화번호
- Twilio raw response 전문

### Message / MessageRecipient

메시지 생성 시 `Message.senderContactId`와 `senderContactSnapshot`은 서버가 선택한 verified PHONE 기준으로 기록됩니다. 사용자가 이후 전화번호를 변경해도 기존 메시지 snapshot은 수정하지 않습니다.

`MessageRecipient`는 수신자별 상태를 유지합니다. OTHER 이메일/전화번호가 연락처 인증 후 기존 회원과 연결되면 `receiverUserId`가 채워질 수 있지만, `receiverType=OTHER`와 원래 `receiverEmail`/`receiverPhone`은 유지됩니다.

### MessageAttachment

현재 첨부 저장 정책:

```txt
allowed mimeType
├── image/jpeg
├── image/png
└── image/webp
```

OCR 관련 필드:

- `ocrStatus`
- `ocrText`
- `ocrConfidence`
- `ocrError`
- `ocrCheckedAt`

`ocrText`는 안전 검사와 운영 확인을 위한 텍스트입니다. OCR이 실패하면 `ocrStatus=FAILED`가 기록되고 메시지는 `MODERATION_FAILED` retry 대상으로 남습니다.

### MessageReply

답장은 공개 도착 링크에서 생성되며, 발신자의 답장함과 관리자 검수에 사용됩니다.

```txt
MessageReply
├── status = VISIBLE | HIDDEN | DELETED
├── senderReadAt
├── senderDeletedAt
├── notifiedAt
├── hiddenAt
└── hiddenReason
```

`senderDeletedAt`은 발신자 화면에서만 숨기는 soft delete입니다. 관리자 hide는 `status=HIDDEN`, `hiddenAt`, `hiddenReason`으로 별도 처리합니다.

### MessageCollection / MessageCollectionSubmission

마음나무는 일반 `Message`와 분리된 collection 모델입니다.

```txt
MessageCollection
├── ownerId
├── tokenHash
├── tokenPreview
├── title
├── description
├── scheduledAt
├── status
├── deliveredAt
└── canceledAt
```

```txt
MessageCollectionSubmission
├── collectionId
├── senderDisplayName
├── content
├── status
├── moderationInputHash
├── moderationCategories
├── moderationFeedback
├── ipHash
├── deliveredAt
└── ownerReadAt
```

raw token과 raw IP는 저장하지 않습니다.

## 17.4 UI 리디자인과 DB 영향

다음 변경은 DB migration이 필요 없습니다.

| 변경 | 이유 |
| --- | --- |
| `AppShell` top bar/sidebar/mobile nav | presentation layer |
| `maeari-stage`, `maeari-hero-card`, `maeari-letter-surface` | CSS utility |
| Figma palette 적용 | styling |
| local image asset 사용 | static asset |
| QR UI 개선 | existing URL client rendering |
| `/sent` 답장함 탭 UI | 기존 `MessageReply` 조회 |
| `/write` 성공 dialog UI | existing response rendering |
| `/arrival/[token]` public stage | presentation layer |

DB migration이 필요한 경우:

- 새 상태 enum 추가.
- 새 provider/channel/event type 추가.
- 새 사용자 행위 로그를 DB에 영구 저장.
- 새 관계나 권한 snapshot 저장.
- 기존 token/hash 정책 변경.

## 17.5 정합성 검증 SQL

운영 DB 확인 시 아래 쿼리를 사용할 수 있습니다.

```sql
SELECT count(*) FROM "User";
SELECT count(*) FROM "UserContact";
SELECT count(*) FROM "UserContact" WHERE "type" = 'PHONE' AND "verifiedAt" IS NOT NULL AND "deletedAt" IS NULL;
SELECT count(*) FROM "PhoneVerificationAttempt";
SELECT count(*) FROM "PhoneVerificationLock" WHERE "lockedUntil" > now();
SELECT count(*) FROM "PhoneNumberLookupCache" WHERE "expiresAt" > now();
```

```sql
SELECT "status", count(*)
FROM "Message"
GROUP BY "status";

SELECT "deliveryStatus", count(*)
FROM "MessageRecipient"
GROUP BY "deliveryStatus";

SELECT "ocrStatus", count(*)
FROM "MessageAttachment"
GROUP BY "ocrStatus";
```

```sql
SELECT "eventType", "channel", "status", count(*)
FROM "NotificationLog"
GROUP BY "eventType", "channel", "status";

SELECT "status", count(*)
FROM "MessageReply"
GROUP BY "status";

SELECT "status", count(*)
FROM "MessageCollection"
GROUP BY "status";

SELECT "status", count(*)
FROM "MessageCollectionSubmission"
GROUP BY "status";
```

## 17.6 새 DB 또는 운영 DB 재검증 절차

```bash
pnpm db:validate
DATABASE_URL="$DATABASE_URL" pnpm prisma migrate status --schema packages/database/prisma/schema.prisma
```

필수 테이블 존재 확인:

```txt
User
UserContact
UserContactVerification
PhoneVerificationAttempt
PhoneVerificationLock
PhoneNumberLookupCache
Message
MessageRecipient
MessageAccessToken
MessageAttachment
MessageReply
MessageCollection
MessageCollectionSubmission
NotificationLog
ContactSuppression
Friendship
FriendRequest
FriendInviteLink
MessageReport
ModerationLog
```

운영 cutover나 restore 뒤에는 반드시 `PUBLIC_TOKEN_PEPPER`, `JWT_SECRET`, Kakao, Gmail SMTP, Solapi, Twilio env를 기존 정책에 맞게 유지한 상태에서 API/Web/Scheduler를 재시작합니다.
