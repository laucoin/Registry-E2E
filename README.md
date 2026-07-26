# Registry E2E — parity suite (ADR 021)

Playwright journeys **authored against the current Angular app**, asserting
user-visible outcomes only, so the identical suite runs against the Nuxt
rewrite. Full suite green per environment gates cutover; intended differences
are recorded in [`divergence-log.md`](divergence-log.md).

## Running

Prerequisites: Keycloak (:8080) + backend (:8081) + the target app.

```bash
cp .env.example .env      # seeded test-user credentials
pnpm install && npx playwright install chromium
pnpm test:angular         # against the Angular app (:4200)
pnpm test:nuxt            # against the Nuxt app (:3000)
pnpm report               # open the HTML report
```

Auth: `tests/auth.setup.ts` signs in through the IdP UI once per target and
persists `storageState` — the only target-aware code in the suite (ADR 021's
"login fixture differs, journey doesn't").

## Findings (pre-existing v1 bugs surfaced by authoring — ADR 021's promise)

1. **Date-less project creation 500'd on the response** — the row was
   inserted, then `AvailabilityStatusReaderDtoMapper.extractLabelDuration`
   NPE'd on the null dates; the UI showed "Server error" over a successful
   insert.
2. **Creating a project locked the account out** — the auto-created,
   auto-selected creator profile has null access dates, so every subsequent
   `GET /authentication/user/current` 500'd (same mapper) until the project
   was deleted (FK `ON DELETE SET NULL` self-healed the selection).

**Status: both fixed 2026-07-25** — null availability windows now fall back to
the plain status label (null-safety guard in the shared mapper, with
regression tests; approved as a narrow exception to the v1 freeze). The
project lifecycle journey runs against both targets again. A related oddity
was left frozen: the NOT_YET/NO_MORE duration labels fire for past-start /
future-end bounds respectively — direction semantics to revisit with v2.

## Status

Reference instance: the authentication/shell journeys. Domain journeys
(projects, participants, movements, …) are added per the migration plan and
must be green against Angular before the corresponding B2 slice starts.
