# 매아리 MVP 개발 계획서

## 0. 문서 목적

이 문서는 예약 메시지 서비스 **매아리**의 MVP를 실제 개발 가능한 단위로 정리한 전체 계획서입니다.

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
- 가입 사용자끼리 친구 요청/수락을 통해 친구 관계를 만들고, 메시지 작성 시 이미 친구인 사용자를 수신자로 선택하는 흐름
- 닉네임 또는 친구 코드로 아직 연결되지 않은 사용자를 찾고 친구 요청을 보내는 흐름
- 친구가 아닌 외부 수신자에게는 이메일 또는 전화번호 중 하나를 필수로 받고, 발송 시간이 되면 Gmail SMTP 또는 Solapi 기반 외부 발송 provider를 통해 이메일 또는 문자로 공개 열람 링크를 전달하는 흐름
- 도착 시간 입력은 단일 `datetime-local` 입력에서 빠른 프리셋, 날짜 입력, 1분 단위 시간 직접 입력, 15분 단위 quick minute 선택, KST 도착 미리보기를 결합한 UX로 개선
- 메인 대시보드 `/`를 추가하고 작성/발신함/수신함/친구 관리로 진입하는 첫 화면을 제공
- 메시지 작성 성공/오류 결과를 화면 중앙 팝업으로 표시하고, 성공 팝업에서 예약 상세/발신함/새 마음 쓰기/메인 이동을 제공
- OpenAI Moderation API 외에 매아리 서비스 정책 guardrail prompt 기반 2차 판정 추가
- 한국어 욕설과 비하 표현 일부를 로컬 규칙으로 보강 차단
- guardrail prompt와 parser의 JSON schema를 `allowed/categories/severity/feedback/rationale` 기준으로 맞추고 legacy `is_harmful` 응답도 normalize하도록 안정화
- 보낸 마음은 상태별로 삭제 정책을 분리하고, 받은 마음은 사용자 보관함에서 제거하는 삭제 UX 추가
- 카카오 알림톡을 제외한 이미지 첨부, 그룹 전송, 익명 답장, 감정 리포트, 관리자 검수 화면 구현
- 기간 랜덤 발송, 도착 전 힌트 알림, 메시지 봉투/테마 선택 구현
- 받은 마음 아카이브, 복구, 일괄 삭제, 미래의 나에게 쓴 편지 모아보기, 감정 태그 기반 필터 구현
- 신고 기능과 관리자 계정 정지/해제 정책 구현
- NotificationLog 재시도 현황과 채널/provider별 발송 통계 대시보드 구현
- 브라우저 favicon/app icon, 헤더 로고, 메인/로그인/공개 도착 링크 화면에 봉투 일러스트 적용
- 운영 도메인 `maeari.madcamp-kaist.org`, Nginx reverse proxy, Certbot HTTPS, PM2 standalone web 운영 상태 반영
- Figma 시안의 라벤더 팔레트, 좌측 sidebar, 상단 bar, 모바일 하단 nav, 공통 panel/chip/input 스타일을 `apps/web` UI shell에 반영

---

## 0.2 2026-07-04 구현 반영 내역

이 날짜에 계획 문서의 설계 항목 중 실제 코드와 운영 서버에 반영된 사항은 다음과 같습니다.

### 인증/도메인/운영

- 운영 도메인 `maeari.madcamp-kaist.org`를 EC2 서버 Nginx에 연결했습니다.
- Certbot으로 HTTPS 인증서를 적용했고, HTTP 요청은 HTTPS로 redirect됩니다.
- Kakao OAuth redirect URI를 운영 기준 `https://maeari.madcamp-kaist.org/api/auth/kakao/callback`으로 맞추었습니다.
- `.env.local`의 `WEB_ORIGIN`, `SERVICE_URL`, `KAKAO_REDIRECT_URI`, `NEXT_PUBLIC_SERVICE_URL`, `COOKIE_SECURE` 값을 운영 도메인 기준으로 정리했습니다.
- API가 env 변경 전 값을 계속 들고 있던 문제를 확인하고 `maeari-api`, `maeari-scheduler`를 재시작해 반영했습니다.
- Next.js 개발 서버를 public port에 띄웠을 때 CSS/JS 404와 500이 발생한 문제를 production standalone server 실행으로 복구했습니다.
- `apps/web/package.json`의 build script가 `.next/static`과 `public`을 standalone 경로로 복사하도록 정리했습니다.

### 친구/수신자 식별

- `User.friendCode`, `FriendRequest`, `Friendship` 스키마를 추가했습니다.
- 친구 코드 생성, 친구 요청 생성/수락/거절/취소, 친구 관계 삭제 API와 화면을 추가했습니다.
- `/friends/search`와 `/friends` 검색 UI로 닉네임 또는 친구 코드 기반 친구 찾기를 추가했습니다.
- `/friends` 화면에서 내 친구 코드, 받은 요청, 보낸 요청, 친구 목록을 관리할 수 있게 했습니다.
- `/write`에서 수신 대상 `친구`를 선택하면 수락된 친구 목록에서 수신자를 고를 수 있게 했습니다.
- 친구에게 보내는 메시지는 `receiverType = FRIEND`, `receiverUserId = friend.id`, `receiverInfo.friendshipId` snapshot으로 저장합니다.
- 친구 관계가 없거나 삭제된 경우 친구 수신자로 메시지를 만들 수 없도록 서버에서 검증합니다.

### 외부 수신/알림

- 친구가 아닌 타인 수신자는 이메일 또는 전화번호 중 하나가 필수입니다.
- `NotificationProvider`, Gmail SMTP provider, Solapi SMS provider를 추가했습니다.
- `NotificationLog`에 provider, idempotencyKey, attemptCount, nextRetryAt 등을 추가해 중복 발송과 재시도 추적을 지원합니다.
- Gmail SMTP와 Solapi provider의 발송 식별자는 `NotificationLog.providerMessageId`에 저장해 운영 로그와 재시도 판단에 사용합니다.
- provider 미설정 시 발송 성공으로 처리하지 않고 `SKIPPED`/`FAILED`로 기록합니다.
- retryable 실패는 retry job에서 재시도할 수 있게 분리했습니다.
- Gmail SMTP/Nodemailer는 EMAIL 채널의 1순위 provider입니다. `GMAIL_SMTP_ENABLED=true`이면 `GMAIL_SMTP_USER`, `GMAIL_SMTP_APP_PASSWORD`를 필수로 검증합니다.
- Solapi Node SDK는 SMS 채널의 1순위 provider입니다. `SOLAPI_SMS_ENABLED`가 비어 있어도 `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SOLAPI_SENDER_NUMBER`가 모두 있으면 자동 활성화됩니다.
- 전화번호는 국내 번호 v1 기준으로 숫자만 남기고, `0`으로 시작하는 10~11자리만 허용합니다.
- `preferredChannel=AUTO`는 이메일이 있으면 EMAIL, 이메일이 없고 전화번호만 있으면 SMS를 선택합니다.
- `preferredChannel=EMAIL` 또는 `SMS`를 명시한 경우 해당 채널만 시도하고 다른 채널로 임의 우회하지 않습니다.
- `ContactSuppression`에 `PUBLIC_TOKEN_PEPPER` 기반 HMAC-SHA256 연락처 hash를 저장해 EMAIL/SMS 수신거부를 채널별로 처리합니다.
- `/api/public/notification-suppressions`와 `/arrival/[token]`의 채널별 버튼으로 이메일 또는 문자 알림 수신거부가 가능합니다.
- 이메일과 문자 본문에는 사용자가 작성한 편지 본문을 절대 포함하지 않고 공개 열람 링크와 도착 안내만 포함합니다.

### 작성/시간 UX

- `/` 메인 대시보드를 추가했습니다.
- `/write` 상단에 KST 현재 시각을 초 단위로 표시합니다.
- 도착 날짜와 시간을 분리하고, 시간은 `type="time"` + `step=60`으로 1분 단위 직접 입력이 가능합니다.
- 15분 단위 quick minute 버튼을 제공해 `00`, `15`, `30`, `45`분을 빠르게 선택할 수 있습니다.
- 기존 30분 단위 select는 제거했습니다.
- 작성 완료 후 입력 위치와 무관하게 결과를 바로 인지할 수 있도록 화면 중앙 팝업을 보여주고, 예약 상세/발신함/새 마음 쓰기/메인 이동을 제공합니다.
- 공개 링크는 “수신자가 비회원이거나 알림 provider가 없을 때 도착 후 열람할 수 있는 수동 공유 링크”라는 용도를 화면에 설명했습니다.

### AI 유해성 필터링

- 기존 구현 위치는 `apps/api/src/modules/moderation/moderation.service.ts`입니다.
- 새 정책 prompt는 `apps/api/src/modules/moderation/moderation-policy.ts`에 추가했습니다.
- 기존 Moderations API는 유지하되, 통과한 메시지도 매아리 서비스 정책 guardrail prompt로 2차 판정합니다.
- guardrail prompt는 “수신자에게 직접 전달되는 예약 메시지”라는 서비스 맥락을 설명하고, 욕설/혐오/비하/성적 모욕/사전식 욕설 목록을 차단하도록 지시합니다.
- guardrail prompt의 응답 schema를 `allowed`, `categories`, `severity`, `feedback`, `rationale`로 통일했습니다.
- parser는 이전 schema인 `is_harmful`, `confidence_score`, `violation_category`, `reason`도 normalize해 schema 불일치로 인한 `MODERATION_FAILED`를 줄입니다.
- guardrail Chat Completions 호출에서 불필요한 `temperature` 고정값을 제거해 현재 모델 API와 호환되도록 했습니다.
- 한국어 욕설과 비하 표현 일부는 `detectKoreanAbuse` 로컬 규칙으로 OpenAI 호출 전 차단합니다.
- `OPENAI_GUARDRAIL_MODEL` 환경 변수를 추가했고 기본값은 `gpt-5.4-mini`입니다.
- 스크린샷 사례처럼 욕설/비하 표현 목록이 메시지 본문에 들어간 경우 `allowed:false`로 차단되는 것을 확인했습니다.

### 보관함 삭제 UX

- 예약 취소와 보관함 삭제를 분리했습니다.
- `Message.senderDeletedAt`을 추가해 발신자가 이미 도착했거나 실패한 보낸 마음을 발신함에서만 숨길 수 있게 했습니다.
- `MessageRecipient.receiverDeletedAt`을 추가해 수신자가 받은 마음을 수신함에서 제거할 수 있게 했습니다.
- `DELETE /api/messages/:id`는 발신자 기준 `PENDING`, `MODERATION_FAILED`, `CANCELED` 메시지는 hard delete하고, `SENT`, `FAILED` 메시지는 `senderDeletedAt` soft delete로 처리합니다.
- 수신자 기준 삭제는 `MessageRecipient.receiverDeletedAt` soft delete로 처리합니다.
- `/sent`, `/inbox`, `/messages/[id]` 화면에 삭제 가능 조건에 맞는 `삭제` 버튼을 추가했습니다.
- soft delete된 항목은 목록 조회에서 제외하지만, 발송 이력, 공개 token, notification log는 감사 추적을 위해 보존합니다.
- v1 오래된 메시지 정리 정책은 자동 hard delete를 하지 않고, 사용자 직접 아카이브/삭제와 감사 로그 보존을 우선합니다.

### 2026-07-05 후순위 기능 구현

- `MessageArrivalMode`, `MessageTheme`, `MessageAttachment`, `MessageReply`를 추가했습니다.
- `/write`에서 그룹 수신자 목록, 이미지 첨부, 랜덤 도착 구간, 도착 전 힌트, 메시지 테마, 익명 답장 허용 여부를 설정할 수 있습니다.
- scheduler에 `sendArrivalHints` job을 추가해 `hintAt`이 지난 `PENDING` 메시지의 `ARRIVAL_HINT` 알림을 발송합니다.
- `/arrival/[token]`에서 첨부 이미지와 테마를 표시하고, 수신자가 익명 답장을 남길 수 있습니다.
- `/messages/[id]` 상세에서 첨부와 답장을 확인합니다.
- `/reports`와 `/api/reports/emotions`에서 월별 감정 리포트를 제공합니다.
- `/admin`과 `/api/admin/*`에서 운영 요약, moderation log, notification log, 익명 답장 검수를 제공합니다.
- `/admin` overview에서 `NotificationLog` 재시도 대상, 상태별/채널별/provider별 발송 통계, 실패 코드를 확인합니다.
- 공개 링크와 로그인 상세 화면에서 메시지 신고를 접수하고, 관리자는 신고 검토 및 발신자 계정 정지/해제를 처리합니다.
- `/sent`, `/inbox`, `/archive`, `/future`에 감정 태그 필터를 제공하고, `/messages/bulk-delete`로 현재 보이는 항목을 일괄 삭제합니다.
- `/archive`, `/future`, `/messages/bulk-delete`로 받은 마음 아카이브, 복구, 일괄 삭제, 미래의 나에게 쓴 편지 모음을 제공합니다.

### 브랜드 이미지

- `images/`의 봉투 일러스트를 web asset으로 변환했습니다.
- `app/icon.png`, `app/apple-icon.png`로 브라우저 탭 지구 아이콘을 서비스 아이콘으로 교체했습니다.
- `public/images/maeari-mark.png`, `maeari-app-icon.png`, `maeari-hero-floral.png`, `maeari-hero-night.png`, `maeari-sidebar-sky.png`, `maeari-card-letter.png`를 주요 UI asset으로 사용합니다.
- `maeari-main-envelope.webp`, `maeari-login-envelope.webp`, `maeari-public-envelope.webp`는 이전 변환 asset으로 보존하지만, 현재 메인/로그인 핵심 화면은 밝은 `maeari-hero-floral.png`를 우선 사용합니다.
- 헤더 로고, AppShell sidebar, 메인 히어로, 로그인 화면, 공개 도착 링크, card thumbnail에 봉투 일러스트를 적용했습니다.

### 검증

- `pnpm --filter @maeari/api typecheck`
- `pnpm --filter @maeari/api build`
- `pnpm --filter @maeari/web typecheck`
- `pnpm --filter @maeari/web build`
- `curl -I https://maeari.madcamp-kaist.org/`
- `curl -I https://maeari.madcamp-kaist.org/api/health`
- `pm2 list`

---

## 0.2.1 2026-07-06 문서 최신화 반영

현재 코드 기준으로 README, IA, DB Schema 문서에 다음 구현 상태를 추가 반영했습니다.

- 서비스명과 화면 문구는 `매아리(매 순간 아껴둔 마음의 소리)` 기준으로 정리했습니다.
- `/`, `/write`, `/sent`, `/inbox`, `/archive`, `/future`, `/reports`, `/admin`, `/friends`, `/messages/[id]`, `/arrival/[token]`의 실제 화면 흐름을 IA에 반영했습니다.
- `MessageArrivalMode`, `MessageTheme`, `MessageAttachment`, `MessageReply`, `MessageReport`, `ContactSuppression`, `NotificationLog` 중심의 최신 Prisma 모델 책임을 DB 문서에 맞췄습니다.
- Gmail SMTP 이메일, Solapi SMS, `AUTO` 채널 라우팅, `ContactSuppression` pre-flight, 채널별 수신거부 정책을 외부 알림 설계에 반영했습니다.
- 취소와 삭제를 분리한 상태별 발신자 hard/soft delete, 받은 마음 soft delete, 아카이브/복구/일괄 삭제 정책을 반영했습니다.
- 친구 검색, 감정 태그 필터, 미래의 나 모음, 감정 리포트, 신고/계정 정지, 관리자 notification 통계 대시보드까지 현재 구현된 후순위 기능을 문서화했습니다.

---

## 0.2.2 2026-07-06 전화번호 인증, 친구 초대 링크, 신규 DB 전환 반영

현재 운영 코드와 서버 상태 기준으로 다음 변경을 추가 반영했습니다.

- 마음쓰기 권한은 이메일 인증이나 사용자가 선택한 발신 연락처가 아니라 **strict 010 휴대전화 인증 보유 여부**로 판단합니다.
- `/write`에서 연락처 선택 UI와 masked value 노출을 제거하고, `/api/me/contacts`의 `writerEligibility.hasVerifiedStrictPhone`만 확인합니다.
- 인증된 PHONE이 없으면 `/write`는 예약을 막고 `/phone-verification?next=/write`로 이동시키는 CTA를 제공합니다.
- `POST /api/messages`는 body의 `senderContactId`를 보안상 무시하고, 서버가 `assertVerifiedSenderPhoneContact(userId)`로 active verified strict PHONE을 직접 선택합니다.
- 선택된 PHONE은 메시지 생성 시점에 `Message.senderContactId`, `senderContactSnapshot`으로 snapshot 저장되며, 이후 사용자가 전화번호를 바꿔도 기존 예약 메시지 전달에는 영향을 주지 않습니다.
- `/phone-verification` 전용 페이지를 추가해 전화번호 입력, OTP 발송/재발송, 6자리 code 검증, 완료 후 `/write` 또는 `/my`로 안전하게 이동하는 흐름을 제공합니다.
- PHONE 인증은 `01012345678`, `010-1234-5678`, `+821012345678`, `821012345678` 계열 입력을 `01012345678`로 정규화하고, 최종적으로 `^010\d{8}$`만 허용합니다.
- `PHONE_LOOKUP_ENABLED=true`일 때 Twilio Lookup v2 `line_type_intelligence`를 호출해 `valid=true`, `country_code=KR`, `type=mobile` 조건만 통과시키며 provider 장애는 fail-closed로 처리합니다.
- `PhoneVerificationAttempt`, `PhoneVerificationLock`, `PhoneNumberLookupCache`를 추가해 raw IP/전화번호 없이 HMAC hash 기반 rate limit, lock, lookup cache를 관리합니다.
- verified PHONE은 사용자가 직접 삭제할 수 없고, 새 PHONE OTP 인증 성공 시 기존 active PHONE을 retire하고 새 PHONE을 primary active로 전환합니다.
- 이메일 연락처는 마음쓰기 권한이 아니라 외부 이메일 수신 메시지를 기존 사용자에게 연결하기 위한 보조 신원으로 사용합니다.
- 친구 초대 링크 기능을 추가했습니다. `/friends`에서 24시간 유효한 1회성 링크를 만들고, `/friends/invite/[token]`에서 미리보기/claim을 처리합니다.
- 로그인 전 초대 링크를 열면 `sessionStorage.maeari.pendingFriendInviteToken`에 보관하고 `/auth/callback`에서 로그인 완료 후 자동 claim합니다.
- 메시지 첨부는 web 기본 경로를 multipart form-data로 전환했습니다. JSON payload는 `payload` field에, 이미지는 `attachments` field에 담고 API가 multer로 MIME/개수/용량/총량을 검증합니다.
- 운영 DB를 기존 MVP 이름 `maeum_arrival`에서 `maeari`로 전환했습니다. Docker Postgres의 DB/USER healthcheck도 `maeari` 기준이며, 기존 DB와 dry-run DB는 final dump 검증 후 제거했습니다.
- 2026-07-07 기준 앱 환경변수와 PM2 프로세스는 `maeari` DB만 사용합니다. 기존 bootstrap role `maeum`은 Postgres system-required role이라 삭제할 수 없지만 `NOLOGIN` 상태이며, template DB owner는 `maeari`로 정리했습니다.
- 운영 DB dump가 git에 올라가지 않도록 `backups/`를 `.gitignore`에 추가했습니다.

---

## 0.2.3 2026-07-07 OCR, 답장함, QR, 마음나무, 첨부 allowlist 반영

현재 Prisma schema, API route, Web route 기준으로 다음 변경이 실제 코드에 반영되었습니다.

