# 매아리 MVP IA

## 0. 문서 목적

이 문서는 `MAEARI_PLAN.md`를 바탕으로 작성한 **매아리 MVP Information Architecture**입니다.

목표는 실제 화면 설계, 라우팅, API 연동, 상태 처리, 비회원 열람 후 가입 귀속 흐름을 한눈에 볼 수 있도록 tree 형태로 구체화하는 것입니다.

---

## 1. IA 설계 기준

## 1.1 사용자 유형

```txt
매아리 사용자
├── 비회원 사용자
│   ├── 공개 링크로 메시지를 열람하는 수신자
│   ├── 카카오 로그인 전 신규 사용자
│   └── 메시지를 보관하기 위해 가입하려는 사용자
│
├── 로그인 사용자
│   ├── 메시지를 작성하는 발신자
│   ├── 미래의 나에게 메시지를 보내는 사용자
│   ├── 타인에게 메시지를 보내는 사용자
│   ├── 받은 메시지를 보관하는 수신자
│   ├── 예약 메시지를 관리하는 사용자
│   └── 관리자 권한이 있는 운영 사용자
│
└── 시스템 사용자
    ├── node-cron scheduler
    ├── ModerationRetryScheduler
    ├── NotificationRetryScheduler
    ├── ArrivalHintScheduler
    ├── NotificationProcessor
    ├── Gmail SMTP provider
    ├── Solapi SMS provider
    ├── Twilio Lookup v2 provider
    ├── PhoneVerificationGuard
    ├── ImageOcrService
    ├── MessageCollectionScheduler
    └── OpenAI Moderation API
```

## 1.2 MVP 핵심 사용자 여정

```txt
매아리 MVP 여정
├── 1. 카카오 로그인
├── 2. 온보딩 질문 확인
├── 3. 마음쓰기 전 전화번호 인증 상태 확인
├── 4. 미인증이면 /phone-verification에서 strict 010 휴대전화 OTP 인증
├── 5. 메시지 작성
├── 6. 이미지 첨부가 있으면 확장자/MIME/header 검증
├── 7. 첨부 이미지 OCR 텍스트 추출
├── 8. 텍스트 본문 + OCR 텍스트 AI 안전 검사
├── 9. AI 검사 API 실패 시 즉시 1회 재시도
├── 10. 2회 실패 또는 OCR 실패 시 검사 실패 상태로 임시 보관
├── 11. 검사 통과 시 예약 메시지 저장
├── 12. 공개 열람 링크와 QR 표시
├── 13. 예약 시간 도래
├── 14. Scheduler가 SENT 처리
├── 15. NotificationProcessor 후속 처리
├── 16. 친구/자기 자신 수신자는 수신함에서 확인
├── 17. 외부 수신자는 Gmail SMTP 또는 Solapi SMS로 공개 링크 수신
├── 18. 수신자가 공개 링크로 열람
├── 19. 필요 시 익명 답장 또는 신고 작성
├── 20. 답장은 발신자 알림과 답장함으로 전달
├── 21. 필요 시 이메일/문자 알림 수신거부
├── 22. 비회원 수신자가 가입하거나 연락처 인증하면 메시지 자동 보관
├── 23. 친구 초대 링크 수신자가 로그인하면 즉시 친구 연결
├── 24. 발신자/수신자가 보관함에서 감정 태그 필터, 아카이브, 삭제 수행
├── 25. 마음나무 링크에서 비회원 편지를 수집하고 도착 시점에 일괄 공개
└── 26. 관리자가 moderation/notification/reply/report 상태 점검
```

---

## 2. 전체 서비스 IA Tree

```txt
매아리
├── Public Area
│   ├── /login
│   │   ├── 카카오 로그인 진입
│   │   ├── 서비스 감성 카피
│   │   ├── 로그인 필요 안내
│   │   └── CTA: 카카오로 시작하기
│   │
│   ├── /arrival/[token]
│   │   ├── 공개 메시지 열람
│   │   ├── token sessionStorage 저장
│   │   ├── 메시지 도착 gate
│   │   ├── 테마와 첨부 이미지 표시
│   │   ├── 메시지 본문 열람
│   │   ├── 발신인 숨김 처리
│   │   ├── 도착일 숨김 처리
│   │   ├── 익명 답장 작성
│   │   ├── 메시지 신고
│   │   ├── 이메일/문자 알림 수신거부
│   │   ├── 회원가입 유도 CTA
│   │   └── 오류 상태
│   │       ├── token 없음
│   │       ├── token 만료
│   │       ├── 이미 다른 계정에 보관됨
│   │       └── 메시지 조회 실패
│   │
│   ├── /arrival/link-failed
│   │   ├── 메시지 보관 실패 안내
│   │   ├── 다시 로그인하기
│   │   ├── 공개 메시지로 돌아가기
│   │   └── 고객 문의 안내
│   │
│   └── /auth/callback
│       ├── 카카오 로그인 완료 처리
│       ├── sessionStorage pending token 확인
│       ├── sessionStorage pending friend invite token 확인
│       ├── /api/auth/link-message 호출
│       ├── /api/friends/invites/:token/claim 호출
│       ├── 성공 시 /inbox 이동
│       ├── pending token 없으면 /write 이동
│       └── 실패 시 /arrival/link-failed 이동
│
├── Authenticated Area
│   ├── /
│   │   ├── 메인 대시보드
│   │   ├── KST 현재 시각
│   │   ├── 마음 쓰기 진입
│   │   ├── 보낸 마음 진입
│   │   ├── 받은 마음 진입
│   │   ├── 친구 관리 진입
│   │   ├── 감정 리포트 진입
│   │   └── 미래의 나 진입
│   │
│   ├── /onboarding
│   │   ├── 감성 질문
│   │   ├── 첫 메시지 작성 유도
│   │   ├── 오늘의 마음 입력
│   │   └── CTA: 마음 남기기
│   │
│   ├── /write
│   │   ├── 메시지 작성
│   │   │   ├── /me/contacts로 전화번호 인증 여부 확인
│   │   │   ├── 미인증 시 /phone-verification?next=/write CTA
│   │   │   ├── 연락처 선택 정보는 화면에 노출하지 않음
│   │   │   ├── 수신 대상 선택
│   │   │   │   ├── 미래의 나
│   │   │   │   ├── 친구
│   │   │   │   └── 연락처
│   │   │   ├── 친구 선택 또는 외부 수신자 정보 입력
│   │   │   ├── 그룹 수신자 목록 추가/삭제
│   │   │   ├── 이메일/전화번호 중 하나 이상 입력
│   │   │   ├── 선호 채널: 자동 선택 / 이메일 / 문자
│   │   │   ├── 제목 입력
│   │   │   ├── 본문 입력
│   │   │   ├── 감정 태그 선택
│   │   │   ├── 이미지 첨부
│   │   │   ├── KST 현재 시각 표시
│   │   │   ├── 고정 도착 또는 기간 랜덤 도착 선택
│   │   │   ├── 도착 전 힌트 선택
│   │   │   ├── 메시지 테마 선택
│   │   │   ├── 익명 답장 허용 여부
│   │   │   └── 예약 날짜/시간 선택
│   │   │
│   │   ├── 감성 옵션
│   │   │   ├── 발신인 숨기기
│   │   │   └── 도착일 숨기기
│   │   │
│   │   ├── 작성 상태
│   │   │   ├── 작성 중
│   │   │   ├── 저장 중
│   │   │   ├── AI 검사 중
│   │   │   ├── AI 차단
│   │   │   ├── 예약 완료
│   │   │   └── 서버 오류
│   │   │
│   │   └── 완료 후 이동
│   │       ├── /sent
│   │       ├── /messages/[id]
│   │       └── 공개 링크 공유 UI
│   │
│   ├── /friends
│   │   ├── 내 친구 코드
│   │   ├── 친구 초대 링크 생성/복사/폐기
│   │   ├── 닉네임 또는 친구 코드로 친구 찾기
│   │   ├── 친구 코드로 요청 보내기
│   │   ├── 받은 요청 수락/거절
│   │   ├── 보낸 요청 취소
│   │   ├── 친구 목록
│   │   └── 친구 삭제
│   │
│   ├── /friends/invite/[token]
│   │   ├── 초대 링크 미리보기
│   │   ├── 초대자 닉네임 표시
│   │   ├── 만료/폐기/사용 완료 상태 표시
│   │   ├── 로그인 전이면 pendingFriendInviteToken 저장 후 로그인 CTA
│   │   └── 로그인 후 claim 성공 시 /friends 이동
│   │
│   ├── /phone-verification
│   │   ├── 010 휴대전화 번호 입력
│   │   ├── 인증번호 발송
│   │   ├── 인증번호 재발송
│   │   ├── 6자리 OTP 입력
│   │   ├── 인증 완료 상태
│   │   └── safe next: /write 또는 /my
│   │
│   ├── /sent
│   │   ├── 내가 보낸 메시지 목록
│   │   ├── 상태별 필터
│   │   ├── 감정 태그 필터
│   │   │   ├── 예약 대기
│   │   │   ├── 발송 완료
│   │   │   ├── 실패
│   │   │   └── 취소
│   │   ├── 메시지 카드
│   │   │   ├── 제목
│   │   │   ├── 수신자 요약
│   │   │   ├── 감정 태그
│   │   │   ├── 예약일
│   │   │   └── 상태 badge
│   │   ├── 예약 취소
│   │   ├── 공개 링크 복사
│   │   ├── 예약 전/검사 실패/취소 메시지 삭제
│   │   ├── 도착 완료/실패 메시지를 보낸 마음에서 삭제
│   │   └── 상세 보기
│   │
│   ├── /inbox
│   │   ├── 내가 받은 메시지 목록
│   │   ├── 자동 귀속된 공개 링크 메시지
│   │   ├── 읽음/미열람 필터
│   │   ├── 감정 태그 필터
│   │   ├── 받은 마음 아카이브
│   │   ├── 받은 마음 삭제
│   │   ├── 현재 보이는 항목 일괄 삭제
│   │   ├── 메시지 카드
│   │   │   ├── 제목
│   │   │   ├── 발신자 표시 또는 숨김
│   │   │   ├── 도착일 표시 또는 숨김
│   │   │   ├── 감정 태그
│   │   │   └── 읽음 상태
│   │   ├── 빈 상태
│   │   └── 상세 보기
│   │
│   ├── /archive
│   │   ├── 아카이브한 받은 마음 목록
│   │   ├── 감정 태그 필터
│   │   ├── 받은 마음으로 복구
│   │   ├── 아카이브에서 삭제
│   │   └── 현재 보이는 항목 일괄 삭제
│   │
│   ├── /future
│   │   ├── 미래의 나에게 쓴 마음 모음
│   │   ├── 감정 태그 필터
│   │   ├── 상태 badge
│   │   └── 상세 보기
│   │
│   ├── /reports
│   │   ├── 월별 감정 리포트
│   │   ├── 보낸 마음/도착 완료/받은 마음/읽은 마음 지표
│   │   ├── 보낸 마음 감정 분포
│   │   ├── 받은 마음 감정 분포
│   │   └── 보낸 마음 상태 분포
│   │
│   ├── /tree
│   │   ├── 마음나무 생성
│   │   ├── 도착 시점 설정
│   │   ├── 생성 완료 후 QR/링크 공유
│   │   ├── 내 마음나무 목록
│   │   ├── ACTIVE 상태 제출 개수 확인
│   │   ├── DELIVERED 상태 제출 본문 열람
│   │   └── ACTIVE 마음나무 취소
│   │
│   ├── /tree/[token]
│   │   ├── 공개 마음나무 제목/설명 조회
│   │   ├── 도착 전 비회원 텍스트 제출
│   │   ├── senderDisplayName 선택 입력
│   │   ├── submission moderation
│   │   ├── IP hash rate limit
│   │   └── 도착 후/취소/만료 상태 안내
│   │
│   ├── /admin
│   │   ├── ADMIN_KAKAO_IDS 기반 접근
│   │   ├── 운영 요약 KPI
│   │   ├── NotificationLog 재시도/채널/provider/실패 코드 통계
│   │   ├── moderation log 목록
│   │   ├── notification log 목록
│   │   ├── 익명 답장 검수/숨김
│   │   ├── 신고 검토/기각
│   │   └── 신고 발신자 계정 정지/해제
│   │
│   ├── /messages/[id]
│   │   ├── 메시지 상세
│   │   ├── 제목
│   │   ├── 본문
│   │   ├── 감정 태그
│   │   ├── 첨부 이미지
│   │   ├── 테마/랜덤 도착/힌트 정보
│   │   ├── 발신자 정보
│   │   ├── 수신자 정보
│   │   ├── 예약일/도착일
│   │   ├── 상태
│   │   ├── 익명 답장 목록
│   │   ├── 공개 링크
│   │   ├── 예약 취소
│   │   ├── 보관함에서 삭제
│   │   ├── 메시지 신고
│   │   └── 목록으로 돌아가기
│   │
│   └── /my
│       ├── 내 정보
│       ├── 카카오 계정 정보
│       ├── 닉네임
│       ├── 이메일
│       ├── 연락처 인증
│       │   ├── PHONE 인증 상태
│       │   ├── 이메일 연결 상태
│       │   ├── 이메일/전화번호 추가
│       │   ├── OTP 인증 코드 발송
│       │   ├── 인증 코드 확인
│       │   ├── 인증 완료 PHONE 변경
│       │   └── 삭제 가능한 연락처 삭제
│       ├── 관리자 화면 진입
│       ├── 로그아웃
│       └── 탈퇴는 MVP 이후
│
└── System Area
    ├── Scheduler
    │   ├── 5분마다 실행
    │   ├── PENDING 메시지 조회
    │   ├── scheduledAt <= now 필터
    │   ├── SENT 상태 변경
    │   └── message.sent event 발행
    │
    ├── ArrivalHintScheduler
    │   ├── delivery cron과 같은 주기로 실행
    │   ├── PENDING 메시지 조회
    │   ├── hintAt <= now AND hintSentAt IS NULL 필터
    │   ├── ARRIVAL_HINT notification 생성
    │   └── hintSentAt 기록
    │
    ├── NotificationProcessor
    │   ├── message.sent event 수신
    │   ├── 가입 수신자 알림 생성
    │   ├── 외부 수신자 channel 결정
    │   ├── ContactSuppression pre-flight
    │   ├── Gmail SMTP 이메일 발송
    │   ├── Solapi SMS 발송
    │   ├── NotificationLog 저장
    │   ├── retryable 실패 시 nextRetryAt 기록
    │   └── 알림 실패 로그 기록
    │
    ├── NotificationRetryScheduler
    │   ├── NotificationLog.status = PENDING 조회
    │   ├── nextRetryAt <= now 필터
    │   ├── EMAIL/SMS provider 재호출
    │   └── 최대 시도 초과 시 FAILED 처리
    │
    ├── CollectionDeliveryScheduler
    │   ├── DELIVERY_CRON 주기로 실행
    │   ├── ACTIVE 마음나무 조회
    │   ├── scheduledAt <= now 필터
    │   ├── MessageCollection.status = DELIVERED
    │   ├── visible submission deliveredAt 기록
    │   └── COLLECTION_DELIVERED notification 생성
    │
    ├── ModerationRetryScheduler
    │   ├── 하루 한 번 실행
    │   ├── MODERATION_FAILED 메시지 조회
    │   ├── moderationNextRetryAt <= now 필터
    │   ├── 재검사 통과 시 PENDING 복귀
    │   ├── 재검사 차단 시 BLOCKED 전환
    │   └── 재검사 API 실패 시 다음 날 재시도 예약
    │
    └── Moderation
        ├── 메시지 저장 전 검사
        ├── 로컬 한국어 욕설/비하 보강 검사
        ├── OpenAI Moderation API 호출
        ├── 매아리 guardrail prompt 2차 판정
        ├── API 실패 시 즉시 1회 재시도
        ├── 2회 실패 시 MODERATION_FAILED 상태 저장
        ├── 하루 1회 자동 재검사
        ├── flagged=false면 저장 허용
        ├── flagged=true면 저장 차단
        └── categories 기반 UX 피드백 반환
```

