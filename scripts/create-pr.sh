#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/create-pr.sh --title "PR title" --body-file pr-body.md [--issue 10] [--base main] [--head branch]

Creates a pull request and applies the project-required metadata:
- Labels: copied from the source issue when --issue is provided, otherwise "ai-agent"
- Reviewers: optional via PR_REVIEWER
- Assignees: optional via PR_ASSIGNEE

Options:
  --issue NUMBER       Source issue number. Its labels are copied to the PR.
  --title TITLE        Pull request title. Required.
  --body BODY          Deprecated. Pull request bodies must be provided with --body-file.
  --body-file FILE     Pull request body file based on .github/pull_request_template.md. Required.
  --base BRANCH        Base branch. Defaults to main.
  --head BRANCH        Head branch. Defaults to the current branch.
  -h, --help           Show this help.
USAGE
}

issue_number=""
title=""
body=""
body_file=""
base_branch="main"
head_branch=""
reviewer="${PR_REVIEWER:-}"
assignee="${PR_ASSIGNEE:-}"
default_label="ai-agent"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --issue)
      issue_number="${2:-}"
      shift 2
      ;;
    --title)
      title="${2:-}"
      shift 2
      ;;
    --body)
      body="${2:-}"
      shift 2
      ;;
    --body-file)
      body_file="${2:-}"
      shift 2
      ;;
    --base)
      base_branch="${2:-}"
      shift 2
      ;;
    --head)
      head_branch="${2:-}"
      shift 2
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

if [[ -z "$title" ]]; then
  echo "--title is required." >&2
  usage >&2
  exit 2
fi

if [[ -n "$body" ]]; then
  echo "Use --body-file based on .github/pull_request_template.md for pull request bodies." >&2
  exit 2
fi

if [[ -z "$body_file" ]]; then
  echo "--body-file based on .github/pull_request_template.md is required." >&2
  usage >&2
  exit 2
fi

if [[ ! -f "$body_file" ]]; then
  echo "Body file not found: $body_file" >&2
  exit 2
fi

template_sections=("## Summary" "## Issue" "## Changes" "## Verification" "## Notes")

for section in "${template_sections[@]}"; do
  if ! grep -Fqx -- "$section" "$body_file"; then
    echo "PR body file must include the template section: $section" >&2
    exit 2
  fi
done

verification_commands=("npm run typecheck" "npm run lint" "npm run build" "npm audit --omit=dev")

for command in "${verification_commands[@]}"; do
  if ! grep -Fq -- "\`$command\`" "$body_file"; then
    echo "PR body file must include the template verification item: $command" >&2
    exit 2
  fi
done

if [[ -z "$head_branch" ]]; then
  head_branch="$(git branch --show-current)"
fi

if [[ -z "$head_branch" ]]; then
  echo "Could not determine the current branch. Use --head." >&2
  exit 2
fi

labels="$default_label"

if [[ -n "$issue_number" ]]; then
  labels="$(gh issue view "$issue_number" --json labels --jq '[.labels[].name] | join(",")')"

  if [[ -z "$labels" ]]; then
    labels="$default_label"
  fi
fi

create_args=(--base "$base_branch" --head "$head_branch" --title "$title")

create_args+=(--body-file "$body_file")

pr_url="$(gh pr create "${create_args[@]}")"

gh pr edit "$pr_url" --add-label "$labels"

if [[ -n "$reviewer" ]]; then
  gh pr edit "$pr_url" --add-reviewer "$reviewer"
fi

if [[ -n "$assignee" ]]; then
  gh pr edit "$pr_url" --add-assignee "$assignee"
fi

echo "$pr_url"
