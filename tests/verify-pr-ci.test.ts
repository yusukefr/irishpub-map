// GitHub Actionsのcheck生成遅延と実行中の状態を、外部APIを使わず再現するテストです。
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const script = resolve("scripts/verify-pr-ci.sh");

function verifyWithChecks(
  checks: string[],
  options: { dispatch?: boolean; runSha?: string; currentSha?: string } = {},
) {
  const directory = mkdtempSync(join(tmpdir(), "verify-pr-ci-"));
  const log = join(directory, "calls.log");
  const checkFile = join(directory, "checks.txt");
  const cursor = join(directory, "cursor.txt");

  writeFileSync(checkFile, `${checks.join("\n")}\n`);
  writeFileSync(cursor, "1");
  writeFileSync(log, "");
  writeFileSync(
    join(directory, "gh"),
    String.raw`#!/usr/bin/env bash
set -euo pipefail
printf 'gh %s\n' "$*" >> "$MOCK_LOG"
case "$1 $2" in
  'pr view')
    if [[ "$*" == *'--json headRefOid'* ]]; then
      printf '%s\n' "$MOCK_CURRENT_SHA"
    else
      printf '1\tOPEN\thttps://example.test/pr/1\tfeature\tsha-123\n'
    fi
    ;;
  'repo view') printf 'owner/repo\n' ;;
  'api repos/'*)
    index="$(cat "$MOCK_CURSOR")"
    line="$(sed -n "$index p" "$MOCK_CHECKS")"
    if [[ -z "$line" ]]; then line="$(tail -n 1 "$MOCK_CHECKS")"; fi
    if [[ "$line" == '-' ]]; then line=''; fi
    printf '%s\n' "$line"
    printf '%s\n' "$((index + 1))" > "$MOCK_CURSOR"
    ;;
  'workflow run') ;;
  'run list')
    if [[ -n "$MOCK_RUN_ID" && "$*" == *"$MOCK_RUN_SHA"* ]]; then
      printf '%s\n' "$MOCK_RUN_ID"
    fi
    ;;
  'run watch') ;;
  *) exit 2 ;;
esac
`,
    { mode: 0o755 },
  );
  writeFileSync(join(directory, "sleep"), '#!/usr/bin/env bash\nprintf "sleep %s\\n" "$*" >> "$MOCK_LOG"\n', {
    mode: 0o755,
  });

  try {
    const result = spawnSync("bash", [script, "--pr", "1", ...(options.dispatch ? ["--dispatch"] : [])], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${directory}:${process.env.PATH}`,
        MOCK_LOG: log,
        MOCK_CHECKS: checkFile,
        MOCK_CURSOR: cursor,
        MOCK_RUN_ID: "42",
        MOCK_RUN_SHA: options.runSha ?? "sha-123",
        MOCK_CURRENT_SHA: options.currentSha ?? "sha-123",
      },
    });
    return { result, calls: readFileSync(log, "utf8") };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe("verify-pr-ci", () => {
  it("accepts an existing successful check without dispatching", () => {
    const { result, calls } = verifyWithChecks(["completed\tsuccess\thttps://example.test/check/1"], {
      dispatch: true,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("CI passed");
    expect(calls).not.toContain("gh workflow run");
  });

  it("waits for queued and in_progress checks and returns their result", () => {
    const { result, calls } = verifyWithChecks(
      [
        "queued\t-\thttps://example.test/check/1",
        "in_progress\t-\thttps://example.test/check/1",
        "completed\tsuccess\thttps://example.test/check/1",
      ],
      { dispatch: true },
    );

    expect(result.status).toBe(0);
    expect(calls.match(/sleep 5/g)).toHaveLength(2);
    expect(calls).not.toContain("gh workflow run");
  });

  it("reports a failed normal check without dispatching", () => {
    const { result, calls } = verifyWithChecks(["completed\tfailure\thttps://example.test/check/1"], {
      dispatch: true,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("finished with failure");
    expect(calls).not.toContain("gh workflow run");
  });

  it("uses a check that appears during the missing-check polling window", () => {
    const { result, calls } = verifyWithChecks(["-", "-", "completed\tsuccess\thttps://example.test/check/1"], {
      dispatch: true,
    });

    expect(result.status).toBe(0);
    expect(calls.match(/sleep 5/g)).toHaveLength(2);
    expect(calls).not.toContain("gh workflow run");
  });

  it("dispatches only after the missing-check timeout and watches the matching SHA", () => {
    const { result, calls } = verifyWithChecks(["-"], { dispatch: true });

    expect(result.status).toBe(0);
    expect(calls.match(/sleep 5/g)).toHaveLength(18);
    expect(calls).toContain("gh workflow run ci.yml --ref feature");
    expect(calls).toContain('headSha == "sha-123"');
    expect(calls).toContain("gh run watch 42 --exit-status");
  });

  it("rejects a dispatched run whose HEAD does not match the PR", () => {
    const { result, calls } = verifyWithChecks(["-"], { dispatch: true, runSha: "sha-older" });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Could not find the dispatched CI run");
    expect(calls).not.toContain("gh run watch");
  });

  it("does not dispatch if the PR HEAD changes during the polling window", () => {
    const { result, calls } = verifyWithChecks(["-"], { dispatch: true, currentSha: "sha-new" });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("HEAD changed");
    expect(calls).not.toContain("gh workflow run");
  });
});
