# 받은 마음 앨범형 UI 구현 계획

## 목적

`받은 마음` 화면을 리스트형에서 앨범형 카드 그리드로 개선한다.

받은 메시지에 첨부 사진이 있으면 그 사진을 카드 대표 이미지로 사용하고, 첨부 사진이 없으면 보낸 사람이 선택한 봉투 테마 이미지를 기본 배경으로 사용한다.

이 작업은 프론트엔드 화면 변경과 백엔드 API 응답 확장이 함께 필요한 작업이므로 `FRONTEND_BACKEND_WORKFLOW.md`의 API 계약 변경 절차를 따른다.

## 핵심 원칙

- 프론트엔드는 받은 마음 앨범 UI, 반응형 카드, 이미지 fallback 표시를 담당한다.
- 백엔드는 받은 마음 목록 API에서 앨범 카드에 필요한 대표 이미지 정보를 제공한다.
- 프론트엔드는 상세 조회 API를 카드별로 추가 호출하지 않는다.
- 받은 마음 목록을 보는 것만으로 메시지가 `읽음` 처리되면 안 된다.
- API 응답 필드는 기존 필드를 제거하지 않고 새 필드만 추가한다.

## 필요한 API 계약 변경

대상 API:

```txt
GET /api/messages/received
```

현재 프론트 사용 필드:

```ts
type InboxMessage = {
  id: string;
  recipientId: string;
  title: string;
  preview: string;
  emotionTag?: string | null;
  customEmotionTag?: string | null;
  senderName?: string | null;
  arrivedAt?: string | null;
  isSenderHidden: boolean;
  isDateHidden: boolean;
  readAt?: string | null;
  linkedAt?: string | null;
};
```

추가 요청 필드:

```ts
type InboxMessage = {
  theme?: "LAVENDER" | "MOSS" | "SUNSET" | "MIDNIGHT" | "PAPER" | null;
  coverImageUrl?: string | null;
  coverImageAlt?: string | null;
  attachmentCount?: number;
};
```

필드 의미:

- `theme`: 메시지 작성자가 선택한 봉투 테마
- `coverImageUrl`: 첨부 이미지가 있을 때 첫 번째 이미지의 공개 URL
- `coverImageAlt`: 대표 이미지 대체 텍스트. 없으면 `title`을 사용해도 된다.
- `attachmentCount`: 메시지에 포함된 첨부 이미지 수

fallback 규칙:

```ts
const coverImage =
  message.coverImageUrl ?? envelopeImageByTheme[message.theme ?? "LAVENDER"];
```

## 백엔드 담당 작업

## 1. 받은 마음 목록 조회 include 확장

파일 후보:

```txt
apps/api/src/modules/messages/message.service.ts
apps/api/src/modules/messages/message.mapper.ts
```

`listReceivedMessages`에서 각 message의 첨부 이미지 정보를 함께 조회한다.

권장 방식:

```ts
attachments: {
  orderBy: { createdAt: "asc" },
  take: 1,
}
```

단, `attachmentCount`가 필요하면 전체 count를 별도로 포함하거나 `_count`를 사용한다.

## 2. mapper에 대표 이미지 필드 추가

`mapReceivedItem` 응답에 다음 필드를 추가한다.

```ts
const coverAttachment = message.attachments?.[0] ?? null;

return {
  ...
  theme: message.theme,
  coverImageUrl: coverAttachment?.publicUrl ?? null,
  coverImageAlt: coverAttachment?.originalName ?? null,
  attachmentCount: message._count?.attachments ?? message.attachments?.length ?? 0,
};
```

주의:

- 기존 응답 필드는 제거하지 않는다.
- 첨부 이미지 원본 데이터나 storage key를 직접 노출하지 않는다.
- `publicUrl`만 내려준다.
- 받은 목록 조회가 메시지를 읽음 처리하지 않도록 유지한다.

## 3. shared 타입 또는 API 문서 반영

공통 타입을 관리한다면 `packages/shared`에 받은 마음 목록 응답 타입을 추가하거나 확장한다.

문서에는 다음 내용을 남긴다.

```txt
Method: GET
Path: /api/messages/received
Auth required: yes
Response added fields:
  theme?: string | null
  coverImageUrl?: string | null
  coverImageAlt?: string | null
  attachmentCount?: number
Backward compatibility:
  기존 필드 유지, 새 필드만 추가
Frontend usage page:
  apps/web/app/inbox/page.tsx
```

## 4. 백엔드 검증

권장 검증:

```bash
pnpm --filter @maeari/api typecheck
pnpm --filter @maeari/api build
```

확인 케이스:

- 첨부 이미지가 있는 받은 마음은 `coverImageUrl`이 내려온다.
- 첨부 이미지가 없는 받은 마음은 `coverImageUrl: null`로 내려온다.
- `theme`은 항상 기존 메시지 테마 값이 내려온다.
- 받은 마음 목록 조회만으로 `readAt`이 변경되지 않는다.

## 프론트엔드 담당 작업

## 1. 받은 마음 타입 확장

파일:

```txt
apps/web/app/inbox/page.tsx
```

`InboxMessage` 타입에 API 추가 필드를 반영한다.

