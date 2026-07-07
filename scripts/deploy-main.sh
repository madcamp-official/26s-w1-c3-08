#!/usr/bin/env bash
set -Eeuo pipefail

# Deploy the latest GitHub main branch to the running Maeari PM2 services.
#
# Default flow:
#   1. refuse deploy if the local working tree is dirty
#   2. fetch + fast-forward pull origin/main
#   3. install dependencies
#   4. validate/generate Prisma client
#   5. build API and Web
#   6. deploy DB migrations
#   7. restart PM2 services with updated env
#   8. run local health checks
#
# Optional overrides:
#   REMOTE=origin
#   BRANCH=main
#   ALLOW_DIRTY=1
#   RUN_INSTALL=0
#   RUN_DB_VALIDATE=0
#   RUN_DB_GENERATE=0
#   RUN_BUILD=0
#   RUN_MIGRATIONS=0
#   RESTART_NGINX=1
#   SKIP_HEALTHCHECK=1
#   DEPLOY_NODE_ENV=production
#   DEPLOY_CI=true
#   PM2_SERVICES="maeari-api maeari-scheduler maeari-web"
#   API_HEALTH_URL=http://127.0.0.1:4000/api/health
#   WEB_HEALTH_URL=http://127.0.0.1:3000/
#
# Env loading:
#   The script loads .env.local, .env.production, then .env if present.
#   Existing shell environment variables take precedence and are not overwritten.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

REMOTE="${REMOTE:-origin}"
BRANCH="${BRANCH:-main}"
ALLOW_DIRTY="${ALLOW_DIRTY:-0}"

RUN_INSTALL="${RUN_INSTALL:-1}"
RUN_DB_VALIDATE="${RUN_DB_VALIDATE:-1}"
RUN_DB_GENERATE="${RUN_DB_GENERATE:-1}"
RUN_BUILD="${RUN_BUILD:-1}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-1}"
RESTART_NGINX="${RESTART_NGINX:-0}"
SKIP_HEALTHCHECK="${SKIP_HEALTHCHECK:-0}"
DEPLOY_NODE_ENV="${DEPLOY_NODE_ENV:-production}"
DEPLOY_CI="${DEPLOY_CI:-true}"

PM2_SERVICES="${PM2_SERVICES:-maeari-api maeari-scheduler maeari-web}"
API_HEALTH_URL="${API_HEALTH_URL:-http://127.0.0.1:4000/api/health}"
WEB_HEALTH_URL="${WEB_HEALTH_URL:-http://127.0.0.1:3000/}"

log() {
  printf '\033[1;34m[deploy]\033[0m %s\n' "$*"
}

warn() {
  printf '\033[1;33m[warn]\033[0m %s\n' "$*" >&2
}

die() {
  printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2
  exit 1
}

on_error() {
  local exit_code=$?
  printf '\033[1;31m[error]\033[0m deploy failed at line %s: %s\n' "$1" "$2" >&2
  exit "$exit_code"
}

trap 'on_error "$LINENO" "$BASH_COMMAND"' ERR

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

run_step() {
  log "$1"
  shift
  "$@"
}