---

## 3. Global Navigation IA

## 3.1 비회원 Navigation

```txt
비회원 Navigation
├── 로고
│   └── /login 또는 /arrival/[token] context 유지
│
├── 주요 CTA
│   ├── 카카오로 시작하기
│   └── 마음 보관하기
│
└── 보조 액션
    ├── 공개 메시지 열람
    ├── 다시 열어보기
    └── 로그인으로 이동
```

## 3.2 로그인 사용자 Navigation

```txt
로그인 사용자 Navigation
├── 홈
│   └── /
│
├── 마음 쓰기
│   └── /write
│
├── 받은 마음
│   └── /inbox
│
├── 보낸 마음
│   └── /sent
│
├── 마음나무
│   └── /tree
│
├── 친구
│   └── /friends
│
├── 리포트
│   └── /reports
│
└── 내 정보
    └── /my
```

## 3.3 Mobile Bottom Navigation

```txt
Mobile Bottom Navigation
├── 쓰기
│   ├── icon: pencil
│   └── route: /write
│
├── 받은 마음
│   ├── icon: inbox
│   └── route: /inbox
│
├── 보낸 마음
│   ├── icon: send
│   └── route: /sent
│
├── 친구
│   ├── icon: users
│   └── route: /friends
│
└── 내 정보
    ├── icon: user
    └── route: /my
```

모바일 하단 navigation은 화면 폭과 엄지 접근성을 고려해 5개 핵심 동선만 고정합니다. `/tree`와 `/reports`는 데스크톱 sidebar, 홈 quick card, 직접 URL, 또는 각 화면 내부 CTA로 접근합니다.

## 3.4 Figma AppShell IA

```txt
Authenticated AppShell
├── Top Bar
│   ├── height: 74px
│   ├── left: maeari-app-icon.png
│   ├── label: 매아리
│   └── right: profile shortcut -> /my
│
├── Desktop Sidebar
│   ├── width: 221px
│   ├── fixed from top 74px
│   ├── nav items
│   │   ├── 홈 -> /
│   │   ├── 마음 보내기 -> /write
│   │   ├── 받은 마음 -> /inbox
│   │   ├── 보낸 마음 -> /sent
│   │   ├── 마음나무 -> /tree
│   │   ├── 친구 -> /friends
│   │   ├── 리포트 -> /reports
│   │   └── 내 정보 -> /my
│   └── Today Line Panel
│       ├── maeari-sidebar-sky.png
│       └── 감성 문구
│
├── Main Stage
│   ├── class: maeari-stage
│   ├── background: #FBF9FC + lavender radial gradients
│   ├── content max width: 1190px
│   └── panels use figma-panel
│
└── Mobile Bottom Nav
    ├── 쓰기 -> /write
    ├── 받은 마음 -> /inbox
    ├── 보낸 마음 -> /sent
    ├── 친구 -> /friends
    └── 내 정보 -> /my
```

```txt
Public Stage
├── 적용 route
│   ├── /login
│   ├── /auth/callback
│   ├── /arrival/[token]
│   ├── /arrival/link-failed
│   ├── /friends/invite/[token]
│   └── /tree/[token]
│
├── Layout
│   ├── class: maeari-public-stage
│   ├── full width background: #FBF9FC + lavender radial gradients
│   ├── compact top brand bar
│   └── centered content panel
│
└── 공통 규칙
    ├── sidebar는 노출하지 않음
    ├── 공개 링크 token context를 유지
    ├── 로그인 CTA는 카카오 OAuth로 연결
    ├── 외부 수신자도 본문 열람 전 gate를 통과
    └── form/action button은 maeari-action 계열 사용
```

## 3.5 Figma 리디자인 화면 대응표

```txt
Figma frame -> Web route mapping
├── Desktop_main
│   └── /
│       ├── hero
│       ├── timeline
│       ├── recent card
│       └── quick action card
│
├── Desktop_Writing
│   └── /write
│       ├── 전화번호 인증 gate
│       ├── 수신자/그룹 panel
│       ├── 제목/본문/첨부 panel
│       ├── 도착 설정 panel
│       └── 제출/결과 dialog
│
├── Desktop_friends
│   └── /friends
│       ├── 친구 코드
│       ├── 친구 검색
│       ├── 요청 받은/보낸 목록
│       ├── 친구 초대 링크
│       └── 친구 목록
│
└── Desktop_my
    └── /my
        ├── 계정 정보
        ├── PHONE 우선 연락처 인증
        ├── EMAIL 연결용 인증
        ├── 관리자 진입
        └── 로그아웃
```

Figma에 직접 없는 화면은 위 네 frame의 규칙을 확장합니다.

```txt
Figma 규칙 확장 route
├── /sent
│   ├── 보낸 마음 tab
│   └── 답장함 tab
├── /inbox
├── /archive
├── /future
├── /messages/[id]
├── /arrival/[token]
├── /tree
├── /tree/[token]
├── /reports
└── /admin
```

공통 UI component:

```txt
Common UI
├── figma-panel
│   ├── 8px radius
│   ├── lavender border
│   └── soft shadow
├── maeari-input
│   ├── input
│   ├── textarea
│   └── select
├── maeari-chip / maeari-chip-active
│   ├── filters
│   ├── segmented option
│   └── secondary small action
├── maeari-action
│   ├── default button
│   ├── primary button
│   └── danger button
├── maeari-badge
│   ├── message status
│   ├── emotion
│   ├── notification status
│   └── contact verification
└── QrShare
    ├── publicUrl QR
    ├── collectionUrl QR
    ├── link copy
    └── PNG save
```

리디자인은 IA의 route path와 API 계약을 바꾸지 않습니다. 화면의 정보 구조, CTA 위치, panel hierarchy, typography만 Figma 기준으로 재배치합니다.

---

## 4. 화면별 상세 IA

## 4.1 `/login`

```txt
/login
├── 목적
│   └── 카카오 OAuth 로그인 시작
│
├── 진입 경로
│   ├── 직접 접속
│   ├── 인증이 필요한 페이지 접근
│   ├── /arrival/[token]의 회원가입 CTA
│   └── session 만료 후 redirect
│
├── 주요 UI
│   ├── 서비스명: 매아리
│   ├── 감성 카피
│   ├── 카카오 로그인 버튼
│   └── 약관/개인정보 안내 링크
│
├── 액션
│   └── 카카오 로그인 클릭
│       └── GET /api/auth/kakao
│
└── 다음 화면
    ├── 신규 사용자: /onboarding
    ├── 기존 사용자: /write
    └── pending arrival token 있음: /auth/callback 경유 후 /inbox
```

## 4.2 `/auth/callback`

```txt
/auth/callback
├── 목적
│   └── 로그인 완료 후 후처리
│
├── 처리 로직
│   ├── sessionStorage.maeari.pendingArrivalToken 확인
│   ├── token 있음
│   │   ├── POST /api/auth/link-message
│   │   ├── 성공: token 삭제
│   │   └── /inbox 이동
│   └── token 없음
│       └── /write 또는 /onboarding 이동
│
├── 로딩 상태
│   ├── 로그인 정보를 확인하고 있어요
│   └── 도착한 마음을 보관하고 있어요
│
└── 오류 상태
    ├── token 만료: /arrival/link-failed
    ├── 이미 다른 계정에 보관됨: /arrival/link-failed
    └── 네트워크 오류: 재시도 CTA
```

## 4.3 `/onboarding`

```txt
/onboarding
├── 목적
│   └── 첫 메시지 작성을 부드럽게 유도
│
├── 주요 UI
│   ├── 감성 질문
│   │   └── 오늘 당신의 마음에 피어난 한 줄의 생각은 무엇인가요?
│   ├── 짧은 답변 입력
│   ├── 건너뛰기
│   └── 마음 남기기 CTA
│
├── 데이터
│   ├── User.id
│   ├── nickname
│   └── onboarding answer는 MVP에서 저장 선택
│
└── 다음 화면
    └── /write
```

## 4.4 `/write`

```txt
/write
├── 목적
│   └── 예약 메시지 작성 및 저장
│
├── Section 0. 마음쓰기 권한 확인
│   ├── GET /api/me/contacts
│   ├── writerEligibility.hasVerifiedStrictPhone 확인
│   ├── false이면 안내 패널 표시
│   ├── CTA: /phone-verification?next=/write
│   ├── 예약 버튼 비활성화
│   └── 연락처 select/masked value는 표시하지 않음
│
├── Section 1. 수신 대상
│   ├── 미래의 나
│   │   ├── receiverInfo.type = SELF
│   │   └── 기본 수신자명: 미래의 나
│   ├── 친구
│   │   ├── receiverInfo.type = FRIEND
│   │   ├── 친구 목록에서 선택
│   │   ├── friendshipId snapshot 저장
│   │   └── receiverUserId = friend.id
│   └── 연락처
│       ├── receiverInfo.type = OTHER
│       ├── 이름
│       ├── 이메일
│       ├── 전화번호
│       ├── 이메일 또는 전화번호 중 하나 필수
│       ├── 전화번호는 010-1234-5678 형태로 표시
│       ├── submit payload는 숫자만 전송
│       └── 선호 채널: AUTO / EMAIL / SMS
│
├── Section 1-1. 그룹 수신자
│   ├── 현재 입력한 수신자 추가
│   ├── 추가된 수신자 label 표시
│   ├── 수신자별 payload 보존
│   └── 추가된 수신자 삭제
│
├── Section 2. 메시지 내용
│   ├── 제목
│   ├── 본문
│   ├── 감정 태그
│       ├── 고마움
│       ├── 응원
│       ├── 축하
│       ├── 위로
│       ├── 그리움
│       ├── 사랑
│       └── 직접 입력
│   └── 이미지 첨부
│       ├── JPG/JPEG/PNG/WebP
│       ├── GIF/HEIC/PDF 차단
│       ├── 최대 3개
│       ├── 파일당 MAX_ATTACHMENT_BYTES 이하
│       ├── 전체 MAX_ATTACHMENT_TOTAL_BYTES 이하
│       ├── payload + 이미지 3개 multipart 요청 허용
│       └── 미리보기와 삭제
│
├── Section 3. 도착 설정
│   ├── KST 현재 시각 초 단위 표시
│   ├── GET /api/time
│   ├── 서버 기준 defaultScheduledAt = serverNow + 24h
│   ├── 서버 시간 조회 실패 시 1회 retry 후 다시 시도 버튼
│   ├── 고정 도착
│   ├── 기간 랜덤 도착
│   │   ├── 시작 날짜/시간
│   │   ├── 종료 날짜/시간
│   │   └── 서버가 구간 안에서 scheduledAt 선택
│   ├── 빠른 프리셋
│   ├── 날짜 선택
│   ├── 시/분 1분 단위 직접 입력
│   ├── 15분 단위 quick minute 버튼
│   ├── KST 도착 미리보기
│   ├── 과거 시간 선택 방지
│   ├── timezone 안내
│   └── 도착 전 힌트
│       ├── 없음
│       ├── 1시간 전
│       └── 하루 전
│
├── Section 4. 감성 옵션
│   ├── 발신인 숨기기
│   │   └── isSenderHidden
│   ├── 도착일 숨기기
│   │   └── isDateHidden
│   ├── 익명 답장 허용
│   │   └── isReplyEnabled
│   └── 메시지 테마
│       ├── LAVENDER
│       ├── MOSS
│       ├── SUNSET
│       ├── MIDNIGHT
│       └── PAPER
│
├── 제출 전 검증
│   ├── verified strict PHONE 필요
│   ├── 필수값 확인
│   ├── 제목 길이
│   ├── 본문 길이
│   ├── scheduledAt 미래 여부
│   ├── receiverInfo 형식
│   ├── recipients 배열 형식
│   ├── 첨부 이미지 개수/크기/MIME type
│   ├── RANDOM_WINDOW 종료 시간이 시작 시간보다 뒤인지 확인
│   ├── hintAt이 현재보다 뒤이고 scheduledAt보다 앞인지 확인
│   ├── FRIEND는 활성 친구 관계 필요
│   ├── OTHER + AUTO는 이메일 또는 전화번호 중 하나 필요
│   ├── OTHER + EMAIL은 이메일 필요
│   └── OTHER + SMS는 전화번호 필요
│
├── 제출 액션
│   └── POST /api/messages
│       ├── 첨부 없음: JSON body
│       ├── 첨부 있음: multipart payload + attachments
│       ├── multipart parts limit은 payload + 이미지 3개를 허용
│       ├── auth middleware
│       ├── request validation
│       ├── senderContactId payload 무시
│       ├── 서버가 verified strict PHONE 직접 선택
│       ├── OpenAI moderation
│       ├── API 실패 시 즉시 1회 재시도
│       ├── 통과 시 PENDING 저장
│       ├── 통과 시 수신자별 publicUrl 반환
│       └── 2회 검사 실패 시 MODERATION_FAILED 저장
│
├── 성공 상태
│   ├── WriteNoticeDialog 중앙 팝업
│   ├── 예약 완료 메시지
│   ├── 제목/수신자/도착 예정 시각 표시
│   ├── publicUrl 용도 안내
│   ├── 첫 번째 publicUrl 복사
│   ├── 메인으로 이동
│   ├── 발신함으로 이동
│   ├── 예약 상세 보기
│   └── 새 마음 쓰기
│
├── 검사 실패 보관 상태
│   ├── WriteNoticeDialog 중앙 팝업
│   ├── 안전 검사를 잠시 완료하지 못했어요
│   ├── 작성한 마음은 임시 보관됨
│   ├── publicUrl 미발급
│   ├── 하루 한 번 자동 재검사 안내
│   └── 확인 버튼으로 닫기
│
└── 실패 상태
    ├── 화면 상단 인라인 notice가 아니라 중앙 팝업으로 표시
    ├── AI 차단
    │   ├── hate/harassment feedback
    │   ├── self-harm/violence feedback
    │   ├── sexual feedback
    │   └── generic feedback
    ├── OpenAI 검사 실패
    │   ├── 1회 자동 재시도
    │   ├── 2회 실패 시 검사 실패 상태 표시
    │   ├── publicUrl 미발급
    │   └── 하루 1회 자동 재검사 안내
    ├── 인증 만료
    ├── 전화번호 인증 필요
    ├── 서버 시간 조회 실패
    ├── 첨부 형식/용량 오류
    ├── validation 오류
    └── 서버 오류
```

