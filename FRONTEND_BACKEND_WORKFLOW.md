# 매아리 Frontend / Backend 분업 프로세스

## 1. 목적

이 문서는 매아리 서비스를 2명의 엔지니어가 각각 Frontend와 Backend로 나누어 관리하기 위한 작업 기준입니다.

현재 프로젝트는 하나의 repository 안에서 여러 app과 package를 관리하는 monorepo 구조입니다. 따라서 repository를 물리적으로 둘로 나누기보다, 폴더 소유권과 API 계약 변경 규칙을 명확히 정하는 방식을 기본으로 합니다.

핵심 원칙은 다음과 같습니다.

```txt
Frontend는 사용자 화면과 API 호출 경험을 책임진다.
Backend는 데이터, 인증, 비즈니스 로직, 외부 연동, 배포 인프라를 책임진다.
두 영역이 만나는 지점은 API 계약과 shared 타입으로 관리한다.
```

---

## 2. 현재 프로젝트 구조

```txt
.
├── apps/
│   ├── web/                 # Frontend: Next.js, React, Tailwind
│   └── api/                 # Backend: Express API, scheduler, external provider
│
├── packages/
│   ├── shared/              # FE/BE 공통 타입, 라벨, enum
│   └── database/            # Prisma schema, generated client
│
├── infra/                   # Nginx 등 배포 인프라
├── scripts/                 # 배포/운영 스크립트
├── uploads/                 # 런타임 업로드 파일
├── package.json             # workspace 공통 script
├── pnpm-workspace.yaml      # workspace 범위
├── .env.example             # 환경 변수 key 목록
└── README.md
```

이 구조는 분업에 이미 적합합니다.

따라서 권장 방향은 다음입니다.

```txt
좋은 방향:
  monorepo는 유지한다.
  apps/web과 apps/api의 소유권을 명확히 나눈다.
  packages/shared와 API 문서를 계약 영역으로 관리한다.

피할 방향:
  frontend repo와 backend repo를 바로 분리한다.
  API 계약 없이 각자 임의로 request/response shape을 바꾼다.
  packages/shared의 기존 타입을 하위 호환성 없이 바로 삭제한다.
  frontend가 DB schema를 직접 수정한다.
  backend가 UI 구조를 임의로 바꾼다.
```

---

## 3. 담당 영역

## 3.1 Frontend 담당

Frontend 담당자는 다음 영역을 주로 관리합니다.

```txt
apps/web/**
apps/web/app/**
apps/web/components/**
apps/web/lib/**
apps/web/public/**
```

주요 책임:

- Next.js page, route, layout 구현
- React component 구현
- Tailwind CSS 기반 UI 구현
- Figma 디자인 반영
- 모바일/데스크톱 반응형 검수
- `apiFetch` 기반 API 호출 연결
- form validation, loading, error, empty state 처리
- 사용자 플로우 구성
- `NEXT_PUBLIC_*` 환경 변수 사용

Frontend 담당자가 직접 수정해도 되는 예:

```txt
apps/web/app/write/page.tsx
apps/web/app/admin/page.tsx
apps/web/components/AppShell.tsx
apps/web/components/ui.tsx
apps/web/lib/api.ts
apps/web/app/globals.css
```

Frontend 담당자가 단독으로 수정하지 않는 영역:

```txt
apps/api/**
packages/database/**
infra/**
server secret 관련 .env 값
```

---

## 3.2 Backend 담당

Backend 담당자는 다음 영역을 주로 관리합니다.

```txt
apps/api/**
packages/database/**
infra/**
scripts/**
docker-compose.yml
```

주요 책임:

- Express API route/controller/service 구현
- 인증/인가 처리
- Kakao OAuth 처리
- JWT/cookie session 처리
- Prisma schema와 migration 관리
- PostgreSQL 데이터 모델 관리
- scheduler와 cron job 관리
- Gmail SMTP, Solapi SMS, OpenAI, OCR 등 외부 provider 연동
- admin API, moderation, notification, report 처리
- 운영 서버 환경 변수와 배포 설정 관리
- Nginx, PM2, database deploy 관리