- 첨부 이미지는 `.jpg`, `.jpeg`, `.png`, `.webp`만 허용합니다.
- Web `accept`, client validation, API multer `fileFilter`, service magic bytes 검사까지 네 단계로 MIME/확장자/파일 header를 검증합니다.
- 이미지 속 욕설/비하 텍스트는 Vision API가 아니라 `tesseract.js` OCR로 추출한 텍스트를 기존 OpenAI Moderation + 매아리 guardrail 입력에 합쳐 검사합니다.
- OCR 실패/timeout은 미검증 콘텐츠를 발송하지 않도록 `MODERATION_FAILED`로 저장하고 retry job에서 저장된 첨부 파일을 다시 OCR 검사합니다.
- 공개 도착 링크의 익명 답장은 `message.reply.created` 이벤트를 발생시키고, 발신자에게 `REPLY_RECEIVED` 앱 내 알림과 이메일 알림을 생성합니다.
- `/sent`에는 보낸 마음과 답장함 탭이 있으며, 답장함에서 읽음 처리와 발신자 화면 삭제가 가능합니다.
- 마음쓰기 완료 모달, 보낸 마음, 메시지 상세 화면에는 기존 공개 URL을 QR로 렌더링하는 `QrShare` 컴포넌트가 적용되어 있습니다.
- 이메일/전화번호 인증이 완료되면 과거 OTHER 수신 메시지 중 현재 user에게 연결 가능한 row를 받은 마음으로 자동 연결합니다.
- `/tree`와 `/tree/[token]` 마음나무 기능을 추가했습니다. 회원은 공개 수집 링크/QR을 만들고, 비회원은 텍스트 편지를 제출하며, scheduler가 도착 시점에 제출물을 일괄 공개합니다.
- `NotificationLog`는 기존 `messageRecipientId` 중심 로그에 더해 `targetUserId`, `messageReplyId`, `messageCollectionId`를 기록할 수 있도록 확장되었습니다.
- 운영 `maeari` DB는 `20260706150000_ocr_replies_qr_collections` migration까지 적용된 상태입니다.
- 2026-07-07 확인 기준 주요 row count는 `User 6`, `Message 34`, `MessageRecipient 34`, `MessageAccessToken 43`, `NotificationLog 25`, `MessageAttachment 4`, `MessageReply 1`입니다.

---

## 0.2.4 2026-07-07 Figma 기반 UI 리디자인 반영

현재 UI 리디자인은 **기능/API/DB는 유지하고 web presentation layer를 교체**하는 방향으로 진행합니다. 기존 구현된 모든 기능은 동일 route와 API를 사용하고, 화면 구조와 스타일만 Figma 시안의 톤으로 맞춥니다. 2026-07-07 기준으로 주요 route의 구 UI 토큰과 버튼/패널 스타일을 새 공통 토큰으로 교체했고, 홈 대시보드는 실제 보낸 마음/받은 마음 API 데이터를 읽는 화면으로 바꾸었습니다. Figma MCP Starter plan call limit 해제 후 주요 frame screenshot과의 마지막 대조를 남겨둔 상태입니다.

기준 시안:

- [madcamp W1 매아리](https://www.figma.com/design/DhS0vdHr6io4aHqAhneMj7/madcamp_W1_%EB%A7%A4%EC%95%84%EB%A6%AC?node-id=0-1&t=NU2i19vEz2cMT2cd-0)
- 우선 반영 frame: `Desktop_main`, `Desktop_Writing`, `Desktop_my`, `Desktop_friends`

반영된 항목:

- `apps/web/components/AppShell.tsx`
  - 모든 로그인 사용자 화면의 공통 shell로 사용합니다.
  - 데스크톱은 74px fixed top bar와 221px fixed left sidebar를 사용합니다.
  - 데스크톱 nav는 홈, 마음 보내기, 받은 마음, 보낸 마음, 마음나무, 친구, 리포트, 내 정보 순서입니다.
  - 모바일은 하단 5-tab nav로 줄이고, 쓰기, 받은 마음, 보낸 마음, 친구, 내 정보만 고정 노출합니다.
  - sidebar 하단에는 `maeari-sidebar-sky.png`와 오늘의 한 줄을 넣어 Figma의 감성 패널 역할을 합니다.
- `apps/web/app/globals.css`
  - Figma 중심 팔레트:
    - `#6D48DB`: primary accent
    - `#F3EEFD`: primary surface
    - `#9A85E1`: secondary accent
    - `#FBF9FC`: app background
    - `#F3EFF7`: secondary gray surface
  - `.maeari-stage`: 전체 app background와 subtle grid layer
  - `.figma-panel`: 8px radius, 보라색 low-contrast border, translucent white panel, soft shadow
  - `.maeari-input`: 입력 공통 border/radius/focus
  - `.maeari-chip`, `.maeari-chip-active`: filter, small action, secondary CTA 공통 스타일
  - `.maeari-action`, `.maeari-action-primary`, `.maeari-action-danger`: 일반/주요/위험 액션 버튼 공통 스타일
  - `.maeari-badge`: status, emotion, contact 상태 표시
  - `.maeari-page-title`, `.maeari-page-copy`: page heading typography
- `apps/web/components/ui.tsx`
  - `Button`, `LinkButton`, `TextInput`, `TextArea`, `SelectInput`, `PageHeader`, `SectionPanel`, `StatusPill`, `EmotionPill`, `EmptyState`, `LetterThumb`를 공통 primitive로 둡니다.
  - 목록/상세/설정 화면이 같은 radius, focus-ring, shadow, label hierarchy를 공유하도록 route별 Tailwind 중복을 줄였습니다.
- `apps/web/app/page.tsx`
  - 메인 화면을 `maeari-hero-floral.png` hero, 곧 찾아갈 마음 timeline, 최근 보관한 마음, 주요 기능 quick card로 재구성했습니다.
  - `/messages/sent`, `/messages/received`를 병렬 조회해 실제 사용자의 예약 대기 메시지와 최근 받은 마음을 표시합니다.
  - 세션이 없으면 `/login`으로 이동하고, 데이터가 없으면 fallback card를 보여주어 첫 사용자도 빈 화면으로 보이지 않게 했습니다.
  - quick card는 마음 쓰기, 받은 마음, 친구, 마음나무로 구성합니다.
- `apps/web/components/Notice.tsx`
  - notice를 새 panel shadow/radius와 tone별 pastel surface로 정리했습니다.
- `apps/web/components/QrShare.tsx`
  - QR 공유 card를 `figma-panel`로 통일하고, 링크 복사/QR 저장 액션을 새 chip/button 톤으로 정리했습니다.

화면별 실제 반영 범위:

- Public route
  - `/login`: 카카오 로그인 진입 화면을 브랜드 카드, 봉투 일러스트, 라벤더 CTA 중심으로 재구성했습니다.
  - `/auth/callback`: pending arrival token, pending friend invite token, 재시도/확인 액션을 새 public stage로 정리했습니다.
  - `/arrival/[token]`: 도착 전 gate, 열람 화면, 첨부, 익명 답장, 신고, 수신거부/재구독 버튼을 새 panel 구조로 정리했습니다.
  - `/arrival/link-failed`: 링크 보관 실패 안내와 복귀 액션을 public stage로 통일했습니다.
  - `/friends/invite/[token]`: 친구 초대 링크 preview/claim/로그인 CTA를 새 카드형 화면으로 정리했습니다.
  - `/tree/[token]`: 비회원 마음나무 제출 화면을 public stage와 단일 제출 panel로 정리했습니다.
- Authenticated route
  - `/`: Figma `Desktop_main` 방향에 맞춰 hero, timeline, 최근 마음, quick card를 새 구조로 정리했습니다.
  - `/write`: Figma `Desktop_Writing` 방향에 맞춰 전화번호 인증 gate, 수신자, 그룹, 본문, 첨부, 도착 설정, 감성 옵션, 결과 dialog를 panel 기반 form으로 정리했습니다.
  - `/sent`: 보낸 마음/답장함 탭, 상태/감정 필터, QR/링크 복사, 취소/삭제 액션을 새 chip/action 체계로 정리했습니다.
  - `/inbox`, `/archive`, `/future`: 받은 마음, 아카이브, 미래의 나 목록을 같은 필터/카드/일괄 삭제 패턴으로 정리했습니다.
  - `/messages/[id]`: 상세 정보, 수신자 상태, 첨부, 답장, 신고, QR 공유, 취소/삭제 액션을 새 detail panel로 정리했습니다.
  - `/friends`: Figma `Desktop_friends` 방향에 맞춰 친구 코드, 검색, 요청, 초대 링크, 친구 목록을 panel grid로 정리했습니다.
  - `/phone-verification`: 마음쓰기 권한용 전화번호 인증 flow를 별도 화면으로 정리했습니다.
  - `/my`: Figma `Desktop_my` 방향에 맞춰 내 정보와 연락처 인증 상태를 PHONE 우선 panel로 정리했습니다.
  - `/tree`: 마음나무 생성/목록/상세/QR 공유를 collection panel로 정리했습니다.
  - `/reports`, `/admin`: 새 토큰을 적용하되 운영/통계 화면답게 조밀한 정보 구조를 유지했습니다.

리디자인에서 지켜야 하는 비기능 요구:

- route path, API request/response, DB schema는 바꾸지 않습니다.
- 발신 연락처 select는 다시 노출하지 않습니다. 마음쓰기 권한은 여전히 `writerEligibility.hasVerifiedStrictPhone`으로만 판단합니다.
- QR은 기존 공개 URL을 시각화하는 UI일 뿐이며 token 정책은 그대로 유지합니다.
- 외부 이메일/SMS 본문에 편지 본문을 넣지 않는 privacy 원칙도 유지합니다.
- Figma에 없는 화면은 `Desktop_main`, `Desktop_Writing`, `Desktop_friends`, `Desktop_my`의 spacing, color, panel, typography 규칙을 확장해 사용합니다.

현재 남은 UI QA:

- Figma MCP call limit이 풀린 뒤 주요 frame과 screenshot을 다시 대조합니다.
- `/write`, `/sent`, `/inbox`, `/arrival/[token]`, `/friends`, `/my`, `/tree`의 세부 form spacing과 button hierarchy를 Figma 기준으로 추가 조정합니다.
- 모바일에서 bottom nav와 sticky action 영역이 겹치지 않는지 확인합니다.
- `rg "petal|moss|paper|amberline|border-brand-line"`로 구 UI 토큰 잔여 사용을 계속 점검합니다. 2026-07-07 기준 주요 app/component 경로에서는 구 MVP 토큰을 제거했습니다.

---

## 0.2.5 2026-07-07 최종 구현 동기화 기준

이 섹션은 2026-07-07 현재 코드에 실제 반영된 변경을 기능 단위로 묶어 정리합니다. 이후 작업자가 “계획인지 구현 완료인지”를 헷갈리지 않도록, 아래 항목은 현재 repository 기준 구현 완료 또는 운영 반영 완료 상태로 간주합니다.

### 0.2.5.1 브랜드/DB/운영 이름 정리

- 서비스의 외부 표시명은 **매아리**입니다.
- 설명 문구는 **매 순간 아껴둔 마음의 소리**를 사용합니다.
- 운영 DB는 `maeum_arrival`에서 `maeari`로 전환했습니다.
- `POSTGRES_DB`, `POSTGRES_USER`, `DATABASE_URL`은 `maeari` 기준입니다.
- 이전 DB와 dry-run DB는 final dump 검증 후 제거했습니다.
- `PUBLIC_TOKEN_PEPPER`는 token hash, 수신거부 hash, OTP hash, IP/contact hash에 모두 영향을 주므로 유지해야 합니다.

### 0.2.5.2 메시지 작성과 발신 권한

- `/write`는 발신 연락처 select와 masked phone/email 노출을 제거했습니다.
- 마음쓰기 권한은 이메일 인증이 아니라 **verified strict 010 PHONE**으로만 판단합니다.
- frontend는 `senderContactId`를 payload에 넣지 않습니다.
- backend는 payload에 `senderContactId`가 들어와도 무시하고, `assertVerifiedSenderPhoneContact(userId)`가 선택한 PHONE을 `Message.senderContactId`, `senderContactSnapshot`에 저장합니다.
- PHONE 선택 우선순위는 active verified PHONE 중 `isPrimary=true`, 그다음 가장 최근 verified PHONE입니다.
- verified PHONE이 없으면 `SENDER_PHONE_VERIFICATION_REQUIRED`로 차단합니다.

### 0.2.5.3 전화번호 인증 abuse defense

- PHONE 인증 입력은 `01012345678`, `010-1234-5678`, `+821012345678`, `821012345678`를 `01012345678`로 정규화합니다.
- 최종 허용 정규식은 `^010\d{8}$`입니다.
- `070`, `050x`, 유선번호, 구형 `01X`, 해외번호는 `CONTACT_PHONE_INVALID`로 차단합니다.
- `PhoneVerificationAttempt`는 요청, 발송 성공, 차단, 발송 실패 상태를 기록합니다.
- `PhoneVerificationLock`은 IP 또는 CONTACT 범위의 lock을 저장합니다.
- `PhoneNumberLookupCache`는 Twilio Lookup v2 결과를 raw 전화번호 없이 HMAC hash 기준으로 저장합니다.
- `PHONE_LOOKUP_ENABLED=true`이면 Twilio Lookup v2의 `valid=true`, `country_code=KR`, `line_type_intelligence.type=mobile` 조건만 통과합니다.
- Lookup provider 장애는 보안을 우선해 `PHONE_LOOKUP_UNAVAILABLE` fail-closed로 처리합니다.

### 0.2.5.4 외부 알림과 privacy

- EMAIL provider는 Gmail SMTP/Nodemailer입니다.
- SMS provider는 Solapi Node SDK입니다.
- `preferredChannel=AUTO`는 이메일이 있으면 EMAIL, 이메일이 없고 전화번호만 있으면 SMS를 선택합니다.
- 사용자가 EMAIL 또는 SMS를 명시하면 해당 채널만 시도하고 다른 채널로 fallback하지 않습니다.
- 이메일/SMS 본문에는 편지 제목/본문/감정 태그를 넣지 않습니다. 공개 열람 링크와 안내 문구만 포함합니다.
- 발신인 숨김이 켜진 메시지는 provider payload에도 sender nickname을 넣지 않습니다.
- `ContactSuppression`은 EMAIL/SMS별 HMAC contact hash를 저장하며, 수신거부와 재구독을 모두 지원합니다.
- suppression 때문에 모든 외부 알림이 최종 skip되면 recipient와 message 상태를 실패로 동기화해 “도착 완료와 실패가 동시에 보이는” 상태를 막습니다.

### 0.2.5.5 첨부와 OCR moderation

- 첨부는 최대 3개입니다.
- 허용 확장자는 `.jpg`, `.jpeg`, `.png`, `.webp`입니다.
- 허용 MIME은 `image/jpeg`, `image/png`, `image/webp`입니다.
- 프론트 `accept`, 프론트 validation, API multer filter, service magic bytes 검사를 모두 같은 allowlist로 맞췄습니다.
- OCR은 `tesseract.js`로 처리하며 기본 언어는 `kor+eng`입니다.
- 이미지 속 텍스트는 기존 텍스트 moderation 입력에 합쳐 검사합니다.
- OCR timeout/실패는 `MODERATION_FAILED`로 저장하고 retry scheduler에서 재검사합니다.
- v1은 이미지 장면 자체의 유해성 판단은 하지 않습니다.

### 0.2.5.6 답장함, QR, 마음나무

- 공개 링크 익명 답장은 `MessageReply`에 저장되고, moderation을 통과해야 합니다.
- 답장 생성 후 `REPLY_RECEIVED` 알림이 발신자에게 생성됩니다.
- 발신자 verified EMAIL이 있으면 답장 도착 이메일도 발송합니다.
- 답장 알림 이메일에는 답장 본문이나 원문 본문을 넣지 않습니다.
- `/sent`는 보낸 마음 tab과 답장함 tab을 제공합니다.
- QR은 기존 공개 URL을 시각화하는 UI입니다. token 저장 정책은 바꾸지 않습니다.
- 마음나무는 `MessageCollection`과 `MessageCollectionSubmission`으로 구현했습니다.
- 마음나무 owner는 verified strict PHONE이 필요하고, 비회원 제출은 텍스트만 허용합니다.
- scheduler는 도착 시점이 지난 ACTIVE collection을 DELIVERED로 바꾸고, visible submissions를 owner에게 공개합니다.

### 0.2.5.7 Figma UI 리디자인 적용 원칙

- UI 리디자인은 backend/API/DB contract를 바꾸지 않는 presentation layer 작업입니다.
- `AppShell`은 로그인 사용자 화면의 top bar, desktop sidebar, mobile bottom nav를 담당합니다.
- public route는 `maeari-public-stage`를 사용합니다.
- 공통 스타일은 `figma-panel`, `maeari-input`, `maeari-chip`, `maeari-action`, `maeari-badge`를 기준으로 통일합니다.
- `apps/web/public/images`의 매아리 asset을 hero, sidebar, card thumbnail에 사용합니다.
- 모바일은 쓰기, 받은 마음, 보낸 마음, 친구, 내 정보 5개 route만 bottom nav에 고정합니다.
- Figma MCP call limit이 풀리면 `Desktop_main`, `Desktop_Writing`, `Desktop_friends`, `Desktop_my`와 실제 화면을 다시 대조합니다.

### 0.2.5.8 답장/인앱 알림/발신자 표시명/오늘의 한 줄 backend 계약

- `Message.senderDisplayName`을 추가해 마음 작성 시점의 발신자 표시 이름을 snapshot 저장합니다.
- `POST /api/messages`는 `senderDisplayName`을 받을 수 있고, 비어 있으면 user nickname을 기본값으로 저장합니다.
- `isSenderHidden=true`이면 공개 링크, 받은 마음, 외부 알림에서는 기존처럼 발신자 이름을 숨깁니다.
- `MessageReply.authorUserId`, `authorDeletedAt`을 추가해 로그인 사용자가 작성한 답장과 공개 링크 익명 답장을 구분합니다.
- `POST /api/messages/:id/replies`는 로그인 수신자가 받은 마음에 답장을 작성하는 API입니다.
- `/api/messages/replies/sent`는 내가 작성한 답장, `/api/messages/replies/received`는 내가 보낸 마음에 받은 답장을 반환합니다.
- 기존 `/api/messages/sent/replies`는 frontend 이전 기간 동안 `/api/messages/replies/received`의 deprecated alias로 유지합니다.
- `NotificationLog.readAt`을 추가하고 `targetUserId + IN_APP + SENT` 기준으로 사용자 알림 API를 제공합니다.
- `/api/notifications/summary`, `/api/notifications`, `/api/notifications/:id/read`, `/api/notifications/read-all`을 추가합니다.
- 받은 마음 상세 열람과 답장 읽음 처리는 관련 `NotificationLog.readAt`도 함께 갱신합니다.
- `DailyLine`, `DailyLineSelection`을 추가해 KST 날짜별 “오늘의 한 줄”을 저장합니다.
- `/api/daily-line`은 오늘 selection이 없으면 `.env`의 OpenAI 설정으로 문구를 생성하고 저장합니다.
- scheduler는 `DAILY_LINE_CRON`으로 매일 KST 기준 오늘 문구를 미리 생성합니다.
- OpenAI는 꽃 관련 시 일부를 `글귀`, `시제목`, `시인` 순서의 JSON으로 반환해야 합니다.
- 프롬프트는 공개저작물로 판단 가능한 고전 시만 사용하도록 제한하고, 최신/저작권 불명 작품은 인용하지 않도록 합니다.
- OpenAI 생성 실패 시 `DAILY_LINE_GENERATION_FAILED`로 실패하며, mock/dummy/seed 문구는 만들지 않습니다.

### 0.2.5.9 마음 목록 thumbnail backend 계약

- `/api/messages/sent`, `/api/messages/received`, `/api/messages/archived`의 각 message에 `thumbnail` 객체를 추가합니다.
- `thumbnail.source="ATTACHMENT"`이면 첫 번째 첨부 이미지의 `publicUrl`을 `thumbnail.url`로 반환합니다.
- 첨부 이미지가 없으면 message id 기준으로 `maeari-message-default-1.png` ~ `maeari-message-default-4.png` 중 하나를 고정 선택하고 `thumbnail.source="DEFAULT"`로 반환합니다.
- `/api/messages/received`와 `/api/messages/archived`는 앨범형 UI를 위해 `theme`, `coverImageUrl`, `coverImageAlt`, `attachmentCount`도 제공합니다.
- frontend는 메인/수신함/발신함/아카이브 card의 `LetterThumb` 또는 앨범 card 배경에 `thumbnail.url`을 넣으면 되고, 테마별 봉투 fallback을 직접 제어하려면 `coverImageUrl ?? envelopeImageByTheme[theme ?? "LAVENDER"]`를 사용합니다.
- 이 변경은 목록 응답 파생 필드와 정적 asset 추가이므로 DB migration은 만들지 않습니다.

---

## 0.3 구현 원칙

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

이 원칙은 카카오 OAuth, OpenAI Moderation, PostgreSQL, JWT/Cookie, 배포 도메인, Nginx, Gmail SMTP, Solapi SMS, 향후 알림톡 연동에 모두 적용합니다.

## 1. 서비스 개요

### 1.1 서비스명

**매아리**

뜻: **매 순간 아껴둔 마음의 소리**

### 1.2 서비스 한 줄 설명

매 순간 아껴둔 마음의 소리를 미래의 특정 순간에 도착시키는 감성 중심형 예약 메시지 서비스입니다.

### 1.3 서비스 목표

매아리의 목적은 단순한 메시지 발송이 아닙니다.

사용자가 현재의 마음, 기억, 감정, 응원, 감사, 축하를 미래의 특정 날짜까지 보관하고, 받는 사람이 예상하지 못한 순간에 그 마음을 다시 만날 수 있도록 돕는 것이 핵심입니다.

즉, 매아리는 다음 경험을 제공합니다.

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

매아리는 사용자가 작성한 메시지를 즉시 소비하지 않고 미래까지 보관합니다.

이 메시지는 단순 텍스트가 아니라 사용자가 특정 시점에 남긴 감정의 기록입니다. 시간이 흐른 뒤 메시지를 다시 만나는 경험은 과거의 자신, 관계, 기억을 새롭게 바라보게 만듭니다.

## 2.2 느린 소통이 만드는 깊은 연결

기존 메신저는 즉각성과 속도를 중심으로 작동합니다.

반면 매아리는 느리게 도착하는 메시지를 통해 더 오래 남는 소통을 지향합니다.

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

`발신인 숨기기`, `도착일 숨기기`, 기간 랜덤 발송, 도착 전 힌트 알림은 v1 구현에 포함되었습니다.

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
| 친구 | 친구 추가/수락 | 회원가입 후 친구 코드 또는 초대 링크로 친구 요청을 보내고 수락한 사용자끼리 관계 저장 |
| 친구 | 친구 수신자 선택 | 메시지 작성 시 이미 친구인 사용자를 검색/선택해 수신자로 지정 |
| 메시지 작성 | 예약 메시지 생성 | 제목, 본문, 감정 태그, 수신자 정보, 예약일 저장 |
| 메시지 작성 보조 | KST 현재 시각 표시 | 작성 화면 상단에서 KST 기준 현재 시각을 초 단위로 확인 |
| 메시지 작성 보조 | 쉬운 도착 시간 선택 | 빠른 프리셋, 날짜 입력, 1분 단위 시간 직접 입력, 15분 단위 quick minute 선택, KST 도착 미리보기 제공 |
| 수신자 식별 | 타인 연락처 필수 | 타인에게 보내는 경우 이메일 또는 전화번호 중 하나를 필수로 저장 |
| 외부 발송 | Gmail SMTP / Solapi 발송 | 친구가 아닌 외부 수신자에게 도착 시점에 공개 링크를 이메일 또는 문자로 발송 |
| 감성 옵션 | 발신인 숨기기 | 수신자가 발신자를 바로 알 수 없게 처리 |
| 감성 옵션 | 도착일 숨기기 | 공개 열람 화면에서 정확한 예약일 노출 제어 |
| AI 필터링 | OpenAI Moderation, 정책 guardrail prompt, 한국어 욕설/비하 표현 보강 | 저장 전 유해성 검사 |
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
| 알림톡 외 채널 고도화 | Gmail SMTP 이메일과 Solapi 문자는 구현 완료, 카카오 알림톡만 후순위 |
| 이미지 첨부 | v1 구현 완료, API uploads 저장과 용량/형식 제한 적용 |
| 그룹 전송 | v1 구현 완료, `Message` 하나에 여러 `MessageRecipient` 생성 |
| 익명 답장 | v1 구현 완료, 공개 링크 답장도 moderation 후 저장 |
| 감정 리포트 | v1 구현 완료, 월별 보낸/받은 마음과 감정 분포 제공 |
| 기간 랜덤 발송 고도화 | v1 구현 완료, 지정 구간 안에서 서버가 도착 시간을 선택 |
| 관리자 검수 화면 | v1 구현 완료, `ADMIN_KAKAO_IDS` 기반 운영 화면 제공 |

---

## 4. 기술 스택

## 4.1 기본 요구 스택

| 영역 | 기술 |
| --- | --- |
| Frontend | Next.js, TypeScript, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| AI Integration | OpenAI Moderation API, OpenAI Chat Completions 기반 guardrail classifier |
| OCR | tesseract.js, `kor+eng` 이미지 텍스트 추출 |
| QR | qrcode.react |
| Email | Nodemailer + Gmail SMTP |
| SMS | Solapi Node SDK |
| Phone Lookup | Twilio Lookup v2 line type intelligence |
| Scheduler | node-cron |
| Server | AWS EC2 Ubuntu 24.04 LTS, t3.medium |
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

### OpenAI guardrail classifier

- Moderations API가 서비스 맥락을 모르는 상태로 판단하는 한계를 보완합니다.
- 매아리가 “수신자에게 직접 도착하는 예약 메시지”라는 점을 system prompt에 설명합니다.
- 욕설 사전, 비하어 설명, 모욕적 표현 목록처럼 일반 moderation에서 통과할 수 있는 텍스트도 수신자에게 전달되면 차단하도록 정책화합니다.
- 구조화된 JSON 응답으로 `allowed`, `categories`, `severity`, `feedback`, `rationale`을 받습니다.

### node-cron

- 단일 서버 MVP에 적합
- 별도 queue 인프라 없이 예약 작업 구현 가능
- 추후 BullMQ, SQS 등으로 대체 가능

---

## 5. 전체 아키텍처

## 5.1 Monolithic 배포 구조

MVP는 AWS EC2 단일 서버에서 운영합니다.

현재 운영 대상은 Ubuntu 24.04 LTS 기반 EC2 `t3.medium`입니다.

```txt
User Browser
  |
  | HTTPS
  v
Nginx :80/:443
  |
  | /api/*
  v
Express API :4000
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
maeari-web        -> Next.js frontend server
maeari-api        -> Express API server
maeari-scheduler  -> 예약 메시지 처리 scheduler
```

현재 운영 web은 Next.js standalone server이며, `next dev`가 아닙니다. 개발 서버를 운영 포트에 노출하면 `.next` 캐시와 devtools manifest 불일치로 정적 파일 404 또는 500이 발생할 수 있어 production build 산출물만 사용합니다.

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
  -> Kakao email이 있으면 UserContact EMAIL 자동 upsert
  -> session or JWT 발급
  -> sessionStorage pendingArrivalToken이 있으면 /api/auth/link-message 시도
  -> sessionStorage pendingFriendInviteToken이 있으면 /api/friends/invites/:token/claim 시도
  -> frontend redirect
```

### 메시지 작성 흐름

```txt
사용자 메시지 작성
  -> /write mount
  -> GET /api/me/contacts
  -> writerEligibility.hasVerifiedStrictPhone 확인
  -> 미인증이면 /phone-verification?next=/write 안내
  -> GET /api/time으로 서버 기준 +24h 기본 도착 시각 설정
  -> Frontend validation
  -> POST /api/messages
     - 첨부가 없으면 JSON
     - 첨부가 있으면 multipart payload + attachments
     - payload + 이미지 3개 multipart 요청 허용
  -> Auth middleware
  -> Request validation
  -> 서버가 senderContactId payload를 무시하고 verified strict PHONE 직접 선택
  -> SELF/FRIEND/OTHER 모든 유형에서 PHONE 인증 필수
  -> 첨부 이미지 MIME/확장자/용량/매직바이트 검사
  -> 첨부 이미지가 있으면 tesseract.js OCR 텍스트 추출
  -> 메시지 제목/본문/감정 태그와 OCR 텍스트 병합
  -> 한국어 욕설/비하 표현 로컬 규칙 검사
  -> OpenAI Moderation 1차 검사
  -> 매아리 guardrail prompt 2차 검사
  -> API 실패 시 즉시 재시도
  -> 통과 시 PENDING 저장
  -> 공개 열람 token 생성
  -> 검사 API 2회 실패 또는 OCR 실패/timeout 시 MODERATION_FAILED 저장
  -> 유해성 차단 시 저장하지 않고 MESSAGE_BLOCKED_BY_MODERATION 응답
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

### 마음나무 흐름

```txt
회원
  -> /tree
  -> verified strict PHONE 확인
  -> POST /api/message-collections
  -> raw token이 포함된 collectionUrl 반환
  -> Web에서 QR/링크 공유

비회원
  -> /tree/[token]
  -> GET /api/public/message-collections/:token
  -> POST /api/public/message-collections/:token/submissions
  -> IP hash rate limit
  -> OpenAI Moderation + 매아리 guardrail 검사
  -> VISIBLE submission 저장

Scheduler
  -> ACTIVE collection 중 scheduledAt <= now 조회
  -> DELIVERED 전환
  -> visible submissions deliveredAt 기록
  -> owner에게 COLLECTION_DELIVERED IN_APP + EMAIL 알림
```

---

## 6. 프로젝트 디렉토리 구조

## 6.1 권장 구조

```txt
maeari/
├── apps/
│   ├── web/
│   │   ├── app/
│   │   │   ├── page.tsx
│   │   │   ├── icon.png
│   │   │   ├── apple-icon.png
│   │   │   ├── login/
│   │   │   ├── onboarding/
│   │   │   ├── write/
│   │   │   ├── inbox/
│   │   │   ├── sent/
│   │   │   ├── friends/
│   │   │   ├── arrival/
│   │   │   │   └── [token]/
│   │   │   └── my/
│   │   ├── components/
│   │   │   ├── AppShell.tsx
│   │   │   ├── Notice.tsx
│   │   │   ├── QrShare.tsx
│   │   │   └── ui.tsx
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── messages/
│   │   │   └── onboarding/
│   │   ├── lib/
│   │   ├── public/
│   │   │   └── images/
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
│       │   │   ├── contacts/
│       │   │   │   ├── contact.controller.ts
│       │   │   │   ├── contact.routes.ts
│       │   │   │   ├── contact.service.ts
│       │   │   │   ├── phone-verification-guard.ts
│       │   │   │   └── phone-lookup.service.ts
│       │   │   ├── messages/
│       │   │   │   ├── message.controller.ts
│       │   │   │   ├── message.routes.ts
│       │   │   │   ├── message.service.ts
│       │   │   │   ├── message-upload.middleware.ts
│       │   │   │   └── message.validation.ts
│       │   │   ├── friends/
│       │   │   │   ├── friend-code.ts
│       │   │   │   ├── friend.controller.ts
│       │   │   │   ├── friend.routes.ts
│       │   │   │   ├── friend.service.ts
│       │   │   │   └── friend.validation.ts
│       │   │   ├── collections/
│       │   │   │   ├── collection.controller.ts
│       │   │   │   ├── collection.routes.ts
│       │   │   │   ├── collection.service.ts
│       │   │   │   └── collection.validation.ts
│       │   │   ├── admin/
│       │   │   │   ├── admin.controller.ts
│       │   │   │   ├── admin.routes.ts
│       │   │   │   └── admin.service.ts
│       │   │   ├── reports/
│       │   │   │   ├── report.controller.ts
│       │   │   │   ├── report.routes.ts
│       │   │   │   └── report.service.ts
│       │   │   ├── moderation/
│       │   │   │   ├── image-ocr.service.ts
│       │   │   │   ├── moderation-feedback.ts
│       │   │   │   ├── moderation-policy.ts
│       │   │   │   └── moderation.service.ts
│       │   │   └── public/
│       │   │       ├── public-message.controller.ts
│       │   │       └── public-message.routes.ts
│       │   ├── events/
│       │   │   ├── domain-events.ts
│       │   │   └── register-events.ts
│       │   ├── jobs/
│       │   │   ├── deliver-message-collections.job.ts
│       │   │   ├── retry-failed-moderation.job.ts
│       │   │   ├── retry-pending-notifications.job.ts
│       │   │   ├── send-arrival-hints.job.ts
│       │   │   └── send-pending-messages.job.ts
│       │   ├── processors/
│       │   │   ├── notification-provider.ts
│       │   │   └── notification.processor.ts
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
│       └── maeari.conf.template
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

- 설계 문서: `MAEARI_DB_SCHEMA.md`
- 실제 Prisma schema: `packages/database/prisma/schema.prisma`

최종안은 기존 단일 `Message.receiverId` 중심 초안보다 확장성을 높이기 위해 `Message`와 `MessageRecipient`를 분리합니다. v1에서는 메시지 하나에 여러 `MessageRecipient`를 연결하는 그룹 전송까지 구현했습니다.

## 7.1 핵심 엔티티

실제 기준은 `packages/database/prisma/schema.prisma`입니다. 현재 MVP schema의 핵심 모델은 다음과 같습니다.

| 모델 | 책임 |
| --- | --- |
| `User` | 카카오 로그인 사용자, 친구 코드, 온보딩 정보 |
| `UserContact` | 사용자가 인증한 이메일/전화번호. PHONE은 마음쓰기 권한, EMAIL은 수신 연결용 |
| `UserContactVerification` | 연락처 OTP hash, 만료, 시도 횟수 |
| `PhoneVerificationAttempt` | PHONE 인증 요청/발송/차단/실패 이력 |
| `PhoneVerificationLock` | PHONE 인증 abuse 방어용 IP/contact 잠금 |
| `PhoneNumberLookupCache` | Twilio Lookup v2 결과 cache |
| `FriendRequest` | 친구 코드 기반 요청, 수락/거절/취소/만료 상태 |
| `Friendship` | 수락된 친구 관계, 정렬된 user pair unique |
| `FriendInviteLink` | 친구 초대 링크 token hash, 만료, 사용 횟수, 폐기 상태 |
| `Message` | 제목, 본문, 감정 태그, 예약 시간, 숨김 옵션, moderation 상태, 발신 PHONE snapshot, 발신함 삭제 timestamp |
| `MessageRecipient` | 수신자별 snapshot, `SELF`/`FRIEND`/`OTHER`, 발송 상태, 가입자 귀속, 수신함 삭제 timestamp |
| `MessageAttachment` | 첨부 이미지 metadata, public URL, OCR 결과 |
| `MessageReply` | 공개 링크 익명 답장, moderation 상태, 발신자 읽음/삭제/알림 상태 |
| `MessageAccessToken` | 공개 링크 token hash, 열람 횟수, 가입 후 귀속 정보 |
| `ModerationLog` | OpenAI Moderation 및 guardrail 검사 이력 |
| `NotificationLog` | IN_APP/Gmail SMTP/Solapi 발송 이력, 답장/마음나무 알림, retry, idempotency |
| `ContactSuppression` | EMAIL/SMS 수신거부 연락처 HMAC hash |
| `MessageReport` | 공개 링크/상세 화면 신고와 관리자 검토 상태 |
| `MessageCollection` | 마음나무 공개 수집 링크, owner, 도착 시각, 상태 |
| `MessageCollectionSubmission` | 비회원 마음나무 제출 편지, moderation, IP hash, owner 열람 상태 |

## 7.2 현재 Prisma schema 기준 요약

```txt
User
  -> Message(sender)
  -> MessageRecipient(receiverUser)
  -> FriendRequest(requester/addressee)
  -> Friendship(userA/userB)
  -> UserContact[]
  -> MessageCollection(owner)

Message
  -> MessageRecipient[]
  -> MessageAttachment[]
  -> MessageReply[]
  -> ModerationLog[]
  -> senderDeletedAt으로 발신자 보관함 soft delete

MessageRecipient
  -> MessageAccessToken[]
  -> NotificationLog[]
  -> MessageReply[]
  -> receiverDeletedAt으로 수신자 보관함 soft delete

MessageAccessToken
  -> tokenHash만 저장하고 raw token은 URL에만 노출

NotificationLog
  -> messageRecipientId 또는 targetUserId/messageReplyId/messageCollectionId
  -> channel, provider, idempotencyKey, attemptCount, nextRetryAt, providerMessageId

ContactSuppression
  -> unique(channel, contactHash)

MessageCollection
  -> MessageCollectionSubmission[]
  -> 공개 마음나무 tokenHash와 도착 상태
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

보관함 삭제는 상태별 혼합 정책을 사용합니다. 발신함에서는 `PENDING`, `MODERATION_FAILED`, `CANCELED` 메시지를 hard delete하고, 이미 도착했거나 실패한 `SENT`, `FAILED` 메시지는 `Message.senderDeletedAt`으로 발신자 화면에서만 제외합니다. 수신함에서는 `MessageRecipient.receiverDeletedAt`을 기준으로 사용자별 soft delete를 적용합니다. 이 방식은 이미 외부에 도착했거나 감사 추적이 필요한 공개 링크 token, notification log, moderation log를 보존하면서 사용자 화면에서는 삭제된 것처럼 동작하게 합니다.

## 7.3 receiverInfo JSON 예시

MVP에서는 메시지와 수신자를 분리해 `MessageRecipient`를 생성합니다. `receiverInfo`는 작성 시점 입력값의 snapshot이며, 가입자 귀속은 `MessageRecipient.receiverUserId`로 관리합니다.

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
  "phone": "<receiver-phone>",
  "preferredChannel": "AUTO"
}
```

친구에게 보내는 경우:

```json
{
  "type": "FRIEND",
  "friendshipId": "uuid",
  "userId": "uuid"
}
```

가입 후 메시지가 수신함에 귀속되면 DB는 다음처럼 해석됩니다.

```txt
MessageRecipient.receiverInfo    -> 최초 작성자가 입력한 수신자 정보 snapshot
MessageRecipient.receiverUserId  -> 실제 가입한 User.id
MessageAccessToken               -> 어떤 token이 어떤 User에게 귀속되었는지 기록
```

## 7.4 이미 확장된 모델과 이후 확장 후보

그룹 전송과 가입자 수신함을 위한 핵심 분리는 반영되어 있고, v1 그룹 전송도 구현되었습니다. 예전 후순위로 두었던 답장, 첨부, 신고, moderation log, 감정 리포트, 마음나무는 현재 schema와 API에 반영되어 있습니다.

이미 구현된 확장 모델:

- `MessageAttachment`: 이미지 첨부 metadata, public URL, OCR 결과
- `MessageReply`: 공개 링크 익명 답장, 발신자 답장함 읽음/삭제 상태
- `MessageReport`: 메시지 신고와 관리자 검토 상태
- `ModerationLog`: OpenAI moderation/guardrail 검사 이력
- `NotificationLog`: 메시지, 답장, 마음나무 알림 이력
- `MessageCollection`, `MessageCollectionSubmission`: 마음나무 공개 수집 링크와 비회원 제출물

이후 추가 후보:

- `NotificationPreference`: 사용자별 채널 선호/무음 시간/빈도 제한
- `UserBlock`: 친구 차단, 특정 사용자 차단
- `DeviceSession` 또는 `LoginSession`: 세션/기기 단위 보안 관리
- `AuditLog`: 관리자 조치, 계정 정지, 신고 처리 이력 별도 감사 로그
- `ProviderCredentialAudit`: 운영 provider 설정 변경 이력

## 7.5 친구 및 외부 수신 확장 스키마

친구에게 보내는 메시지와 외부 연락처로 보내는 메시지는 수신자 식별 방식이 다릅니다. 따라서 `MessageRecipient`를 계속 중심 모델로 사용하되, `RecipientType`을 `SELF`, `FRIEND`, `OTHER`로 확장합니다.

### User 확장

```prisma
model User {
  id         String  @id @default(uuid()) @db.Uuid
  kakaoId    String  @unique @db.VarChar(64)
  nickname   String  @db.VarChar(80)
  email      String? @db.VarChar(255)
  friendCode String  @unique @db.VarChar(20)

  sentFriendRequests     FriendRequest[] @relation("FriendRequestRequester")
  receivedFriendRequests FriendRequest[] @relation("FriendRequestAddressee")
  friendshipsAsA         Friendship[]    @relation("FriendshipUserA")
  friendshipsAsB         Friendship[]    @relation("FriendshipUserB")
}
```

`friendCode`는 가입 직후 서버가 생성합니다. 사용자는 이 코드를 복사하거나 초대 링크로 공유하고, 다른 사용자는 코드를 입력해 친구 요청을 보냅니다. 닉네임 전체 검색은 동명이인과 개인정보 노출 위험이 있으므로 MVP에서는 제공하지 않습니다.

### 친구 요청과 친구 관계

```prisma
enum FriendRequestStatus {
  PENDING
  ACCEPTED
  REJECTED
  CANCELED
  EXPIRED
}