## 4.4.1 `/phone-verification`

```txt
/phone-verification
├── 목적
│   └── 마음쓰기 권한용 010 휴대전화 인증
│
├── 진입 경로
│   ├── /write 인증 필요 CTA
│   ├── /my 전화번호 변경 CTA
│   └── 직접 접근
│
├── next 처리
│   ├── 허용: /write, /my
│   └── 그 외 외부 URL/비정상 값은 /write로 대체
│
├── 초기 데이터
│   └── GET /api/me/contacts
│       ├── 이미 isWriteEligiblePhone=true이면 인증 완료 패널
│       └── 미인증 PHONE이 있으면 pendingContactId 유지
│
├── 인증번호 발송
│   ├── 전화번호 입력
│   ├── 010-1234-5678 포맷팅
│   ├── POST /api/me/contacts { type: PHONE, value }
│   ├── CONTACT_PHONE_INVALID 안내
│   ├── PHONE_VERIFICATION_*_LOCKED 안내
│   └── PHONE_LOOKUP_UNAVAILABLE 안내
│
├── 인증번호 검증
│   ├── 6자리 OTP 입력
│   ├── POST /api/me/contacts/:id/verify
│   ├── 성공 시 loadContacts
│   └── next로 이동
│
└── 재발송
    ├── POST /api/me/contacts/:id/send-code
    └── 60초 cooldown
```

```txt
Legacy note
├── /write에는 연락처 선택 UI가 없음
├── 이메일 인증만으로는 마음쓰기 불가
└── 전화번호는 메시지 수신/전달에 직접 사용하지 않고 작성 권한 확인에만 사용
```

## 4.5 `/sent`

```txt
/sent
├── 목적
│   └── 내가 작성한 메시지 확인, 예약 관리, 받은 익명 답장 확인
│
├── 진입 경로
│   ├── navigation
│   ├── 메시지 작성 완료
│   └── 메시지 상세에서 돌아가기
│
├── 데이터 요청
│   ├── GET /api/messages/sent
│   └── GET /api/messages/sent/replies
│
├── 상단 탭
│   ├── 보낸 마음
│   └── 답장함
│
├── 목록 필터
│   ├── 전체
│   ├── 예약 대기
│   ├── 발송 완료
│   ├── 검사 실패
│   ├── 실패
│   └── 취소
│
├── 감정 필터
│   ├── 모든 감정
│   └── 현재 목록에 있는 감정 태그
│
├── 메시지 카드
│   ├── 제목
│   ├── 수신자명
│   ├── 감정 태그
│   ├── 예약일
│   ├── 재검사 예정일
│   ├── 수신자 수
│   ├── 발송 상태
│   └── 숨김 옵션 badge
│
├── 카드 액션
│   ├── 상세 보기
│   ├── 공개 링크 복사
│   │   └── MODERATION_FAILED 상태에서는 비활성
│   ├── QR 보기
│   │   ├── publicUrl을 QR로 렌더링
│   │   ├── 링크 복사 fallback
│   │   └── QR PNG 저장
│   ├── 예약 취소
│   │   └── PATCH /api/messages/:id/cancel
│   └── 보낸 마음에서 삭제
│       ├── PENDING/MODERATION_FAILED/CANCELED: hard delete
│       └── SENT/FAILED: senderDeletedAt soft delete
│
├── 답장함 탭
│   ├── 답장 작성 시각
│   ├── 연결된 메시지 제목
│   ├── 수신자 표시명
│   ├── 익명 여부
│   ├── 짧은 미리보기
│   ├── 읽음 상태
│   ├── PATCH /api/messages/replies/:id/read
│   └── DELETE /api/messages/replies/:id
│
└── 빈 상태
    ├── 아직 보낸 마음이 없어요
    └── CTA: 첫 마음 쓰기
```

## 4.6 `/inbox`

```txt
/inbox
├── 목적
│   └── 내가 받은 메시지와 가입 후 귀속된 메시지 확인
│
├── 진입 경로
│   ├── navigation
│   ├── /auth/callback link-message 성공
│   ├── 공개 링크 보관 완료
│   └── 메시지 상세에서 돌아가기
│
├── 데이터 요청
│   └── GET /api/messages/received
│
├── 목록 구성
│   ├── 최신 도착순
│   ├── 전체/미열람/읽음 필터
│   ├── 감정 태그 필터
│   ├── 읽음/미열람 상태
│   └── 자동 보관 badge
│
├── 메시지 카드
│   ├── 제목
│   ├── 본문 미리보기
│   ├── 발신자
│   │   ├── 표시
│   │   └── 숨김: 누군가의 마음
│   ├── 도착일
│   │   ├── 표시
│   │   └── 숨김: 어느 날 도착한 마음
│   ├── 감정 태그
│   ├── 보관
│   │   └── PATCH /api/messages/:id/archive
│   ├── 삭제
│   │   └── DELETE /api/messages/:id
│   ├── 일괄 삭제
│   │   └── POST /api/messages/bulk-delete
│   └── 상세 보기
│
└── 빈 상태
    ├── 아직 도착한 마음이 없어요
    └── CTA: 미래의 나에게 마음 쓰기
```

## 4.7 `/archive`

```txt
/archive
├── 목적
│   └── 아카이브한 받은 마음을 따로 관리
│
├── 데이터 요청
│   └── GET /api/messages/archived
│
├── 목록 구성
│   ├── 최신 아카이브순
│   ├── 감정 태그 필터
│   └── 현재 보이는 항목 일괄 삭제
│
├── 카드 액션
│   ├── 상세 보기
│   ├── 받은 마음으로 복구
│   │   └── PATCH /api/messages/:id/unarchive
│   └── 삭제
│       └── DELETE /api/messages/:id
│
└── 빈 상태
    └── 아카이브한 마음이 없어요
```

## 4.8 `/future`

```txt
/future
├── 목적
│   └── 미래의 나에게 쓴 메시지만 모아보기
│
├── 데이터 요청
│   └── GET /api/messages/sent
│
├── 클라이언트 필터
│   ├── receiver.type = SELF
│   └── 감정 태그 필터
│
├── 카드 표시
│   ├── 상태 badge
│   ├── 감정 태그
│   ├── 제목
│   └── 도착 예정 시각
│
└── 빈 상태
    └── 미래의 나에게 맡긴 마음이 없어요
```

## 4.9 `/reports`

```txt
/reports
├── 목적
│   └── 월별 보낸/받은 마음의 감정 흐름 확인
│
├── 데이터 요청
│   └── GET /api/reports/emotions?month=YYYY-MM
│
├── 입력
│   └── month picker
│
├── 지표
│   ├── 보낸 마음
│   ├── 도착 완료
│   ├── 받은 마음
│   └── 읽은 마음
│
├── 분포
│   ├── 보낸 마음 감정 분포
│   ├── 받은 마음 감정 분포
│   └── 보낸 마음 상태 분포
│
└── 오류 상태
    ├── 인증 만료
    └── 리포트 조회 실패
```

## 4.10 `/admin`

```txt
/admin
├── 목적
│   └── 운영자가 안전/발송/신고 상태를 확인하고 조치
│
├── 접근 권한
│   ├── 로그인 필요
│   └── request.user.isAdmin = true
│
├── 데이터 요청
│   ├── GET /api/admin/overview
│   ├── GET /api/admin/moderation-logs
│   ├── GET /api/admin/notification-logs
│   ├── GET /api/admin/replies
│   └── GET /api/admin/reports
│
├── Overview
│   ├── 사용자/메시지/예약/검사 대기/차단/신고 KPI
│   ├── NotificationLog 전체/즉시 재시도/예약 재시도
│   ├── 알림 상태별 통계
│   ├── 채널별 통계
│   ├── provider별 통계
│   ├── 실패 코드 통계
│   └── 수신자 deliveryStatus 통계
│
├── Moderation Logs
│   └── 검사 상태, 피드백, 에러 메시지 확인
│
├── Notification Logs
│   └── eventType/channel/status/provider/error 확인
│
├── Replies
│   ├── 익명 답장 preview
│   └── PATCH /api/admin/replies/:id/hide
│
└── Reports
    ├── 신고 사유/상세 확인
    ├── PATCH /api/admin/reports/:id/review
    ├── PATCH /api/admin/users/:id/suspend
    └── PATCH /api/admin/users/:id/unsuspend
```

## 4.11 `/messages/[id]`

```txt
/messages/[id]
├── 목적
│   └── 로그인 사용자의 메시지 상세 확인
│
├── 접근 권한
│   ├── senderId === currentUser.id
│   └── MessageRecipient.receiverUserId === currentUser.id
│
├── 데이터 요청
│   └── GET /api/messages/:id
│
├── 상세 정보
│   ├── 제목
│   ├── 본문
│   ├── 감정 태그
│   ├── 첨부 이미지
│   ├── 메시지 테마
│   ├── 랜덤 도착 구간
│   ├── 도착 전 힌트 시각
│   ├── 발신자 정보
│   ├── 수신자 정보
│   ├── 예약일
│   ├── 발송일
│   ├── 상태
│   ├── 익명 답장 목록
│   ├── 공개 링크
│   │   └── MODERATION_FAILED 상태에서는 없음
│   └── 숨김 옵션
│
├── 발신자 액션
│   ├── 예약 취소
│   ├── 공개 링크 복사
│   ├── 보낸 마음에서 삭제
│   └── 발신함으로 돌아가기
│
├── 수신자 액션
│   ├── 메시지 신고
│   ├── 받은 마음에서 삭제
│   ├── 수신함으로 돌아가기
│   └── 보관 유지
│
└── 오류 상태
    ├── 권한 없음
    ├── 메시지 없음
    └── 서버 오류
```

## 4.12 `/arrival/[token]`

```txt
/arrival/[token]
├── 목적
│   └── 비회원 또는 외부 수신자가 공개 링크로 메시지 열람
│
├── 진입 경로
│   ├── 공유 링크
│   ├── Gmail SMTP 이메일 링크
│   ├── Solapi SMS 링크
│   └── 향후 알림톡 링크
│
├── 초기 처리
│   ├── route param token 추출
│   ├── sessionStorage.maeari.pendingArrivalToken 저장
│   └── GET /api/public/messages/:token
│
├── 열람 gate
│   ├── 오늘, 누군가의 마음이 도착했어요
│   ├── 지금 열어볼까요?
│   └── 열어보기 CTA
│
├── 메시지 표시
│   ├── 제목
│   ├── 본문
│   ├── 감정 태그
│   ├── 테마
│   ├── 첨부 이미지
│   ├── 발신자
│   │   ├── isSenderHidden=false: 발신자 표시
│   │   └── isSenderHidden=true: 누군가
│   └── 도착일
│       ├── isDateHidden=false: 날짜 표시
│       └── isDateHidden=true: 도착일 숨김 문구
│
├── 익명 답장
│   ├── isReplyEnabled=true이면 입력 표시
│   ├── POST /api/public/messages/:token/replies
│   └── 답장도 moderation 후 저장
│
├── 신고
│   ├── 신고 사유 입력
│   └── POST /api/public/messages/:token/reports
│
├── 수신거부
│   ├── canSuppressEmailNotification=true이면 이메일 알림 버튼 표시
│   ├── canSuppressSmsNotification=true이면 문자 알림 버튼 표시
│   ├── isEmailNotificationSuppressed/isSmsNotificationSuppressed로 버튼 문구 토글
│   ├── POST /api/public/notification-suppressions: 알림 다시 받지 않기
│   ├── DELETE /api/public/notification-suppressions: 알림 다시 받기
│   ├── body: { token, channel }
│   └── 원본 연락처가 아닌 HMAC contactHash만 저장
│
├── 가입 유도
│   ├── 이 마음을 오래 보관하고 싶다면 매아리에 저장해 보세요
│   └── CTA: 카카오로 시작하기
│       └── GET /api/auth/kakao
│
└── 오류 상태
    ├── token 없음
    ├── token 만료
    ├── 메시지 없음
    ├── 아직 도착 전
    └── 서버 오류
```

## 4.13 `/my`

```txt
/my
├── 목적
│   └── 로그인 사용자 계정 정보와 연락처 인증 상태 확인
│
├── 데이터 요청
│   ├── GET /api/me
│   └── GET /api/me/contacts
│
├── 표시 정보
│   ├── 닉네임
│   ├── 이메일
│   ├── 카카오 연동 상태
│   ├── 관리자 권한이면 /admin link
│   └── 가입일
│
├── 연락처 인증
│   ├── PHONE 연락처를 항상 최상단 표시
│   ├── EMAIL 연락처는 그 아래 표시
│   ├── maskedValue만 표시하고 raw value는 노출하지 않음
│   ├── verified PHONE
│   │   ├── 삭제 버튼 미노출
│   │   ├── 변경 CTA: /phone-verification?next=/my
│   │   └── 마음쓰기 가능 상태
│   ├── 미인증 PHONE
│   │   ├── OTP 입력 또는 재발송
│   │   └── 삭제 가능
│   └── EMAIL
│       ├── 추가/OTP 인증 가능
│       └── 삭제 가능
│
├── 액션
│   ├── 전화번호 변경
│   │   └── /phone-verification?next=/my
│   ├── 이메일 연락처 추가
│   │   └── POST /api/me/contacts
│   ├── 인증번호 검증
│   │   └── POST /api/me/contacts/:id/verify
│   ├── 로그아웃
│   │   └── POST /api/auth/logout
│   └── 탈퇴는 MVP 이후
│
└── 다음 화면
    └── /login
```

---

## 5. 기능 IA Tree

## 5.1 인증

```txt
Auth
├── 카카오 로그인 시작
│   └── GET /api/auth/kakao
│
├── 카카오 로그인 callback
│   └── GET /api/auth/kakao/callback
│       ├── Kakao access token 요청
│       ├── Kakao user profile 조회
│       ├── User upsert
│       ├── Kakao email 기반 UserContact EMAIL upsert
│       ├── HttpOnly cookie 발급
│       ├── pending arrival token 처리
│       ├── pending friend invite token 처리
│       └── frontend callback redirect
│
├── 현재 사용자 조회
│   └── GET /api/me
│
├── 공개 링크 메시지 귀속
│   └── POST /api/auth/link-message
│       ├── token 검증
│       ├── 만료 확인
│       ├── 중복 귀속 확인
│       ├── MessageRecipient.receiverUserId 업데이트
│       └── MessageAccessToken.linkedUserId 업데이트
│
├── 친구 초대 링크 claim
│   └── POST /api/friends/invites/:token/claim
│       ├── token hash 조회
│       ├── 만료/폐기/사용 완료 확인
│       ├── 자기 자신/이미 친구 여부 확인
│       ├── Friendship 생성
│       └── claimCount 증가
│
└── 로그아웃
    └── POST /api/auth/logout
```

## 5.2 메시지 작성

