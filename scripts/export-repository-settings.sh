#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/export-repository-settings.sh [--output FILE]

Exports the repository settings used by the project documentation.
Requires an authenticated gh CLI with read access to the repository.
USAGE
}

repository="${GH_REPO:-yusukefr/irishpub-map}"
output_file="${1:-docs/repository-settings/repository-settings.json}"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ "${1:-}" == "--output" ]]; then
  output_file="${2:-}"
fi

if [[ -z "$output_file" || ( "${1:-}" == "--output" && $# -ne 2 ) || ( "${1:-}" != "--output" && $# -gt 1 ) ]]; then
  echo "Invalid arguments." >&2
  usage >&2
  exit 2
fi

output_dir="$(dirname "$output_file")"
mkdir -p "$output_dir"
temporary_dir="$(mktemp -d)"
trap 'rm -rf "$temporary_dir"' EXIT

gh api "repos/$repository" > "$temporary_dir/repository.json"
gh api "repos/$repository/actions/permissions" > "$temporary_dir/actions-permissions.json"
gh api "repos/$repository/actions/permissions/workflow" > "$temporary_dir/workflow-permissions.json"

if gh api "repos/$repository/branches/main/protection" > "$temporary_dir/branch-protection.json" 2> "$temporary_dir/branch-protection.error"; then
  :
else
  printf 'null\n' > "$temporary_dir/branch-protection.json"
fi

gh api "repos/$repository/rulesets" > "$temporary_dir/rulesets.json"
while IFS= read -r ruleset_id; do
  gh api "repos/$repository/rulesets/$ruleset_id" > "$temporary_dir/ruleset-$ruleset_id.json"
done < <(node -e 'for (const ruleset of JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))) console.log(ruleset.id)' "$temporary_dir/rulesets.json")

node - "$temporary_dir" "$repository" "$output_file" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const [temporaryDir, repository, outputFile] = process.argv.slice(2);
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(temporaryDir, file), "utf8"));
const rulesets = readJson("rulesets.json");

const settings = {
  exported_at: new Date().toISOString(),
  repository: {
    name: repository,
    settings: readJson("repository.json"),
  },
  actions: {
    permissions: readJson("actions-permissions.json"),
    workflow_permissions: readJson("workflow-permissions.json"),
  },
  branch_protection: {
    branch: "main",
    settings: readJson("branch-protection.json"),
  },
  rulesets: rulesets.map(({ id }) => readJson(`ruleset-${id}.json`)),
};

fs.writeFileSync(outputFile, `${JSON.stringify(settings, null, 2)}\n`);
NODE

echo "Exported repository settings to $output_file"
