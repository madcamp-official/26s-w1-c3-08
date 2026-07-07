#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
ENV_FILE="${REPO_ROOT}/.env.local"
SOURCE_BRANCH="backend"
TARGET_BRANCHES=("backend" "dev")

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
configured_source_branch="$(read_env_value GITHUB_PUSH_SOURCE_BRANCH)"
configured_branches="$(read_env_value GITHUB_PUSH_BRANCHES)"
configured_branch="$(read_env_value GITHUB_PUSH_BRANCH)"

if [[ -n "$configured_source_branch" ]]; then
  SOURCE_BRANCH="$configured_source_branch"
fi

if [[ -n "$configured_branches" ]]; then
  normalized_branches="${configured_branches//,/ }"
  # shellcheck disable=SC2206
  TARGET_BRANCHES=($normalized_branches)
elif [[ -n "$configured_branch" ]]; then
  TARGET_BRANCHES=("$configured_branch")
fi

if (( ${#TARGET_BRANCHES[@]} == 0 )); then
  echo "No target branches configured."
  exit 1
fi

for target_branch in "${TARGET_BRANCHES[@]}"; do
  if [[ "$target_branch" == "main" || "$target_branch" == "master" ]]; then
    echo "Refusing to push to protected branch '$target_branch'. Use backend/dev handoff branches."
    exit 1
  fi
done

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

current_branch="$(git branch --show-current)"

if [[ -z "$current_branch" ]]; then
  echo "Detached HEAD is not supported."
  exit 1
fi

if [[ -n "$SOURCE_BRANCH" && "$current_branch" != "$SOURCE_BRANCH" ]]; then
  echo "Run this script from '$SOURCE_BRANCH' branch. Current branch: '$current_branch'."
  exit 1
fi

git config user.email "$GITHUB_PUSH_EMAIL"
git config user.name "$GITHUB_PUSH_NAME"
git add .

if git diff --cached --quiet; then
  echo "No changes to commit. Pushing existing HEAD to target branches."
else
  read -r -p "Commit message: " COMMIT_MESSAGE

  if [[ -z "$COMMIT_MESSAGE" ]]; then
    echo "Commit message is required."
    exit 1
  fi

  git commit -m "$COMMIT_MESSAGE"
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

for target_branch in "${TARGET_BRANCHES[@]}"; do
  if [[ "$target_branch" == "$current_branch" ]]; then
    GIT_ASKPASS="$askpass_script" GIT_TERMINAL_PROMPT=0 git push -u origin "HEAD:${target_branch}"
  else
    GIT_ASKPASS="$askpass_script" GIT_TERMINAL_PROMPT=0 git push origin "HEAD:${target_branch}"
  fi
done