```txt
Message Create
├── 작성 권한
│   ├── GET /api/me/contacts
│   ├── writerEligibility.hasVerifiedStrictPhone=true 필요
│   ├── 서버도 POST /api/messages에서 assertVerifiedSenderPhoneContact 실행
│   ├── senderContactId payload는 무시
│   └── verified strict PHONE snapshot 저장
│
├── 입력
│   ├── receiverInfo 또는 recipients[]
│   │   ├── SELF
│   │   ├── FRIEND
│   │   └── OTHER: name, email?, phone?, preferredChannel
│   ├── title
│   ├── content
│   ├── emotionTag
│   ├── scheduledAt 또는 arrivalWindowStartAt/arrivalWindowEndAt
│   ├── arrivalMode
│   ├── hintAt
│   ├── theme
│   ├── isReplyEnabled
│   ├── attachments[]
│   ├── isSenderHidden
│   └── isDateHidden
│
├── 검증
│   ├── auth required
│   ├── verified strict PHONE required
│   ├── required fields
│   ├── content length
│   ├── scheduledAt future only
│   ├── RANDOM_WINDOW 구간 유효성
│   ├── hintAt 유효성
│   ├── attachments 개수/용량/MIME type
│   ├── multipart payload JSON 파싱
│   ├── payload + 이미지 3개 multipart 허용, 이미지 4개 이상 차단
│   ├── receiverInfo schema
│   ├── 친구 수신자는 활성 Friendship 필요
│   ├── 외부 수신자는 email 또는 phone 중 하나 필요
│   ├── EMAIL 선택 시 email 필요
│   ├── SMS 선택 시 phone 필요
│   └── 전화번호는 국내 10~11자리 숫자만 허용
│
├── AI Moderation
│   ├── title/content/emotionTag 검사
│   ├── 로컬 한국어 보강 규칙
│   ├── OpenAI Moderations API
│   ├── 매아리 guardrail prompt
│   ├── flagged=false
│   │   └── PENDING 저장 진행
│   ├── flagged=true
│   │   ├── categories parsing
│   │   ├── getModerationFeedback
│   │   └── 저장 차단 또는 BLOCKED 처리
│   └── API failure
│       ├── 즉시 1회 자동 재시도
│       ├── 2회 실패 시 MODERATION_FAILED 저장
│       ├── publicUrl 미발급
│       └── 하루 1회 재검사 예약
│
├── DB 저장
│   ├── 통과
│   │   ├── Message 생성
│   │   ├── MessageAttachment 생성
│   │   ├── MessageRecipient 여러 개 생성 가능
│   │   ├── status=PENDING
│   │   └── 수신자별 MessageAccessToken 생성
│   └── 검사 실패
│       ├── Message 생성
│       ├── MessageAttachment 생성
│       ├── MessageRecipient 생성
│       ├── status=MODERATION_FAILED
│       ├── moderationNextRetryAt 저장
│       └── MessageAccessToken 생성 안 함
│
└── 응답
    ├── message
    ├── publicUrl
    └── 검사 실패 notice

Frontend result rendering
├── /write의 setNotice 결과는 WriteNoticeDialog로 표시
├── role="dialog", aria-modal=true
├── success tone
│   ├── completedMessage summary
│   ├── publicUrl 복사
│   ├── 예약 상세 보기
│   ├── 보낸 마음 보기
│   ├── 새 마음 쓰기
│   └── 메인 이동
├── danger/default tone
│   └── 확인 버튼으로 닫기
└── 화면이 하단에 있어도 결과 인지가 가능하도록 fixed overlay 사용
```

## 5.3 메시지 수신

```txt
Message Receive
├── 가입자 수신
│   ├── MessageRecipient.receiverUserId 존재
│   ├── /inbox 노출
│   └── GET /api/messages/received
│
├── 비회원 수신
│   ├── MessageAccessToken.token 존재
│   ├── /arrival/[token] 접근
│   ├── GET /api/public/messages/:token
│   └── 가입 CTA 노출
│
└── 가입 후 귀속
    ├── sessionStorage token 확인
    ├── POST /api/auth/link-message
    ├── MessageRecipient.receiverUserId 연결
    ├── MessageAccessToken.linkedUserId 연결
    └── /inbox 이동
```

## 5.4 예약 처리

```txt
Scheduled Delivery
├── node-cron
│   ├── 주기: DELIVERY_CRON
│   ├── 조건: status=PENDING
│   └── 조건: scheduledAt <= now
│
├── 상태 변경
│   ├── Message.status = SENT
│   ├── Message.sentAt = now
│   └── 실패 시 Message.status = FAILED
│
├── 이벤트 발행
│   └── domainEvents.emit("message.sent")
│
└── 후속 처리
    └── NotificationProcessor
        ├── 가입자 알림 생성
        ├── 외부 수신자 channel 결정
        ├── AUTO: 이메일 있으면 EMAIL, 이메일 없고 전화번호만 있으면 SMS
        ├── EMAIL/SMS 명시 선택 시 다른 채널 fallback 없음
        ├── EMAIL: Gmail SMTP provider
        ├── SMS: Solapi provider
        ├── ContactSuppression 조회
        ├── NotificationLog 저장
        ├── providerMessageId 저장
        ├── provider 미설정 또는 수신거부 시 실패/생략 상태 기록
        ├── retryable 실패는 nextRetryAt 기록
        └── 실패 로그 기록
```

## 5.5 AI 검사 실패 재검사

```txt
Moderation Retry
├── node-cron
│   ├── 주기: MODERATION_RETRY_CRON
│   ├── 조건: status=MODERATION_FAILED
│   └── 조건: moderationNextRetryAt <= now
│
├── 재검사
│   ├── OpenAI Moderation API 호출
│   ├── API 실패 시 즉시 1회 재시도
│   └── 결과 분기
│
├── 재검사 통과
│   ├── Message.status = PENDING
│   ├── MessageAccessToken 생성
│   ├── moderationNextRetryAt = null
│   ├── moderationFailureReason = null
│   └── 예약 발송 scheduler 대상으로 복귀
│
├── 재검사 차단
│   ├── Message.status = BLOCKED
│   ├── moderationFailureReason = feedback
│   └── 발송하지 않음
│
└── 재검사 실패
    ├── Message.status = MODERATION_FAILED 유지
    ├── moderationAttemptCount 증가
    ├── moderationLastCheckedAt 갱신
    └── moderationNextRetryAt = now + 1 day
```

## 5.6 도착 전 힌트 알림

```txt
Arrival Hint
├── node-cron
│   ├── 주기: DELIVERY_CRON
│   ├── 조건: Message.status = PENDING
│   ├── 조건: hintAt <= now
│   └── 조건: hintSentAt IS NULL
│
├── NotificationProcessor
│   ├── eventType = ARRIVAL_HINT
│   ├── 가입 수신자: IN_APP
│   ├── 외부 수신자: EMAIL 또는 SMS
│   ├── ContactSuppression pre-flight
│   └── NotificationLog 기록
│
└── 완료
    └── Message.hintSentAt = now
```

## 5.7 이메일/문자 알림 수신거부

```txt
Notification Suppression
├── 진입
│   └── /arrival/[token] 공개 열람 화면
│
├── 표시 조건
│   ├── canSuppressEmailNotification=true
│   └── canSuppressSmsNotification=true
│
├── 요청
│   ├── POST /api/public/notification-suppressions
│   │   ├── token
│   │   └── channel: EMAIL 또는 SMS
│   └── DELETE /api/public/notification-suppressions
│       ├── token
│       └── channel: EMAIL 또는 SMS
│
├── 서버 처리
│   ├── tokenHash로 MessageAccessToken 조회
│   ├── channel에 맞는 receiverEmail 또는 receiverPhone 확인
│   ├── 연락처 정규화
│   ├── PUBLIC_TOKEN_PEPPER로 HMAC-SHA256 hash 생성
│   ├── POST이면 ContactSuppression upsert
│   └── DELETE이면 ContactSuppression deleteMany
│
└── 이후 발송
    ├── NotificationProcessor가 발송 전 ContactSuppression 조회
    ├── hash가 있으면 provider 호출 생략
    └── NotificationLog.status = SKIPPED, errorCode = CONTACT_SUPPRESSED
```

## 5.8 익명 답장과 신고

```txt
Reply & Report
├── 공개 링크 답장
│   ├── /arrival/[token]
│   ├── POST /api/public/messages/:token/replies
│   ├── message.status = SENT 필요
│   ├── isReplyEnabled = true 필요
│   ├── 답장 본문 moderation
│   └── MessageReply 저장
│
├── 공개 링크 신고
│   ├── /arrival/[token]
│   ├── POST /api/public/messages/:token/reports
│   └── MessageReport 저장
│
└── 로그인 상세 신고
    ├── /messages/[id]
    ├── POST /api/messages/:id/reports
    └── MessageReport 저장
```

---

## 6. 상태 IA Tree

## 6.1 Message Status

```txt
Message.status
├── PENDING
│   ├── 예약 대기
│   ├── /sent에서 취소 가능
│   └── scheduler 조회 대상
│
├── SENT
│   ├── 발송 처리 완료
│   ├── sentAt 존재
│   ├── /inbox 또는 /arrival/[token]에서 열람 가능
│   └── message.sent event 발행 완료
│
├── FAILED
│   ├── scheduler 처리 실패
│   ├── 운영 로그 확인 필요
│   └── 재처리는 MVP 이후
│
├── BLOCKED
│   ├── AI moderation 차단
│   ├── 최초 작성 시 flagged=true면 저장하지 않고 차단 응답
│   ├── MODERATION_FAILED 재검사에서 flagged=true면 BLOCKED 전환
│   └── 발송하지 않음
│
├── MODERATION_FAILED
│   ├── OpenAI API 장애 또는 timeout으로 검사 자체 실패
│   ├── 즉시 2회 검사 실패 후 진입
│   ├── publicUrl 미발급
│   ├── /sent에서 검사 실패 상태 표시
│   ├── moderationNextRetryAt 표시
│   └── 하루 1회 재검사 대상
│
└── CANCELED
    ├── 발신자가 예약 취소
    ├── scheduler 조회 대상 제외
    └── 공개 링크 비활성 처리 가능
```

## 6.2 공개 링크 상태

```txt
MessageAccessToken
├── 활성
│   ├── token 존재
│   ├── expiresAt 없음 또는 미래
│   └── /arrival/[token] 열람 가능
│
├── 만료
│   ├── expiresAt < now
│   └── 열람 또는 보관 불가 안내
│
├── 미귀속
│   ├── linkedUserId 없음
│   └── 비회원 열람 상태
│
├── 귀속 완료
│   ├── linkedUserId 존재
│   ├── linkedAt 존재
│   └── /inbox에서 확인 가능
│
└── 충돌
    ├── 다른 userId로 link-message 요청
    └── 409 Conflict
```

## 6.3 AI Moderation 상태

```txt
Moderation
├── 검사 전
│   └── 작성 완료 전
│
├── 검사 중
│   ├── OpenAI Moderation API 호출
│   ├── API 실패 시 즉시 1회 재시도
│   └── 제출 버튼 loading
│
├── 통과
│   ├── flagged=false
│   └── Message 저장
│
├── 차단
│   ├── flagged=true
│   ├── categories parsing
│   ├── UX feedback 표시
│   └── Message 저장 안 함
│
└── 검사 실패
    ├── OpenAI API 오류
    ├── 1차 실패
    ├── 즉시 2차 자동 재시도
    ├── 2차 실패
    ├── Message.status = MODERATION_FAILED
    ├── publicUrl 미발급
    ├── moderationNextRetryAt 표시
    └── 하루 1회 자동 재검사 안내
```

---

## 7. API-화면 매핑 IA

```txt
Frontend Routes
├── /
│   ├── GET /api/me
│   └── 주요 authenticated route link
│
├── /login
│   └── GET /api/auth/kakao
│
├── /auth/callback
│   ├── GET /api/me
│   ├── POST /api/auth/link-message
│   └── POST /api/friends/invites/:token/claim
│
├── /onboarding
│   └── GET /api/me
│
├── /write
│   ├── GET /api/me
│   ├── GET /api/me/contacts
│   ├── GET /api/time
│   ├── GET /api/friends
│   └── POST /api/messages
│
├── /phone-verification
│   ├── GET /api/me/contacts
│   ├── POST /api/me/contacts
│   ├── POST /api/me/contacts/:id/send-code
│   └── POST /api/me/contacts/:id/verify
│
├── /friends
│   ├── GET /api/friends
│   ├── GET /api/friends/requests
│   ├── GET /api/friends/search
│   ├── POST /api/friends/invites
│   ├── GET /api/friends/invites/active
│   ├── DELETE /api/friends/invites/:id
│   ├── POST /api/friends/requests
│   ├── PATCH /api/friends/requests/:id/accept
│   ├── PATCH /api/friends/requests/:id/reject
│   ├── PATCH /api/friends/requests/:id/cancel
│   └── DELETE /api/friends/:friendshipId
│
├── /friends/invite/[token]
│   ├── GET /api/friends/invites/:token/preview
│   ├── POST /api/friends/invites/:token/claim
│   └── GET /api/auth/kakao
│
├── /sent
│   ├── GET /api/messages/sent
│   ├── POST /api/messages/:id/public-link
│   ├── PATCH /api/messages/:id/cancel
│   └── DELETE /api/messages/:id
│
├── /inbox
│   ├── GET /api/messages/received
│   ├── PATCH /api/messages/:id/archive
│   ├── DELETE /api/messages/:id
│   └── POST /api/messages/bulk-delete
│
├── /archive
│   ├── GET /api/messages/archived
│   ├── PATCH /api/messages/:id/unarchive
│   ├── DELETE /api/messages/:id
│   └── POST /api/messages/bulk-delete
│
├── /future
│   └── GET /api/messages/sent
│
├── /reports
│   └── GET /api/reports/emotions
│
├── /admin
│   ├── GET /api/admin/overview
│   ├── GET /api/admin/moderation-logs
│   ├── GET /api/admin/notification-logs
│   ├── GET /api/admin/replies
│   ├── GET /api/admin/reports
│   ├── PATCH /api/admin/replies/:id/hide
│   ├── PATCH /api/admin/reports/:id/review
│   ├── PATCH /api/admin/users/:id/suspend
│   └── PATCH /api/admin/users/:id/unsuspend
│
├── /messages/[id]
│   ├── GET /api/messages/:id
│   ├── POST /api/messages/:id/public-link
│   ├── PATCH /api/messages/:id/cancel
│   ├── POST /api/messages/:id/reports
│   └── DELETE /api/messages/:id
│
├── /arrival/[token]
│   ├── GET /api/public/messages/:token
│   ├── POST /api/public/messages/:token/replies
│   ├── POST /api/public/messages/:token/reports
│   ├── POST /api/public/notification-suppressions
│   └── DELETE /api/public/notification-suppressions
│
└── /my
    ├── GET /api/me
    ├── GET /api/me/contacts
    ├── POST /api/me/contacts
    ├── POST /api/me/contacts/:id/send-code
    ├── POST /api/me/contacts/:id/verify
    ├── PATCH /api/me/contacts/:id
    ├── DELETE /api/me/contacts/:id
    └── POST /api/auth/logout
```

