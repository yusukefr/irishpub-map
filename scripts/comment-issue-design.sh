#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/comment-issue-design.sh --issue 13 --body-file design.md
  scripts/comment-issue-design.sh --issue 13 --body "Design comment"

Posts the implementation plan and impact scope to the source issue before implementation.

Options:
  --issue NUMBER    Issue number to comment on. Required.
  --body BODY       Comment body text. Required unless --body-file is provided.
  --body-file FILE  Comment body file. Required unless --body is provided.
  -h, --help        Show this help.
USAGE
}

issue_number=""
body=""
body_file=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --issue)
      issue_number="${2:-}"
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

if [[ -z "$issue_number" ]]; then
  echo "--issue is required." >&2
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

if [[ -n "$body_file" ]]; then
  gh issue comment "$issue_number" --body-file "$body_file"
else
  gh issue comment "$issue_number" --body "$body"
fi