Backend 담당자가 직접 수정해도 되는 예:

```txt
apps/api/src/app.ts
apps/api/src/modules/**
apps/api/src/middlewares/**
apps/api/src/processors/**
apps/api/src/jobs/**
packages/database/prisma/schema.prisma
packages/database/prisma/migrations/**
infra/**
scripts/**
```

Backend 담당자가 단독으로 수정하지 않는 영역:

```txt
apps/web/app/**
apps/web/components/**
화면 copy, layout, Figma 반영 UI
```

---

## 3.3 공동 담당

다음 영역은 Frontend와 Backend가 함께 관리합니다.

```txt
packages/shared/**
.env.example
README.md
MAEARI_PLAN.md
MAEARI_IA.md
MAEARI_DB_SCHEMA.md
FRONTEND_BACKEND_WORKFLOW.md
```

공동 관리가 필요한 이유:

- `packages/shared`는 API request/response 타입, enum, 라벨 등을 담을 수 있습니다.
- `.env.example`은 frontend public env와 backend secret env가 같이 들어갑니다.
- README와 기획 문서는 두 영역의 실제 구현 상태를 모두 반영해야 합니다.

공동 리뷰가 필요한 변경:

```txt
API endpoint 추가/삭제
request body 변경
response shape 변경
status code 변경
error code 변경
공통 enum 변경
shared 타입 삭제 또는 deprecated 제거
환경 변수 추가/삭제
DB schema 변경이 화면에 영향을 주는 경우
```

---

## 4. 폴더 분리 전략

## 4.1 현재 구조 유지 권장

현재는 다음 이유로 monorepo 유지가 더 좋습니다.

- frontend와 backend가 같은 도메인 모델을 공유합니다.
- API, DB, 화면이 빠르게 함께 바뀌는 MVP/초기 서비스 단계입니다.
- `packages/shared`를 통해 공통 타입을 쉽게 공유할 수 있습니다.
- 하나의 PR에서 API와 화면을 함께 검증하기 쉽습니다.
- 배포도 `maeari-web`, `maeari-api`, `maeari-scheduler`로 이미 프로세스가 분리됩니다.

물리적으로 repo를 나누면 다음 비용이 생깁니다.

- API 타입 공유가 어려워집니다.
- 버전 관리가 필요합니다.
- frontend가 backend 변경을 따라가기 위해 별도 package publish 또는 git dependency가 필요합니다.
- 작은 팀에서는 동기화 비용이 커집니다.

따라서 지금은 다음 구조를 표준으로 둡니다.

```txt
apps/web    -> Frontend owner
apps/api    -> Backend owner
packages/*  -> 계약/공통 영역
```

---

## 4.2 나중에 repo 분리가 필요한 시점

아래 조건이 생기면 별도 repo 분리를 다시 검토합니다.

```txt
Frontend와 Backend 배포 주기가 완전히 달라진다.
팀원이 4명 이상으로 늘어난다.
API schema가 안정화되어 자주 바뀌지 않는다.
외부 client가 API를 사용한다.
Backend가 여러 서비스로 쪼개진다.
Frontend가 web 외에 mobile app까지 확장된다.
```

그 전까지는 monorepo에서 소유권을 나누는 방식이 더 효율적입니다.

---

## 5. API 계약 관리

Frontend와 Backend의 접점은 API입니다.

따라서 API는 다음 순서로 변경합니다.

```txt
1. Backend 담당자가 endpoint, request, response, error code 초안을 작성한다.
2. Frontend 담당자가 화면에서 필요한 필드와 상태를 검토한다.
3. 둘이 합의한 뒤 packages/shared 또는 README API 표에 계약을 기록한다.
4. Backend가 API를 구현한다.
5. Frontend가 apiFetch 호출과 UI 상태를 구현한다.
6. 둘 다 typecheck/build를 통과시킨다.
```