load_env_file() {
  local file="$1"
  local line key value

  [[ -f "$file" ]] || return 0

  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"

    [[ -z "$line" ]] && continue
    [[ "$line" =~ ^[[:space:]]*# ]] && continue

    line="${line#export }"

    [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] || continue

    key="${line%%=*}"
    value="${line#*=}"

    if [[ "$value" == \"*\" && "$value" == *\" ]]; then
      value="${value:1:${#value}-2}"
    elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
      value="${value:1:${#value}-2}"
    fi

    if [[ ! -v "$key" ]]; then
      export "$key=$value"
    fi
  done < "$file"

  log "Loaded env file: $file"
}

load_env_files() {
  load_env_file ".env.local"
  load_env_file ".env.production"
  load_env_file ".env"
}

set_deploy_node_env() {
  if [[ "${NODE_ENV:-}" != "$DEPLOY_NODE_ENV" ]]; then
    warn "Overriding NODE_ENV='${NODE_ENV:-unset}' with NODE_ENV='$DEPLOY_NODE_ENV' for deploy."
  fi

  export NODE_ENV="$DEPLOY_NODE_ENV"
  export CI="${CI:-$DEPLOY_CI}"
}

check_disk_space() {
  local free_mb
  free_mb="$(df -Pm "$ROOT_DIR" | awk 'NR == 2 { print $4 }')"
  if [[ -n "$free_mb" && "$free_mb" -lt 512 ]]; then
    warn "Free disk space is under 512MB (${free_mb}MB). Build or install may fail."
  fi
}

ensure_clean_worktree() {
  if [[ "$ALLOW_DIRTY" == "1" ]]; then
    warn "ALLOW_DIRTY=1 set. Deploying with local uncommitted changes."
    return
  fi

  if [[ -n "$(git status --porcelain)" ]]; then
    git status --short
    die "Working tree is not clean. Commit/stash local changes first, or run with ALLOW_DIRTY=1."
  fi
}

switch_to_branch() {
  git fetch --prune "$REMOTE"

  if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
    git switch "$BRANCH"
  else
    git switch -c "$BRANCH" --track "$REMOTE/$BRANCH"
  fi
}

pull_latest() {
  local old_rev new_rev
  old_rev="$(git rev-parse --short HEAD)"

  run_step "Pulling latest $REMOTE/$BRANCH with fast-forward only" \
    git pull --ff-only "$REMOTE" "$BRANCH"

  new_rev="$(git rev-parse --short HEAD)"

  if [[ "$old_rev" == "$new_rev" ]]; then
    log "Already up to date at $new_rev"
  else
    log "Updated $old_rev -> $new_rev"
    git log --oneline "${old_rev}..${new_rev}" || true
  fi
}

ensure_pm2_services_exist() {
  local service
  read -r -a service_list <<< "$PM2_SERVICES"

  for service in "${service_list[@]}"; do
    pm2 describe "$service" >/dev/null 2>&1 || die "PM2 service not found: $service"
  done
}

restart_pm2_services() {
  local service
  read -r -a service_list <<< "$PM2_SERVICES"

  for service in "${service_list[@]}"; do
    run_step "Restarting PM2 service: $service" pm2 restart "$service" --update-env
  done

  run_step "Saving PM2 process list" pm2 save
}

check_url() {
  local label="$1"
  local url="$2"
  log "Health check: $label ($url)"
  if ! curl -fsS \
    --retry 10 \
    --retry-connrefused \
    --retry-all-errors \
    --retry-delay 2 \
    --max-time 10 \
    "$url" >/dev/null 2>&1; then
    curl -fsS --max-time 10 "$url" >/dev/null
  fi
}

main() {
  cd "$ROOT_DIR"

  require_command git
  require_command pnpm
  require_command pm2
  require_command curl

  [[ -d .git ]] || die "Not a git repository: $ROOT_DIR"

  log "Repository: $ROOT_DIR"
  log "Target branch: $REMOTE/$BRANCH"

  load_env_files
  set_deploy_node_env

  check_disk_space
  ensure_clean_worktree
  switch_to_branch
  pull_latest
  ensure_pm2_services_exist

  if [[ "$RUN_INSTALL" == "1" ]]; then
    run_step "Installing dependencies" pnpm install --frozen-lockfile
  fi

  if [[ "$RUN_DB_VALIDATE" == "1" ]]; then
    run_step "Validating Prisma schema" pnpm db:validate
  fi

  if [[ "$RUN_DB_GENERATE" == "1" ]]; then
    run_step "Generating Prisma client" pnpm db:generate
  fi

  if [[ "$RUN_BUILD" == "1" ]]; then
    run_step "Building API" pnpm --filter @maeari/api build
    run_step "Building Web" pnpm --filter @maeari/web build
  fi

  if [[ "$RUN_MIGRATIONS" == "1" ]]; then
    run_step "Deploying database migrations" pnpm db:deploy
  fi

  restart_pm2_services

  if [[ "$RESTART_NGINX" == "1" ]]; then
    run_step "Testing Nginx config" sudo nginx -t
    run_step "Restarting Nginx" sudo systemctl restart nginx
  fi

  if [[ "$SKIP_HEALTHCHECK" != "1" ]]; then
    check_url "api" "$API_HEALTH_URL"
    check_url "web" "$WEB_HEALTH_URL"
  fi

  log "PM2 status"
  pm2 status --no-color

  log "Deploy complete."
}

main "$@"
