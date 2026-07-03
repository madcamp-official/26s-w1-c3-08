# 마음도착 MVP

예약 메시지 서비스 **마음도착** MVP 구현체입니다.

이 저장소는 `MAEUM_ARRIVAL_PLAN.md`, `MAEUM_ARRIVAL_IA.md`, `MAEUM_ARRIVAL_DB_SCHEMA.md`를 기준으로 구성되었습니다.

## 구현 범위

- 카카오 OAuth 로그인
- HttpOnly cookie 기반 세션
- 메시지 작성 및 예약
- OpenAI Moderation 기반 유해성 검사
- Moderation API 실패 시 즉시 재시도 및 `MODERATION_FAILED` 보관
- 하루 1회 moderation 재검사 scheduler
- 비회원 공개 링크 열람
- 공개 링크 열람 후 가입 시 수신함 자동 귀속
- 발신함, 수신함, 상세 화면
- 예약 발송 scheduler
- `EventEmitter` 기반 `NotificationProcessor`
- Nginx reverse proxy template

## 원칙

- mock 파일을 만들지 않습니다.
- dummy 데이터를 만들지 않습니다.
- seed 데이터를 만들지 않습니다.
- fake provider 성공 응답을 만들지 않습니다.
- 외부 연동값은 `.env.local` 또는 `.env.production`에서만 주입합니다.

## 구조

```txt
apps/
  api/     Express API, scheduler
  web/     Next.js frontend
packages/
  database Prisma schema/client wrapper
  shared   shared labels/types
infra/
  nginx    Nginx config template
```

## 환경 변수

필요한 key 목록은 `.env.example`을 기준으로 합니다. 실제 값은 비워두었고, 런타임에 `.env.local` 또는 `.env.production`으로 제공해야 합니다.

필수 환경 변수가 없으면 API 서버는 시작 단계에서 실패합니다.

## 개발 명령

```bash
pnpm install
DATABASE_URL="<postgres-url>" pnpm db:generate
DATABASE_URL="<postgres-url>" pnpm db:migrate
pnpm dev:api
pnpm dev:web
pnpm dev:scheduler
```

## 검증 명령

```bash
DATABASE_URL="<postgres-url>" pnpm db:validate
DATABASE_URL="<postgres-url>" pnpm db:generate
pnpm typecheck
NEXT_PUBLIC_API_BASE_URL="<api-url>" NEXT_PUBLIC_SERVICE_URL="<web-url>" pnpm build
```

## 배포 메모

Nginx 설정은 `infra/nginx/maeum-arrival.conf.template`를 사용합니다.

```bash
SERVICE_DOMAIN="<domain>" \
WWW_SERVICE_DOMAIN="<www-domain>" \
API_PORT="<api-port>" \
WEB_PORT="<web-port>" \
./scripts/render-nginx.sh
```