---

## 8. 데이터-화면 매핑 IA

최종 Prisma schema는 `packages/database/prisma/schema.prisma`를 기준으로 합니다. 자세한 모델 설명은 `MAEARI_DB_SCHEMA.md`에 정리합니다.

```txt
Database Models
├── User
│   ├── /login
│   ├── /auth/callback
│   ├── /my
│   ├── /write sender
│   ├── /sent sender
│   ├── /inbox receiver
│   ├── /friends friend code, search, relation
│   └── /admin suspension
│
├── UserContact
│   ├── /my 연락처 인증 목록
│   ├── /phone-verification PHONE OTP 인증
│   ├── /write writerEligibility
│   ├── Message.senderContactSnapshot 생성
│   └── OTHER 이메일 수신자 기존 사용자 연결
│
├── UserContactVerification
│   ├── /phone-verification 6자리 OTP 검증
│   └── /my 이메일 OTP 검증
│
├── PhoneVerificationAttempt
│   ├── /phone-verification 요청 이력
│   └── rate limit 집계
│
├── PhoneVerificationLock
│   ├── /phone-verification IP lock
│   └── /phone-verification CONTACT lock
│
├── PhoneNumberLookupCache
│   ├── Twilio Lookup 결과 cache
│   └── raw phone 미저장
│
├── Message
│   ├── /write 생성
│   ├── /sent 목록
│   ├── /sent 검사 실패 상태 표시
│   ├── /inbox 목록
│   ├── /messages/[id] 상세
│   ├── /arrival/[token] 공개 열람
│   ├── /reports 감정 집계
│   ├── /admin report/reply/moderation context
│   ├── Scheduler 상태 변경
│   └── ModerationRetryScheduler 재검사
│
├── MessageRecipient
│   ├── /write 수신자 snapshot
│   ├── /sent 수신자별 발송 상태
│   ├── /inbox 귀속 사용자
│   ├── /archive 아카이브/복구
│   ├── /future SELF 필터
│   └── NotificationProcessor channel 결정
│
├── MessageAttachment
│   ├── /write 이미지 저장
│   ├── /messages/[id] 첨부 표시
│   └── /arrival/[token] 첨부 표시
│
├── MessageReply
│   ├── /arrival/[token] 익명 답장 생성
│   ├── /messages/[id] 발신자 답장 확인
│   └── /admin 답장 검수/숨김
│
├── MessageReport
│   ├── /arrival/[token] 공개 링크 신고
│   ├── /messages/[id] 로그인 신고
│   └── /admin 신고 검토/계정 정지
│
├── MessageAccessToken
│   ├── /write 생성 결과 publicUrl
│   ├── /arrival/[token] 조회 key
│   ├── /auth/callback sessionStorage token
│   └── /api/auth/link-message 귀속 처리
│
├── NotificationLog
│   ├── NotificationProcessor 발송 이력
│   ├── Gmail SMTP provider 결과
│   ├── Solapi SMS provider 결과
│   ├── retry job 대상
│   └── /admin 발송 통계와 로그
│
├── ContactSuppression
│   ├── /arrival/[token] 수신거부 결과
│   └── NotificationProcessor pre-flight 조회
│
├── FriendRequest
│   └── /friends 요청 관리
│
├── FriendInviteLink
│   ├── /friends 초대 링크 생성/폐기/목록
│   ├── /friends/invite/[token] 미리보기
│   └── /auth/callback 로그인 후 claim
│
└── Friendship
    ├── /friends 친구 목록
    └── /write 친구 수신자 선택
```

---

## 9. 예외 화면 IA

```txt
Exception IA
├── 인증 오류
│   ├── 로그인 만료
│   ├── /login redirect
│   └── 기존 작업 복구는 MVP 이후
│
├── AI 차단
│   ├── 상대방에게 상처를 줄 수 있는 표현
│   ├── 더 따뜻하고 안전한 표현
│   ├── 조심스러운 표현 요청
│   └── 다시 작성 CTA
│
├── AI 검사 실패
│   ├── OpenAI API 오류 또는 timeout
│   ├── 즉시 1회 자동 재시도
│   ├── 2회 실패 시 검사 실패 상태 표시
│   ├── 작성한 마음은 임시 보관
│   ├── publicUrl 미발급
│   ├── 하루 1회 자동 재검사 안내
│   └── 재검사 통과 시 예약 발송 큐 복귀
│
├── 공개 링크 오류
│   ├── token 없음
│   ├── token 만료
│   ├── 메시지 없음
│   ├── 이미 다른 계정에 보관됨
│   └── /arrival/link-failed
│
├── 예약 오류
│   ├── 과거 날짜 선택
│   ├── 랜덤 도착 구간 오류
│   ├── 힌트 시간이 현재보다 과거이거나 도착 이후인 경우
│   ├── scheduler 실패
│   └── FAILED 상태 표시
│
├── 알림 오류
│   ├── provider 미설정
│   ├── ContactSuppression으로 발송 생략
│   ├── retryable 실패는 nextRetryAt 예약
│   └── 최종 실패는 NotificationLog.status = FAILED
│
├── 관리자 접근 오류
│   ├── 로그인 필요
│   ├── 관리자 권한 없음
│   └── 계정 정지 사용자는 auth middleware에서 차단
│
└── 서버 오류
    ├── 재시도
    ├── 이전 화면으로 돌아가기
    └── 문의 안내는 MVP 이후
```

---

## 10. MVP IA 우선순위

```txt
IA Priority
├── P0
│   ├── /
│   ├── /login
│   ├── /auth/callback
│   ├── /write
│   ├── /sent
│   ├── /arrival/[token]
│   ├── /inbox
│   ├── /friends
│   ├── POST /api/messages
│   ├── GET /api/public/messages/:token
│   ├── POST /api/public/notification-suppressions
│   ├── DELETE /api/public/notification-suppressions
│   └── POST /api/auth/link-message
│
├── P1
│   ├── /messages/[id]
│   ├── /my
│   ├── /archive
│   ├── /future
│   ├── /reports
│   ├── 친구 검색/요청/수락/거절/취소 API
│   ├── PATCH /api/messages/:id/cancel
│   ├── DELETE /api/messages/:id
│   ├── Gmail SMTP 이메일 발송
│   ├── Solapi SMS 발송
│   ├── ContactSuppression pre-flight
│   ├── 감정 태그 필터
│   ├── 이미지 첨부
│   ├── 그룹 전송
│   ├── 익명 답장/신고
│   ├── AI moderation feedback states
│   ├── AI 검사 실패 상태
│   ├── 하루 1회 moderation retry job
│   └── scheduler event flow
│
└── P2
    ├── /onboarding
    ├── /admin
    ├── 읽음 상태
    ├── 공개 링크 실패 전용 화면
    ├── NotificationLog 운영 대시보드
    └── 카카오 알림톡 연동
```

---

## 11. IA 기반 개발 순서

```txt
Development Order
├── 1. Auth 기반
│   ├── /login
│   ├── /auth/callback
│   ├── GET /api/auth/kakao
│   ├── GET /api/auth/kakao/callback
│   └── GET /api/me
│
├── 2. Message Create
│   ├── /write
│   ├── 친구 수신자 선택
│   ├── 그룹 수신자 배열
│   ├── 외부 수신자 email/phone/preferredChannel 입력
│   ├── 이미지 첨부
│   ├── 랜덤 도착/힌트/테마/답장 허용 설정
│   ├── POST /api/messages
│   ├── moderation feedback
│   ├── moderation immediate retry
│   ├── MODERATION_FAILED 상태 저장
│   └── moderation 통과 시 publicUrl 생성
│
├── 3. Public Arrival
│   ├── /arrival/[token]
│   ├── sessionStorage token 저장
│   ├── GET /api/public/messages/:token
│   ├── POST /api/public/messages/:token/replies
│   ├── POST /api/public/messages/:token/reports
│   ├── POST /api/public/notification-suppressions
│   ├── DELETE /api/public/notification-suppressions
│   └── 가입 CTA
│
├── 4. Link Message
│   ├── POST /api/auth/link-message
│   ├── /auth/callback 후처리
│   └── /inbox 자동 이동
│
├── 5. Storage
│   ├── /sent
│   ├── /inbox
│   ├── /archive
│   ├── /future
│   ├── /messages/[id]
│   ├── 감정 필터
│   ├── cancel action
│   └── soft delete action
│
├── 6. Friends
│   ├── /friends
│   ├── friendCode
│   ├── friend search
│   ├── FriendRequest
│   └── Friendship
│
├── 7. Reports & Admin
│   ├── /reports
│   ├── /admin
│   ├── moderation logs
│   ├── notification dashboard
│   ├── reply moderation
│   ├── report review
│   └── account suspension
│
└── 8. System
    ├── scheduler
    ├── arrival hint scheduler
    ├── moderation retry scheduler
    ├── domainEvents
    ├── NotificationProcessor
    ├── Gmail SMTP provider
    ├── Solapi SMS provider
    ├── notification retry scheduler
    └── failure logging
```

---

## 2026-07-06 IA 추가: 답장함, QR, 마음나무

```txt
MaeAri
├── Sent
│   ├── /sent
│   │   ├── 보낸 마음 탭
│   │   ├── 답장함 탭
│   │   ├── 답장 읽음/삭제
│   │   └── 공개 도착 QR 보기
│   └── /messages/[id]
│       ├── 답장 목록
│       ├── 상세 진입 시 답장 읽음 처리
│       └── 공개 도착 QR 보기
│
├── Tree
│   ├── /tree
│   │   ├── 마음나무 생성
│   │   ├── 도착 시점 설정
│   │   ├── QR/링크 공유
│   │   ├── 마음나무 목록
│   │   └── 도착 후 제출물 열람
│   └── /tree/[token]
│       ├── 공개 마음나무 안내
│       ├── 비회원 텍스트 제출
│       └── 도착 후 제출 차단
│
├── Write
│   ├── 이미지 첨부 .jpg/.jpeg/.png/.webp
│   ├── 이미지 OCR 안전 검사
│   └── 완료 모달 QR 우선 표시
│
└── System
    ├── image OCR moderation
    ├── message.reply.created event
    ├── REPLY_RECEIVED notification
    ├── MessageCollection scheduler
    └── contact verification claim/backfill
```

### 2026-07-07 운영 반영 상태

- IA에 추가된 `/sent` 답장함, `/tree`, `/tree/[token]`, QR 공유, 이미지 OCR 검사 흐름은 코드와 DB migration에 반영되었습니다.
- 운영 `maeari` DB는 `20260706150000_ocr_replies_qr_collections`까지 적용되어 schema drift가 없는 상태입니다.
- 이후 남은 IA 작업은 신규 route 추가가 아니라 각 화면의 수동 QA, 모바일 반응형 점검, Figma 리디자인 적용 시 현재 기능 보존 확인입니다.

### 2026-07-07 첨부 이미지/OCR IA 상세

```txt
/write
├── 이미지 첨부 버튼
│   ├── accept: .jpg, .jpeg, .png, .webp
│   ├── multiple
│   ├── 최대 3개
│   ├── 개별 최대 2MB
│   └── 전체 최대 MAX_ATTACHMENT_TOTAL_BYTES
│
├── 클라이언트 1차 검증
│   ├── file.type: image/jpeg, image/png, image/webp
│   ├── file.name 확장자: .jpg, .jpeg, .png, .webp
│   ├── 미지원 형식 오류: "이미지는 jpg, jpeg, png, webp 형식만 첨부할 수 있어요."
│   └── 통과 시 previewUrl 생성
│
├── 제출 payload
│   ├── 첨부 없음: JSON body
│   └── 첨부 있음: multipart/form-data
│       ├── payload: JSON.stringify(messagePayload)
│       └── attachments: File[]
│
├── API 업로드 검증
│   ├── multer memory storage
│   ├── MIME type allowlist
│   ├── originalname 확장자 allowlist
│   ├── 파일 개수/용량/총량 제한
│   ├── service 저장 전 magic bytes 검사
│   └── 실패 시 ATTACHMENT_TYPE_UNSUPPORTED / TOO_MANY_ATTACHMENTS / ATTACHMENT_TOO_LARGE
│
├── OCR 안전 검사
│   ├── tesseract.js
│   ├── IMAGE_OCR_LANGUAGES=kor+eng
│   ├── IMAGE_OCR_TIMEOUT_MS=8000
│   ├── MessageAttachment.ocrStatus 기록
│   ├── 추출 텍스트를 메시지 본문과 병합
│   └── OpenAI moderation/guardrail 검사 입력에 포함
│
└── 결과
    ├── 안전: Message + MessageAttachment 저장, 예약 완료 모달 표시
    ├── 유해: MESSAGE_BLOCKED_BY_MODERATION
    └── OCR 실패/timeout: MODERATION_FAILED, retry job 대상
```

### 2026-07-07 운영/DB IA 상세

```txt
Operations
├── Database
│   ├── active DB: maeari
│   ├── removed DB: maeum_arrival
│   ├── removed dry-run DB: maeari_dryrun
│   ├── app client connections to old DB: 0
│   └── bootstrap role maeum: NOLOGIN, system-required
│
├── PM2
│   ├── maeari-api
│   ├── maeari-scheduler
│   └── maeari-web
│
└── Health Check
    ├── http://127.0.0.1:4000/api/health
    ├── http://127.0.0.1:3000/
    ├── https://maeari.madcamp-kaist.org/api/health
    └── https://maeari.madcamp-kaist.org/
```

### 2026-07-07 Figma UI IA 상세

```txt
Visual System
├── Palette
│   ├── accent: #6D48DB
│   ├── main surface: #F3EEFD
│   ├── secondary accent: #9A85E1
│   ├── background: #FBF9FC
│   └── secondary gray: #F3EFF7
│
├── Shared Classes
│   ├── maeari-stage
│   ├── figma-panel
│   ├── maeari-input
│   ├── maeari-chip
│   ├── maeari-chip-active
│   ├── maeari-action
│   ├── maeari-action-primary
│   ├── maeari-action-danger
│   ├── maeari-badge
│   ├── maeari-page-title
│   └── maeari-page-copy
│
├── Shared Components
│   ├── AppShell
│   ├── Notice
│   ├── QrShare
│   ├── Button/LinkButton
│   ├── TextInput/TextArea/SelectInput
│   ├── PageHeader/SectionPanel/EmptyState
│   ├── StatusPill/EmotionPill
│   ├── LetterThumb
│   └── route-specific form/card components
│
├── Home Page
│   ├── hero: maeari-hero-floral.png
│   ├── API: GET /messages/sent
│   ├── API: GET /messages/received
│   ├── timeline: PENDING 보낸 마음 중 scheduledAt 가까운 순
│   ├── recent letters: 최근 받은 마음
│   ├── fallback: 데이터 없음/초기 로딩 시 감성 card
│   └── quick cards: /write, /inbox, /friends, /tree
│
└── Preservation Rule
    ├── route path 변경 없음
    ├── API contract 변경 없음
    ├── DB schema 변경 없음
    ├── 전화번호 인증 gate 유지
    ├── OCR/guardrail/SMTP/SMS/Twilio 유지
    └── 기존 기능은 새 UI 안에서 동일하게 동작해야 함
```

