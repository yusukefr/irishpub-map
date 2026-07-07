#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/create-pr.sh --title "PR title" --body-file pr-body.md [--issue 10] [--base main] [--head branch]
  scripts/create-pr.sh --title "PR title" --body "PR body" [--issue 10] [--base main] [--head branch]

Creates a pull request and applies the project-required metadata:
- Labels: copied from the source issue when --issue is provided, otherwise "ai-agent"
- Reviewers: yusukefr
- Assignees: yf-ai-agent

Options:
  --issue NUMBER       Source issue number. Its labels are copied to the PR.
  --title TITLE        Pull request title. Required.
  --body BODY          Pull request body text. Required unless --body-file is provided.
  --body-file FILE     Pull request body file. Required unless --body is provided.
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
reviewer="yusukefr"
assignee="yf-ai-agent"
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

if [[ -n "$body" && -n "$body_file" ]]; then
  echo "Use either --body or --body-file, not both." >&2
  usage >&2
  exit 2
fi

if [[ -z "$body" && -z "$body_file" ]]; then
  echo "Either --body or --body-file is required." >&2
  usage >&2
  exit 2
fi

if [[ -n "$body_file" && ! -f "$body_file" ]]; then
  echo "Body file not found: $body_file" >&2
  exit 2
fi

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

if [[ -n "$body_file" ]]; then
  create_args+=(--body-file "$body_file")
else
  create_args+=(--body "$body")
fi

pr_url="$(gh pr create "${create_args[@]}")"

gh pr edit "$pr_url" \
  --add-label "$labels" \
  --add-reviewer "$reviewer" \
  --add-assignee "$assignee"

echo "$pr_url"