## 5.1 API 변경 시 반드시 적을 것

API를 추가하거나 바꿀 때는 최소한 다음을 기록합니다.

```txt
Method:
Path:
Auth required:
Request body:
Response body:
Error code:
Frontend usage page:
Backward compatibility:
```

예시:

```txt
Method: GET
Path: /api/admin/overview
Auth required: admin session
Request body: none
Response body:
  {
    overview: {
      users: number;
      messages: number;
      pendingMessages: number;
    }
  }
Error code:
  401 UNAUTHENTICATED
  403 ADMIN_FORBIDDEN
Frontend usage page:
  apps/web/app/admin/page.tsx
Backward compatibility:
  새로운 필드 추가는 가능하지만 기존 필드 제거는 frontend 수정과 함께 진행
```

---

## 5.2 공통 타입 위치와 동기화 규칙

가벼운 방식으로는 `packages/shared`에 API 타입을 둡니다.

권장 예시:

```txt
packages/shared/src/api-types.ts
packages/shared/src/enums.ts
packages/shared/src/labels.ts
```

운영 규칙:

```txt
API request/response 타입은 가능하면 packages/shared에 정의한다.
Backend가 response shape을 바꾸면 shared 타입도 같은 PR에서 수정한다.
Frontend는 가능한 한 shared 타입을 import해서 apiFetch<T>()에 사용한다.
packages/shared 변경은 Frontend와 Backend가 모두 리뷰한다.
```

예시 코드:

```ts
export type AdminOverviewResponse = {
  overview: {
    users: number;
    messages: number;
    pendingMessages: number;
    failedNotifications: number;
  };
};
```

Frontend 사용:

```ts
apiFetch<AdminOverviewResponse>("/admin/overview");
```

Backend도 같은 타입을 참고할 수 있습니다.

단, DB 내부 타입과 API response 타입은 분리합니다.

```txt
Prisma model type = DB 내부 구조
API response type = frontend에 노출되는 계약
```

즉, `packages/database`의 Prisma model은 서버 내부 구현이고, `packages/shared`의 API 타입은 frontend와 backend가 함께 지키는 공개 계약입니다.

---

## 5.3 Backward Compatibility / Deprecated 정책

`packages/shared`에 있는 기존 타입이나 필드는 바로 삭제하지 않습니다.

API response field를 rename하거나 제거해야 할 때는 일정 기간 `old field + new field`를 함께 유지합니다.

예시:

```ts
export type MessageSummaryResponse = {
  id: string;
  title: string;

  /**
   * @deprecated use deliveryStatus instead.
   * Will be removed after frontend migration is complete.
   */
  status?: string;

  deliveryStatus: string;
};
```

정책:

```txt
field rename은 old field와 new field를 잠시 함께 유지한다.
old field에는 @deprecated 주석을 단다.
Frontend 반영이 끝난 뒤 별도 PR에서 deprecated field를 제거한다.
제거 PR에는 "Frontend에서 더 이상 사용하지 않음" 검증 결과를 남긴다.
breaking change가 필요하면 ResponseV2처럼 새 타입을 추가하고 기존 타입은 유지한다.
shared 타입 삭제는 최소 한 번의 배포 사이클 이후 진행한다.
```

이 규칙의 목적은 backend 타입 변경과 frontend 반영 시점이 어긋나도 런타임 에러가 나지 않게 하는 것입니다.

---

## 6. 작업 프로세스

## 6.1 기능 개발 시작 전

기능을 시작하기 전에 10분 정도 짧게 아래를 합의합니다.

```txt
1. 이 기능이 frontend-only인지 backend-only인지 full-stack인지 정한다.
2. 필요한 API가 있는지 확인한다.
3. DB schema 변경 여부를 확인한다.
4. 화면 경로와 API 경로를 정한다.
5. packages/shared 타입 변경과 deprecated 유지 필요 여부를 확인한다.
6. 담당자와 리뷰어를 정한다.
```

