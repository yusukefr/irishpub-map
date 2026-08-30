#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/verify-pr-ci.sh [--pr NUMBER|URL] [--dispatch]

Checks that the latest commit of a pull request has a successful
"Lint, Test, Build" check. With --dispatch, runs ci.yml via workflow_dispatch
when the check is missing or unsuccessful and waits for that run to finish.

Options:
  --pr PR              Pull request number or URL. Defaults to the current branch's PR.
  --dispatch           Run ci.yml manually when the latest HEAD has no successful CI.
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
check_runs="$(gh api "repos/$repo/commits/$head_sha/check-runs?per_page=100" --jq '.check_runs[] | select(.name == "Lint, Test, Build") | [.status, (.conclusion // ""), .html_url] | @tsv')"

if while IFS=$'\t' read -r status conclusion url; do
  [[ "$status" == "completed" && "$conclusion" == "success" ]] && {
    echo "CI passed for PR #$pr_number at $head_sha"
    echo "$url"
    exit 0
  }
done <<< "$check_runs"; then
  :
fi

echo "No successful Lint, Test, Build check found for PR #$pr_number at $head_sha." >&2
echo "$pr_url" >&2

if [[ "$dispatch" != true ]]; then
  echo "Run with --dispatch to start ci.yml for the latest branch HEAD." >&2
  exit 1
fi

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
echo "Manual CI passed for PR #$pr_number at $head_sha (workflow_dispatch run $run_id)."
echo "workflow_dispatch may not appear as a pull_request check on the PR page."