model FriendRequest {
  id          String              @id @default(uuid()) @db.Uuid
  requesterId String             @db.Uuid
  addresseeId String             @db.Uuid
  status      FriendRequestStatus @default(PENDING)
  message     String?             @db.VarChar(120)
  expiresAt   DateTime            @db.Timestamptz(3)
  respondedAt DateTime?           @db.Timestamptz(3)
  createdAt   DateTime            @default(now()) @db.Timestamptz(3)
  updatedAt   DateTime            @updatedAt @db.Timestamptz(3)

  requester User @relation("FriendRequestRequester", fields: [requesterId], references: [id], onDelete: Cascade)
  addressee User @relation("FriendRequestAddressee", fields: [addresseeId], references: [id], onDelete: Cascade)

  @@index([requesterId, status])
  @@index([addresseeId, status])
  @@index([expiresAt])
}

model Friendship {
  id          String    @id @default(uuid()) @db.Uuid
  userAId     String    @db.Uuid
  userBId     String    @db.Uuid
  createdById String    @db.Uuid
  deletedAt   DateTime? @db.Timestamptz(3)
  createdAt   DateTime  @default(now()) @db.Timestamptz(3)
  updatedAt   DateTime  @updatedAt @db.Timestamptz(3)

  userA User @relation("FriendshipUserA", fields: [userAId], references: [id], onDelete: Cascade)
  userB User @relation("FriendshipUserB", fields: [userBId], references: [id], onDelete: Cascade)

  @@unique([userAId, userBId])
  @@index([userAId, deletedAt])
  @@index([userBId, deletedAt])
}
```

`Friendship.userAId`, `userBId`는 항상 UUID 문자열 오름차순으로 저장합니다. 이렇게 하면 A->B, B->A가 중복 생성되지 않습니다. 친구 삭제는 `deletedAt` soft delete로 처리해 과거 메시지의 수신자 snapshot과 감사 로그를 보존합니다.

### MessageRecipient 확장

```prisma
enum RecipientType {
  SELF
  FRIEND
  OTHER
}

model MessageRecipient {
  id             String        @id @default(uuid()) @db.Uuid
  messageId      String        @db.Uuid
  receiverUserId String?       @db.Uuid
  receiverType   RecipientType
  receiverName   String?       @db.VarChar(80)
  receiverEmail  String?       @db.VarChar(255)
  receiverPhone  String?       @db.VarChar(32)
  receiverInfo   Json?
}
```

친구 수신자는 `receiverType = FRIEND`, `receiverUserId = 친구 User.id`로 저장합니다. `receiverInfo`에는 작성 시점의 친구 닉네임과 `friendshipId` snapshot을 저장합니다. 친구 삭제 후에도 이미 예약된 메시지는 기존 수신자에게 도착하되, 발신자가 발송 전 취소할 수 있습니다.

외부 수신자는 `receiverType = OTHER`로 저장하고, `receiverEmail` 또는 `receiverPhone` 중 하나가 반드시 있어야 합니다. 둘 다 있고 `preferredChannel = AUTO`인 경우 MVP 기본 발송 우선순위는 `EMAIL -> SMS`입니다. 사용자가 SMS를 명시 선택한 경우 SMS만 시도하며 EMAIL fallback은 하지 않습니다.

### NotificationLog 확장

Gmail SMTP, Solapi SMS를 포함한 외부 알림의 재시도와 idempotency를 위해 `NotificationLog`에 다음 필드를 추가합니다.

```prisma
model NotificationLog {
  id                 String  @id @default(uuid()) @db.Uuid
  messageRecipientId String  @db.Uuid
  channel            NotificationChannel
  status             NotificationStatus
  provider           String? @db.VarChar(80)
  idempotencyKey     String  @unique @db.VarChar(160)
  attemptCount       Int     @default(0)
  nextRetryAt        DateTime? @db.Timestamptz(3)
  providerMessageId  String? @db.VarChar(160)
  payload            Json?
  errorCode          String? @db.VarChar(120)
  errorMessage       String? @db.Text
}
```

`idempotencyKey`는 `messageRecipientId:eventType:channel` 형식으로 생성합니다. 같은 수신자에게 같은 도착 알림이 중복 발송되지 않도록 provider 호출 전 `NotificationLog`를 먼저 생성하고, 이미 같은 key가 있으면 기존 로그를 재사용합니다.

## 7.6 친구/외부 수신 오류 및 실패 관리

친구 기능 오류 코드는 다음 기준으로 통일합니다.

| 코드 | HTTP | 상황 |
| --- | --- | --- |
| `FRIEND_CODE_NOT_FOUND` | 404 | 입력한 친구 코드에 해당하는 사용자가 없음 |
| `FRIEND_SELF_NOT_ALLOWED` | 400 | 자기 자신에게 친구 요청 |
| `FRIEND_REQUEST_ALREADY_PENDING` | 409 | 같은 대상에게 대기 중인 요청이 이미 있음 |
| `FRIENDSHIP_ALREADY_EXISTS` | 409 | 이미 친구 관계가 있음 |
| `FRIEND_REQUEST_NOT_FOUND` | 404 | 처리할 친구 요청을 찾을 수 없음 |
| `FRIEND_REQUEST_FORBIDDEN` | 403 | 요청 수신자가 아닌 사용자가 수락/거절 시도 |
| `FRIEND_REQUEST_EXPIRED` | 410 | 요청 유효 기간 만료 |
| `FRIENDSHIP_NOT_FOUND` | 404 | 친구 삭제 또는 친구 수신자 선택 시 관계 없음 |

외부 발송 실패 코드는 다음 기준으로 기록합니다.

| 코드 | 재시도 | 처리 |
| --- | --- | --- |
| `NOTIFICATION_PROVIDER_NOT_CONFIGURED` | 아니오 | `SKIPPED`, 수신자 `FAILED` |
| `CONTACT_SUPPRESSED` | 아니오 | `SKIPPED`, 수신자 `FAILED` |
| `SMTP_AUTH_FAILED` | 아니오 | `FAILED`, Gmail 계정/앱 비밀번호 확인 |
| `SMTP_RATE_LIMITED` | 예 | 지수 backoff 후 재시도 |
| `SMTP_TEMPORARY_FAILURE` | 예 | 지수 backoff 후 재시도 |
| `SMTP_SEND_FAILED` | 아니오 | provider 거절 사유 저장 |
| `SOLAPI_AUTH_FAILED` | 아니오 | `FAILED`, Solapi API key/secret 확인 |
| `SOLAPI_INSUFFICIENT_BALANCE` | 아니오 | `FAILED`, 잔액 충전 필요 |
| `SOLAPI_INVALID_SENDER` | 아니오 | `FAILED`, 발신번호 등록/형식 확인 |
| `SOLAPI_INVALID_RECEIVER` | 아니오 | `FAILED`, 수신번호 형식 확인 |
| `SOLAPI_RATE_LIMITED` | 예 | 지수 backoff 후 재시도 |
| `SOLAPI_NETWORK_ERROR` | 예 | 지수 backoff 후 재시도 |
| `SOLAPI_SERVER_ERROR` | 예 | 지수 backoff 후 재시도 |
| `INVALID_RECEIVER_CONTACT` | 아니오 | 입력값 검증 실패, 메시지 생성 차단 |
| `DELIVERY_RETRY_EXHAUSTED` | 아니오 | 최종 실패 처리 |

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

## 9.1.1 Contact API

| Method | Endpoint | 인증 | 설명 |
| --- | --- | --- | --- |
| GET | `/api/me/contacts` | 필요 | 내 연락처 인증 목록과 `writerEligibility.hasVerifiedStrictPhone` 조회 |
| POST | `/api/me/contacts` | 필요 | 이메일/전화번호 연락처 추가 및 OTP 발송. PHONE은 strict 010, rate limit, Twilio Lookup guard 적용 |
| POST | `/api/me/contacts/:id/send-code` | 필요 | OTP 인증 코드 재발송 |
| POST | `/api/me/contacts/:id/verify` | 필요 | OTP 인증 코드 검증 |
| PATCH | `/api/me/contacts/:id` | 필요 | 연락처 label 수정. `isPrimary`는 active PHONE 교체/내부 우선순위 관리에 사용 |
| DELETE | `/api/me/contacts/:id` | 필요 | 연락처 soft delete. verified PHONE은 삭제 불가, 새 번호 인증으로만 변경 |

PHONE 인증 정책:

- `normalizeStrictKoreanMobilePhone`은 `01012345678`, `010-1234-5678`, `+821012345678`, `821012345678`를 `01012345678`로 정규화합니다.
- `^010\d{8}$`가 아니면 `CONTACT_PHONE_INVALID`입니다.
- 동일 연락처 10분 내 3회 초과 요청은 CONTACT 24시간 lock입니다.
- 동일 IP에서 1시간 내 서로 다른 번호 5개 초과 요청은 IP 1시간 lock입니다.
- OTP는 10분 만료, 60초 재발송 cooldown, 5회 실패 시 만료입니다.
- Twilio Lookup provider 장애는 `PHONE_LOOKUP_UNAVAILABLE`로 fail-closed 처리합니다.

## 9.2 Message API

| Method | Endpoint | 인증 | 설명 |
| --- | --- | --- | --- |
| GET | `/api/time` | 불필요 | 서버 기준 현재 시각과 기본 예약 시각(+24h) 조회 |
| POST | `/api/messages` | 필요 | 메시지 작성 및 예약. 서버가 verified strict PHONE을 직접 선택하고 `senderContactId` payload는 무시 |
| GET | `/api/messages/sent` | 필요 | 내가 보낸 메시지 목록 |
| GET | `/api/messages/received` | 필요 | 내가 받은 메시지 목록 |
| GET | `/api/messages/archived` | 필요 | 내가 아카이브한 받은 메시지 목록 |
| POST | `/api/messages/bulk-delete` | 필요 | 여러 메시지를 내 보관함에서 일괄 제거 |
| GET | `/api/messages/:id` | 필요 | 메시지 상세 조회 |
| PATCH | `/api/messages/:id/cancel` | 필요 | 예약 메시지 취소 |
| PATCH | `/api/messages/:id/archive` | 필요 | 받은 메시지 아카이브 |
| PATCH | `/api/messages/:id/unarchive` | 필요 | 받은 메시지 아카이브 복구 |
| DELETE | `/api/messages/:id` | 필요 | 보낸/받은 마음을 내 보관함에서 제거. 발신자는 상태별 hard/soft delete 정책 적용 |

## 9.3 Public API

| Method | Endpoint | 인증 | 설명 |
| --- | --- | --- | --- |
| GET | `/api/public/messages/:token` | 불필요 | 비회원 링크로 메시지 조회 |
| POST | `/api/public/messages/:token/replies` | 불필요 | 공개 링크 익명 답장 작성 |
| POST | `/api/public/messages/:token/reports` | 불필요 | 공개 링크 메시지 신고 |
| POST | `/api/public/notification-suppressions` | 불필요 | 이메일/SMS 알림 수신거부 |
| DELETE | `/api/public/notification-suppressions` | 불필요 | 이메일/SMS 알림 다시 받기 |

## 9.3.1 Report API

| Method | Endpoint | 인증 | 설명 |
| --- | --- | --- | --- |
| GET | `/api/reports/emotions` | 필요 | 월별 감정 리포트 조회 |

## 9.3.2 Admin API

| Method | Endpoint | 인증 | 설명 |
| --- | --- | --- | --- |
| GET | `/api/admin/overview` | 관리자 | 운영 요약 조회 |
| GET | `/api/admin/moderation-logs` | 관리자 | moderation 검사 로그 조회 |
| GET | `/api/admin/notification-logs` | 관리자 | 외부 알림 로그 조회 |
| GET | `/api/admin/replies` | 관리자 | 익명 답장 검수 목록 조회 |
| GET | `/api/admin/reports` | 관리자 | 신고 검수 목록 조회 |
| PATCH | `/api/admin/replies/:id/hide` | 관리자 | 익명 답장 숨김 처리 |
| PATCH | `/api/admin/reports/:id/review` | 관리자 | 신고 검토 완료/기각 |
| PATCH | `/api/admin/users/:id/suspend` | 관리자 | 사용자 계정 정지 |
| PATCH | `/api/admin/users/:id/unsuspend` | 관리자 | 사용자 계정 정지 해제 |

## 9.3.3 Friend API

| Method | Endpoint | 인증 | 설명 |
| --- | --- | --- | --- |
| GET | `/api/friends` | 필요 | 내 친구 목록 조회 |
| GET | `/api/friends/requests` | 필요 | 받은/보낸 친구 요청 목록 조회 |
| GET | `/api/friends/search` | 필요 | 닉네임 또는 친구 코드 기반 친구 후보 검색 |
| POST | `/api/friends/invites` | 필요 | 24시간 유효한 1회성 친구 초대 링크 생성 |
| GET | `/api/friends/invites/active` | 필요 | 내가 만든 활성 초대 링크 목록 조회 |
| GET | `/api/friends/invites/:token/preview` | 불필요 | 초대 링크 초대자와 사용 가능 상태 미리보기 |
| POST | `/api/friends/invites/:token/claim` | 필요 | 로그인 사용자가 초대 링크로 친구 연결 |
| DELETE | `/api/friends/invites/:id` | 필요 | 내가 만든 초대 링크 폐기 |
| POST | `/api/friends/requests` | 필요 | 친구 코드로 친구 요청 생성 |
| PATCH | `/api/friends/requests/:id/accept` | 필요 | 받은 친구 요청 수락 및 Friendship 생성 |
| PATCH | `/api/friends/requests/:id/reject` | 필요 | 받은 친구 요청 거절 |
| PATCH | `/api/friends/requests/:id/cancel` | 필요 | 내가 보낸 대기 요청 취소 |
| DELETE | `/api/friends/:friendshipId` | 필요 | 친구 관계 soft delete |

친구 요청 생성 request:

```json
{
  "friendCode": "ABCD-1234",
  "message": "나야, 친구 추가해줘"
}
```

친구 목록 response:

```json
{
  "friends": [
    {
      "friendshipId": "uuid",
      "userId": "uuid",
      "nickname": "김윤서",
      "profileImageUrl": null,
      "createdAt": "2026-07-04T01:00:00.000Z"
    }
  ]
}
```

## 9.4 Notification Provider 내부 설계

외부 발송은 공개 HTTP API로 직접 노출하지 않고 `NotificationProcessor` 내부에서 실행합니다. `ExternalNotificationProvider` dispatcher는 Gmail SMTP와 Solapi provider를 같은 내부 인터페이스로 다룹니다.

```ts
type SendNotificationInput = {
  channel: "SMS" | "EMAIL";
  to: string;
  receiverName: string | null;
  publicUrl: string;
  subject?: string;
  text: string;
  html?: string;
  idempotencyKey: string;
};

type SendNotificationResult = {
  status: "SENT" | "RETRYABLE_FAILED" | "FAILED";
  provider: string;
  providerMessageId?: string;
  errorCode?: string;
  errorMessage?: string;
};
```

EMAIL 채널은 Gmail SMTP provider를 사용하고, SMS 채널은 Solapi provider를 사용합니다. 해당 채널 provider가 꺼져 있거나 필수 설정이 없으면 성공 처리하지 않고 `NotificationLog.status = SKIPPED`, `MessageRecipient.deliveryStatus = FAILED`, `errorCode = NOTIFICATION_PROVIDER_NOT_CONFIGURED`로 기록합니다. Gmail SMTP와 Solapi 응답에서 확보한 provider message id 또는 group id는 `NotificationLog.providerMessageId`에 저장합니다.

## 9.5 Auth Link Message API

비회원이 `/arrival/[token]`으로 메시지를 열람한 뒤 카카오 로그인을 완료하면, 프론트엔드가 이 API를 호출해 메시지를 로그인한 사용자의 수신함에 귀속합니다.

### Request

```json
{
  "token": "public-access-token"
}
```

### 처리 규칙

- 인증된 사용자만 호출할 수 있습니다.
- route token을 `PUBLIC_TOKEN_PEPPER` 기반 HMAC-SHA256으로 처리한 `MessageAccessToken.tokenHash`가 존재해야 합니다.
- token이 만료되지 않아야 합니다.
- token이 폐기되지 않아야 합니다.
- 연결된 메시지가 `SENT` 상태여야 합니다.
- 이미 다른 사용자에게 귀속된 token이면 `409 Conflict`를 반환합니다.
- 정상 처리 시 `MessageRecipient.receiverUserId`를 로그인한 `User.id`로 업데이트합니다.
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

### link-message service 현재 구현 요약

현재 구현 파일은 `apps/api/src/modules/auth/link-message.service.ts`입니다.

```txt
1. token 필수 검증
2. hashPublicToken(token)으로 tokenHash 생성
3. MessageAccessToken.tokenHash 조회
4. revokedAt, expiresAt, message.status=SENT 검증
5. 이미 다른 사용자에게 linkedUserId가 있으면 409
6. 같은 사용자가 재호출하면 idempotent success
7. transaction으로 MessageRecipient.receiverUserId 업데이트
8. MessageAccessToken.linkedUserId, linkedAt 업데이트
9. /inbox redirect 정보 반환
```

## 9.6 메시지 작성 Request 예시

메시지 작성 요청에는 `senderContactId`를 포함하지 않습니다. 악의적 API 조작을 막기 위해 포함되어 들어와도 서버는 무시하고, 현재 로그인 사용자의 active verified strict PHONE을 직접 조회해 `Message.senderContactId`와 `senderContactSnapshot`을 저장합니다.

친구에게 보내는 경우:

```json
{
  "receiverInfo": {
    "type": "FRIEND",
    "friendshipId": "uuid",
    "userId": "uuid"
  },
  "title": "언젠가 너에게 도착할 말",
  "content": "오늘의 고마움을 미래의 너에게 남겨두고 싶어.",
  "emotionTag": "THANKS",
  "scheduledAt": "2026-12-25T09:00:00.000Z",
  "isSenderHidden": false,
  "isDateHidden": true
}
```

친구가 아닌 외부 수신자에게 보내는 경우:

```json
{
  "receiverInfo": {
    "type": "OTHER",
    "name": "<receiver-name>",
    "email": "<receiver-email>",
    "phone": null,
    "preferredChannel": "AUTO"
  },
  "title": "언젠가 너에게 도착할 말",
  "content": "오늘의 고마움을 미래의 너에게 남겨두고 싶어.",
  "emotionTag": "THANKS",
  "scheduledAt": "2026-12-25T09:00:00.000Z",
  "isSenderHidden": false,
  "isDateHidden": true
}
```

`receiverInfo.type = OTHER`이면 `email` 또는 `phone` 중 하나가 반드시 필요합니다. `preferredChannel = AUTO`일 때는 이메일이 있으면 EMAIL, 이메일이 없고 전화번호만 있으면 SMS를 선택합니다.

첨부 이미지가 있는 경우 web은 `multipart/form-data`로 전송합니다.

```txt
payload: JSON.stringify(createMessageRequestWithoutAttachments)
attachments: File[]
```

API는 `message-upload.middleware.ts`에서 `payload` JSON을 파싱하고, `attachments` 파일을 memory buffer로 받은 뒤 MIME type, 원본 파일 확장자, 개수, 개별 용량, 총량을 검증해 service 입력의 `attachments[]`로 변환합니다. 첨부가 없으면 일반 JSON body도 허용합니다.

multipart 제한은 file count와 field count를 엄격하게 유지하되, parser parts 제한은 `MAX_ATTACHMENT_COUNT + 2`로 둡니다. 이 값은 `payload` field와 이미지 3개가 함께 들어오는 정상 요청을 허용하기 위한 여유이며, 이미지 4개 이상은 계속 `TOO_MANY_ATTACHMENTS`로 차단합니다.

첨부 형식 allowlist는 다음과 같습니다.

```txt
허용 확장자: .jpg, .jpeg, .png, .webp
허용 MIME: image/jpeg, image/png, image/webp
```

프론트엔드는 파일 선택창의 `accept`와 `createAttachmentDraft` 검증에서 같은 allowlist를 사용합니다. 서버는 multer 단계에서 MIME과 확장자를 확인하고, `persistAttachments` 직전에 파일 매직바이트를 다시 검사합니다.

```txt
JPEG: FF D8 FF
PNG:  89 50 4E 47 0D 0A 1A 0A
WEBP: RIFF .... WEBP
```

따라서 확장자만 바꾼 파일, 잘못된 MIME type, GIF/HEIC/PDF/텍스트 파일은 저장 전에 `ATTACHMENT_TYPE_UNSUPPORTED`로 차단됩니다.

## 9.7 메시지 작성 Response 예시

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

매아리는 따뜻한 메시지 경험을 핵심 가치로 삼습니다.

따라서 메시지가 DB에 저장되기 전 OpenAI Moderation API를 호출하여 유해성을 검사합니다.

## 10.2 검사 대상

아래 필드를 하나의 moderation input으로 묶어 검사합니다.

- title
- content
- emotionTag

수신자 이름이나 연락처는 개인정보가 포함될 수 있으므로 moderation 대상에 넣지 않는 것을 권장합니다.

현재 구현에서는 `buildModerationInputText`가 다음처럼 라벨을 붙여 OpenAI Moderations API에 넘깁니다.

```txt
제목: <title>