예시:

```txt
기능: 관리자 notification 실패 재시도 버튼
Frontend 담당:
  /admin 화면 버튼 추가
Backend 담당:
  PATCH /api/admin/notification-logs/:id/retry 구현
공동 계약:
  성공 응답 { retried: true }
  실패 코드 NOTIFICATION_LOG_NOT_FOUND
```

---

## 6.2 브랜치 규칙

브랜치 이름은 변경 성격이 보이게 작성합니다.

```txt
frontend/admin-dashboard-ui
frontend/write-form-polish
frontend/figma-home-redesign

backend/admin-notification-retry
backend/message-report-api
backend/solapi-delivery-log

contract/admin-overview-response
contract/message-recipient-status
```

권장 기준:

```txt
frontend/* -> apps/web 중심 변경
backend/*  -> apps/api, packages/database 중심 변경
contract/* -> API 계약, packages/shared, .env.example 변경
```

---

## 6.3 Commit 규칙

commit message는 아래 prefix를 사용합니다.

```txt
feat(web): write page recipient selector
feat(api): add report review endpoint
fix(web): handle admin forbidden state
fix(api): prevent duplicate notification retry
schema(db): add message report status index
docs(team): document frontend backend workflow
chore(env): add gmail smtp env keys
```

권장 prefix:

```txt
feat(web)
fix(web)
refactor(web)

feat(api)
fix(api)
refactor(api)

schema(db)
docs
chore
```

---

## 6.4 PR 규칙

PR에는 다음을 적습니다.

```md
## 변경 요약

## 담당 영역
- [ ] Frontend
- [ ] Backend
- [ ] Shared contract
- [ ] DB schema
- [ ] Infra

## API 변경
- Method/Path:
- Request:
- Response:
- Error:
- Backward compatibility:
- Deprecated field/type:

## 검증
- [ ] pnpm --filter @maeari/web typecheck
- [ ] pnpm --filter @maeari/api typecheck
- [ ] pnpm db:validate
- [ ] pnpm build

## 화면 변경
- Figma link:
- Screenshot:

## 배포 영향
- [ ] web restart 필요
- [ ] api restart 필요
- [ ] scheduler restart 필요
- [ ] db migration 필요
- [ ] env 추가 필요
```

---

## 7. 리뷰 규칙

## 7.1 리뷰 책임

```txt
apps/web/**              -> Frontend 담당 리뷰
apps/api/**              -> Backend 담당 리뷰
packages/database/**     -> Backend 담당 리뷰 필수
packages/shared/**       -> Frontend + Backend 둘 다 리뷰
infra/**                 -> Backend 담당 리뷰
.env.example             -> Frontend + Backend 둘 다 리뷰
README.md                -> 변경 범위 담당자가 리뷰, API/env 변경이면 둘 다 리뷰
```

## 7.2 반드시 같이 리뷰해야 하는 경우

다음 변경은 두 명 모두 리뷰합니다.

```txt
API response 필드 삭제 또는 이름 변경
API error code 변경
packages/shared의 타입 삭제 또는 deprecated 제거
인증/인가 정책 변경
DB schema 변경이 화면에 영향을 주는 경우
환경 변수 추가/삭제
배포 프로세스 변경
공개 링크, 개인정보, 신고, 관리자 기능 변경
```

---

## 8. 로컬 개발

## 8.1 Frontend 담당 실행

Frontend만 작업할 때:

```bash
pnpm install
pnpm dev:web
```

Frontend가 주로 확인할 환경 변수:

```env
NEXT_PUBLIC_API_BASE_URL=/api
NEXT_PUBLIC_SERVICE_URL=http://localhost:3000
```