### 2026-07-07 UI 리디자인 구현 IA 보강

이번 UI 변경은 기존 화면을 “부분 수정”하는 것이 아니라, 같은 기능을 Figma 기반 shell과 panel system 안에 다시 배치하는 작업입니다. 따라서 IA 관점에서는 route와 flow는 유지하고, 각 화면의 visual hierarchy와 CTA 위치를 새 기준으로 재정의합니다.

```txt
UI Redesign Scope
├── 유지
│   ├── route path
│   ├── API request/response
│   ├── auth/session cookie
│   ├── 전화번호 인증 gate
│   ├── OCR moderation
│   ├── Gmail/Solapi/Twilio provider
│   ├── ContactSuppression
│   ├── QR publicUrl semantics
│   └── soft delete/archive/read status semantics
│
├── 교체
│   ├── page background
│   ├── navigation shell
│   ├── panel/card visual style
│   ├── form input style
│   ├── action button hierarchy
│   ├── empty/loading/error state presentation
│   └── mobile navigation placement
│
└── 금지
    ├── 발신 연락처 select 재노출
    ├── 이메일 인증만으로 마음쓰기 허용
    ├── 외부 알림 이메일/SMS에 편지 본문 포함
    ├── QR 값을 DB에 별도 저장
    ├── UI-only 변경을 위해 schema migration 추가
    └── Figma에 없는 기능을 제거
```

### Desktop IA 기준

```txt
Desktop Layout
├── Top Bar
│   ├── fixed height 74px
│   ├── left brand mark
│   ├── service name
│   └── right profile shortcut
│
├── Left Sidebar
│   ├── fixed width 221px
│   ├── nav item
│   │   ├── 홈
│   │   ├── 마음 보내기
│   │   ├── 받은 마음
│   │   ├── 보낸 마음
│   │   ├── 마음나무
│   │   ├── 친구
│   │   ├── 리포트
│   │   └── 내 정보
│   └── emotional image panel
│
└── Main Content
    ├── top padding: top bar height
    ├── left offset: sidebar width
    ├── max content width: 1190px 기준
    ├── section style: figma-panel
    └── primary CTA style: maeari-action-primary
```

Desktop에서 특히 확인해야 하는 layout:

```txt
/ main
├── hero + timeline two-column grid
├── 1280px에서 timeline clipping 금지
└── quick card grid는 내용 길이로 높이가 갑자기 튀지 않게 유지

/write
├── left writing form
├── right delivery settings panel
├── 1280px에서 right panel clipping 금지
├── x-large 이상에서 delivery panel sticky
└── smaller desktop에서는 단일 column로 자연스럽게 내려감

/friends
├── friend code/search top area
├── invite link panel
├── received/sent request panels
└── friends list panel

/my
├── account summary
├── PHONE contact first
├── EMAIL contact below
└── verified PHONE delete action hidden/disabled
```

### Mobile IA 기준

```txt
Mobile Layout
├── Public routes
│   ├── centered brand panel
│   ├── no sidebar
│   ├── full-width safe padding
│   └── CTA remains visible without overlap
│
├── Authenticated routes
│   ├── no desktop sidebar
│   ├── content top padding retained
│   ├── bottom nav fixed
│   ├── bottom padding prevents nav overlap
│   └── long Korean headings use break-keep
│
└── Bottom Nav
    ├── 쓰기
    ├── 받은 마음
    ├── 보낸 마음
    ├── 친구
    └── 내 정보
```

Mobile에서 제외되는 직접 nav:

```txt
Not in fixed mobile nav
├── 홈
├── 마음나무
└── 리포트
```

접근 경로:

```txt
홈
└── logo/direct URL

마음나무
├── 홈 quick card
├── direct /tree
└── desktop sidebar

리포트
├── direct /reports
└── desktop sidebar
```

### Public Route IA 보강

공개 route는 로그인 사용자 shell을 쓰지 않고 `maeari-public-stage`를 사용합니다.

```txt
Public Stage Routes
├── /login
│   ├── brand first impression
│   ├── maeari-hero-floral.png
│   └── Kakao CTA
│
├── /auth/callback
│   ├── 로그인 완료 처리 상태
│   ├── pending arrival token 처리
│   ├── pending friend invite token 처리
│   └── 실패 시 재시도 CTA
│
├── /arrival/[token]
│   ├── arrival gate
│   ├── message reading panel
│   ├── attachments
│   ├── anonymous reply
│   ├── report
│   ├── email/SMS unsubscribe toggle
│   └── save/login CTA
│
├── /arrival/link-failed
│   ├── why failed
│   ├── back to public link
│   └── login retry
│
├── /friends/invite/[token]
│   ├── inviter preview
│   ├── availability state
│   ├── login CTA
│   └── claim result
│
└── /tree/[token]
    ├── collection title/description
    ├── pre-delivery submission form
    ├── moderation failure feedback
    └── delivered/canceled closed state
```

### `/write` IA 보강

`/write`는 가장 많은 기능을 가진 화면이므로 Figma panel 구조 안에서도 기능 손실이 없어야 합니다.

```txt
/write
├── Entry Guard
│   ├── GET /api/me/contacts
│   ├── writerEligibility.hasVerifiedStrictPhone 확인
│   ├── false: phone verification CTA
│   └── true: form 활성화
│
├── Server Time
│   ├── GET /api/time
│   ├── defaultScheduledAt = serverNow + 24h
│   ├── 실패 시 1회 retry
│   └── 최종 실패 시 submit block + retry button
│
├── Recipient Panel
│   ├── SELF
│   ├── FRIEND
│   ├── OTHER
│   ├── group recipient add/remove
│   ├── OTHER email/phone one-of-required
│   └── preferredChannel AUTO/EMAIL/SMS
│
├── Letter Panel
│   ├── title
│   ├── content
│   ├── emotion tag
│   ├── image attachments
│   │   ├── jpg/jpeg/png/webp only
│   │   ├── max 3
│   │   ├── preview
│   │   └── remove
│   └── OCR moderation 대상
│
├── Arrival Panel
│   ├── fixed arrival
│   ├── random window
│   ├── date input
│   ├── hour/minute 1분 단위 입력
│   ├── 15분 quick minute
│   ├── hint setting
│   └── KST preview
│
├── Emotion/Privacy Options
│   ├── sender hidden
│   ├── date hidden
│   ├── reply enabled
│   └── theme
│
└── Result Dialog
    ├── success
    │   ├── message detail
    │   ├── sent
    │   ├── write another
    │   ├── home
    │   └── QR/link share
    └── failure
        ├── moderation feedback
        ├── phone verification required
        ├── attachment error
        └── retry guidance
```

### `/sent` IA 보강

```txt
/sent
├── Tabs
│   ├── 보낸 마음
│   └── 답장함
│
├── 보낸 마음 tab
│   ├── status filter
│   ├── emotion filter
│   ├── message card
│   ├── detail
│   ├── cancel
│   ├── delete/hide
│   ├── QR view
│   └── link copy
│
└── 답장함 tab
    ├── reply card
    ├── message title
    ├── reply preview
    ├── createdAt
    ├── unread/read state
    ├── mark read
    ├── delete from sender view
    └── go to message detail
```

### 첨부 이미지/OCR 오류 IA

```txt
Attachment Error UX
├── unsupported type
│   ├── condition: non jpg/jpeg/png/webp
│   └── message: 이미지는 jpg, jpeg, png, webp 형식만 첨부할 수 있어요.
│
├── too many attachments
│   ├── condition: count > 3
│   └── message: 이미지는 최대 3개까지 첨부할 수 있어요.
│
├── file too large
│   ├── condition: single file > MAX_ATTACHMENT_BYTES
│   └── message: 이미지 용량이 너무 커요.
│
├── total too large
│   ├── condition: sum > MAX_ATTACHMENT_TOTAL_BYTES
│   └── message: 첨부 이미지 전체 용량이 너무 커요.
│
└── OCR/moderation failed
    ├── condition: OCR timeout/provider error after retry
    ├── message status: MODERATION_FAILED
    └── user sees: 요청 완료 실패/검사 재시도 안내
```

### 운영 확인 IA

문서와 코드가 맞는지 운영자가 확인하는 흐름도 IA에 포함합니다.

```txt
Deploy Verification
├── API
│   ├── pm2 status maeari-api
│   ├── ss -ltnp :4000
│   └── curl /api/health
│
├── Scheduler
│   ├── pm2 status maeari-scheduler
│   ├── delivery cron log
│   ├── moderation retry log
│   └── notification retry log
│
├── Web
│   ├── pnpm --filter @maeari/web build
│   ├── pm2 restart maeari-web --update-env
│   ├── curl /
│   ├── extract CSS URL from /login
│   └── curl CSS URL -> 200 text/css
│
└── Nginx
    ├── nginx -t
    ├── systemctl status nginx
    ├── curl https://maeari.madcamp-kaist.org/
    └── curl https://maeari.madcamp-kaist.org/api/health
```

## 2026-07-07 최종 IA 동기화

아래 내용은 현재 코드에 반영된 최종 사용자 흐름을 IA 관점에서 다시 정리한 것입니다. 새 UI 리디자인은 화면 구조를 바꾸지만 route와 API 계약은 유지합니다.

### 최종 사용자 흐름 요약

```txt
신규 사용자
├── /login
│   └── 카카오 OAuth
├── /auth/callback
│   ├── pending arrival token 있으면 메시지 귀속 시도
│   ├── pending friend invite token 있으면 친구 초대 claim
│   └── 기본 이동
├── /
│   ├── 최근 마음과 quick card 확인
│   └── /write 진입
├── /write
│   ├── /me/contacts writerEligibility 확인
│   ├── strict PHONE 없으면 /phone-verification?next=/write CTA
│   └── strict PHONE 있으면 메시지 작성 가능
└── /phone-verification
    ├── 010 번호 입력
    ├── Twilio Lookup/rate limit guard 통과
    ├── Solapi OTP 수신
    ├── 6자리 코드 검증
    └── /write 또는 /my 복귀
```

```txt
메시지 작성
├── 수신 대상
│   ├── 미래의 나
│   ├── 친구
│   └── 연락처
├── 연락처 수신자
│   ├── 이메일 또는 전화번호 중 하나 이상 필수
│   ├── AUTO는 EMAIL 우선
│   ├── EMAIL 선택 시 email 필수
│   └── SMS 선택 시 phone 필수
├── 작성 내용
│   ├── 제목
│   ├── 본문
│   ├── 감정 태그
│   └── 첨부 이미지 최대 3개
├── 첨부 이미지
│   ├── jpg/jpeg/png/webp만 선택 가능
│   ├── API에서 MIME/확장자/magic bytes 재검증
│   └── OCR 텍스트가 moderation 입력에 합쳐짐
├── 도착 설정
│   ├── 서버 기준 +24시간 기본값
│   ├── 고정 도착
│   ├── 랜덤 도착 구간
│   ├── 1분 단위 시간 입력
│   └── 15분 단위 quick minute
├── 옵션
│   ├── 발신인 숨김
│   ├── 도착일 숨김
│   ├── 익명 답장 허용
│   └── 도착 전 힌트
└── 완료
    ├── 예약 성공 dialog
    ├── 공개 URL QR
    ├── 링크 복사
    ├── /sent
    └── /messages/[id]
```

### 최종 navigation 규칙

```txt
Desktop authenticated shell
├── Top bar
├── Left sidebar
│   ├── 홈
│   ├── 마음 보내기
│   ├── 받은 마음
│   ├── 보낸 마음
│   ├── 마음나무
│   ├── 친구
│   ├── 리포트
│   └── 내 정보
└── Main stage
    └── figma-panel 기반 route content
```

```txt
Mobile authenticated shell
├── Top brand bar
├── Main stage
└── Bottom nav
    ├── 쓰기
    ├── 받은 마음
    ├── 보낸 마음
    ├── 친구
    └── 내 정보
```

모바일에서 `/tree`와 `/reports`는 고정 bottom nav에 넣지 않고, 홈 quick card, desktop sidebar, 직접 URL, 화면 내부 CTA로 접근합니다. 이는 하단 nav의 폭과 터치 안정성을 우선한 결정입니다.

### 공개 route IA 확정

```txt
Public route
├── /login
│   ├── brand hero
│   └── Kakao CTA
├── /arrival/[token]
│   ├── 도착 전 gate
│   ├── 도착 후 본문/첨부 열람
│   ├── 익명 답장
│   ├── 신고
│   └── 이메일/SMS 수신거부/재구독
├── /friends/invite/[token]
│   ├── 초대자 preview
│   ├── 로그인 전 pending token 저장
│   └── 로그인 후 즉시 친구등록
├── /tree/[token]
│   ├── 마음나무 preview
│   ├── 도착 전 비회원 편지 제출
│   └── 도착 후/취소 상태 안내
└── /arrival/link-failed
    └── 보관 실패 안내와 복귀 CTA
```

공개 route는 모두 `maeari-public-stage`를 사용합니다. 공개 링크 token context를 잃지 않도록 로그인 CTA 전에는 sessionStorage에 pending token을 저장합니다.

### 상태별 사용자 피드백 IA

```txt
Write submit feedback
├── PHONE 미인증
│   ├── error: SENDER_PHONE_VERIFICATION_REQUIRED
│   └── action: /phone-verification?next=/write
├── PHONE 형식/Lookup 차단
│   ├── error: CONTACT_PHONE_INVALID
│   └── copy: 휴대전화 번호만 인증할 수 있어요.
├── PHONE rate limit/lock
│   ├── error: PHONE_VERIFICATION_IP_LOCKED 또는 PHONE_VERIFICATION_CONTACT_LOCKED
│   └── copy: 단기간에 너무 많은 인증을 요청하셨습니다.
├── 이미지 형식 차단
│   ├── error: ATTACHMENT_TYPE_UNSUPPORTED
│   └── copy: 이미지는 jpg, jpeg, png, webp 형식만 첨부할 수 있어요.
├── 이미지 개수 초과
│   ├── error: TOO_MANY_ATTACHMENTS
│   └── copy: 이미지는 최대 3개까지 첨부할 수 있어요.
├── OCR/moderation 실패
│   ├── message status: MODERATION_FAILED
│   └── copy: 안전 검사를 완료하지 못해 재검사 대기
└── 성공
    ├── 예약 완료 dialog
    ├── QR
    ├── 링크 복사
    └── 다음 행동 CTA
```

### 관리/운영자 IA 확정

```txt
Admin / Reports
├── Reports
│   ├── 보낸 마음/받은 마음/읽은 마음 지표
│   ├── 감정 분포
│   └── 상태 분포
└── Admin
    ├── moderation log
    ├── notification log
    ├── reply/report review
    ├── account suspension
    └── provider failure/error code 확인
```

관리 화면은 Figma 감성 UI를 적용하되, 운영자가 빠르게 스캔해야 하므로 테이블과 조밀한 로그 UI를 유지합니다.

## 2026-07-07 최신 화면 IA 상세

이 섹션은 지금까지 바뀐 UI와 기능을 사용자 화면 기준으로 다시 묶은 최종 IA입니다. route path는 유지하고, 기존 기능을 새 Figma 기반 shell 안에 배치하는 것이 원칙입니다.

