#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/verify-pr-ci.sh [--pr NUMBER|URL] [--dispatch]

Waits for the latest commit of a pull request to receive a completed
"Lint, Test, Build" check. With --dispatch, runs ci.yml via workflow_dispatch
only if the check has not appeared after 90 seconds.

Options:
  --pr PR              Pull request number or URL. Defaults to the current branch's PR.
  --dispatch           Run ci.yml manually if no check appears within 90 seconds.
  -h, --help           Show this help.
USAGE
}

pr_ref=""
dispatch=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pr)
      pr_ref="${2:-}"
      shift 2
      ;;
    --dispatch)
      dispatch=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -n "$pr_ref" ]]; then
  pr_data="$(gh pr view "$pr_ref" --json number,state,url,headRefName,headRefOid --jq '[.number, .state, .url, .headRefName, .headRefOid] | @tsv')"
else
  pr_data="$(gh pr view --json number,state,url,headRefName,headRefOid --jq '[.number, .state, .url, .headRefName, .headRefOid] | @tsv')"
fi

IFS=$'\t' read -r pr_number pr_state pr_url head_branch head_sha <<< "$pr_data"

if [[ "$pr_state" != "OPEN" ]]; then
  echo "Pull request #$pr_number is not open: $pr_state" >&2
  exit 1
fi

repo="$(gh repo view --json nameWithOwner --jq '.nameWithOwner')"
missing_polls=0
active_polls=0

ensure_latest_head() {
  local current_sha
  current_sha="$(gh pr view "$pr_number" --json headRefOid --jq '.headRefOid')"
  if [[ "$current_sha" != "$head_sha" ]]; then
    echo "PR #$pr_number HEAD changed while waiting for CI. Run this command again." >&2
    exit 1
  fi
}

while true; do
  # 同じ HEAD の再実行がある場合は、古い成功ではなく最新の check を判定する。
  check_run="$(gh api "repos/$repo/commits/$head_sha/check-runs?per_page=100" --jq '[.check_runs[] | select(.name == "Lint, Test, Build")] | max_by(.id) | if . == null then empty else [.status, (.conclusion // "-"), .html_url] | @tsv end')"

  if [[ -z "$check_run" ]]; then
    if (( missing_polls >= 18 )); then
      break
    fi
    ((missing_polls += 1))
    sleep 5
    continue
  fi

  IFS=$'\t' read -r status conclusion url <<< "$check_run"
  if [[ "$status" == "completed" ]]; then
    if [[ "$conclusion" == "success" ]]; then
      ensure_latest_head
      echo "CI passed for PR #$pr_number at $head_sha"
      echo "$url"
      exit 0
    fi
    echo "CI finished with $conclusion for PR #$pr_number at $head_sha." >&2
    echo "$url" >&2
    exit 1
  fi

  if (( active_polls >= 240 )); then
    echo "Timed out waiting for the existing CI check for PR #$pr_number at $head_sha." >&2
    echo "$url" >&2
    exit 1
  fi
  ((active_polls += 1))
  sleep 5
done

echo "No Lint, Test, Build check appeared for PR #$pr_number at $head_sha after 90 seconds." >&2
echo "$pr_url" >&2

if [[ "$dispatch" != true ]]; then
  echo "Run with --dispatch to start ci.yml for the latest branch HEAD." >&2
  exit 1
fi

ensure_latest_head
gh workflow run ci.yml --ref "$head_branch"

run_id=""
for _ in {1..30}; do
  run_id="$(gh run list --workflow ci.yml --branch "$head_branch" --limit 20 --json databaseId,event,status,headSha --jq "first(.[] | select(.event == \"workflow_dispatch\" and .headSha == \"$head_sha\")) | .databaseId // \"\"")"
  if [[ -n "$run_id" ]]; then
    break
  fi
  sleep 2
done

if [[ -z "$run_id" ]]; then
  echo "Could not find the dispatched CI run for $head_sha." >&2
  exit 1
fi

gh run watch "$run_id" --exit-status
ensure_latest_head
echo "Manual CI passed for PR #$pr_number at $head_sha (workflow_dispatch run $run_id)."
echo "workflow_dispatch may not appear as a pull_request check on the PR page."
