#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
ENV_FILE="${REPO_ROOT}/.env.local"
SOURCE_BRANCH="backend"
TARGET_BRANCH="dev"
MERGE_MESSAGE="merge backend into dev for frontend integration"

read_env_value() {
  local key="$1"
  local value="${!key-}"

  if [[ -n "$value" ]]; then
    printf '%s' "$value"
    return
  fi

  if [[ ! -f "$ENV_FILE" ]]; then
    return
  fi

  local line
  line="$(grep -E "^[[:space:]]*${key}=" "$ENV_FILE" | tail -n 1 || true)"

  if [[ -z "$line" ]]; then
    return
  fi

  value="${line#*=}"
  value="${value%$'\r'}"

  if (( ${#value} >= 2 )); then
    if [[ "${value:0:1}" == '"' && "${value: -1}" == '"' ]]; then
      value="${value:1:${#value}-2}"
    elif [[ "${value:0:1}" == "'" && "${value: -1}" == "'" ]]; then
      value="${value:1:${#value}-2}"
    fi
  fi

  printf '%s' "$value"
}

GITHUB_PUSH_EMAIL="$(read_env_value GITHUB_PUSH_EMAIL)"
GITHUB_PUSH_TOKEN="$(read_env_value GITHUB_PUSH_TOKEN)"
GITHUB_PUSH_NAME="$(read_env_value GITHUB_PUSH_NAME)"

if [[ -z "$GITHUB_PUSH_EMAIL" ]]; then
  echo "Missing GITHUB_PUSH_EMAIL. Add it to .env."
  exit 1
fi

if [[ -z "$GITHUB_PUSH_TOKEN" ]]; then
  echo "Missing GITHUB_PUSH_TOKEN. Add it to .env."
  exit 1
fi

if [[ -z "$GITHUB_PUSH_NAME" ]]; then
  GITHUB_PUSH_NAME="$(git -C "$REPO_ROOT" config user.name || true)"
fi

if [[ -z "$GITHUB_PUSH_NAME" ]]; then
  GITHUB_PUSH_NAME="${GITHUB_PUSH_EMAIL%@*}"
fi

cd "$REPO_ROOT"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean. Commit and push backend changes first."
  exit 1
fi

askpass_script="$(mktemp)"
trap 'rm -f "$askpass_script"' EXIT

cat > "$askpass_script" <<'EOF'
#!/usr/bin/env bash
case "$1" in
  *Username*) printf '%s\n' "x-access-token" ;;
  *Password*) printf '%s\n' "$GITHUB_PUSH_TOKEN" ;;
  *) printf '\n' ;;
esac
EOF

chmod 700 "$askpass_script"
export GITHUB_PUSH_TOKEN

git config user.email "$GITHUB_PUSH_EMAIL"
git config user.name "$GITHUB_PUSH_NAME"

GIT_ASKPASS="$askpass_script" GIT_TERMINAL_PROMPT=0 git fetch origin \
  "+refs/heads/${SOURCE_BRANCH}:refs/remotes/origin/${SOURCE_BRANCH}" \
  "+refs/heads/${TARGET_BRANCH}:refs/remotes/origin/${TARGET_BRANCH}"

if git show-ref --verify --quiet "refs/heads/${SOURCE_BRANCH}"; then
  git switch "$SOURCE_BRANCH"
else
  git switch -c "$SOURCE_BRANCH" "origin/${SOURCE_BRANCH}"
fi
git merge --ff-only "origin/${SOURCE_BRANCH}"

if [[ "$(git rev-parse "$SOURCE_BRANCH")" != "$(git rev-parse "origin/${SOURCE_BRANCH}")" ]]; then
  echo "Local '$SOURCE_BRANCH' differs from 'origin/${SOURCE_BRANCH}'. Run scripts/github-auto-commit.sh first."
  exit 1
fi

integration_branch="backend-to-dev-$(date +%Y%m%d%H%M%S)"
git switch -c "$integration_branch" "origin/${TARGET_BRANCH}"
git merge --no-ff "$SOURCE_BRANCH" -m "$MERGE_MESSAGE"

GIT_ASKPASS="$askpass_script" GIT_TERMINAL_PROMPT=0 git push -u origin "HEAD:${TARGET_BRANCH}"

git switch "$SOURCE_BRANCH"
git branch -D "$integration_branch"