### 1. Shell IA

```txt
Authenticated Layout
├── AppShell
│   ├── Top bar
│   │   ├── maeari-app-icon
│   │   ├── 서비스명 매아리
│   │   └── primary action: 마음 보내기
│   ├── Desktop sidebar
│   │   ├── 홈
│   │   ├── 마음 보내기
│   │   ├── 받은 마음
│   │   ├── 보낸 마음
│   │   ├── 마음나무
│   │   ├── 친구
│   │   ├── 리포트
│   │   └── 내 정보
│   ├── Sidebar image panel
│   │   ├── maeari-sidebar-sky.png
│   │   └── 오늘의 한 줄
│   ├── Main content
│   │   └── figma-panel / maeari-stage
│   └── Mobile bottom nav
│       ├── 쓰기
│       ├── 받은 마음
│       ├── 보낸 마음
│       ├── 친구
│       └── 내 정보
```

```txt
Public Layout
├── maeari-public-stage
├── 브랜드 아이콘
├── 공개 route별 단일 목적 panel
└── 로그인 CTA가 필요한 경우 pending token을 먼저 sessionStorage에 저장
```

공개 route는 sidebar를 사용하지 않습니다. 공개 링크를 받은 비회원이 불필요한 navigation에 노출되지 않고, 열람/제출/로그인 CTA만 명확히 보도록 합니다.

### 2. Home `/` IA

```txt
/
├── Hero panel
│   ├── brand label
│   ├── headline
│   ├── supporting copy
│   ├── maeari-hero-floral.png
│   └── CTA: 마음 보내기
├── KST current time card
├── 곧 찾아갈 마음 timeline
│   ├── /messages/sent 기반
│   ├── 예약 대기 우선
│   └── 없으면 fallback message
├── 최근 보관한 마음
│   ├── /messages/received 기반
│   ├── 최근 받은 마음 card
│   └── 없으면 empty state
└── Quick cards
    ├── 마음 쓰기
    ├── 받은 마음
    ├── 친구
    └── 마음나무
```

홈은 landing page가 아니라 로그인 사용자의 작업 대시보드입니다. 새 UI에서도 실제 API 데이터를 읽고, 데이터가 없을 때만 안내 card를 표시합니다.

### 3. Write `/write` IA

```txt
/write
├── Page header
│   ├── 제목: 마음 쓰기
│   ├── 현재 KST 초 단위 표시
│   └── 서버 기준 시간 로딩 상태
├── Phone verification gate
│   ├── /me/contacts writerEligibility 확인
│   ├── hasVerifiedStrictPhone = false
│   │   ├── warning notice
│   │   ├── CTA: /phone-verification?next=/write
│   │   └── 예약 버튼 disabled
│   └── hasVerifiedStrictPhone = true
│       └── form 활성화
├── Recipient panel
│   ├── 미래의 나
│   ├── 친구
│   │   └── accepted friendship 목록
│   └── 연락처
│       ├── 이름
│       ├── email
│       ├── phone
│       └── preferredChannel: AUTO / EMAIL / SMS
├── Group recipients
│   ├── 수신자 추가
│   ├── 수신자 제거
│   └── 수신자별 validation
├── Content panel
│   ├── title
│   ├── content textarea
│   ├── emotion tag
│   └── custom emotion
├── Attachment panel
│   ├── 최대 3개
│   ├── jpg/jpeg/png/webp만 허용
│   ├── preview grid
│   ├── remove action
│   └── OCR moderation 대상 안내는 과도하게 노출하지 않음
├── Arrival panel
│   ├── GET /api/time
│   ├── defaultScheduledAt = serverNow + 24h
│   ├── retry once on failure
│   ├── fixed arrival
│   ├── random window
│   ├── date input
│   ├── time input 1분 단위
│   └── quick minute 00/15/30/45
├── Options panel
│   ├── 발신인 숨김
│   ├── 도착일 숨김
│   ├── 익명 답장 허용
│   ├── 도착 전 힌트
│   └── theme
└── Submit result dialog
    ├── 성공
    │   ├── 예약 완료
    │   ├── 공개 URL QR
    │   ├── 링크 복사
    │   ├── 보낸 마음 보기
    │   ├── 상세 보기
    │   └── 새 마음 쓰기
    └── 실패
        ├── PHONE 인증 필요
        ├── 이미지 형식 오류
        ├── 첨부 개수/용량 오류
        ├── moderation 차단
        ├── OCR/moderation 일시 실패
        └── 서버 오류
```

`/write`에서 발신 연락처 select, masked phone/email value, senderContactId 선택 UI는 노출하지 않습니다. 사용자는 “인증 여부”만 확인하고, 실제 발신 권한 선택은 서버가 수행합니다.

### 4. Phone Verification `/phone-verification` IA

```txt
/phone-verification
├── Page purpose
│   └── 마음쓰기 전 010 휴대전화 인증
├── Already verified state
│   ├── 인증 완료 안내
│   ├── 마음 쓰러 가기
│   └── 내 정보로 돌아가기
├── Input state
│   ├── phone input
│   ├── 010 번호만 허용
│   └── 인증번호 받기
├── Code state
│   ├── 6자리 OTP input
│   ├── 재발송
│   ├── cooldown
│   └── 인증 완료
├── Error feedback
│   ├── CONTACT_PHONE_INVALID
│   ├── PHONE_VERIFICATION_IP_LOCKED
│   ├── PHONE_VERIFICATION_CONTACT_LOCKED
│   ├── PHONE_LOOKUP_UNAVAILABLE
│   └── OTP mismatch / expired
└── Safe next
    ├── /write allowed
    ├── /my allowed
    └── 그 외 또는 외부 URL은 /write
```

### 5. Sent `/sent` IA

```txt
/sent
├── Tabs
│   ├── 보낸 마음
│   └── 답장함
├── 보낸 마음 tab
│   ├── 상태 필터
│   ├── 감정 필터
│   ├── MessageCard + LetterThumb
│   ├── 예약 취소
│   ├── 보낸 마음에서 삭제
│   ├── 공개 링크 복사
│   ├── QR 보기
│   └── 상세 보기
└── 답장함 tab
    ├── GET /api/messages/sent/replies
    ├── 새 답장 badge
    ├── 메시지 제목
    ├── 수신자 표시
    ├── 답장 작성 시각
    ├── preview
    ├── 읽음 처리
    ├── 발신자 화면 삭제
    └── 원문 메시지 상세 이동
```

답장함 이메일 알림에는 답장 본문을 넣지 않으므로, 실제 내용 확인은 앱 내부 `/sent` 답장함 또는 `/messages/[id]`에서 이루어집니다.

### 6. Inbox / Archive / Future IA

```txt
Received Mailbox Family
├── /inbox
│   ├── 받은 마음 목록
│   ├── 감정 태그 필터
│   ├── 읽음/미열람 상태
│   ├── 아카이브
│   ├── 삭제
│   ├── 일괄 삭제
│   └── 상세 보기
├── /archive
│   ├── 아카이브 목록
│   ├── 받은 마음으로 복구
│   ├── 삭제
│   └── 일괄 삭제
└── /future
    ├── 미래의 나에게 쓴 마음
    ├── 상태 badge
    ├── 감정 필터
    └── 상세 보기
```

새 UI에서는 목록 card가 모두 같은 `LetterThumb + figma-panel + status/emotion pill` 구조를 사용합니다.

### 7. Public Arrival `/arrival/[token]` IA

```txt
/arrival/[token]
├── Token lookup
├── 도착 전
│   ├── 아직 도착하지 않음
│   ├── hint 표시 가능
│   └── 로그인 CTA optional
├── 도착 후
│   ├── title
│   ├── sender display or hidden
│   ├── scheduledAt display or hidden
│   ├── content
│   ├── attachments
│   ├── theme
│   └── receiver state
├── Reply
│   ├── isReplyEnabled true일 때 표시
│   ├── anonymous reply
│   └── moderation 후 저장
├── Report
│   └── 공개 링크 수신자 신고
├── Notification suppression
│   ├── 이메일 알림 다시 받지 않기 / 다시 받기
│   └── 문자 알림 다시 받지 않기 / 다시 받기
└── Save to account
    ├── pendingArrivalToken 저장
    ├── Kakao login
    └── /auth/callback에서 link-message
```

공개 링크는 `Message.status`와 token의 `MessageRecipient.deliveryStatus`가 모두 열람 가능한 상태인지 확인해야 합니다.

### 8. Friends `/friends` IA

```txt
/friends
├── 내 친구 코드
├── 친구 검색
│   ├── nickname
│   └── friendCode
├── 친구 요청
│   ├── 요청 보내기
│   ├── 받은 요청 수락/거절
│   └── 보낸 요청 취소
├── 친구 목록
│   ├── 친구 표시
│   └── 친구 삭제
└── 친구 초대 링크
    ├── 생성
    ├── 복사
    ├── 폐기
    ├── /friends/invite/[token] preview
    └── 로그인 후 claim
```

초대 링크는 일회성/임시 링크 성격입니다. 로그인 전 접근하면 pending token을 저장하고 로그인 후 자동으로 친구등록을 시도합니다.

### 9. My `/my` IA

```txt
/my
├── 계정 정보
├── 연락처 인증
│   ├── PHONE 먼저 표시
│   │   ├── 인증 완료 상태
│   │   ├── 삭제 불가
│   │   └── 변경 CTA -> /phone-verification?next=/my
│   └── EMAIL
│       ├── 인증 상태
│       ├── 추가/인증
│       └── 삭제 가능
├── 친구/메시지 quick state
└── 로그아웃
```

연락처 설명 문구는 과하게 노출하지 않습니다. PHONE이 마음쓰기 권한의 기준이라는 사실은 `/write` gate와 `/phone-verification`에서 충분히 안내하고, `/my`에서는 상태와 action 중심으로 표시합니다.

### 10. Tree `/tree`, `/tree/[token]` IA

```txt
/tree
├── PHONE gate
├── 마음나무 생성
│   ├── title
│   ├── description
│   └── scheduledAt
├── 생성 완료
│   ├── collectionUrl
│   ├── QR
│   ├── 링크 복사
│   └── QR 저장
├── 내 마음나무 목록
│   ├── ACTIVE
│   ├── DELIVERED
│   └── CANCELED
└── 상세
    ├── 도착 전 제출 개수
    ├── 도착 후 제출 본문
    └── 취소
```

```txt
/tree/[token]
├── 공개 preview
├── 도착 전
│   ├── senderDisplayName optional
│   ├── content
│   ├── moderation
│   └── 제출 완료
├── 도착 후
│   └── 제출 마감 안내
└── 취소/만료/오류
    └── 제출 불가 안내
```

마음나무 v1은 텍스트 제출만 지원하며, 이미지 첨부는 일반 메시지 `/write`에서만 지원합니다.

### 11. UI 오류/상태 copy IA

```txt
Phone verification
├── CONTACT_PHONE_INVALID
│   └── 휴대전화 번호만 인증할 수 있어요.
├── PHONE_VERIFICATION_IP_LOCKED
│   └── 단기간에 너무 많은 인증을 요청하셨습니다. 잠시 후 다시 시도해 주세요.
├── PHONE_VERIFICATION_CONTACT_LOCKED
│   └── 단기간에 너무 많은 인증을 요청하셨습니다. 잠시 후 다시 시도해 주세요.
└── PHONE_LOOKUP_UNAVAILABLE
    └── 번호 확인 서비스가 잠시 불안정해요. 잠시 후 다시 시도해 주세요.
```

```txt
Attachments
├── ATTACHMENT_TYPE_UNSUPPORTED
│   └── 이미지는 jpg, jpeg, png, webp 형식만 첨부할 수 있어요.
├── TOO_MANY_ATTACHMENTS
│   └── 이미지는 최대 3개까지 첨부할 수 있어요.
├── ATTACHMENT_TOO_LARGE
│   └── 이미지 용량이 너무 커요.
└── ATTACHMENTS_TOO_LARGE
    └── 첨부 이미지 전체 용량이 너무 커요.
```

```txt
Moderation / OCR
├── BLOCKED
│   └── guardrail feedback 표시
├── MODERATION_FAILED
│   └── 안전 검사를 완료하지 못해 재검사 대기 안내
└── OCR failure
    └── 미검증 이미지가 발송되지 않도록 실패 대기 상태로 저장
```

### 12. 운영 QA IA

화면 QA는 기능별로 다음 순서를 따릅니다.

```txt
QA Flow
├── Auth
│   ├── login
│   ├── auth callback
│   ├── pending arrival claim
│   └── pending friend invite claim
├── Writer gate
│   ├── no PHONE -> write disabled
│   ├── phone verification
│   └── write enabled
├── Message writing
│   ├── self
│   ├── friend
│   ├── other email
│   ├── other sms
│   ├── image 1/2/3
│   ├── image 4 blocked
│   └── unsupported file blocked
├── Delivery
│   ├── scheduler SENT
│   ├── IN_APP
│   ├── EMAIL
│   ├── SMS
│   └── suppression
├── Public
│   ├── arrival
│   ├── reply
│   ├── report
│   └── save to account
├── Social
│   ├── friend request
│   ├── invite link
│   └── claim
├── Collection
│   ├── create tree
│   ├── public submit
│   └── deliver tree
└── Responsive
    ├── desktop 1280
    ├── mobile 390
    ├── bottom nav overlap
    └── text/button overflow
```

Figma MCP 인증과 파일 접근은 확인된 상태지만, Starter plan call limit으로 최종 screenshot 재대조가 제한될 수 있습니다. call limit이 풀리면 `Desktop_main`, `Desktop_Writing`, `Desktop_friends`, `Desktop_my` 기준으로 실제 route screenshot을 다시 비교합니다.

## 2026-07-07 최종 IA 동기화: 현재 구현 기준

이 장은 최신 코드 기준의 사용자 화면 구조를 한 번 더 고정합니다. UI는 Figma 기반으로 재작성하되, 기존 기능을 잃지 않는 것을 최우선 조건으로 둡니다.

### 1. Global Shell IA

```txt
Logged-in AppShell
├── Top bar
│   ├── app icon
│   ├── 매아리 wordmark
│   └── my profile button
├── Desktop sidebar
│   ├── 홈
│   ├── 마음 보내기
│   ├── 받은 마음
│   ├── 보낸 마음
│   ├── 마음나무
│   ├── 친구
│   ├── 리포트
│   ├── 내 정보
│   └── 오늘의 한 줄 image panel
├── Mobile bottom nav
│   ├── 쓰기
│   ├── 받은 마음
│   ├── 보낸 마음
│   ├── 친구
│   └── 내 정보
└── Content stage
    ├── maeari-stage
    ├── max width container
    └── route content
```

공개/비회원 화면은 `AppShell`을 쓰지 않고 `maeari-public-stage`를 사용합니다.

```txt
Public Stage
├── centered brand header
├── public letter/card surface
├── error/expired/gate state
└── action buttons
```

### 2. Route IA 최신표