감정 태그: <emotionTag 또는 없음>

본문:
<content>
```

라벨을 붙이는 이유는 모델이 제목, 감정 태그, 본문을 구분해 더 안정적으로 판단하도록 돕기 위해서입니다.

## 10.3 차단 기준

현재 구현은 단일 OpenAI Moderation 결과만으로 결정하지 않고 다음 순서로 검사합니다.

```txt
1. 로컬 한국어 욕설/비하 표현 보강 검사
2. OpenAI Moderations API 검사
3. 매아리 서비스 정책 guardrail prompt 기반 2차 검사
```

OpenAI Moderation 결과에서 `flagged = true`인 경우 저장하지 않습니다. `flagged = false`이더라도 guardrail prompt가 `allowed = false`를 반환하면 저장하지 않습니다.

운영 정책상 특히 강하게 차단해야 하는 범위는 다음과 같습니다.

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
- profanity
- degrading name-calling
- body-shaming
- disability/intelligence insults
- sexual insults
- slur dictionaries or copied abusive-term lists

### 10.3.1 매아리 guardrail prompt

OpenAI Moderations API는 범용 safety classifier이므로, “예약 메시지가 실제 수신자에게 직접 도착한다”는 제품 맥락을 알지 못합니다. 따라서 다음 파일에 서비스 전용 prompt를 둡니다.

```txt
apps/api/src/modules/moderation/moderation-policy.ts
```

guardrail prompt의 핵심 정책:

- 매아리는 한국어 중심의 private scheduled message service입니다.
- 판단 대상은 작성자의 의도 추정이 아니라 수신자에게 전달될 메시지 자체입니다.
- 욕설, 성적 모욕, 비하적 별명, 혐오/괴롭힘, 신체/지능/장애/사회적 지위 비하를 차단합니다.
- 욕설 사전, 비하어 목록, 모욕적 단어의 설명도 메시지 본문으로 전달되면 차단합니다.
- 안전하지 않은 단어가 교육/설명 목적으로 보이더라도, 매아리에서는 수신자에게 그대로 전달되므로 차단하는 쪽으로 판단합니다.
- 결과는 strict JSON으로 받습니다.

응답 schema:

```json
{
  "allowed": false,
  "categories": ["harassment", "degrading-name-calling"],
  "severity": "medium",
  "feedback": "받는 사람이 편안하게 읽을 수 있도록 표현을 조금 더 부드럽게 다듬어 주세요.",
  "rationale": "The message contains a list of insulting and degrading expressions."
}
```

이 prompt는 AI의 “판단력”에만 의존하지 않고, 매아리의 제품 정책을 명시적으로 전달하기 위한 장치입니다.

현재 parser는 위 schema를 1차 기준으로 사용합니다. 또한 배포 중 남아 있을 수 있는 legacy prompt 응답인 `is_harmful`, `confidence_score`, `violation_category`, `reason` 형식도 normalize해, schema mismatch 자체가 메시지 전달 실패로 이어지지 않도록 처리합니다.

### 10.3.2 로컬 한국어 보강 규칙

스크린샷 사례처럼 명백한 한국어 욕설/비하 표현이 포함된 경우에는 OpenAI 호출 전 로컬 규칙으로도 차단합니다.

현재 보강 대상 예시:

- 일반 욕설: `씨발`, `시발`, `병신`, `좆`, `지랄`, `개새끼` 등
- 비하 표현: `땅딸보`, `똥개`, `똥꼬충`, `딸피` 등
- 성적 모욕 또는 비하 맥락 표현: `딸딸이`, `마스터베이션 아미` 등
- 우회 표기: 기호/숫자/공백 삽입(`개 새 끼`, `미.친.놈`), 자모 축약(`ㅅㅂ`, `ㅂㅅ`, `ㅈㄴ`, `ㄲㅈ`), 의도적 오타(`쒸발`, `섀끼`, `븽신`) 등
- 띄어쓰기, 일부 변형, 영문 표기를 정규화한 뒤 검사

이 목록은 완전한 금칙어 사전이 아니라, 실제 통과 사례를 바탕으로 추가되는 최소 안전망입니다. 넓은 문맥 판단은 guardrail prompt가 담당합니다.

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

매아리의 서비스 철학상 유해성 검사를 통과하지 못한 메시지는 수신자에게 전달하지 않습니다.

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

스케줄러는 예약 시간이 된 메시지를 `SENT`로 바꾸고 `message.sent` event만 발행합니다. 실제 서비스 내 알림, Gmail SMTP 이메일, Solapi 문자, 실패 재시도는 `NotificationProcessor`가 담당합니다.

Gmail SMTP 또는 Solapi 중 해당 채널에 사용할 provider가 없으면 fake 발송 성공을 만들지 않습니다. 외부 수신자에게 실제 알림을 보낼 수 없는 경우 `NotificationLog.status = SKIPPED`, `MessageRecipient.deliveryStatus = FAILED`로 저장해 발송 성공처럼 보이지 않게 합니다.

```ts
import { EventEmitter } from "node:events";

export const domainEvents = new EventEmitter();

export const MESSAGE_SENT_EVENT = "message.sent";