```ts
type InboxMessage = {
  ...
  theme?: string | null;
  coverImageUrl?: string | null;
  coverImageAlt?: string | null;
  attachmentCount?: number;
};
```

## 2. 봉투 테마 fallback 이미지 준비

파일 후보:

```txt
apps/web/app/inbox/page.tsx
apps/web/lib/messageCovers.ts
apps/web/public/images/**
```

테마별 기본 이미지를 매핑한다.

예시:

```ts
const envelopeImageByTheme: Record<string, string> = {
  LAVENDER: "/images/maeari-card-letter.png",
  MOSS: "/images/maeari-open-envelope.png",
  SUNSET: "/images/maeari-cloud-envelope.png",
  MIDNIGHT: "/images/maeari-moon-letter.png",
  PAPER: "/images/maeari-heart-letter.png",
};
```

## 3. 앨범형 카드 컴포넌트 구성

받은 마음 목록을 기존 세로 리스트에서 카드 그리드로 변경한다.

권장 그리드:

```tsx
<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
  ...
</div>
```

카드 구성:

- `aspect-[16/9]` 또는 `min-h`가 있는 이미지 카드
- 배경 이미지 `img` 또는 `next/image`
- 이미지 위 그라데이션 오버레이
- 제목
- 날짜
- 보낸 사람
- 감정 표시
- 읽음/미열람 상태
- 첨부 개수 표시
- 보관/삭제 액션

## 4. 대표 이미지 선택 로직

```ts
function inboxCoverFor(message: InboxMessage) {
  return message.coverImageUrl ?? envelopeImageByTheme[message.theme ?? "LAVENDER"];
}
```

첨부 사진이 있는 경우:

- 사진을 카드 전체 배경으로 사용
- `object-cover` 적용
- 제목 가독성을 위해 어두운 오버레이 사용

첨부 사진이 없는 경우:

- 봉투 테마 이미지를 카드 배경으로 사용
- 이미지 톤이 밝으면 텍스트 영역에 더 강한 오버레이 또는 하단 패널 사용

## 5. 필터와 빈 상태 유지

기존 기능은 유지한다.

- 전체/미열람/읽음 필터
- 감정 필터
- 새로고침
- 아카이브 이동
- 일괄 삭제
- 개별 보관
- 개별 삭제
- 빈 상태

빈 상태는 앨범 그리드와 시각적으로 어울리도록 카드형 안내로 바꿀 수 있다.

## 6. 접근성과 반응형

필수 처리:

- 카드 전체가 상세 페이지 링크로 동작
- 보관/삭제 버튼은 카드 링크와 클릭 충돌이 없어야 함
- 버튼에는 명확한 `aria-label` 또는 텍스트 제공
- 모바일에서는 1열, 태블릿 2열, 데스크톱 3~4열
- 긴 제목은 `line-clamp` 처리
- 이미지가 없거나 로딩 실패해도 봉투 fallback이 보이도록 처리

## 7. 프론트엔드 검증

권장 검증:

```bash
pnpm --filter @maeari/web typecheck
pnpm --filter @maeari/web build
```

화면 확인:

- 첨부 이미지 있는 받은 마음 카드
- 첨부 이미지 없는 받은 마음 카드
- 밝은 이미지에서 텍스트 가독성
- 어두운 이미지에서 텍스트 가독성
- 모바일 1열
- 데스크톱 3~4열
- 보관/삭제 버튼 클릭
- 카드 클릭으로 상세 이동
- 필터 적용 후 빈 상태

## 작업 순서

1. 백엔드 담당자가 `GET /api/messages/received` 응답에 대표 이미지 필드를 추가한다.
2. API 응답 예시를 공유한다.
3. 프론트엔드 담당자가 `InboxMessage` 타입을 확장한다.
4. 프론트엔드 담당자가 테마별 fallback 이미지 매핑을 만든다.
5. 프론트엔드 담당자가 받은 마음 목록을 앨범형 카드 그리드로 바꾼다.
6. 프론트엔드 담당자가 필터, 보관, 삭제, 상세 이동 동작을 회귀 확인한다.
7. 양쪽 담당자가 typecheck/build를 통과시킨다.

## API 응답 예시

```json
{
  "messages": [
    {
      "id": "msg_123",
      "recipientId": "rec_123",
      "title": "너의 웃음이 좋아",
      "preview": "오늘 문득 네 생각이 났어...",
      "emotionTag": "THANKS",
      "customEmotionTag": null,
      "theme": "LAVENDER",
      "coverImageUrl": "https://service.example/uploads/abc.webp",
      "coverImageAlt": "flowers.webp",
      "attachmentCount": 1,
      "senderName": "서은",
      "arrivedAt": "2026-07-07T10:00:00.000Z",
      "isSenderHidden": false,
      "isDateHidden": false,
      "readAt": null,
      "linkedAt": null
    }
  ]
}
```

## 결정 필요 사항

- 카드에서 보관/삭제 버튼을 항상 보일지, hover 시 보일지
- 첨부 이미지가 여러 장일 때 `+2` 같은 개수 배지를 보여줄지
- 자동 보관 메시지와 일반 받은 마음을 카드에서 얼마나 구분할지
- 밝은 봉투 테마에서 오버레이를 얼마나 강하게 줄지