API 서버가 필요하면 Backend 담당자의 로컬 API를 같이 띄우거나, 같은 machine에서 다음도 실행합니다.

```bash
pnpm dev:api
```

---

## 8.2 Backend 담당 실행

Backend 작업 시:

```bash
pnpm install
docker compose up -d postgres
pnpm db:generate
pnpm db:migrate
pnpm dev:api
pnpm dev:scheduler
```

Backend가 주로 관리하는 환경 변수:

```env
DATABASE_URL=
JWT_SECRET=
KAKAO_CLIENT_ID=
KAKAO_CLIENT_SECRET=
KAKAO_REDIRECT_URI=
OPENAI_API_KEY=
OPENAI_MODERATION_MODEL=
GMAIL_SMTP_USER=
GMAIL_SMTP_APP_PASSWORD=
SOLAPI_API_KEY=
SOLAPI_API_SECRET=
ADMIN_KAKAO_IDS=
```

Frontend 담당자는 위 secret 값을 알 필요가 없습니다.

---

## 9. 환경 변수 관리

환경 변수는 다음 기준으로 나눕니다.

## 9.1 Frontend public env

브라우저에 노출되어도 되는 값만 `NEXT_PUBLIC_*`로 둡니다.

```env
NEXT_PUBLIC_API_BASE_URL=
NEXT_PUBLIC_SERVICE_URL=
```

주의:

```txt
NEXT_PUBLIC_* 값은 브라우저 번들에 포함될 수 있다.
secret, token, API key를 절대 넣지 않는다.
```

## 9.2 Backend secret env

서버에서만 읽는 값입니다.

```env
DATABASE_URL=
JWT_SECRET=
KAKAO_CLIENT_SECRET=
OPENAI_API_KEY=
GMAIL_SMTP_APP_PASSWORD=
SOLAPI_API_SECRET=
PUBLIC_TOKEN_PEPPER=
```

규칙:

```txt
.env.local, .env.production은 commit하지 않는다.
.env.example에는 key만 두거나 안전한 기본값만 둔다.
운영 secret은 Backend 담당자가 관리한다.
env key가 추가되면 .env.example과 README를 함께 수정한다.
```

---

## 10. DB schema와 migration 규칙

DB는 Backend 담당자가 관리합니다.

```txt
packages/database/prisma/schema.prisma
packages/database/prisma/migrations/**
```

규칙:

```txt
Frontend 담당자는 DB schema를 직접 수정하지 않는다.
화면에 필요한 데이터가 있으면 API response 변경 요청으로 전달한다.
Backend 담당자는 migration 생성 후 API response 변경 여부를 공유한다.
DB field를 제거하거나 rename할 때는 frontend 영향 범위를 먼저 확인한다.
```

DB 변경 프로세스:

```txt
1. Backend 담당자가 schema.prisma 수정
2. migration 생성
3. 관련 service/controller 수정
4. API response 변경 여부 공유
5. Frontend 담당자가 화면 반영
6. pnpm db:validate, pnpm typecheck, pnpm build 확인
```

---

## 11. 배포 책임

현재 운영 프로세스는 다음처럼 나눕니다.

```txt
maeari-web        -> Frontend 배포 대상
maeari-api        -> Backend 배포 대상
maeari-scheduler  -> Backend 배포 대상
nginx             -> Backend/infra 담당
postgres          -> Backend 담당
```

운영 서버에서 GitHub `main` branch의 최신 코드를 서비스에 적용할 때는 `scripts/deploy-main.sh`를 표준 배포 명령으로 사용합니다.

## 11.1 표준 자동 배포

처음 한 번만 실행 권한을 확인합니다.

```bash
chmod +x scripts/deploy-main.sh
```

일반 배포:

```bash
./scripts/deploy-main.sh
```

이 스크립트가 수행하는 작업:

