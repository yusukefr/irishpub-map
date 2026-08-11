---
name: web-test-workflow
description: Add, update, or verify tests for Irish Pub Map Next.js, React, API, shared-type, search, or MapLibre changes. Use when modifying files under apps/web, packages/shared, data, or tests, or when diagnosing a test failure in this repository.
---

# Irish Pub Map Web Test Workflow

Use the repository's existing test architecture. Follow `AGENTS.md` for all
working rules, including the required validation for application changes.

1. Map the change to its nearest existing test.
   - Components and the API route: `tests/web/`.
   - Shared types and data logic: `tests/shared/`.
   - Keep test file names as `<subject>.test.ts` or `<subject>.test.tsx`.
2. Add or update a regression test for changed behavior. Use Testing Library for
   component behavior; do not assert incidental implementation details.
3. For `maplibre-gl`, use the configured alias and mock in
   `tests/mocks/maplibre-gl.ts`. Reset it with `resetMaplibreMock()` between
   tests that change mock state. Cover the WebGL fallback when map creation can
   fail.
4. Run the smallest relevant test while iterating, then run the repository
   commands before handoff:

   ```bash
   npm test
   npm run typecheck
   npm run lint
   npm run build
   ```

5. Keep the configured 90% coverage thresholds intact. Report any skipped
   command and its reason.
