# Agent instructions — Registry-E2E

These instructions apply to ALL AI agents (Claude Code, Copilot, Cursor, or any other assistant) generating or modifying
code in this repository. They are permanent project policy, not suggestions.

## Repository overview

Playwright end-to-end suite for Registry, run against the Nuxt app (`--project=nuxt`, plus
`--project=nuxt-session` for the session-lifetime journeys). Tests live in
`tests/`, shared helpers in `tests/support/`. Lint with `pnpm lint`; run with
`pnpm test:nuxt` / `pnpm test:nuxt-session`.

## Code comment policy (strict — enforced)

Only three kinds of comment may exist in this repository. Everything else is removed on sight.

### Mandatory — test structure markers

`// Arrange`, `// Act`, and `// Assert` (including combined forms such as `// Act + Assert`) must NEVER be deleted,
reworded, or moved. When they exist, preserve them exactly; they are exempt from every removal rule below.

### Allowed — one block comment above a complex declaration

A single **JSDoc block comment (`/** … */`)** placed DIRECTLY above a genuinely complex or non-obvious test, function,
hook or `test.describe` — explaining its intent, its high-level logic, or a constraint the code cannot express (a
backend rule, a third-party quirk such as Ant Design widget behaviour). Requirements:

- Written in clear English, as a `/** … */` block. Never use a `//` block for documentation.
- Placed immediately above the declaration it documents (no blank line between), never inside the body.
- Explains WHY, not a line-by-line account of the implementation.
- A suite whose scope and constraints are obvious from its file name and its test titles gets no comment at all.

### Not comments under this policy

Tooling directives (`// @ts-check`, `// eslint-disable*`, `// @ts-expect-error`, triple-slash references) — keep them
where the tooling needs them.

### Forbidden, without exception

- Inline explanation comments on or between statements inside a function or test body, and end-of-line (trailing)
  comments — the test structure markers above are the only in-body comments allowed anywhere.
- Step-by-step narrative comments that restate what the next lines do (e.g. `// Delete it.`,
  `// Back to the dashboard.`), and section dividers.
- Commented-out code.
- Any comment that repeats what the code already says (names, types, obvious control flow).
- **References to an ADR or to any decision-record number.** Rationale worth keeping is stated in the test's own terms;
  the ADR set lives in the Documentations repository and is never cited from source. References to the functional
  documentation pages (`critical-scenarios.md`, `roles-and-permissions.md`, …) stay — they name the behaviour under
  test.

### Rule for future code generation

When generating, refactoring, or reviewing any code in this repository:

1. The default for any line of code is NO comment.
2. Strictly preserve `// Arrange`, `// Act`, `// Assert` comments wherever they appear.
3. Document only genuinely complex declarations, with a single JSDoc block directly above them.
4. Never write an ADR reference into a comment.

## Reported bugs — check the documentation before fixing

When the user reports a bug, or disputes behaviour a test asserts, treat the documentation as part of the investigation
rather than as background reading.

1. **Find what the docs claim** about the behaviour — the feature page, the roles/permissions matrix, the API reference,
   and the journey scenarios in `critical-scenarios.md`.
2. **Decide which side is wrong.** The reported behaviour, the code, and the docs are three independent claims; a
   disagreement between them is itself the finding. Where a page names an authoritative source (for example,
   roles-and-permissions.md defers to the seed migrations for the permission matrix), that source wins over the prose.
3. **Fix the documentation in the same change as the code.** A bug fix that leaves the docs asserting the old, wrong
   behaviour just moves the defect. If the docs were right and the code was wrong, say so explicitly in the change; if
   the docs were wrong, correct them and keep the scenario list in step.
4. **Never silently loosen a test to match observed behaviour.** Establish which behaviour is correct first, then align
   the test with that — citing the authority you relied on.
5. **Report contradictions you cannot resolve** instead of picking a side; they usually mean a decision is owed.