```txt
1. local working tree가 clean 상태인지 확인
2. origin/main을 fetch
3. main branch로 전환
4. git pull --ff-only origin main
5. pnpm install --frozen-lockfile
6. pnpm db:validate
7. pnpm db:generate
8. pnpm --filter @maeari/api build
9. pnpm --filter @maeari/web build
10. pnpm db:deploy
11. pm2 restart maeari-api --update-env
12. pm2 restart maeari-scheduler --update-env
13. pm2 restart maeari-web --update-env
14. pm2 save
15. local API/Web health check
```

기본 health check:

```txt
API: http://127.0.0.1:4000/api/health
Web: http://127.0.0.1:3000/
```

Nginx까지 함께 재시작해야 할 때:

```bash
RESTART_NGINX=1 ./scripts/deploy-main.sh
```

DB migration이 없는 배포에서 migration 단계를 건너뛸 때:

```bash
RUN_MIGRATIONS=0 ./scripts/deploy-main.sh
```

의존성 설치를 건너뛰고 빠르게 재배포할 때:

```bash
RUN_INSTALL=0 ./scripts/deploy-main.sh
```

health check를 임시로 건너뛸 때:

```bash
SKIP_HEALTHCHECK=1 ./scripts/deploy-main.sh
```

특정 PM2 서비스만 재시작할 때:

```bash
PM2_SERVICES="maeari-web" RUN_MIGRATIONS=0 ./scripts/deploy-main.sh
PM2_SERVICES="maeari-api maeari-scheduler" ./scripts/deploy-main.sh
```

주의:

```txt
기본값은 dirty working tree 배포를 막는다.
운영 배포 전에는 변경사항을 commit/push한 뒤 실행한다.
ALLOW_DIRTY=1은 스크립트 자체 테스트나 긴급 상황에서만 사용한다.
git pull은 --ff-only이므로 서버에서 직접 수정한 파일과 충돌이 있으면 배포가 중단된다.
중단되면 에러를 먼저 해결하고 같은 명령을 다시 실행한다.
```

## 11.2 Frontend만 변경한 경우

```bash
pnpm --filter @maeari/web build
pm2 restart maeari-web
```

## 11.3 Backend API만 변경한 경우

```bash
pnpm --filter @maeari/api build
pm2 restart maeari-api
```

## 11.4 Scheduler도 변경한 경우

```bash
pnpm --filter @maeari/api build
pm2 restart maeari-api
pm2 restart maeari-scheduler
```

## 11.5 DB migration이 있는 경우

```bash
pnpm db:deploy
pnpm --filter @maeari/api build
pm2 restart maeari-api
pm2 restart maeari-scheduler
```

## 11.6 env가 추가된 경우

```txt
1. .env.example 수정
2. 운영 .env.production 값 추가
3. 관련 프로세스 재시작
4. README 또는 운영 문서에 설명 추가
```

---

## 12. 충돌 방지 규칙

## 12.1 작업 시작 전

```bash
git status
git pull --rebase
```

이미 다른 사람이 수정 중인 파일을 건드려야 하면 먼저 공유합니다.

예:

```txt
apps/web/app/write/page.tsx는 Frontend 담당 작업 중
apps/api/src/modules/messages/message.service.ts는 Backend 담당 작업 중
packages/shared/src/index.ts는 둘 다 영향 있으므로 먼저 API 계약 합의
```

## 12.2 큰 파일 주의

현재 page 파일들이 커지는 경향이 있으므로, Frontend 담당자는 화면이 커지면 component로 분리합니다.

권장:

```txt
apps/web/app/write/page.tsx
apps/web/app/write/components/RecipientSelector.tsx
apps/web/app/write/components/SchedulePicker.tsx
apps/web/app/write/components/MessageOptions.tsx
```

Backend도 module service가 커지면 domain별로 분리합니다.

권장:

```txt
apps/api/src/modules/messages/message-create.service.ts
apps/api/src/modules/messages/message-read.service.ts
apps/api/src/modules/messages/message-delivery.service.ts
```

---