| Route | 사용자 목적 | 최상위 UI 구조 | 핵심 상태 |
| --- | --- | --- | --- |
| `/login` | Kakao로 시작 | brand visual + login CTA | pending token 유지 |
| `/auth/callback` | OAuth 완료 | loading/result panel | pending arrival/friend invite 처리 |
| `/onboarding` | 첫 사용자 정보 확인 | welcome panel + note | nickname/note 저장 |
| `/` | 현황 확인 | hero + timeline + cards | recent, due soon, quick actions |
| `/write` | 마음 예약 | PHONE gate + write form + delivery panel | time loading, moderation, upload, success |
| `/phone-verification` | 작성 권한 인증 | phone input + OTP flow | invalid, locked, lookup unavailable, verified |
| `/sent` | 보낸 마음 관리 | tab: messages/replies | cancel, delete, QR, reply read/delete |
| `/inbox` | 받은 마음 확인 | filter + message cards | read, archive, delete |
| `/archive` | 보관함 | archived cards | restore, delete |
| `/future` | 미래의 나 | self scheduled cards | waiting/sent state |
| `/messages/[id]` | 상세 확인 | letter detail + side/actions | recipients, attachments, replies, QR |
| `/arrival/[token]` | 공개 열람 | public gate/detail | before arrival, available, suppress, reply |
| `/friends` | 친구 관리 | code/search/request/invite panels | friend request and invite token |
| `/friends/invite/[token]` | 친구 초대 수락 | preview + login/claim CTA | pending claim |
| `/my` | 계정/연락처 관리 | account + contact panels | PHONE first, EMAIL secondary |
| `/reports` | 감정 리포트 | stat cards | emotion summary |
| `/admin` | 운영 관리 | dense panels/tables | moderation, notification, report, reply |
| `/tree` | 마음나무 생성/관리 | create form + QR + list | active/delivered/canceled |
| `/tree/[token]` | 비회원 제출 | public collection form | canSubmit, delivered, canceled |

### 3. `/write` IA 상세

```txt
/write
├── Header
│   ├── title: 마음 쓰기
│   └── current KST card
├── PHONE Gate
│   ├── writerEligibility.hasVerifiedStrictPhone=false
│   │   ├── warning notice
│   │   ├── /phone-verification?next=/write CTA
│   │   └── submit disabled
│   └── true
│       └── form enabled
├── Message Form
│   ├── title
│   ├── content
│   ├── emotionTag/customEmotionTag
│   ├── attachments
│   │   ├── max 3
│   │   ├── jpg/jpeg/png/webp only
│   │   ├── preview/remove
│   │   └── client validation notice
│   └── options
│       ├── isSenderHidden
│       ├── isDateHidden
│       └── isReplyEnabled
├── Recipient Panel
│   ├── SELF
│   ├── FRIEND
│   └── OTHER
│       ├── email
│       ├── phone
│       └── preferredChannel AUTO/EMAIL/SMS
├── Delivery Panel
│   ├── server time loading
│   ├── default +24h
│   ├── date
│   ├── hour/minute
│   ├── 15-minute presets
│   ├── FIXED/RANDOM_WINDOW
│   └── hintAt
└── Submit Result
    ├── success dialog
    ├── public URL
    ├── QR
    ├── link copy
    ├── go sent
    └── reset/write again
```

중요 제약:

- `senderContactId`는 UI에 노출하지 않고 submit payload에도 넣지 않습니다.
- 서버가 준 `defaultScheduledAt`을 기본값으로 사용합니다.
- 사용자가 시간을 수정하지 않으면 서버 ISO를 그대로 보냅니다.
- 사용자가 수정하면 KST 입력값을 ISO UTC로 정규화해서 보냅니다.

### 4. Attachment IA

```txt
Attachment UX
├── Add button
├── accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
├── Draft validation
│   ├── MIME
│   ├── extension
│   ├── count
│   ├── per-file size
│   └── total size
├── Preview grid
│   ├── thumbnail
│   ├── file name
│   ├── size
│   └── remove
└── Error copy
    ├── 이미지는 jpg, jpeg, png, webp 형식만 첨부할 수 있어요.
    ├── 이미지는 최대 3개까지 첨부할 수 있어요.
    ├── 이미지 용량이 너무 커요.
    └── 첨부 이미지 전체 용량이 너무 커요.
```

서버 IA:

```txt
Upload
├── multer memory
├── MIME/ext allowlist
├── magic bytes
├── OCR
├── moderation
└── upload dir save
```

### 5. `/sent` IA 최신화

```txt
/sent
├── PageHeader
├── Tabs
│   ├── 보낸 마음
│   └── 답장함
├── Sent Messages
│   ├── MessageCard
│   ├── status pill
│   ├── recipients summary
│   ├── scheduledAt/sentAt
│   ├── public link copy
│   ├── QR 보기
│   ├── 예약 취소
│   └── 삭제
└── Reply Inbox
    ├── unread count
    ├── reply card
    ├── sender display or 익명 답장
    ├── preview
    ├── mark read on open
    └── delete from sender view
```

답장함은 보낸 마음 안의 하위 inbox입니다. 수신자가 공개 링크에서 남긴 답장을 발신자가 확인하는 곳이며, 답장 이메일 알림은 내용이 아니라 내부 링크만 전달합니다.

### 6. `/arrival/[token]` IA 최신화

```txt
/arrival/[token]
├── Token Resolve
│   ├── invalid
│   ├── canceled
│   ├── before arrival
│   ├── delivery failed
│   └── available
├── Letter
│   ├── title
│   ├── sender display
│   ├── scheduled/arrival time
│   ├── content
│   ├── attachments
│   └── theme surface
├── Reply
│   ├── enabled
│   ├── content
│   ├── anonymous display option
│   └── submit
├── Safety
│   ├── report
│   └── blocked state
├── Notification Preference
│   ├── canSuppressEmailNotification
│   ├── isEmailNotificationSuppressed
│   ├── canSuppressSmsNotification
│   └── isSmsNotificationSuppressed
└── Account Claim
    ├── 로그인 후 보관
    └── pendingArrivalToken
```

### 7. `/my`와 `/phone-verification` IA 최신화

```txt
/my
├── Profile
├── 연락처 인증
│   ├── PHONE section first
│   │   ├── verified / pending / missing
│   │   ├── 변경 CTA
│   │   └── verified delete hidden
│   └── EMAIL section
│       ├── verified / pending / missing
│       ├── add
│       ├── send code
│       ├── verify
│       └── delete
└── logout
```

```txt
/phone-verification
├── Already verified
│   ├── 인증 완료
│   ├── 마음 쓰러 가기
│   └── 내 정보로 돌아가기
└── Verification flow
    ├── phone input
    ├── request code
    ├── cooldown
    ├── OTP input
    ├── verify
    └── safe next redirect
```

`next` 허용 경로는 `/write`, `/my`입니다. 외부 URL이나 이상한 경로는 `/write`로 대체합니다.

### 8. Friends IA 최신화

```txt
/friends
├── Hero
├── 내 친구 코드
├── 친구 검색
│   ├── nickname
│   └── friendCode
├── 요청
│   ├── 받은 요청
│   ├── 보낸 요청
│   ├── 수락
│   ├── 거절
│   └── 취소
├── 친구 목록
│   ├── friend card
│   └── delete
└── 초대 링크
    ├── create
    ├── active invite
    ├── copy
    ├── revoke
    └── QR/share extension 가능
```

초대 링크:

```txt
/friends/invite/[token]
├── preview inviter
├── unauthenticated
│   ├── pending token 저장
│   └── Kakao login CTA
└── authenticated
    ├── claim
    ├── success
    └── failure reason
```

### 9. Tree IA 최신화

```txt
/tree
├── PHONE gate
├── Create collection
│   ├── title
│   ├── description
│   └── scheduledAt
├── Created result
│   ├── collectionUrl
│   ├── QR
│   ├── copy
│   └── download QR
└── My collections
    ├── ACTIVE
    ├── DELIVERED
    ├── CANCELED
    ├── submission count
    └── cancel/detail
```

```txt
/tree/[token]
├── public header
├── collection preview
├── canSubmit=true
│   ├── senderDisplayName optional
│   ├── content
│   └── submit
└── canSubmit=false
    ├── delivered
    ├── canceled
    └── expired/closed copy
```

### 10. Admin IA 최신화

Admin은 감성 UI보다 운영 효율이 우선입니다. 그래도 색상과 panel은 새 체계를 따릅니다.

```txt
/admin
├── summary cards
├── moderation logs
├── notification logs
├── reports
│   ├── review
│   └── dismiss
├── replies
│   ├── visible list
│   └── hide
└── users
    ├── suspend
    └── restore
```

### 11. 최신 QA IA

```txt
Visual QA
├── desktop 1280
│   ├── home
│   ├── write
│   ├── friends
│   └── my
├── mobile 390
│   ├── login
│   ├── write
│   └── arrival
├── no text overflow
├── no nested card visual clutter
├── no broken image icon
├── AppShell fixed elements do not cover content
└── Figma screenshot compare after MCP limit reset
```

```txt
Functional QA
├── auth
├── strict phone verification
├── write without senderContactId
├── image 1/2/3 attach
├── image 4 blocked
├── unsupported image blocked
├── OCR moderation
├── scheduled delivery
├── Gmail SMTP
├── Solapi SMS
├── suppression/re-subscribe
├── public reply
├── sent replies tab
├── QR scan
├── friend invite claim
├── tree submit/deliver
└── admin review
```

## 2026-07-08 프론트엔드 IA 동기화: 현재 화면 기준

이 장은 2026-07-08 기준 프론트엔드 화면에서 실제로 보이는 최신 IA를 고정합니다. 이전 장의 오래된 명칭이나 quick card 구조보다 이 장의 기준을 우선합니다.

### 1. Global Navigation 최신 기준

```txt
Logged-in AppShell
├── Top bar
│   ├── maeari_logo.png
│   ├── 매아리 wordmark
│   └── 내 정보 profile shortcut
├── Desktop sidebar
│   ├── 홈 -> /
│   ├── 마음 보내기 -> /write
│   ├── 보낸 마음 -> /sent
│   ├── 마음 보관함 -> /archive
│   ├── 마음나무 -> /tree
│   ├── 친구 -> /friends
│   └── 리포트 -> /reports
├── Today Line Panel
│   ├── GET /api/daily-line
│   ├── text
│   ├── / poemTitle, poet
│   └── / date
└── Mobile bottom nav
    ├── 홈 -> /
    ├── 쓰기 -> /write
    ├── 보낸 마음 -> /sent
    ├── 보관함 -> /archive
    ├── 마음나무 -> /tree
    └── 친구 -> /friends
```

`받은 마음`은 좌측/하단 고정 메뉴에서는 제거하고, 홈 히어로 CTA나 직접 route `/inbox`에서 접근합니다.

### 2. Home `/` 최신 기준

```txt
/
├── Hero
│   ├── background: maeari-hero-night.png
│   ├── copy: 잊고 있던 글이, 나를 찾아오는 순간
│   ├── 현재 KST
│   ├── CTA: 마음 보내기
│   └── CTA: 받은 마음 보기
├── 곧 찾아갈 마음
│   ├── desktop: hero 오른쪽 timeline
│   ├── mobile/tablet: 최근 찾아온 마음 위 card
│   └── 예정된 마음이 없으면 마음나무 fallback 1개
└── 최근 찾아온 마음
    ├── MessageAlbumCard
    ├── thumbnail.url 우선
    ├── coverImageUrl fallback
    ├── 화면 폭별 표시 개수
    │   ├── mobile: 1개
    │   ├── medium: 2개
    │   └── desktop: 3개
    └── 전체 보기 -> /archive
```

### 3. Write `/write` 최신 기준

```txt
/write
├── Header
│   ├── 새로운 마음 보내기
│   └── 현재 시각 KST
├── Message form
│   ├── receiver
│   ├── title/content
│   ├── emotion tags
│   ├── envelope/theme
│   └── image attachments
├── Delivery setting
│   ├── 전달 예정일
│   ├── 전달 예정 시간
│   ├── quick presets
│   │   ├── 1분 후
│   │   ├── 10분 후
│   │   ├── 하루 후
│   │   └── 일주일 후
│   ├── 15분 quick minute
│   ├── 고정 도착 / 랜덤 도착
│   ├── 익명으로 보내기
│   └── 도착 예정일 숨기기
└── Submit result dialog
    ├── 예약 완료 안내
    ├── 공개 도착 QR
    ├── 링크 복사
    ├── QR 저장
    ├── 예약 상세 보기
    ├── 새 마음 쓰기
    └── 메인
```

팝업/알림창은 화면 전체를 어둡게 덮지 않고, 카드 자체의 그림자를 강화해 떠 보이게 합니다.

### 4. Inbox / Archive 최신 기준

```txt
/inbox
├── 받은 마음
├── album grid
├── unread dot with white outline
├── no star icon
├── card preview에는 본문 미표시
├── 수신 시간 표시
├── 감정 태그 필터
├── 보관
└── 삭제
```

```txt
/archive
├── 마음 보관함
├── album grid
├── thumbnail.url / coverImageUrl 기반 카드 배경
├── 감정 태그 필터
├── 보관함에서 빼기
└── 삭제
```

### 5. Message Detail `/messages/[id]` 최신 기준

```txt
/messages/[id]
├── 상단 목록 이동 버튼 없음
├── status/emotion/hidden badges
├── title
├── sender display
├── 시간 정보는 한 종류만 표시
│   ├── SENDER + 예약/검사 대기: 예약 시간
│   └── 전달 완료/받은 마음/보관함: 도착 시간
├── recipient state
├── content
├── attachments
│   ├── polaroid frame
│   └── click opens original image
├── replies
├── public link / QR
├── cancel/delete/report
└── attachment image가 있으면 상단 편지지 overlay로 표시
```

### 6. Public Arrival `/arrival/[token]` 최신 기준

```txt
/arrival/[token]
├── public header
├── night-sky background
│   ├── random stars
│   └── pointer constellation trail
├── before-open gate
│   ├── background: images/편지.png -> maeari-arrival-letter.png
│   ├── card width: desktop 약 70vw
│   ├── 남겨둔 마음이 도착했어요
│   ├── gift icon
│   ├── 지금, 열어볼까요?
│   └── 마음 열어보기
├── opened letter
│   ├── title
│   ├── arrivedAt only for recipient perspective
│   ├── content
│   ├── polaroid attachments
│   ├── anonymous reply
│   ├── report
│   └── Kakao start CTA inline
└── notification suppression
```

별똥별 궤적은 짧은 선분을 이어 그리며, 새 움직임은 새 궤적으로 시작하고 오래된 선분부터 사라집니다.

### 7. Tree `/tree` 최신 기준

```txt
/tree
├── 새 마음나무 만들기
├── 생성 성공 notice
├── QR / link share
├── 마음나무 card
│   ├── 상세정보
│   │   ├── QR
│   │   └── URL
│   ├── 열기
│   │   └── card 내부에서 제출물 펼침
│   └── 닫기
│       ├── X icon
│       └── confirm popup
```

마음나무 confirm popup도 전체 화면을 어둡게 덮지 않고 dialog shadow 중심으로 표시합니다.
