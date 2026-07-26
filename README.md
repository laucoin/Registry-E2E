# Registry (E2E)

[![Playwright](https://img.shields.io/badge/Playwright-1.50-2EAD33?logo=playwright&logoColor=white)](https://playwright.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![pnpm](https://img.shields.io/badge/pnpm-F69220?logo=pnpm&logoColor=white)](https://pnpm.io)

<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-4-orange.svg?style=flat-square)](#contributors-)
<!-- ALL-CONTRIBUTORS-BADGE:END -->

## This repository 📖

This project is built with [Playwright](https://playwright.dev) (TypeScript).

This application is the Registry end-to-end suite: Playwright journeys asserting user-visible outcomes only,
run against the Nuxt frontend on top of the backend. Full suite green per environment gates a release. The suite was
originally authored against the legacy Angular app and run against both; that target is retired, and the differences
recorded during the migration are kept for history in [`divergence-log.md`](divergence-log.md).

Checkout the full documentation [here](https://doc.laucoin.fr/registry).

Linked repositories:

- [Frontend](https://github.com/laucoin/Registry-Frontend.git)
- [Backend](https://github.com/laucoin/Registry-Backend.git)

## How to install and use it? ⚙️

### Prerequisites

You need to install a Node environment. To do that there are 2 possibilities.

#### Node Version Management (recommended)

1. Install [NVM](https://github.com/nvm-sh/nvm#installing-and-updating)
2. Then install node (`>= v22`)
    ```shell
    nvm install <version>
    ```

#### Classic installation

1. Install [Node.js](https://nodejs.org/en/download/)

Then, in both cases, install [pnpm](https://pnpm.io/installation):

```shell
corepack enable pnpm
```

### Build and run locally

1. Clone this repository with:
    ```shell
    git clone https://github.com/laucoin/Registry-E2E.git
    ```
   OR
    ```shell
    git clone git@github.com:laucoin/Registry-E2E.git
    ```
2. Move into the project directory
    ```shell
    cd Registry-E2E/
    ```
3. Install dependencies and the browser
    ```shell
    pnpm install
    pnpm exec playwright install chromium
    ```
4. Create your environment file from the template and fill in the seeded test-user credentials
    ```shell
    cp .env.example .env
    ```
    ```dotenv
    E2E_USERNAME=<seeded-test-user>
    E2E_PASSWORD=<seeded-test-user-password>
    # E2E_NUXT_URL=http://localhost:3000
    # E2E_NUXT_SESSION_URL=http://localhost:3001
    # E2E_BACKEND_URL=http://localhost:8081
    # IdP is Authentik; the token endpoint is derived from the issuer's origin.
    # E2E_ISSUER=http://localhost:9000/application/o/registry
    # E2E_TOKEN_URL=http://localhost:9000/application/o/token/
    # E2E_TEST_CLIENT=registry-test-cli
    ```

Now, you can use the following scripts. Enjoy !

> To run the suite, you need Authentik (`:9000`, application `registry`), the backend (Spring on `:8081`) and the target
> app (Nuxt on `:3000`) already running. To do that refer to the
> [backend readme](https://github.com/laucoin/Registry-Backend.git) and the
> [frontend readme](https://github.com/laucoin/Registry-Frontend.git).

#### Running the suite

Run the suite with:

```shell script
pnpm test:nuxt         # against the Nuxt app (:3000)
pnpm test:nuxt-session # session-lifetime journeys, short-session instance (:3001)
pnpm report            # open the HTML report
```

Auth: `tests/auth.setup.ts` signs in through the IdP UI and persists `storageState`.

It signs in the two persistent accounts up front and writes one state file per actor (`.auth/nuxt-<actor>.json`). A
suite that only ever holds the administrator's session cannot assert that Registry refuses anybody, and refusals are
most of the blocking scenario set — so the lesser accounts are what make `tests/access-*.spec.ts` possible. The rest are
signed in by the journey that consumes them (`signInAtSetup: false` in `tests/support/actors.ts`): signing them in here
would provision, refuse or consume the very identity whose first sign-in is under test.

| Actor         | Account                     | Why it exists                                                       |
|---------------|-----------------------------|---------------------------------------------------------------------|
| `admin`       | `$E2E_USERNAME`             | `USER_ADMINISTRATOR` — creates projects, invites, administers users |
| `member`      | `$E2E_USERNAME-member`      | global `USER`; invited per project as coordinator or participant    |
| `fresh`       | `$E2E_USERNAME-fresh`       | unseeded — proves first-sign-in auto-provisioning                   |
| `clash`       | `$E2E_USERNAME-clash`       | shares the admin's email — must fail `AUTH_EMAIL_ALREADY_USED`      |
| `unverified`  | `$E2E_USERNAME-unverified`  | `email_verified: false` — must fail `AUTH_EMAIL_NOT_VERIFIED`       |
| `blocked`     | `$E2E_USERNAME-blocked`     | the block/unblock target                                            |
| `burn`        | `$E2E_USERNAME-burn`        | the anonymization target                                            |
| `purge`       | `$E2E_USERNAME-purge`       | the purge-guard target                                              |
| `signout`     | `$E2E_USERNAME-signout`     | consumed by the RP-initiated logout journey                         |
| `light`       | `$E2E_USERNAME-light`       | the light-user linking target                                       |
| `selfpurge`   | `$E2E_USERNAME-selfpurge`   | the self-service purge target                                       |

One disposable identity per destructive journey: two sharing one makes the pair order-dependent. All share
`E2E_PASSWORD` and are provisioned by `ci/authentik/blueprints/e2e-registry.yaml`.

#### Other scripts

```shell script
pnpm lint   # eslint (formatting mirrors Registry-Frontend)
```

#### Further help

- Playwright [documentation](https://playwright.dev/docs/intro)
- axe-core for Playwright [documentation](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright)
- TypeScript [documentation](https://www.typescriptlang.org/docs/)

## Findings 🐞

Pre-existing v1 bugs surfaced by authoring the suite:

1. **Date-less project creation 500'd on the response** — the row was inserted, then
   `AvailabilityStatusReaderDtoMapper.extractLabelDuration`
   NPE'd on the null dates; the UI showed "Server error" over a successful insert.
2. **Creating a project locked the account out** — the auto-created, auto-selected creator profile has null access
   dates, so every subsequent
   `GET /authentication/user/current` 500'd (same mapper) until the project was deleted (FK `ON DELETE SET NULL`
   self-healed the selection).

**Status: both fixed 2026-07-25** — null availability windows now fall back to the plain status label (null-safety guard
in the shared mapper, with regression tests; approved as a narrow exception to the v1 freeze). The project lifecycle
journey runs green again. A related oddity was left frozen: the NOT_YET/NO_MORE duration labels fire for past-start /
future-end bounds respectively — direction semantics to revisit with v2.

## Status 🚦

**237 tests across 49 specs** — 233 under `--project=nuxt` and 4 session-lifetime journeys under
`--project=nuxt-session`.

The suite is measured against the
[journey scenarios](https://doc.laucoin.fr/registry/technical/critical-scenarios) page, which is the behavioural oracle:
every scenario there carries a coverage marker naming the spec that asserts it, maintained by hand in the same change as
the spec. **All 56 blocking (`@p1`) scenarios are now automated** — 55 outright, one partially — and `@p2`
stands at 93 of 97.

The bulk of that is refusals. The suite used to hold a single `USER_ADMINISTRATOR` session and so could only prove the
product works for someone allowed to do the thing; it now also proves it stops someone who is not — blocked, invited,
rejected and out-of-window profiles, cross-project access, option gating, role gating and the last-administrator guards.

## Contributing 💻

The `main` branch contain the development code.

WARNING :

- Any development must be done on a separate branch: every change reaches `main` through a pull request.

This repository has no GitHub Actions workflows yet (unlike the
[frontend](https://github.com/laucoin/Registry-Frontend.git) and the
[backend](https://github.com/laucoin/Registry-Backend.git), whose pull requests are gated by their workflows): the suite
is itself the quality gate and runs manually — see
[Running the suite](#running-the-suite). Before opening a pull request, make sure `pnpm lint` is clean and the suite is
green, and follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.

Before contributing, please read the [documentation](https://doc.laucoin.fr/registry/) and our
[code of conduct](CODE_OF_CONDUCT.md).

## Contributors 🧑‍💻

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/en/reference/emoji-key/)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://doc.laucoin.fr/resume"><img src="https://avatars.githubusercontent.com/u/31480129?v=4?s=100" width="100px;" alt="Luc AUCOIN"/><br /><sub><b>Luc AUCOIN</b></sub></a><br /><a href="#projectManagement-laucoin" title="Project Management">📆</a> <a href="#ideas-laucoin" title="Ideas, Planning, & Feedback">🤔</a> <a href="https://github.com/laucoin/Registry-E2E/commits?author=laucoin" title="Code">💻</a> <a href="#maintenance-laucoin" title="Maintenance">🚧</a> <a href="#infra-laucoin" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Usinouv"><img src="https://avatars.githubusercontent.com/u/13047412?v=4?s=100" width="100px;" alt="Usinouv"/><br /><sub><b>Usinouv</b></sub></a><br /><a href="#ideas-Usinouv" title="Ideas, Planning, & Feedback">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/lvicainne"><img src="https://avatars.githubusercontent.com/u/1641160?v=4?s=100" width="100px;" alt="Louis VICAINNE"/><br /><sub><b>Louis VICAINNE</b></sub></a><br /><a href="#infra-lvicainne" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a> <a href="#ideas-lvicainne" title="Ideas, Planning, & Feedback">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/ctruillet"><img src="https://avatars.githubusercontent.com/u/43933447?v=4?s=100" width="100px;" alt="Clément Truillet"/><br /><sub><b>Clément Truillet</b></sub></a><br /><a href="#ideas-ctruillet" title="Ideas, Planning, & Feedback">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="[https://github.com/ctruillet](https://www.linkedin.com/in/c%C3%A9cile-crochon/)"><img src="https://media.licdn.com/dms/image/v2/C4D03AQEWB-ofOcjZ7A/profile-displayphoto-shrink_800_800/profile-displayphoto-shrink_800_800/0/1626700975351?e=1787184000&v=beta&t=mfq6na-TuTZL4pA-0ivIHpnDBxOUjKQ0_I1KSuxhIrQ" width="100px;" alt="Cécile Crochon"/><br /><sub><b>Cécile Crochon</b></sub></a><br /><a href="#projectManagement-ccrochon" title="Project Management">📆</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification.
Contributions of any kind welcome!

To add a contributor, either comment on an issue/PR with
`@all-contributors please add @<username> for <contributions>` (bot), or run:

```shell script
pnpm contributors:add <username> <contributions>
```