## 13. 기능 유형별 담당 예시

## 13.1 Figma UI 반영

담당:

```txt
Frontend 주도
Backend는 API 변경이 있을 때만 참여
```

작업:

```txt
apps/web/app/**
apps/web/components/**
apps/web/app/globals.css
```

검증:

```bash
pnpm --filter @maeari/web typecheck
pnpm --filter @maeari/web build
```

---

## 13.2 새 API 추가

담당:

```txt
Backend 주도
Frontend는 response shape 검토
```

작업:

```txt
apps/api/src/modules/**
packages/shared/src/**
README.md
```

검증:

```bash
pnpm --filter @maeari/api typecheck
pnpm typecheck
```

---

## 13.3 DB schema 변경

담당:

```txt
Backend 단독 주도
Frontend 영향이 있으면 공동 리뷰
```

작업:

```txt
packages/database/prisma/schema.prisma
packages/database/prisma/migrations/**
apps/api/src/modules/**
```

검증:

```bash
pnpm db:validate
pnpm db:generate
pnpm --filter @maeari/api typecheck
```

---

## 13.4 관리자 화면 개선

담당:

```txt
Frontend: /admin 화면, 표, 버튼, 상태 표시
Backend: /api/admin/*, 권한, 통계 query
공동: API response 타입
```

대표 파일:

```txt
apps/web/app/admin/page.tsx
apps/api/src/modules/admin/admin.routes.ts
apps/api/src/modules/admin/admin.controller.ts
apps/api/src/modules/admin/admin.service.ts
```

---

## 14. 권장 CODEOWNERS

GitHub를 사용한다면 `.github/CODEOWNERS`를 추가하는 것을 권장합니다.

예시:

```txt
/apps/web/              @frontend-engineer
/apps/api/              @backend-engineer
/packages/database/     @backend-engineer
/packages/shared/       @frontend-engineer @backend-engineer
/infra/                 @backend-engineer
/scripts/               @backend-engineer
/.env.example           @frontend-engineer @backend-engineer
/README.md              @frontend-engineer @backend-engineer
/MAEARI_*.md            @frontend-engineer @backend-engineer
```

실제 GitHub 계정명으로 바꿔서 사용합니다.

---

## 15. 최소 검증 명령

작업 범위별 최소 검증은 다음과 같습니다.

## 15.1 Frontend 변경

```bash
pnpm --filter @maeari/web typecheck
pnpm --filter @maeari/web build
```

## 15.2 Backend 변경

```bash
pnpm --filter @maeari/api typecheck
pnpm --filter @maeari/api build
```

## 15.3 DB 변경

```bash
pnpm db:validate
pnpm db:generate
pnpm --filter @maeari/api typecheck
```

## 15.4 공통 계약 변경

```bash
pnpm typecheck
pnpm build
```

---

## 16. 최종 운영 원칙

두 명이 빠르게 개발하되 안정성을 유지하려면 다음 원칙을 지킵니다.

```txt
1. 폴더 소유권을 존중한다.
2. API 계약 변경은 반드시 공유한다.
3. packages/shared 타입은 API 계약으로 취급한다.
4. 기존 shared 타입은 deprecated 기간 없이 바로 삭제하지 않는다.
5. DB schema는 Backend 담당자가 관리한다.
6. Figma와 화면 품질은 Frontend 담당자가 관리한다.
7. packages/shared 변경은 둘 다 리뷰한다.
8. env 추가는 .env.example과 README에 반영한다.
9. 배포 전 각자 담당 영역의 build/typecheck를 통과시킨다.
10. 운영 secret은 repository에 넣지 않는다.
11. 서로의 영역을 수정해야 하면 PR 설명에 이유를 적는다.
12. 화면과 API가 동시에 바뀌는 기능은 contract를 먼저 합의한다.
```

이 프로세스의 목표는 책임을 나누되, 서비스 경험은 하나로 유지하는 것입니다.
