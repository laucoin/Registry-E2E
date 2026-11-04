# Registry-E2E

End-to-end tests for Registry (Playwright + playwright-bdd). Gherkin scenarios live in `features/`.

Status: **phase 3** - every scenario that is not `@wip` has its step definitions; the suite runs against the local stack.

## Setup

```
npm install && npx playwright install chromium
cp .env.example .env   # BASE_URL, API_URL, IDP, AU_PASS
npm test               # every scenario that is not @wip
npm run test:smoke     # the @smoke scenarios
FEATURES=features/movements/movement-create.feature npm run test:feature   # one or several feature files (comma-separated)
```

Requires the local stack (`Registry-Backend/local-dev`: Postgres + Authentik), the backend and the frontend running.
`support/global-setup.ts` signs each seeded account in once and stores its session in `.auth/`. The login form is handled by an adapter in `support/idp/` chosen with `IDP` (`authentik` locally, `keycloak` supported); to support another provider, add an adapter and register it in `support/idp/index.ts`. The adapters are untested against the real login pages.

## Tags

- Domain: `@auth` `@access` `@projects` `@movements` `@config`
- Run scope: `@smoke`, `@critical` (the end-to-end path of a stay, see `features/critical/`)
- Actor: `@role-user-admin` `@role-user` `@role-project-admin` `@role-coordinator` `@role-participant` `@role-support`
- `@exclusive`: scenario that changes a seeded account (block, demote, delete); it runs alone, after the parallel ones
- `@all-roles`: the feature also runs as the project coordinator and the project participant (see "Running as every role")
- `@needs:<PERMISSION>` (e.g. `@needs:PARTICIPANT_C`, `@needs:U`): the scenario is skipped for roles without that project permission
- `@only:<ROLE>` (e.g. `@only:PROJECT_ADMINISTRATOR`): the scenario switches account itself, so it runs for that role only
- `@wip`: a scenario kept out of the runs until a decision is made (none today)

## Test accounts (Authentik blueprint, password = AU_PASS, default dev123)

| Account         | User role          | Project role (seed)              | Notes                                   |
| --------------- | ------------------ | -------------------------------- | --------------------------------------- |
| administrator   | USER_ADMINISTRATOR | PROJECT_ADMINISTRATOR (ACCEPTED) |                                         |
| coordinator     | USER               | PROJECT_COORDINATOR (INVITED)    | must accept invitation first            |
| participant     | USER               | PROJECT_PARTICIPANT (INVITED)    | very long name/email (layout edge case) |
| blocked-user    | USER_ADMINISTRATOR | PROJECT_ADMINISTRATOR            | user blocked (not visible)              |
| blocked-profile | USER_ADMINISTRATOR | PROJECT_ADMINISTRATOR            | project profile blocked                 |

## Running as every role

`npm test` runs five Playwright projects: `parallel` (administrator), `role-coordinator`, `role-participant` (only the `@all-roles` scenarios, with that role's account),
`matrix` and `exclusive`. A feature opts in with `@all-roles` and logs in with `Soit je suis connecté avec mon rôle`.

- The permission matrix is **not written in the features**. `support/permissions.ts` reads the authorities the backend grants (`/authentication/user/current`) and holds a snapshot of the
  documented matrix; `tests/permission-matrix.spec.ts` fails when the two differ, and `tests/permission-denials.spec.ts` checks that every right a role lacks is refused (403).
- Skipped scenarios are not lost: the refusal is what `permission-denials` verifies, the nominal path is what the role that holds the permission runs.
- A project a scenario creates through `TestData.projectNamed` gives the logged-in account its role, so the same steps work for every role.

## Local backend notes

- The app language is a `locale` cookie; `support/global-setup.ts` sets it to `fr` for every account (the features and date formats are French).
- Personal-data exports are rate limited (5 per user per hour). Raise `REGISTRY_EXPORT_RATE_LIMIT_CAPACITY` on your local backend if you run the suite several times an hour.
- `npm run test:feature` runs every project at once, including `@exclusive` scenarios that block seeded accounts: use `npm test` for a reliable run.

## Roles

Two independent levels:

- **Application role** (USER_ADMINISTRATOR / USER): users area, user block/export/delete, support profile, listing every project.
- **Project role** (PROJECT_ADMINISTRATOR / COORDINATOR / PARTICIPANT): what a user can do inside a project they have a profile in.

Seed note: every seeded project gives all accounts a profile, so "no profile in project X" and "support profile" scenarios must create their own project with another account.

## Disabled elements

Disabling an element does not delete it, but it can disappear from view: lists only show it when the visibility filter allows it, selectors (movement forms, group members) ignore hidden elements, and everything inside a disabled project is unreachable until the project is enabled again. Any "disable then enable" scenario must therefore set the visibility filter (`*-list-is-visible-select`) before looking for the element, and a project must be re-enabled from the projects list.

## API helpers

Scenario data is created through the API, not the UI (`support/api/`):

- `ApiClient` calls `/api/v2` as a seeded account, reusing the session cookies of `.auth/` and sending the `X-XSRF-TOKEN` header the backend requires on writes.
- `TestData` (the `data` fixture) creates a project (valid for movements dated now), participants, groups, vehicles, activities, and registered/guest movements. Every project it creates is deleted after the scenario, so a scenario must not rely on pre-existing data it did not create.
- Movement reasons follow the backend rules: a registered participant going OUT needs a reason or an activity, a guest coming IN needs a reason (never an activity), the other two combinations take neither.
