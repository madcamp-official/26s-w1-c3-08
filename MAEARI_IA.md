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
    ├── MCP fallback provider
    └── OpenAI Moderation API
```

## 1.2 MVP 핵심 사용자 여정

```txt
매아리 MVP 여정
├── 1. 카카오 로그인
├── 2. 온보딩 질문 확인
├── 3. 메시지 작성
├── 4. AI 안전 검사
├── 5. AI 검사 API 실패 시 즉시 1회 재시도
├── 6. 2회 실패 시 검사 실패 상태로 임시 보관
├── 7. 검사 통과 시 예약 메시지 저장
├── 8. 공개 열람 링크 생성
├── 9. 예약 시간 도래
├── 10. Scheduler가 SENT 처리
├── 11. NotificationProcessor 후속 처리
├── 12. 친구/자기 자신 수신자는 수신함에서 확인
├── 13. 외부 수신자는 Gmail SMTP 또는 Solapi SMS로 공개 링크 수신
├── 14. 수신자가 공개 링크로 열람
├── 15. 필요 시 익명 답장 또는 신고 작성
├── 16. 필요 시 이메일/문자 알림 수신거부
├── 17. 비회원 수신자가 가입하면 메시지 자동 보관
├── 18. 발신자/수신자가 보관함에서 감정 태그 필터, 아카이브, 삭제 수행
└── 19. 관리자가 moderation/notification/reply/report 상태 점검
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
│       ├── /api/auth/link-message 호출
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
│   │   ├── 닉네임 또는 친구 코드로 친구 찾기
│   │   ├── 친구 코드로 요청 보내기
│   │   ├── 받은 요청 수락/거절
│   │   ├── 보낸 요청 취소
│   │   ├── 친구 목록
│   │   └── 친구 삭제
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
│   │   ├── 취소된 메시지 삭제
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
    │   ├── MCP fallback 발송
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
├── 수신함
│   └── /inbox
│
├── 발신함
│   └── /sent
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
├── 리포트
│   ├── icon: bar-chart
│   └── route: /reports
│
└── 내 정보
    ├── icon: user
    └── route: /my
```

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
│       ├── JPEG/PNG/WebP/GIF
│       ├── 최대 3개
│       ├── 파일당 MAX_ATTACHMENT_BYTES 이하
│       └── 미리보기와 삭제
│
├── Section 3. 도착 설정
│   ├── KST 현재 시각 초 단위 표시
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
│       ├── auth middleware
│       ├── request validation
│       ├── OpenAI moderation
│       ├── API 실패 시 즉시 1회 재시도
│       ├── 통과 시 PENDING 저장
│       ├── 통과 시 수신자별 publicUrl 반환
│       └── 2회 검사 실패 시 MODERATION_FAILED 저장
│
├── 성공 상태
│   ├── 예약 완료 메시지
│   ├── publicUrl 용도 안내
│   ├── 첫 번째 publicUrl 복사
│   ├── 수신자별 publicUrls 확인
│   ├── 메인으로 이동
│   ├── 발신함으로 이동
│   └── 새 마음 쓰기
│
├── 검사 실패 보관 상태
│   ├── 안전 검사를 잠시 완료하지 못했어요
│   ├── 작성한 마음은 임시 보관됨
│   ├── publicUrl 미발급
│   ├── 하루 한 번 자동 재검사 안내
│   └── 발신함으로 이동
│
└── 실패 상태
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
    ├── validation 오류
    └── 서버 오류
```

## 4.5 `/sent`

```txt
/sent
├── 목적
│   └── 내가 작성한 메시지 확인 및 예약 관리
│
├── 진입 경로
│   ├── navigation
│   ├── 메시지 작성 완료
│   └── 메시지 상세에서 돌아가기
│
├── 데이터 요청
│   └── GET /api/messages/sent
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
│   ├── 예약 취소
│   │   └── PATCH /api/messages/:id/cancel
│   └── 취소된 메시지 삭제
│       └── DELETE /api/messages/:id
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
│   ├── 취소된 메시지 삭제
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
│   ├── canSuppressEmailNotification=true이면 이메일 알림 수신거부 버튼 표시
│   ├── canSuppressSmsNotification=true이면 문자 알림 수신거부 버튼 표시
│   ├── POST /api/public/notification-suppressions
│   ├── body: { token, channel }
│   └── 원본 연락처가 아닌 HMAC contactHash 저장
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
│   └── 로그인 사용자 계정 정보 확인
│
├── 데이터 요청
│   └── GET /api/me
│
├── 표시 정보
│   ├── 닉네임
│   ├── 이메일
│   ├── 카카오 연동 상태
│   ├── 관리자 권한이면 /admin link
│   └── 가입일
│
├── 액션
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
│       ├── HttpOnly cookie 발급
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
└── 로그아웃
    └── POST /api/auth/logout
```

## 5.2 메시지 작성

```txt
Message Create
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
│   ├── required fields
│   ├── content length
│   ├── scheduledAt future only
│   ├── RANDOM_WINDOW 구간 유효성
│   ├── hintAt 유효성
│   ├── attachments 개수/용량/MIME type
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
        ├── EMAIL: Gmail SMTP 우선, MCP fallback
        ├── SMS: Solapi 우선, MCP fallback
        ├── ContactSuppression 조회
        ├── NotificationLog 저장
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
│   └── POST /api/public/notification-suppressions
│       ├── token
│       └── channel: EMAIL 또는 SMS
│
├── 서버 처리
│   ├── tokenHash로 MessageAccessToken 조회
│   ├── channel에 맞는 receiverEmail 또는 receiverPhone 확인
│   ├── 연락처 정규화
│   ├── PUBLIC_TOKEN_PEPPER로 HMAC-SHA256 hash 생성
│   └── ContactSuppression upsert
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
│   └── POST /api/auth/link-message
│
├── /onboarding
│   └── GET /api/me
│
├── /write
│   ├── GET /api/me
│   ├── GET /api/friends
│   └── POST /api/messages
│
├── /friends
│   ├── GET /api/friends
│   ├── GET /api/friends/requests
│   ├── GET /api/friends/search
│   ├── POST /api/friends/requests
│   ├── PATCH /api/friends/requests/:id/accept
│   ├── PATCH /api/friends/requests/:id/reject
│   ├── PATCH /api/friends/requests/:id/cancel
│   └── DELETE /api/friends/:friendshipId
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
│   └── POST /api/public/notification-suppressions
│
└── /my
    ├── GET /api/me
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
    ├── MCP fallback provider
    ├── notification retry scheduler
    └── failure logging
```