export type MessageSentEventPayload = {
  messageId: string;
  recipientIds: string[];
  sentAt: Date;
};
```

### Scheduler 책임

```ts
domainEvents.emit(MESSAGE_SENT_EVENT, {
  messageId: message.id,
  recipientIds,
  sentAt,
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
- 친구 수신자에게 서비스 내 알림 생성
- 외부 수신자에게 공개 링크를 포함한 이메일 또는 문자 발송
- `receiverInfo.preferredChannel = AUTO`이면 이메일을 우선 사용하고, 이메일이 없을 때 SMS를 사용
- NotificationLog 저장
- provider 호출 전 idempotency key로 중복 발송 방지
- retryable 실패 시 `NotificationLog.status = PENDING`, `nextRetryAt` 기록
- 최종 실패 시 `NotificationLog.status = FAILED`, `MessageRecipient.deliveryStatus = FAILED`
- 알림 실패 시 메시지 상태를 되돌리지 않고 알림 실패 로그만 남김
- provider 미설정으로 외부 알림이 나가지 않은 경우 수신자 발송 상태를 실패로 표시

외부 발송 메시지 본문에는 실제 편지 본문을 넣지 않습니다. 이메일/SMS에는 “마음이 도착했어요” 안내, 수신자 이름, 공개 열람 링크만 포함합니다. 발신인 숨김이 켜져 있으면 발신자 이름을 알림 payload와 발송 문구에 포함하지 않습니다.

## 11.5.1 외부 알림 provider 발송 처리 흐름

```txt
1. NotificationProcessor가 message.sent event 수신
2. MessageRecipient와 최신 MessageAccessToken 조회
3. 친구/자기 자신 수신자는 IN_APP 로그 생성 후 deliveredAt 기록
4. 외부 수신자는 이메일/전화번호 존재 여부와 preferredChannel로 channel 결정
5. NotificationLog를 PENDING으로 먼저 생성하거나 기존 idempotencyKey 로그 재사용
6. 선택된 channel의 연락처를 정규화하고 ContactSuppression 조회
7. 수신거부된 연락처이면 provider 호출 없이 NotificationLog=SKIPPED, errorCode=CONTACT_SUPPRESSED
8. EMAIL은 Gmail SMTP, SMS는 Solapi provider 호출
9. 성공 시 NotificationLog=SENT, providerMessageId 저장, MessageRecipient=SENT
10. retryable 실패 시 NotificationLog=PENDING, nextRetryAt 저장
11. non-retryable 실패 또는 재시도 한도 초과 시 NotificationLog=FAILED, MessageRecipient=FAILED
```

재시도 job은 `NotificationLog.status = PENDING AND nextRetryAt <= now` 조건으로 실행합니다. 재시도 간격은 1분, 5분, 30분 순서의 지수 backoff를 기본값으로 사용하고, 최대 3회까지 시도합니다.

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
| 메인 | `/` | KST 현재 시각, 작성/발신함/수신함/친구 관리 진입, 브랜드 히어로 |
| 로그인 | `/login` | 카카오 로그인 진입 |
| 온보딩 | `/onboarding` | 감성 질문 및 첫 작성 유도 |
| 메시지 작성 | `/write` | 전화번호 인증 gate, 편지 작성, KST 현재 시각 확인, 서버 기준 +24h 기본 예약일, 옵션 설정 |
| 전화번호 인증 | `/phone-verification` | strict 010 휴대전화 인증번호 발송/검증, 인증 완료 후 `/write` 또는 `/my` 복귀 |
| 발신함 | `/sent` | 내가 보낸 메시지 관리 |
| 수신함 | `/inbox` | 내가 받은 메시지 목록 |
| 친구 | `/friends` | 친구 코드 확인, 친구 초대 링크, 친구 요청, 요청 수락/거절, 친구 삭제 |
| 친구 초대 | `/friends/invite/[token]` | 초대 링크 미리보기와 로그인 후 친구 연결 |
| 공개 열람 | `/arrival/[token]` | 비회원 메시지 확인 |
| 마이페이지 | `/my` | 내 정보, 연락처 인증 상태, 전화번호 변경, 로그아웃 |

## 12.2 메시지 작성 화면 구성

필수 입력:

- 마음쓰기 가능 조건: active verified strict 010 PHONE 보유
- 수신 대상
- 친구 수신자인 경우 친구 선택
- 수신자 이름
- 외부 수신자인 경우 이메일 또는 전화번호 중 하나
- 제목
- 본문
- 감정 태그
- 도착 날짜/시간

상단 보조 정보:

- KST 기준 현재 시각
- 초 단위 실시간 갱신
- 서버 기준 기본 도착 시각: `/api/time`의 `defaultScheduledAt = serverNow + 24h`
- 예약 시간 선택 시 현재 시각을 바로 비교할 수 있는 기준 정보 제공

수신 대상 선택:

- `미래의 나`: 현재 로그인 사용자에게 도착
- `친구`: 이미 수락된 친구 목록에서 선택
- `연락처로 보내기`: 이메일 또는 전화번호 입력

도착 시간 선택:

- 빠른 선택 chip: `오늘 밤 9시`, `내일 아침 9시`, `내일 밤 9시`, `1주 뒤`, `1개월 뒤`
- 직접 설정: 날짜 입력과 1분 단위 시간 입력을 분리
- 보조 선택: `00분`, `15분`, `30분`, `45분` quick minute 버튼 제공
- 선택 결과를 `YYYY년 M월 D일 요일 HH:mm KST` 형식으로 즉시 미리보기
- 키보드 사용자를 위해 날짜/시간 직접 입력을 유지
- 현재보다 과거이거나 너무 가까운 시간은 제출 전 클라이언트와 서버에서 모두 차단

전화번호 인증 gate:

- `/write` mount 시 `GET /api/me/contacts` 호출
- `writerEligibility.hasVerifiedStrictPhone=false`이면 경고 패널 표시
- CTA는 `/phone-verification?next=/write`
- 예약 submit은 비활성화
- API가 `SENDER_PHONE_VERIFICATION_REQUIRED`를 반환하면 `/phone-verification?next=/write`로 이동
- 연락처 select, masked phone/email, `senderContactId` 입력은 화면에 노출하지 않음

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

예약 완료 또는 오류 상태에서는 작성 위치와 무관하게 결과를 확인할 수 있도록 화면 중앙 팝업을 우선 노출합니다. 성공 팝업에는 예약 상태, 예약 시간, 공개 링크의 용도, 예약 상세 보기, 발신함 이동, 새 마음 쓰기, 메인 이동을 함께 제공합니다. 오류/검증 실패 팝업은 확인 버튼으로 닫을 수 있습니다. 공개 링크는 자동 발송 수단이 아니라 수신자가 비회원이거나 외부 provider가 아직 연결되지 않았을 때 도착 후 수동으로 열람할 수 있는 fallback 링크입니다.

AI 검사 실패 상태에서는 `publicUrl`을 보여주지 않습니다. 대신 “작성한 마음은 임시로 보관했고, 하루에 한 번 자동으로 다시 검사할게요.” 안내와 함께 발신함으로 이동할 수 있게 합니다.

## 12.2.1 브랜드 이미지 적용

오늘 반영된 봉투 일러스트는 화면별 목적에 맞춰 다음처럼 사용합니다.

- 브라우저 탭과 모바일 홈 화면: `apps/web/app/icon.png`, `apps/web/app/apple-icon.png`
- 헤더 로고와 작은 브랜드 표식: `apps/web/public/images/maeari-mark.png`
- AppShell 상단 브랜드 아이콘: `apps/web/public/images/maeari-app-icon.png`
- 메인 대시보드/로그인 히어로: `apps/web/public/images/maeari-hero-floral.png`
- 이벤트/보조 히어로 후보: `apps/web/public/images/maeari-hero-night.png`
- AppShell sidebar 감성 패널: `apps/web/public/images/maeari-sidebar-sky.png`
- 메시지/연락처/공개 화면 보조 일러스트: `maeari-card-letter.png`, `maeari-cloud-envelope.png`, `maeari-heart-letter.png`, `maeari-moon-letter.png`, `maeari-star-letter.png`
- 이전 변환 asset인 `maeari-main-envelope.webp`, `maeari-login-envelope.webp`, `maeari-public-envelope.webp`는 보존하되 현재 핵심 화면은 새 PNG asset을 우선 사용합니다.

## 12.2.2 Figma 기반 UI 시스템

Figma 리디자인은 web app의 visual language를 통일하기 위한 presentation layer 작업입니다. 백엔드 API, Prisma schema, scheduler, SMTP/SMS/Twilio/OCR/guardrail 로직은 변경하지 않습니다.

디자인 토큰:

| 목적 | 값 | 사용 위치 |
| --- | --- | --- |
| Primary accent | `#6D48DB` | 주요 CTA, active nav, 강조 icon |
| Primary surface | `#F3EEFD` | active nav 배경, soft highlight |
| Secondary accent | `#9A85E1` | 브랜드 보조 색, hover/focus 보조 |
| App background | `#FBF9FC` | 전체 stage 배경 |
| Secondary gray | `#F3EFF7` | 보조 surface, border 주변 tone |

공통 class:

- `.maeari-stage`: route content를 감싸는 전체 배경입니다. 라벤더 radial gradient와 subtle grid를 사용해 흰 화면이 비어 보이지 않게 합니다.
- `.figma-panel`: card, panel, modal-like block의 기본 시각 단위입니다. radius는 8px, border는 low-contrast lavender, background는 translucent white, shadow는 가볍게 유지합니다.
- `.maeari-input`: input/select/textarea에 적용하는 공통 focus와 border입니다.
- `.maeari-chip`: filter tab, secondary action, small CTA에 쓰는 공통 chip입니다.
- `.maeari-chip-active`: 현재 선택된 filter/tab/segment 상태를 표시합니다.
- `.maeari-action`: 일반 command button의 공통 스타일입니다.
- `.maeari-action-primary`: 주요 CTA에 쓰는 보라색 filled button입니다.
- `.maeari-action-danger`: 취소, 삭제, 신고 등 위험도가 있는 action에 쓰는 low-saturation red button입니다.
- `.maeari-badge`: 상태, 감정, 인증 정보를 짧게 표시하는 badge입니다.
- `.maeari-page-title`, `.maeari-page-copy`: 페이지 heading과 설명 문구를 통일합니다.

공통 component:

- `Button`, `LinkButton`: route별 CTA와 command button의 variant/size를 통일합니다.
- `TextInput`, `TextArea`, `SelectInput`: input family의 radius, focus, border를 통일합니다.
- `PageHeader`: 페이지 제목, 보조 설명, 우측 action 배치를 통일합니다.
- `SectionPanel`: 설정/목록/상세 section의 card 구조를 통일합니다.
- `StatusPill`, `EmotionPill`: 메시지 상태와 감정 태그 표시를 한 곳에서 변환합니다.
- `EmptyState`: 데이터가 없는 목록에서 같은 구조의 빈 상태를 제공합니다.
- `LetterThumb`: 최근 마음/목록 card에서 사용하는 봉투 thumbnail입니다.

Shell 구조:

```txt
AppShell
├── fixed top bar: 74px
│   ├── maeari app icon
│   ├── service name
│   └── profile shortcut
│
├── desktop left sidebar: 221px
│   ├── 홈
│   ├── 마음 보내기
│   ├── 받은 마음
│   ├── 보낸 마음
│   ├── 마음나무
│   ├── 친구
│   ├── 리포트
│   ├── 내 정보
│   └── 오늘의 한 줄 illustration panel
│
├── main stage
│   └── max-width 1190px content
│
└── mobile bottom nav
    ├── 쓰기
    ├── 받은 마음
    ├── 보낸 마음
    ├── 친구
    └── 내 정보
```

현재 적용된 route:

- `/`: `maeari-hero-floral.png` 기반 Figma tone hero, API 기반 timeline, 최근 받은 마음 card, quick cards 적용
- `/write`: 기존 기능을 유지한 상태로 `figma-panel` 기반 양단 form 구조 적용
- `/sent`, `/inbox`, `/archive`, `/future`: 목록 card에 `figma-panel` 적용
- `/messages/[id]`, `/arrival/[token]`: 상세/공개 열람 panel에 `figma-panel` 적용
- `/friends`, `/my`, `/phone-verification`: hero panel과 상태 card에 Figma tone 적용
- `/tree`, `/tree/[token]`: 마음나무 생성/공개 제출 화면에 Figma panel과 QR 공유 적용
- `/admin`, `/reports`: 운영/리포트 화면은 조밀한 정보 구조를 유지하면서 새 panel token만 적용

남은 검증:

- Figma MCP 접근 한도가 풀린 뒤 `Desktop_main`, `Desktop_Writing`, `Desktop_friends`, `Desktop_my` screenshot과 pixel-level spacing을 다시 비교합니다.
- route별 form label, button width, mobile overflow, bottom nav overlap을 수동 QA합니다.
- 새 UI class 도입 후 구 색상 token과 구 radius가 남아 있는지 `rg`로 추적합니다.

## 12.2.3 도착 시간 UX 개선 근거

단일 `datetime-local` 입력은 브라우저마다 UI가 다르고, 사용자가 “언제 보내고 싶은지”보다 “정확한 날짜와 시간을 직접 계산”해야 해서 예약 메시지 경험에 부담을 줍니다. 검색한 디자인 시스템 가이드를 기준으로 다음 원칙을 적용합니다.

- Material Design 3는 date picker를 날짜 또는 기간 선택 도구로, time picker를 특정 시간 선택 도구로 분리해 설명합니다.
- GOV.UK Design System은 사용자가 가까운 미래 날짜를 고르거나 요일 관계를 봐야 할 때 calendar control이 적합하지만, JavaScript calendar를 유일한 입력 수단으로 만들지 말고 직접 입력도 허용하라고 안내합니다.
- U.S. Web Design System은 date picker에서도 날짜를 수동 입력할 수 있게 하고 날짜 형식 힌트를 제공하라고 안내합니다. time picker는 일정 예약처럼 일정한 간격의 시간 선택에 적합하다고 설명합니다.

따라서 매아리는 다음 UX를 채택합니다.

```txt
빠른 프리셋으로 감성적 의도를 먼저 선택
  -> 필요하면 날짜/시간을 직접 수정
  -> 분 단위는 직접 입력하되 15분 버튼으로 빠르게 보정
  -> KST 기준 도착 미리보기로 확정 전 검토
  -> 서버에는 UTC ISO string으로 저장
```

참고 자료:

- https://m3.material.io/components/date-pickers
- https://m3.material.io/components/time-pickers
- https://design-system.service.gov.uk/patterns/dates/
- https://designsystem.digital.gov/components/date-picker/
- https://designsystem.digital.gov/components/time-picker/

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
이 마음을 오래 보관하고 싶다면 매아리에 저장해 보세요.
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
      sessionStorage.setItem("maeari.pendingArrivalToken", token);
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

const PENDING_TOKEN_KEY = "maeari.pendingArrivalToken";

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

`/api/auth/link-message`는 token으로 `MessageAccessToken`을 찾은 뒤 연결된 `MessageRecipient`의 `receiverUserId`를 현재 로그인한 사용자로 업데이트합니다.

```txt
raw route token
  -> hashPublicToken(token)
  -> MessageAccessToken.tokenHash
  -> MessageAccessToken.messageRecipientId
  -> MessageRecipient.receiverUserId = currentUser.id
  -> MessageAccessToken.linkedUserId = currentUser.id
  -> MessageAccessToken.linkedAt = now
```

이렇게 하면 비회원 링크로 받은 메시지도 가입 직후 수신함에서 자연스럽게 다시 볼 수 있습니다.

---

## 13. 인프라 설계

## 13.1 서버 환경

| 항목 | 값 |
| --- | --- |
| Provider | AWS EC2 |
| Instance | t3.medium |
| OS | Ubuntu 24.04 LTS |
| RAM | 4GB |
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

Nginx 설정 파일에는 실제 도메인을 직접 쓰지 않습니다. `infra/nginx/maeari.conf.template` 형태로 관리하고, 배포 시 `.env.production`의 값을 사용해 `envsubst` 또는 배포 스크립트에서 치환합니다.

### Nginx site config template 초안

```nginx
server {
    listen 80;
    server_name ${SERVICE_DOMAIN} ${WWW_SERVICE_DOMAIN};

    client_max_body_size 12m;

    error_page 502 503 504 =503 /maeari-maintenance.html;

    location = /maeari-maintenance.html {
        root /usr/share/nginx/html;
        internal;
    }

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

현재 운영 서버에서는 `maeari.madcamp-kaist.org` 단일 도메인으로 인증서를 발급했습니다.

```bash
sudo certbot --nginx -d maeari.madcamp-kaist.org
```

## 13.4 PM2 프로세스

```bash
pm2 start apps/api/dist/server.js --name maeari-api
pm2 start apps/api/dist/scheduler.js --name maeari-scheduler
pm2 start apps/web/.next/standalone/apps/web/server.js --name maeari-web
pm2 save
pm2 startup
```

현재 개발 서버에서는 API와 scheduler가 `pnpm dev:api`, `pnpm dev:scheduler`로 떠 있지만, web은 CSS/JS 정적 파일 안정성을 위해 production standalone server로 실행합니다. 운영 안정화를 위해 API와 scheduler도 `pnpm --filter @maeari/api build` 후 `dist/server.js`, `dist/scheduler.js` 실행으로 전환하는 것을 권장합니다.

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
OPENAI_GUARDRAIL_MODEL=

PUBLIC_TOKEN_PEPPER=
UPLOAD_DIR=
UPLOAD_PUBLIC_PATH=
MAX_ATTACHMENT_COUNT=
MAX_ATTACHMENT_BYTES=
MAX_ATTACHMENT_TOTAL_BYTES=
DELIVERY_CRON=
MODERATION_RETRY_CRON=
MODERATION_MAX_ATTEMPTS=
NOTIFICATION_RETRY_CRON=
NOTIFICATION_MAX_ATTEMPTS=

GMAIL_SMTP_ENABLED=
GMAIL_SMTP_HOST=
GMAIL_SMTP_PORT=
GMAIL_SMTP_SECURE=
GMAIL_SMTP_USER=
GMAIL_SMTP_APP_PASSWORD=
GMAIL_SMTP_FROM_NAME=
GMAIL_SMTP_FROM_ADDRESS=
GMAIL_SMTP_CONNECTION_TIMEOUT_MS=

SOLAPI_SMS_ENABLED=
SOLAPI_API_KEY=
SOLAPI_API_SECRET=
SOLAPI_SENDER_NUMBER=

PHONE_LOOKUP_ENABLED=
PHONE_LOOKUP_PROVIDER=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
PHONE_LOOKUP_TIMEOUT_MS=
PHONE_LOOKUP_CACHE_TTL_DAYS=
```

`GMAIL_SMTP_ENABLED=true`이면 `GMAIL_SMTP_USER`, `GMAIL_SMTP_APP_PASSWORD`가 필수입니다. 예전 로컬 MVP용 alias 변수는 더 이상 사용하지 않습니다.

`SOLAPI_SMS_ENABLED=true`이면 `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SOLAPI_SENDER_NUMBER`가 필수입니다. `SOLAPI_SMS_ENABLED`가 비어 있으면 세 값이 모두 있을 때 자동으로 활성화됩니다. 발신번호는 하이픈 없이 숫자만 허용합니다.

`PHONE_LOOKUP_ENABLED=true`이면 `PHONE_LOOKUP_PROVIDER=TWILIO`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`이 필수입니다. Lookup timeout 기본값은 3000ms, cache TTL 기본값은 30일입니다.

Gmail SMTP 또는 Solapi가 꺼진 채널은 외부 발송을 성공 처리하지 않고 `NOTIFICATION_PROVIDER_NOT_CONFIGURED`로 기록합니다.

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

const gmailSmtpEnabled =
  optionalBooleanEnv("GMAIL_SMTP_ENABLED") ??
  Boolean(optionalEnv("GMAIL_SMTP_USER") && optionalEnv("GMAIL_SMTP_APP_PASSWORD"));
const solapiSmsEnabled =
  optionalBooleanEnv("SOLAPI_SMS_ENABLED") ??
  Boolean(optionalEnv("SOLAPI_API_KEY") && optionalEnv("SOLAPI_API_SECRET") && optionalEnv("SOLAPI_SENDER_NUMBER"));
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
  cookieDomain: optionalEnv("COOKIE_DOMAIN"),
  cookieSecure: requireBooleanEnv("COOKIE_SECURE"),
  kakaoClientId: requireEnv("KAKAO_CLIENT_ID"),
  kakaoClientSecret: requireEnv("KAKAO_CLIENT_SECRET"),
  kakaoRedirectUri: requireEnv("KAKAO_REDIRECT_URI"),
  openaiApiKey: requireEnv("OPENAI_API_KEY"),
  openaiModerationModel: requireEnv("OPENAI_MODERATION_MODEL"),
  openaiGuardrailModel: optionalEnv("OPENAI_GUARDRAIL_MODEL") ?? "gpt-5.4-mini",
  publicTokenPepper: requireEnv("PUBLIC_TOKEN_PEPPER"),
  deliveryCron: requireEnv("DELIVERY_CRON"),
  moderationRetryCron: requireEnv("MODERATION_RETRY_CRON"),
  moderationMaxAttempts: requireNumberEnv("MODERATION_MAX_ATTEMPTS"),
  notificationRetryCron: optionalEnv("NOTIFICATION_RETRY_CRON") ?? "*/5 * * * *",
  notificationMaxAttempts: optionalNumberEnv("NOTIFICATION_MAX_ATTEMPTS", 3),
  gmailSmtpEnabled,
  gmailSmtpHost: optionalEnv("GMAIL_SMTP_HOST") ?? "smtp.gmail.com",
  gmailSmtpPort: optionalNumberEnv("GMAIL_SMTP_PORT", 465),
  gmailSmtpSecure: optionalBooleanEnv("GMAIL_SMTP_SECURE") ?? true,
  gmailSmtpUser: gmailSmtpEnabled ? requireEnv("GMAIL_SMTP_USER") : optionalEnv("GMAIL_SMTP_USER"),
  gmailSmtpAppPassword: gmailSmtpEnabled ? requireEnv("GMAIL_SMTP_APP_PASSWORD") : optionalEnv("GMAIL_SMTP_APP_PASSWORD"),
  gmailSmtpFromName: optionalEnv("GMAIL_SMTP_FROM_NAME") ?? "매아리",
  gmailSmtpFromAddress: optionalEnv("GMAIL_SMTP_FROM_ADDRESS"),
  gmailSmtpConnectionTimeoutMs: optionalNumberEnv("GMAIL_SMTP_CONNECTION_TIMEOUT_MS", 10000),
  solapiSmsEnabled,
  solapiApiKey: solapiSmsEnabled ? requireEnv("SOLAPI_API_KEY") : optionalEnv("SOLAPI_API_KEY"),
  solapiApiSecret: solapiSmsEnabled ? requireEnv("SOLAPI_API_SECRET") : optionalEnv("SOLAPI_API_SECRET"),
  solapiSenderNumber: solapiSmsEnabled ? requirePhoneNumberEnv("SOLAPI_SENDER_NUMBER") : optionalPhoneNumberEnv("SOLAPI_SENDER_NUMBER"),
};

function requireEnv(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function optionalEnv(key: string): string | undefined {
  const value = process.env[key];
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function requireNumberEnv(key: string): number {
  const value = Number(requireEnv(key));

  if (!Number.isFinite(value)) {
    throw new Error(`Environment variable must be a number: ${key}`);
  }

  return value;
}

function optionalNumberEnv(key: string, fallback: number): number {
  const raw = optionalEnv(key);

  if (!raw) {
    return fallback;
  }

  const value = Number(raw);

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

function optionalBooleanEnv(key: string): boolean | undefined {
  const value = optionalEnv(key);

  if (!value) {
    return undefined;
  }

  if (value !== "true" && value !== "false") {
    throw new Error(`Environment variable must be "true" or "false": ${key}`);
  }

  return value === "true";
}

function requirePhoneNumberEnv(key: string): string {
  const value = requireEnv(key).replace(/\D/g, "");

  if (!/^0\d{9,10}$/.test(value)) {
    throw new Error(`Environment variable must be a domestic phone number without hyphens: ${key}`);
  }

  return value;
}

function optionalPhoneNumberEnv(key: string): string | undefined {
  const value = optionalEnv(key);

  if (!value) {
    return undefined;
  }

  const normalized = value.replace(/\D/g, "");

  if (!/^0\d{9,10}$/.test(normalized)) {
    throw new Error(`Environment variable must be a domestic phone number without hyphens: ${key}`);
  }

  return normalized;
}
```

### 운영 서버 권장 방식

운영 서버에서는 `.env.production` 파일 권한을 제한합니다.

```bash
chmod 600 .env.production
```

PM2 실행 시에는 `NODE_ENV=production`을 명시합니다.

```bash
NODE_ENV=production pm2 start apps/api/dist/server.js --name maeari-api
NODE_ENV=production pm2 start apps/api/dist/scheduler.js --name maeari-scheduler
NODE_ENV=production pm2 start apps/web/.next/standalone/apps/web/server.js --name maeari-web
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
- 비회원 메시지 가입 귀속을 위한 `MessageRecipient.receiverUserId`, `linkedUserId`, `linkedAt` 설계
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
- 매아리 guardrail prompt 작성
- 한국어 욕설/비하 표현 로컬 보강 규칙 작성
- `moderateMessageWithRetry` 작성
- message service 작성
- POST `/api/messages` 구현
- POST `/api/auth/link-message` 구현
- DELETE `/api/messages/:id` 구현
- public access token 생성 로직 구현
- guardrail 응답 parser와 legacy schema normalize 로직 구현
- 에러 핸들링 middleware 구현
- OpenAI/Kakao/JWT/DB 값은 모두 config loader를 통해 `.env`에서만 읽도록 구현
- OpenAI 응답을 fake success로 대체하는 코드 작성 금지

### 산출물

- `moderation.service.ts`
- `moderation-feedback.ts`
- `moderation-policy.ts`
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
- OpenAI Moderations API가 통과시킨 메시지도 매아리 guardrail prompt가 차단하면 저장하지 않음
- 사전식 욕설/비하어 목록처럼 범용 moderation에서 놓칠 수 있는 메시지를 정책 prompt와 로컬 규칙으로 보강 차단함
- guardrail 응답은 현재 schema와 legacy `is_harmful` schema 모두 안정적으로 파싱됨
- OpenAI API 실패 시 즉시 1회 자동 재시도
- 2회 모두 검사 실패 시 `MODERATION_FAILED` 상태로 저장하고 검사 실패 UX를 반환
- `MODERATION_FAILED` 메시지는 publicUrl을 발급하지 않음
- `OPENAI_API_KEY`가 없으면 서버 시작 또는 요청 처리 시 명확한 설정 오류를 반환함
- mock moderation 결과를 사용하지 않음
- 공개 열람 URL token 생성 가능
- 공개 링크로 열람한 메시지가 가입 후 로그인 사용자 수신함에 귀속됨
- 예약 전/검사 실패/취소 보낸 마음은 hard delete 가능
- 도착 완료/실패 보낸 마음은 `senderDeletedAt`으로 발신함에서 제거 가능
- 받은 마음은 `receiverDeletedAt`으로 수신함에서 제거 가능

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

- `infra/nginx/maeari.conf.template` 작성
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

## Step 5. 친구 추가 및 친구 수신자 선택

### 목표

회원가입한 사용자가 친구 코드를 통해 친구 요청을 보내고, 수락된 친구를 메시지 수신자로 선택할 수 있게 한다.

### 작업 항목

- `FriendRequest`, `Friendship`, `User.friendCode` Prisma schema 추가
- 친구 코드 생성 유틸 작성
- 친구 요청 생성/수락/거절/취소/삭제 service 작성
- 친구 API route/controller/validation 작성
- `/friends` 화면 작성
- `/write` 수신 대상에 `친구` 탭과 친구 선택 UI 추가
- 친구 수신자 메시지 생성 시 friendship 유효성 검증
- 친구 삭제 후에도 기존 메시지 snapshot 유지

### 완료 기준

- 자기 자신에게 친구 요청 불가
- 이미 친구이거나 pending 요청이 있으면 중복 요청 불가
- 친구 요청 수신자만 수락/거절 가능
- 수락 시 정렬된 `userAId`, `userBId`로 중복 없는 `Friendship` 생성
- 친구 선택 메시지는 `receiverType = FRIEND`, `receiverUserId = 친구 User.id`로 저장
- 친구 수신자는 도착 시 서비스 내 알림과 수신함에서 메시지를 확인 가능

---

## Step 6. Gmail SMTP 이메일 / Solapi 문자 발송

### 목표

친구가 아닌 외부 수신자에게 발송 시간이 되면 공개 열람 링크를 Gmail SMTP 이메일 또는 Solapi 문자로 전달한다.

### 작업 항목

- `NotificationProvider` interface 작성
- `GmailSmtpNotificationProvider` 작성
- `SolapiSmsNotificationProvider` 작성
- Gmail SMTP와 Solapi 설정 env 추가: `GMAIL_SMTP_*`, `SOLAPI_*`
- `NotificationLog` idempotency/retry 필드 추가
- `ContactSuppression` 기반 EMAIL/SMS 수신거부 pre-flight 추가
- 외부 수신자 channel 선택 로직 작성
- Notification retry job 작성
- provider 성공/실패/errorCode mapping 작성
- 발송 문구 template 작성
- 메시지 상세/발신함에서 외부 발송 상태와 실패 사유 표시
- `/write` 외부 수신자 email/phone/preferredChannel UI 추가
- `/arrival/[token]` 채널별 수신거부 버튼 추가

### 완료 기준

- 외부 수신자는 이메일 또는 전화번호 중 하나 없이는 메시지 생성 불가
- provider 미설정 시 발송 성공으로 표시하지 않고 `SKIPPED/FAILED` 기록
- Gmail SMTP 또는 Solapi 발송 성공 시 `NotificationLog=SENT`, `MessageRecipient=SENT`
- retryable 실패는 최대 3회 재시도
- non-retryable 실패는 최종 실패로 기록
- 같은 수신자/이벤트/channel 조합은 idempotency key로 중복 발송되지 않음
- SMS/EMAIL 본문에는 편지 본문이 포함되지 않음

---

## Step 7. 도착 시간 UX 개선

### 목표

사용자가 날짜/시간을 직접 계산하지 않아도 쉽게 도착 시간을 설정하도록 메시지 작성 화면을 개선한다.

### 작업 항목

- `datetime-local` 단일 입력을 빠른 프리셋 + 날짜 입력 + 1분 단위 시간 입력으로 교체
- 15분 단위 quick minute button 생성
- 선택한 값을 KST 기준 미리보기로 표시
- 프리셋 선택 시 `scheduledAt` 자동 계산
- 직접 입력 변경 시 preview와 submit payload 동기화
- 서버 validation은 UTC ISO string 기준 미래 시간 검증 유지

### 완료 기준

- 빠른 프리셋 클릭만으로 예약 시간이 설정됨
- 직접 날짜/시간 입력 가능
- 사용자는 시/분을 1분 단위로 직접 입력 가능
- 15분 단위 quick minute 버튼으로 흔한 분 값을 빠르게 선택 가능
- KST 도착 미리보기가 표시됨
- 과거 시간 또는 현재보다 너무 가까운 시간은 제출 불가
- 모바일/데스크톱에서 텍스트와 컨트롤이 겹치지 않음

---

## 17. MVP 이후 확장 계획

## Phase 2. 친구 및 실제 외부 발송 안정화

- 닉네임 또는 친구 코드 기반 친구 찾기 v1 구현 완료
- Gmail SMTP, Solapi provider 운영 모니터링 v1 구현 완료
- SMS/EMAIL provider 교체와 운영 모니터링 고도화 v1 구현 완료
- NotificationLog 재시도 대시보드 v1 구현 완료
- 카카오 알림톡 연동

## Phase 3. 감성 기능 강화

- 기간 랜덤 발송 v1 구현 완료
- 도착 전 힌트 알림 v1 구현 완료
- 익명 답장 v1 구현 완료
- 메시지 봉투/테마 선택 v1 구현 완료

## Phase 4. 보관함 고도화

- 보낸 마음 상태별 hard/soft delete와 받은 마음 soft delete는 구현 완료
- 감정 태그 기반 필터 v1 구현 완료
- 월별 감정 리포트 v1 구현 완료
- 받은 메시지 아카이브 v1 구현 완료
- 보관함 삭제 복구, 일괄 삭제 v1 구현 완료
- 오래된 메시지 정리 정책 v1 구현 완료
- 미래의 나에게 쓴 편지 모아보기 v1 구현 완료

## Phase 5. 운영 도구

- 관리자 페이지 v1 구현 완료
- 유해 메시지 moderation log v1 구현 완료
- 신고 기능 v1 구현 완료
- 계정 정지 정책 v1 구현 완료
- 발송 통계 대시보드 v1 구현 완료

---

## 18. 예상 리스크와 대응

| 리스크 | 설명 | 대응 |
| --- | --- | --- |
| OpenAI API 장애 | 메시지 작성이 막힐 수 있음 | Fail Closed 정책과 재시도 안내 |
| Kakao OAuth 설정 오류 | 로그인 불가 | 개발/운영 redirect URI 분리 |
| 예약 job 중복 실행 | 메시지 중복 발송 가능 | in-memory lock, 추후 DB lock |
| 공개 링크 유출 | 누구나 열람 가능 | 충분히 긴 token, 만료 정책 |
| 친구 요청 악용 | 모르는 사용자에게 반복 요청 가능 | 친구 코드 기반 요청, pending 중복 차단, 요청 취소/거절, 추후 차단 기능 |
| 외부 연락처 오입력 | 이메일/SMS가 잘못된 대상에게 갈 수 있음 | 형식 검증, 확인 UI, 공개 링크에는 편지 본문 미포함 |
| 외부 provider 발송 장애 | 도착 시점에 이메일/문자 발송 실패 가능 | NotificationLog PENDING 재시도, 최종 실패 상태 노출, fake 성공 금지 |
| OCR 처리 지연/실패 | 이미지 첨부 메시지의 안전 검사가 timeout될 수 있음 | `IMAGE_OCR_TIMEOUT_MS`, `MODERATION_FAILED` 보관, retry job에서 저장 파일 재검사 |
| 마음나무 공개 링크 악용 | 비회원이 같은 링크에 반복 제출할 수 있음 | IP hash 기반 collection당 시간당 제출 제한, submission moderation, owner 도착 전 본문 비노출 |
| QR 공유 유출 | QR은 기존 공개 URL을 시각화하므로 캡처 유출 가능 | 충분히 긴 token, token hash 저장, 공개 링크 권한/만료/revoke 정책 유지 |
| EC2 단일 서버 한계 | Next.js, API, scheduler, DB 동시 운영 부담 | PM2 memory limit, swap, managed DB 고려 |
| 알림톡 미연동 | 카카오톡 기반 알림 부족 | MVP에서는 Gmail SMTP 이메일과 Solapi 문자 발송으로 시작 |

---

## 19. 현재 개발 우선순위

1. 운영 DB schema와 Prisma migration 상태를 코드 기준 최신으로 유지한다.
2. 메시지 작성, OCR moderation, 답장, 알림, 마음나무 scheduler가 서로 상태를 꼬지 않도록 검증한다.
3. Kakao 로그인, 전화번호 인증, Gmail SMTP, Solapi SMS, Twilio Lookup, OpenAI guardrail의 운영 env를 분리 관리한다.
4. 외부 알림 provider가 실패하거나 수신거부 상태일 때 성공처럼 보이지 않도록 `NotificationLog`와 메시지/수신자 상태를 동기화한다.
5. 사용자 화면에서는 `/write`, `/sent`, `/inbox`, `/tree`, `/my`를 핵심 QA 대상으로 둔다.
6. Nginx/PM2 운영은 production build와 `db:deploy` 이후 재시작하는 절차를 유지한다.

---

## 20. 운영 적용 순서

```txt
1. .env.local 또는 .env.production의 DATABASE_URL이 maeari DB를 가리키는지 확인
2. pnpm db:validate
3. pnpm db:deploy
4. pnpm --filter @maeari/api typecheck
5. pnpm --filter @maeari/web typecheck
6. pnpm --filter @maeari/database typecheck
7. pnpm --filter @maeari/api build
8. pnpm --filter @maeari/web build
9. pm2 restart maeari-api --update-env
10. pm2 restart maeari-scheduler --update-env
11. pm2 restart maeari-web --update-env
12. curl -I https://maeari.madcamp-kaist.org/
13. curl -I https://maeari.madcamp-kaist.org/api/health
```

---

## 21. 현재 운영 검증 체크리스트

- 이미지 OCR: `.jpg/.jpeg/.png/.webp` 첨부 1~3개 업로드, GIF/HEIC/PDF 차단, 이미지 속 텍스트 moderation 차단 확인.
- 답장함: `/arrival/[token]` 답장 작성, `/sent` 답장함 표시, 답장 읽음/삭제, 발신자 이메일 알림 확인.
- QR: 마음쓰기 완료 모달, `/sent`, `/messages/[id]`에서 QR 표시/스캔/PNG 저장 확인.
- 연락처 claim: 이메일/전화번호 인증 후 과거 OTHER 수신 메시지가 `/inbox`에 연결되는지 확인.
- 마음나무: `/tree` 생성, `/tree/[token]` 비회원 제출, scheduler 도착 후 owner 열람과 알림 확인.
- 배포: `db:deploy`, API/Web build, PM2 restart, Nginx health check 순서 준수.

---

## 22. 2026-07-06 신규 기능 구현 반영

### 22.1 이미지 OCR 기반 안전 검사

- 이미지 첨부는 `.jpg`, `.jpeg`, `.png`, `.webp`만 허용합니다.
- API는 `tesseract.js`의 `Tesseract.recognize`를 사용해 업로드된 이미지의 OCR 텍스트를 추출합니다.
- 기본 OCR 언어는 `kor+eng`이며, 운영 env의 `IMAGE_OCR_LANGUAGES`로 조정할 수 있습니다.
- OCR 텍스트는 기존 메시지 제목/본문/감정 태그와 함께 moderation/guardrail에 전달합니다.
- OCR 실패 또는 timeout은 `MODERATION_FAILED`로 저장하고 기존 moderation retry job에서 저장된 첨부 파일을 다시 OCR 검사합니다.
- 이미지 장면 자체의 폭력성/선정성 판단은 v1 범위에서 제외하고, 이미지 안의 텍스트 유해성만 처리합니다.
- `tesseract.js` v7은 `recognize` named export를 제공하지 않으므로, API는 default import 후 `Tesseract.recognize(...)`로 호출합니다.

### 22.2 답장 알림과 보낸 마음 답장함

- 공개 도착 링크에서 답장이 생성되면 `message.reply.created` 이벤트를 발행합니다.
- `NotificationProcessor`는 `REPLY_RECEIVED` 앱 내 알림을 만들고, 발신자의 verified EMAIL이 있으면 이메일 알림도 보냅니다.
- 답장 이메일에는 원문/답장 내용이 포함되지 않으며 메시지 상세 링크만 포함합니다.
- `/sent`는 기존 보낸 마음 탭과 답장함 탭을 함께 제공합니다.

### 22.3 QR 공유

- 기존 `publicUrl` API는 유지합니다.
- 웹은 URL을 `qrcode.react`로 QR 렌더링하며, 링크 복사와 QR PNG 저장을 제공합니다.
- SMS/이메일 알림은 계속 URL 텍스트를 발송합니다.

### 22.4 연락처 인증 후 과거 비회원 수신 연결

- `verifyUserContact`와 Kakao 이메일 자동 등록 후 `receiverEmail`/`receiverPhone`이 일치하는 미연결 OTHER 수신자를 현재 user로 연결합니다.
- 다른 user에게 이미 연결된 수신자는 변경하지 않습니다.
- 이미 도착한 메시지는 받은 마음에 노출되고, 외부 알림 실패로 단일 수신 메시지가 `FAILED`인 경우 내부 수신으로 복구 가능한 범위에서 `SENT`로 복구합니다.

### 22.5 마음나무

- `/tree`에서 회원이 공개 링크를 만들고, `/tree/[token]`에서 비회원이 텍스트 편지를 남깁니다.
- 마음나무 생성자는 verified PHONE 보유가 필요합니다.
- 비회원 제출은 기존 텍스트 guardrail을 즉시 통과해야 저장됩니다.
- scheduler는 `DELIVERY_CRON` 주기로 `ACTIVE` 마음나무 중 `scheduledAt`이 지난 항목을 `DELIVERED`로 전환하고 제출물을 일괄 공개합니다.

### 22.6 운영 DB migration 상태

- 2026-07-07 기준 운영 `maeari` DB에 `20260706150000_ocr_replies_qr_collections` migration을 적용했습니다.
- `prisma migrate status` 결과는 `Database schema is up to date!`입니다.
- 따라서 이 단계의 남은 작업은 schema 작성이 아니라 OCR/답장함/QR/마음나무의 수동 QA와 provider 실발송 검증입니다.

### 22.7 2026-07-07 운영 안정화 반영

#### OCR env 적용 순서

운영 OCR은 외부 Vision API가 아니라 API 서버 내부 `tesseract.js` 기반 OCR입니다. 설정은 API와 scheduler가 읽으므로, env 변경 후 둘 다 재시작해야 합니다.

```env
IMAGE_OCR_MODERATION_ENABLED=true
IMAGE_OCR_LANGUAGES=kor+eng
IMAGE_OCR_TIMEOUT_MS=8000
IMAGE_OCR_MAX_TEXT_CHARS=4000
```

적용 순서:

```txt
1. .env.local 또는 .env.production에 OCR env 추가
2. pnpm --filter @maeari/api typecheck
3. pnpm --filter @maeari/api build
4. pm2 restart maeari-api --update-env
5. pm2 restart maeari-scheduler --update-env
6. pm2 save
7. curl -I http://127.0.0.1:4000/api/health
8. curl -I https://maeari.madcamp-kaist.org/api/health
```

#### 첨부 이미지 검증 계층

이미지 파일은 다음 네 계층을 모두 통과해야 합니다.

| 계층 | 위치 | 검증 내용 |
| --- | --- | --- |
| Browser accept | `apps/web/app/write/page.tsx` | `.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp` |
| Client validation | `createAttachmentDraft` | MIME과 파일명 확장자 검사, 2MB 개별 용량 검사 |
| Multipart middleware | `message-upload.middleware.ts` | multer `fileFilter`에서 MIME과 originalname 확장자 검사 |
| Service validation | `message.service.ts` | 저장 직전 JPEG/PNG/WEBP 매직바이트 검사 |

이중 검증 이유:

- 브라우저 `accept`는 사용자 편의 기능일 뿐 보안 경계가 아닙니다.
- MIME type은 API 직접 호출로 위조될 수 있습니다.
- 확장자는 사용자가 임의로 바꿀 수 있습니다.
- 따라서 실제 파일 header까지 검사해 허용 이미지가 아닌 파일이 `UPLOAD_DIR`에 저장되지 않도록 합니다.

#### 운영 DB 정리 상태

- 앱 환경변수는 `DATABASE_URL=.../maeari?schema=public`, `POSTGRES_DB=maeari`, `POSTGRES_USER=maeari` 기준입니다.
- 운영 DB 목록에는 `maeari`만 남아 있으며, 기존 `maeum_arrival`과 `maeari_dryrun` DB는 삭제된 상태입니다.
- `maeum` role은 Postgres bootstrap role이라 삭제할 수 없지만 `NOLOGIN` 상태입니다.
- `template0`, `template1` owner는 `maeari`로 정리했습니다.
- 구형 DB를 사용하는 client connection은 0개입니다.

#### PM2 복구 확인

- API가 `tesseract.js` import 오류로 `online`이지만 4000 포트를 listen하지 못하는 상황이 발생할 수 있음을 확인했습니다.
- 복구 기준은 PM2 `online`만이 아니라 다음 health check까지 포함합니다.

```bash
ss -ltnp | rg ':3000|:4000|:80|:443'
curl -I http://127.0.0.1:4000/api/health
curl -I http://127.0.0.1:3000/
curl -I https://maeari.madcamp-kaist.org/api/health
curl -I https://maeari.madcamp-kaist.org/
```

#### Web standalone 정적 asset 확인

UI 리디자인 이후 web은 CSS 의존도가 커졌기 때문에, HTML 200만으로 정상 배포를 판단하면 안 됩니다. Next.js standalone server가 `.next/static`과 `public`을 실제로 제공하는지 반드시 확인합니다.

현재 web package 기준:

```txt
apps/web/next.config.ts
└── output: "standalone"

apps/web/package.json
├── build: next build && pnpm run copy-standalone-assets
├── copy-standalone-assets
│   ├── .next/static -> .next/standalone/apps/web/.next/static
│   └── public -> .next/standalone/apps/web/public
└── start:standalone: node .next/standalone/apps/web/server.js
```

운영 반영 순서:

```bash
pnpm --filter @maeari/web typecheck
pnpm --filter @maeari/web build
pm2 restart maeari-web --update-env
pm2 save
```

정상 확인:

```bash
curl -I http://127.0.0.1:3000/
curl -s http://127.0.0.1:3000/login \
  | rg -o '/_next/static/css/[^" ]+\.css' \
  | head -1 \
  | xargs -r -I{} curl -I http://127.0.0.1:3000{}
```

판정 기준:

- `/` HTML은 `200 OK`.
- CSS URL도 `200 OK`.
- CSS 응답 `Content-Type`은 `text/css`.
- CSS가 404이면 `maeari-web`을 재시작하기 전에 `pnpm --filter @maeari/web build`가 끝까지 성공했는지 확인합니다.
- 운영 포트에 `next dev`를 띄우지 않습니다. 개발 서버는 devtools manifest/cache 차이 때문에 production asset 경로와 충돌할 수 있습니다.

#### UI 리디자인 기능 보존 체크

Figma 기반 presentation layer 교체에서 반드시 유지해야 하는 기능 계약은 다음과 같습니다.

| 화면 | 유지해야 하는 기능 | 확인 포인트 |
| --- | --- | --- |
| `/login` | Kakao OAuth 시작 | CTA가 `/api/auth/kakao`로 이동 |
| `/auth/callback` | pending arrival token, pending friend invite token 처리 | `sessionStorage` token 처리 후 `/inbox` 또는 `/friends` 이동 |
| `/` | 실제 데이터 기반 dashboard | `/messages/sent`, `/messages/received` 조회, fallback card |
| `/write` | 전화번호 인증 gate, 수신자 선택, 그룹, 첨부, OCR, 도착 설정 | `senderContactId` 미전송, 서버 기준 +24h 시간, multipart payload |
| `/sent` | 보낸 마음/답장함, 취소, 삭제, QR | `GET /messages/sent`, `GET /messages/replies/received`, deprecated alias `GET /messages/sent/replies`, reply read/delete |
| `/inbox` | 받은 마음, 아카이브, 삭제, 일괄 삭제 | `receiverDeletedAt`, `receiverArchivedAt` 기반 UI |
| `/archive` | 아카이브 목록, 복구, 삭제 | 받은 마음과 동일 card/action 체계 |
| `/future` | 미래의 나 모음 | `SELF` 수신자와 감정 필터 |
| `/messages/[id]` | 상세, 첨부, 수신자 상태, QR, 답장, 신고, 삭제/취소 | 발신자/수신자 권한별 액션 분리 |
| `/arrival/[token]` | 공개 열람, 도착 gate, 답장, 신고, 수신거부/재구독 | token 기준 공개 API와 ContactSuppression |
| `/friends` | 친구 코드, 검색, 요청, 초대 링크 | invite preview/claim 흐름 유지 |
| `/phone-verification` | strict 010 OTP 인증 | Lookup/rate-limit 오류 안내, safe next |
| `/my` | PHONE 우선 연락처 인증, 이메일 연결용 인증 | verified PHONE 삭제 불가, 변경 CTA |
| `/tree` | 마음나무 생성/목록/QR/제출물 열람 | verified PHONE gate, collection 상태 |
| `/tree/[token]` | 비회원 제출 | 제출 moderation, 도착 후 제출 차단 |
| `/reports` | 감정 리포트 | 월별 통계 card |
| `/admin` | moderation/notification/report/reply 운영 | 조밀한 table/panel 유지 |

#### 첨부 allowlist 운영 기준

사진 첨부는 사용자가 명시적으로 요청한 범위에 맞춰 `.jpg`, `.jpeg`, `.png`, `.webp`만 허용합니다. HEIC, GIF, PDF, SVG, TXT, 확장자를 바꾼 실행 파일은 업로드 단계 또는 저장 직전 단계에서 차단합니다.

검증 계층:

```txt
Frontend input accept
  -> .jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp

Frontend createAttachmentDraft
  -> file.type + file.name 확장자 + 개별 용량 검사

API message-upload.middleware.ts
  -> multer fileFilter에서 MIME + originalname 확장자 검사

API message.service.ts
  -> 저장 직전 magic bytes 검사
     - JPEG: FF D8 FF
     - PNG: 89 50 4E 47 0D 0A 1A 0A
     - WEBP: RIFF....WEBP

ImageOcrService
  -> OCR_SUPPORTED_TYPES: image/jpeg, image/png, image/webp
```

관련 error code:

- `ATTACHMENT_TYPE_UNSUPPORTED`: 형식/확장자/header 불일치
- `TOO_MANY_ATTACHMENTS`: 4개 이상 첨부
- `ATTACHMENT_TOO_LARGE`: 개별 파일 용량 초과
- `ATTACHMENTS_TOO_LARGE`: 총 첨부 용량 초과

이 정책은 DB enum 추가 없이 service validation으로 유지합니다. DB에는 검증을 통과한 `mimeType` 문자열과 저장 metadata만 남깁니다.

#### Figma MCP와 남은 시각 QA

Figma MCP 인증과 파일 접근은 확인되어 있으나, Figma Starter plan call limit 때문에 일부 `get_metadata`/`get_design_context` 호출이 제한될 수 있습니다. call limit이 풀리면 다음 순서로 마지막 QA를 진행합니다.

```txt
1. Desktop_main screenshot 재확인
2. Desktop_Writing screenshot 재확인
3. Desktop_friends screenshot 재확인
4. Desktop_my screenshot 재확인
5. 실제 /, /write, /friends, /my desktop screenshot 비교
6. mobile 390px /login, /write, /arrival/[token] overflow 확인
7. 1280px desktop /write 우측 전달 설정 panel clipping 확인
8. CSS static 200 확인
```

완료 기준:

- 구 MVP UI 토큰이 사용자 화면에 남지 않습니다.
- desktop 1280px에서 sidebar/topbar/content가 겹치지 않습니다.
- mobile에서 하단 nav와 sticky/action 영역이 겹치지 않습니다.
- Korean H1/CTA 문장이 한 글자씩 찢어지지 않습니다.
- 버튼 안 텍스트가 줄바꿈으로 깨지지 않습니다.
- Figma 기준 palette, panel hierarchy, CTA priority가 유지됩니다.

## 23. 2026-07-07 최신 구현 반영 계획 정리

이 장은 지금까지 실제 코드에 들어간 변경을 “앞으로 유지해야 하는 설계 기준”으로 다시 정리합니다. 이미 구현된 기능은 신규 개발 계획이 아니라 현재 baseline으로 보고, 이후 수정은 이 baseline을 깨지 않는 방향으로 진행합니다.

## 23.1 현재 baseline

```txt
Current Maeari Baseline
├── Brand
│   ├── 서비스명: 매아리
│   ├── 의미: 매 순간 아껴둔 마음의 소리
│   ├── 운영 도메인: maeari.madcamp-kaist.org
│   └── 운영 DB: maeari / maeari user
│
├── Auth
│   ├── Kakao OAuth
│   ├── HttpOnly cookie session
│   ├── pending arrival token linking
│   ├── pending friend invite claim
│   └── strict 010 PHONE verification for writing
│
├── Message
│   ├── SELF / FRIEND / OTHER
│   ├── group recipients
│   ├── fixed arrival / random window
│   ├── hint notification
│   ├── message theme
│   ├── anonymous reply option
│   ├── attachments up to 3 images
│   └── public URL + QR
│
├── Safety
│   ├── OpenAI Moderation
│   ├── Maeari guardrail prompt
│   ├── local Korean abuse rules
│   ├── Tesseract OCR for text in images
│   ├── moderation retry queue
│   └── image allowlist: jpg/jpeg/png/webp
│
├── Notification
│   ├── IN_APP
│   ├── Gmail SMTP EMAIL
│   ├── Solapi SMS
│   ├── ContactSuppression
│   ├── NotificationLog retry
│   ├── reply received notification
│   └── message collection delivered notification
│
├── Social
│   ├── friend code
│   ├── friend search
│   ├── friend request lifecycle
│   ├── friendship soft delete
│   └── one-time friend invite link
│
├── Collection
│   ├── /tree authenticated owner area
│   ├── /tree/[token] public submission area
│   ├── non-member text submissions
│   ├── moderation before saving
│   └── scheduled collection delivery
│
└── Web UI
    ├── Figma palette
    ├── AppShell desktop sidebar/topbar
    ├── mobile bottom nav
    ├── public stage
    ├── figma-panel/card system
    └── route/API contract unchanged
```

## 23.2 메시지 작성 정책

메시지 작성은 기능이 가장 많은 경로이므로 다음 순서를 baseline으로 고정합니다.

```txt
POST /api/messages
├── session user 확인
├── request body의 senderContactId 무시
├── 서버가 active verified strict PHONE 직접 선택
│   ├── type = PHONE
│   ├── verifiedAt != null
│   ├── deletedAt = null
│   └── value matches ^010\d{8}$
├── 수신자 normalize
│   ├── SELF
│   ├── FRIEND
│   └── OTHER: email 또는 phone 중 하나 이상 필수
├── 첨부 normalize/검증
│   ├── 최대 3개
│   ├── .jpg/.jpeg/.png/.webp
│   ├── image/jpeg/image/png/image/webp
│   ├── 개별/총 용량 검사
│   └── magic bytes 검사
├── 이미지 OCR
│   ├── tesseract.js
│   ├── kor+eng
│   ├── timeout
│   └── OCR 실패 시 MODERATION_FAILED
├── safety moderation
│   ├── 제목
│   ├── 본문
│   ├── 감정 태그
│   └── OCR 추출 텍스트
├── DB 생성
│   ├── Message
│   ├── MessageRecipient[]
│   ├── MessageAttachment[]
│   └── MessageAccessToken[]
└── response
    ├── message id
    ├── publicUrl/publicUrls
    └── 작성 성공 dialog에서 QR로 표시 가능
```

중요한 보안 결정:

- 프론트엔드는 `senderContactId`를 보내지 않습니다.
- 악의적인 client가 `senderContactId`를 보내도 서버는 무시합니다.
- 이메일 인증은 마음쓰기 권한을 주지 않습니다.
- PHONE 인증은 메시지 수신/전달 번호가 아니라 “작성 권한 증명”입니다.
- 이미 생성된 메시지의 `senderContactSnapshot`은 이후 전화번호 변경으로 바뀌지 않습니다.

## 23.3 전화번호 인증과 abuse defense

전화번호 인증은 단순 SMS OTP가 아니라 “strict 010 mobile 회선 인증”입니다.

```txt
/phone-verification
├── 입력 허용
│   ├── 01012345678
│   ├── 010-1234-5678
│   ├── +821012345678
│   └── 821012345678
├── normalize
│   └── 01012345678
├── reject
│   ├── 070
│   ├── 050x
│   ├── 01X legacy mobile
│   ├── landline
│   ├── overseas
│   └── malformed input
├── PostgreSQL guard
│   ├── IP lock
│   ├── contact lock
│   ├── contact 10분 3회 제한
│   ├── IP 1시간 서로 다른 번호 5개 제한
│   └── raw IP/phone 저장 금지
├── Twilio Lookup v2
│   ├── valid = true
│   ├── country_code = KR
│   ├── line_type_intelligence.type = mobile
│   ├── success/reject cache
│   └── provider 장애 fail-closed
└── Solapi OTP
    ├── 60초 resend cooldown
    ├── 10분 code expiry
    └── 5회 실패 시 만료
```

verified PHONE 삭제 정책:

- verified PHONE은 `DELETE /api/me/contacts/:id`로 삭제할 수 없습니다.
- 새 번호 인증 성공 시 transaction으로 기존 active PHONE을 retire하고 새 PHONE을 primary active로 만듭니다.
- 미인증 PHONE과 EMAIL은 삭제 가능합니다.

## 23.4 외부 알림과 privacy

외부 발송은 메시지 본문을 보내는 기능이 아니라 “도착 링크 알림”입니다.

```txt
NotificationProcessor
├── MESSAGE_SENT
│   ├── SELF/FRIEND/linked user: IN_APP
│   ├── OTHER EMAIL: Gmail SMTP
│   ├── OTHER SMS: Solapi
│   └── ContactSuppression pre-flight
├── ARRIVAL_HINT
│   └── 도착 전 힌트 알림
├── REPLY_RECEIVED
│   ├── sender target IN_APP
│   └── verified sender EMAIL 있으면 EMAIL
└── COLLECTION_DELIVERED
    ├── owner target IN_APP
    └── verified owner EMAIL 있으면 EMAIL
```

privacy 원칙:

- 이메일 본문에 편지 본문을 넣지 않습니다.
- 문자 본문에 편지 본문을 넣지 않습니다.
- 답장 알림 이메일에도 원문/답장 내용을 넣지 않습니다.
- 공개 링크 URL과 서비스 설명만 포함합니다.
- 수신거부 연락처는 raw email/phone이 아니라 HMAC hash만 저장합니다.

## 23.5 UI 리디자인 구현 원칙

Figma 기반 UI 작업은 DB/API 기능을 바꾸지 않는 presentation layer 교체입니다.

```txt
UI Redesign Contract
├── route path 유지
├── API request/response 유지
├── Prisma schema 변경 없음
├── 기존 기능 삭제 없음
├── 기존 구 UI 토큰 제거
├── Figma palette 사용
├── desktop AppShell 사용
├── mobile bottom nav 사용
└── public route는 maeari-public-stage 사용
```

새 UI 토큰:

- `maeari-stage`
- `maeari-public-stage`
- `figma-panel`
- `maeari-input`
- `maeari-action`
- `maeari-action-primary`
- `maeari-action-danger`
- `maeari-chip`
- `maeari-chip-active`
- `maeari-badge`
- `maeari-page-title`
- `maeari-page-copy`

주요 화면별 UI 유지 기능:

| 화면 | 반드시 유지할 기능 |
| --- | --- |
| `/` | 실제 보낸/받은 마음 데이터를 쓰는 dashboard |
| `/write` | PHONE gate, 그룹 수신자, 첨부, OCR, 도착 설정, 성공 dialog |
| `/sent` | 보낸 마음/답장함, 취소/삭제/QR/링크 복사 |
| `/inbox` | 받은 마음, 아카이브, 삭제, 일괄 삭제 |
| `/arrival/[token]` | 공개 gate, 본문/첨부, 답장, 신고, 수신거부/재구독 |
| `/friends` | 친구 검색, 요청, 친구 코드, 초대 링크 |
| `/my` | PHONE 우선 인증 상태, 이메일 연결용 인증, 변경 CTA |
| `/tree` | 마음나무 생성, QR, 목록, 도착 후 제출물 |
| `/admin` | 운영 로그를 빠르게 볼 수 있는 조밀한 panel/table |

## 23.6 QA와 배포 체크리스트

코드 변경 후 공통 확인:

```bash
pnpm db:validate
pnpm --filter @maeari/api typecheck
pnpm --filter @maeari/web typecheck
pnpm --filter @maeari/api build
pnpm --filter @maeari/web build
```

운영 PM2 반영:

```bash
pm2 restart maeari-api --update-env
pm2 restart maeari-scheduler --update-env
pm2 restart maeari-web --update-env
pm2 save
```

smoke check:

```bash
curl -I http://127.0.0.1:4000/api/health
curl -I http://127.0.0.1:3000/
curl -I https://maeari.madcamp-kaist.org/api/health
curl -I https://maeari.madcamp-kaist.org/
```

web static check:

```bash
curl -s http://127.0.0.1:3000/login \
  | rg -o '/_next/static/css/[^" ]+\.css' \
  | head -1 \
  | xargs -r -I{} curl -I http://127.0.0.1:3000{}
```

수동 QA:

- Kakao login
- `/phone-verification` strict 010 인증
- `/write` 전화번호 미인증 차단
- 이미지 1/2/3개 첨부 성공
- 이미지 4개 차단
- GIF/HEIC/SVG/PDF 차단
- OCR 욕설 이미지 차단 또는 `MODERATION_FAILED` 처리
- Gmail SMTP EMAIL 발송
- Solapi SMS 발송
- 수신거부/재구독
- 공개 링크 열람
- 익명 답장 후 `/sent` 답장함
- QR 스캔
- 친구 초대 링크 claim
- 마음나무 생성/제출/도착
- 모바일 하단 nav overlap 없음
- Figma frame과 desktop 주요 화면 재비교

Figma MCP 관련:

- 인증과 파일 접근은 확인되어 있습니다.
- Starter plan call limit에 걸릴 수 있으므로, limit이 해제되면 `Desktop_main`, `Desktop_Writing`, `Desktop_friends`, `Desktop_my`를 다시 확인합니다.
- pixel-level 재대조 전에도 기능 계약은 유지해야 하며, Figma에 없는 화면은 같은 palette/panel hierarchy로 확장합니다.

## 24. 2026-07-07 최종 구현 반영 계획 정리

이 장은 현재 코드에 반영된 최신 기능과 UI 변경을 기준으로, 이후 유지보수자가 “무엇을 건드리면 되는지”를 판단할 수 있도록 정리한 실행 계획 겸 운영 기준입니다.

## 24.1 확정된 제품 방향

매아리는 이제 다음 세 축을 중심으로 동작합니다.

```txt
Maeari Product Core
├── Time Capsule Message
│   ├── 예약 도착
│   ├── 공개 링크 열람
│   ├── 앱 내 보관함
│   └── 이메일/SMS 도착 알림
├── Safe Emotional Delivery
│   ├── OpenAI moderation
│   ├── 매아리 guardrail prompt
│   ├── 로컬 욕설/비하 보강
│   ├── 이미지 OCR 텍스트 검사
│   └── 신고/관리자 검수
└── Social / Event Layer
    ├── 친구
    ├── 답장함
    ├── QR 공유
    └── 마음나무
```

기능 추가 시 반드시 지키는 원칙:

- 외부 알림에는 편지 본문을 넣지 않습니다.
- 공개 URL/QR은 열람 token만 담고, token 원문은 DB에 저장하지 않습니다.
- 연락처 suppression과 인증 guard는 raw email/phone/IP를 저장하지 않고 HMAC hash를 사용합니다.
- 마음쓰기 권한은 strict verified PHONE 기준입니다.
- 이메일 인증은 비회원 이메일 수신 메시지를 계정에 연결하는 용도이며, 마음쓰기 권한이 아닙니다.
- UI 변경은 route/API/DB 계약을 깨지 않는 범위에서 presentation layer로 처리합니다.

## 24.2 최신 web UI 구현 계획과 완료 기준

UI 전면 교체의 완료 기준은 “이전 MVP UI를 사용자 화면에서 보지 않는 것”입니다. 현재 구현은 `AppShell`과 공통 토큰을 기준으로 대부분의 route를 새 체계로 재작성했습니다.

```txt
Web Redesign Completion
├── Global
│   ├── fixed top bar
│   ├── desktop sidebar
│   ├── mobile bottom nav
│   ├── maeari app icon
│   └── public stage
├── Surface
│   ├── maeari-hero-card
│   ├── figma-panel
│   ├── maeari-soft-panel
│   ├── maeari-letter-surface
│   └── 8px radius controls
├── Interaction
│   ├── QR modal
│   ├── write success dialog
│   ├── notice tone
│   ├── status pill
│   └── mobile-safe layout
└── Assets
    ├── maeari-app-icon.png
    ├── maeari-card-letter.png
    ├── maeari-hero-floral.png
    ├── maeari-sidebar-sky.png
    └── envelope/letter variants
```

현재 route별 UI 반영:

| Route | 새 UI 반영 내용 | 유지해야 하는 기능 |
| --- | --- | --- |
| `/` | Figma형 hero, KST clock, timeline, recent/quick cards | 실제 message stats/data |
| `/write` | 패널형 작성 flow, 오른쪽 전달 설정, 성공 QR dialog | PHONE gate, 첨부, OCR, 수신자 정책, 서버 시간 |
| `/sent` | 보낸 마음/답장함 탭, letter card, QR modal | 취소/삭제/읽음/답장 삭제 |
| `/inbox` | 받은 마음 card와 archive/delete action | 읽음/보관/삭제/일괄 삭제 |
| `/archive` | 보관함 card와 복구/삭제 | receiverArchivedAt 정책 |
| `/future` | 미래의 나 메시지 card | SELF 예약 표시 |
| `/messages/[id]` | 상세 letter surface, 수신자 상태, QR | 신고/답장/삭제/취소 |
| `/arrival/[token]` | public stage와 열람 surface | gate, 답장, 신고, 수신거부 |
| `/friends` | 친구 코드/search/request/invite panel | 친구 요청과 초대 링크 claim |
| `/my` | 계정/연락처 인증 panel | PHONE 우선, EMAIL 인증/삭제 |
| `/phone-verification` | 독립 인증 화면 | strict phone + OTP |
| `/tree` | 마음나무 생성/목록/QR | collection 생성/취소/상세 |
| `/tree/[token]` | 공개 제출 화면 | 비회원 제출 moderation |
| `/reports` | 감정 리포트 card | 통계 조회 |
| `/admin` | 운영 table/card | moderation/notification/report/reply 관리 |

Figma MCP는 인증과 파일 접근이 확인됐습니다. 단, Starter plan call limit이 발생하면 다음 순서로 대응합니다.

1. 이미 확인한 frame 구조와 local asset으로 구현을 계속합니다.
2. `rg "figma-assets|main-hero|petal|moss|amberline"`로 구 UI 흔적을 제거합니다.
3. call limit 해제 후 `Desktop_main`, `Desktop_Writing`, `Desktop_friends`, `Desktop_my`를 다시 열어 screenshot 대조를 진행합니다.
4. Figma에 없는 route는 같은 shell, spacing, panel, button hierarchy로 확장합니다.

## 24.3 첨부와 OCR moderation 계획

이미지 첨부는 안전 검사 비용과 처리 시간을 고려해 allowlist를 좁게 유지합니다.

```txt
Allowed Attachment Types
├── .jpg / image/jpeg
├── .jpeg / image/jpeg
├── .png / image/png
└── .webp / image/webp
```

차단 대상:

- GIF
- HEIC/HEIF
- SVG
- PDF
- 동영상
- 일반 텍스트/문서
- 확장자와 실제 magic bytes가 맞지 않는 파일

처리 계획:

```txt
1. Client
   ├── accept 제한
   ├── mime/extension 확인
   ├── 개별/총 용량 확인
   └── FormData(payload + attachments)
2. API upload middleware
   ├── multer memory storage
   ├── file count limit
   ├── MIME allowlist
   └── originalname extension allowlist
3. Message service
   ├── magic bytes 검사
   ├── upload dir 저장
   ├── OCR 수행
   ├── OCR text를 moderation input에 병합
   └── MessageAttachment OCR metadata 저장
4. Retry job
   ├── OCR_FAILED attachment 재검사
   ├── moderation 재실행
   └── APPROVED/BLOCKED/MODERATION_FAILED 정리
```

OCR 실패 정책:

- OCR 실패/timeout은 안전하다고 간주하지 않습니다.
- 메시지는 `MODERATION_FAILED` 상태로 저장하고 발송되지 않습니다.
- retry job이 저장 파일을 다시 읽어 OCR과 moderation을 재시도합니다.
- 재시도 한도 초과 시 운영자가 admin moderation log에서 확인할 수 있어야 합니다.

## 24.4 답장함, QR, 마음나무 구현 계획

답장함:

```txt
Public Reply Flow
├── recipient opens /arrival/[token]
├── writes reply
├── public-message.service creates MessageReply
├── domain event message.reply.created
├── NotificationProcessor creates IN_APP and optional EMAIL
├── sender opens /sent?tab=replies
├── PATCH /api/messages/replies/:id/read
└── DELETE /api/messages/replies/:id
```

답장함 privacy:

- 답장 이메일에는 답장 본문을 넣지 않습니다.
- 답장 삭제는 `senderDeletedAt` soft delete입니다.
- 관리자 hidden 처리와 발신자 삭제는 별도 상태입니다.

QR:

```txt
QR Share Flow
├── existing publicUrl / collectionUrl
├── QrShare component
├── QRCodeCanvas rendering
├── copy link
└── download png
```

QR은 URL의 표현 방식이므로 DB migration이 필요 없습니다.

마음나무:

```txt
Collection Flow
├── owner creates collection
├── tokenHash saved, raw token not saved
├── public URL/QR shared
├── guest submits text
├── moderation approved -> VISIBLE
├── scheduledAt reached
├── deliverDueMessageCollections marks DELIVERED
└── owner receives IN_APP + optional EMAIL
```

마음나무 v1 제약:

- 비회원 제출은 텍스트만 허용합니다.
- 첨부 이미지는 일반 마음쓰기에서만 지원합니다.
- 제출자 raw IP는 저장하지 않습니다.
- 동일 IP 제출 제한은 HMAC hash 기준으로 운영합니다.

## 24.5 전화번호 인증과 메시지 생성 계획

메시지 생성 API는 항상 서버가 발신 자격을 판단합니다.

```txt
POST /api/messages
├── authMiddleware
├── ignore senderContactId
├── assertVerifiedSenderPhoneContact(userId)
│   ├── PHONE
│   ├── verifiedAt != null
│   ├── deletedAt = null
│   ├── value matches ^010\d{8}$
│   └── primary -> newest verified fallback
├── normalize recipients
├── moderation/OCR
├── create Message + Recipients + Attachments
└── return publicUrl/token where applicable
```

전화번호 인증 API:

```txt
POST /api/me/contacts
├── type=PHONE
├── strict normalize
├── rate limit / lock preflight
├── Twilio Lookup cache or lookup
├── create/reactivate pending UserContact
└── send-code flow

POST /api/me/contacts/:id/send-code
├── preflight
├── cooldown
├── OTP hash 저장
└── Solapi SMS 발송

POST /api/me/contacts/:id/verify
├── code hash compare
├── attempt count
├── transaction
│   ├── retire old active PHONE
│   └── activate new PHONE primary
└── claimRecipientsForVerifiedContact
```

## 24.6 운영 반영 계획

UI-only 변경:

```bash
pnpm --filter @maeari/web typecheck
pnpm --filter @maeari/web build
pm2 restart maeari-web --update-env
pm2 save
```

API/DB 변경:

```bash
pnpm db:validate
pnpm --filter @maeari/api typecheck
pnpm --filter @maeari/api build
pnpm --filter @maeari/web typecheck
pnpm --filter @maeari/web build
pm2 restart maeari-api --update-env
pm2 restart maeari-scheduler --update-env
pm2 restart maeari-web --update-env
pm2 save
```

smoke test:

```bash
curl -I http://127.0.0.1:4000/api/health
curl -I http://127.0.0.1:3000/
curl -I https://maeari.madcamp-kaist.org/api/health
curl -I https://maeari.madcamp-kaist.org/
```

수동 QA priority:

1. Kakao login과 pending token 처리.
2. strict 010 인증, lock, invalid phone UX.
3. `/write` PHONE gate와 이미지 1/2/3개 첨부.
4. OCR 욕설 이미지 차단 또는 moderation retry.
5. Gmail SMTP, Solapi SMS, suppression/re-subscribe.
6. 공개 링크 도착 전/후 열람.
7. 익명 답장과 `/sent` 답장함.
8. QR 스캔/다운로드.
9. 친구 초대 링크 claim.
10. 마음나무 생성/제출/도착.
11. 모바일 bottom nav와 버튼/text overflow.
12. Figma frame 재대조.
