# Registry-E2E

End-to-end tests for Registry, written in plain Playwright and TypeScript. Their job is to catch regressions after a
dependency upgrade or a new feature, without a manual pass through the application.

What is covered, and why, is listed in [`docs/test-plan.md`](docs/test-plan.md): every test title starts with its plan id
(e.g. `CRIT-01`), so `grep -r CRIT-01 specs` leads from the rule to the test.

## Setup

```
pnpm install && pnpm exec playwright install chromium
cp .env.example .env   # BASE_URL, API_URL, IDP, AU_PASS
pnpm test              # every test: the parallel ones, then the @exclusive ones
pnpm test:smoke        # the @smoke tests
pnpm test:ui           # Playwright UI mode, to run and debug a single test
pnpm report            # open the last HTML report (steps, screenshots and traces of failures)
```

Requires the local stack (`Registry-Backend/local-dev`: Postgres + Authentik), the backend and the frontend running.
`support/global-setup.ts` signs each seeded account in once and stores its session in `.auth/`. The login form is handled
by an adapter in `support/idp/` chosen with `IDP` (`authentik` locally, `keycloak` supported); to support another
provider, add an adapter and register it in `support/idp/index.ts`.

## Layout

| Folder        | Alias          | Content                                                                                      |
| ------------- | -------------- | -------------------------------------------------------------------------------------------- |
| `specs/`      | —              | The tests, by domain. Linear: no `if` or loop, one `test.step()` per Arrange / Act / Assert. |
| `pages/`      | `@pages/`      | One page object per screen, with business-level methods (`create`, `record`…).               |
| `components/` | `@components/` | What several screens share: element picker, form submission…                                 |
| `fixtures/`   | `@fixtures/`   | `test.extend`: injects the page objects and the `data` helper into the tests.                |
| `support/`    | `@support/`    | Tooling: accounts, sign-in, API client, test data, dates, permission matrix.                 |

A test never touches a selector: it calls page objects and asserts on the locators they expose. Page objects locate by
`data-test-id` (the frontend's attribute, configured as Playwright's `testIdAttribute`) or by accessible role and label.

A form submission goes through `FormSubmission` (`@components/form-submission.component`): when the backend rejects it,
the test fails at once with the message shown to the user, instead of waiting for the next screen until the timeout.

## Tags

- `@smoke`: the critical path, run by `pnpm test:smoke`.
- `@exclusive`: a test that changes a seeded account (block, demote, delete) or signs in through the IdP, whose login rate the backend limits; it runs alone, after the parallel ones.

## Test data

Each test creates what it needs and leaves nothing behind:

- `TestData` (the `data` fixture) creates projects, participants, groups, vehicles, activities, alerts and movements
  through the API (`support/api/`). The projects it creates, and the ones a test created through the UI and registered
  with `data.track(projectId)`, are deleted at the end of the test.
- Names carry a random suffix (`uid()` from `@support/unique`), so tests run in parallel and replay without collisions.
- `ApiClient` calls `/api/v2` as a seeded account, reusing the session cookies of `.auth/` and sending the
  `X-XSRF-TOKEN` header the backend requires on writes.
- Movement reasons follow the backend rules: a registered participant going OUT needs a reason or an activity, a guest
  coming IN needs a reason (never an activity), the other two combinations take neither.

## Test accounts (Authentik blueprint, password = AU_PASS, default dev123)

| Account         | User role          | Project role (seed)              | Notes                                   |
| --------------- | ------------------ | -------------------------------- | --------------------------------------- |
| administrator   | USER_ADMINISTRATOR | PROJECT_ADMINISTRATOR (ACCEPTED) | default account of the tests            |
| coordinator     | USER               | PROJECT_COORDINATOR (INVITED)    | must accept invitation first            |
| participant     | USER               | PROJECT_PARTICIPANT (INVITED)    | very long name/email (layout edge case) |
| blocked-user    | USER_ADMINISTRATOR | PROJECT_ADMINISTRATOR            | user blocked (not visible)              |
| blocked-profile | USER_ADMINISTRATOR | PROJECT_ADMINISTRATOR            | project profile blocked                 |

A test that needs another account declares it with `test.use({ storageState: authFile('coordinator') })`.
`support/permissions.ts` holds the expected permission matrix of each project role, read from the backend migrations.

## Local notes

- The app language is a `locale` cookie; `support/global-setup.ts` sets it to `fr` for every account, so labels and
  date formats are French.
- **The backend limits project creation to 10 per user per hour**, and every test creates its own project. Start the
  local backend with `REGISTRY_PROJECT_CREATION_RATE_LIMIT_CAPACITY=10000`, otherwise the suite fails after ten tests
  with `The submission was rejected in a toast: Tu as envoyé trop de requêtes…`.
- Personal-data exports are rate limited (5 per user per hour). Raise `REGISTRY_EXPORT_RATE_LIMIT_CAPACITY` on your local
  backend if you run the suite several times an hour.
- If every page stays blank with `504 (Outdated Optimize Dep)` in the console, the frontend dev server serves a stale
  Vite cache after a dependency upgrade: stop `ng serve`, delete `frontend/.angular/cache` and start it again.
