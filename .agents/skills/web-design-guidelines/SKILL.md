---
name: web-design-guidelines
description: Review UI code for Irish Pub Map Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices".
metadata:
  author: vercel
  version: "1.0.0"
  upstream-commit: e3d624baaf29dc1fc645aff3e38f03e564d2d6b1
  argument-hint: <file-or-pattern>
---

# Web Interface Guidelines

Review UI code against the reviewed and vendored guidelines.

## Guidelines Source

Read `references/web-interface-guidelines-command.md`. It is vendored from `vercel-labs/web-interface-guidelines` commit `e3d624baaf29dc1fc645aff3e38f03e564d2d6b1`.

Do not fetch guidelines from an external branch at runtime. Update the vendored file and this commit identifier in a reviewed repository change when the criteria need to change.

## Usage

When a user provides a file or pattern argument:
1. Read `references/web-interface-guidelines-command.md` and the specified files.
2. Apply all relevant rules.
3. Respect the priority defined in `docs/design/foundation.md`: Irish Pub Map Design System, Reference Screens, Existing Components, then these guidelines.
4. Output findings using the format specified in the vendored guidelines.

If no files are specified, ask the user which files to review.
