#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
ENV_FILE="${REPO_ROOT}/.env.local"
TARGET_BRANCH="main"

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
configured_branch="$(read_env_value GITHUB_PUSH_BRANCH)"

if [[ -n "$configured_branch" ]]; then
  TARGET_BRANCH="$configured_branch"
fi

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

read -r -p "Commit message: " COMMIT_MESSAGE

if [[ -z "$COMMIT_MESSAGE" ]]; then
  echo "Commit message is required."
  exit 1
fi

cd "$REPO_ROOT"

git config user.email "$GITHUB_PUSH_EMAIL"
git config user.name "$GITHUB_PUSH_NAME"
git add .

if git diff --cached --quiet; then
  echo "No changes to commit."
  exit 0
fi

git commit -m "$COMMIT_MESSAGE"

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

GIT_ASKPASS="$askpass_script" GIT_TERMINAL_PROMPT=0 git push -u origin "$TARGET_BRANCH"
