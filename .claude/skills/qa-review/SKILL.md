---
name: qa-review
description: Evaluates test strategy, stability, and anti-flakiness for Playwright E2E tests. Enforces deterministic data-test-id locators and accessible roles, zero flakiness (ban on arbitrary timeouts in favor of auto-waiting web-first assertions), critical highway coverage (Golden Paths, typed destructive confirmations, console/network health), and scenario structure via test.step() and the AAA pattern.
---

# QA Review — Playwright E2E Tests (Reliability & Safety Net)

Examine the change (diff, newly added `.spec.ts` files, scenario additions, or refactorings) against reliability,
anti-flakiness guarantees, and critical path coverage for the Playwright E2E test repository. Only touched or newly
added files are scored; discrepancies identified in untouched legacy code are reported as test debt without score
deductions. Start with a baseline score of **100 points** and apply deductions: **blocker −40**, **should-fix −10**,
**nit −2.5** (minimum floor at 0).

## Evaluation Criteria

### 1. Locator Robustness: Priority on `data-test-id` & Accessible Roles

* **Alignment with Frontend Contract (`data-test-id`):**
    * Prioritize `page.getByTestId('...')` for interactive elements (buttons, inputs, links, modals, action triggers).
      The frontend guarantees `data-test-id` presence across all interactive components, making it the primary
      deterministic targeting standard.
* **Semantic & Accessible Locators:**
    * Use accessible ARIA roles (`page.getByRole('button', { name: '...' })`, `page.getByLabel('...')`) whenever page
      semantics warrant it.
* **Strict Ban on Fragile CSS Selectors:**
    * **Absolute ban** on selectors coupled to DOM hierarchy or visual styles (e.g., `.btn-primary > span`,
      `div:nth-child(3) > a`, Tailwind/Bootstrap utility classes). Any selector of this kind is a blocker finding.

### 2. Zero Flakiness & Auto-Waiting Web-First Assertions

* **Ban on Arbitrary Timeouts:**
    * **Strict ban on `page.waitForTimeout()` and any arbitrary `sleep()` calls.** Any fixed delay is an immediate
      blocker.
* **Mandatory Auto-Waiting Web-First Assertions:**
    * Exclusively use Playwright's native auto-waiting assertions (`await expect(locator).toBeVisible()`,
      `toBeEnabled()`, `toHaveText()`, `toHaveCount()`).
    * Disallow evaluating state synchronously prior to asserting (e.g., `expect(await locator.isVisible()).toBe(true)`
      is prohibited as it strips away auto-waiting retry capabilities).
* **Network & Navigation Synchronization:**
    * When actions trigger navigations or critical asynchronous mutations, synchronize using explicit condition waits
      (`page.waitForURL(...)`, `page.waitForResponse(...)`) rather than static delays.

### 3. Targeted Coverage: Critical Golden Paths & Regression Safety Net

* **Priority on Core Highways:**
    * Focus on high-value business flows: session restoration/login, complete entity lifecycle (creation, edition),
      blocking error paths, and core page navigation without client crashes.
    * Avoid overloading E2E with exhaustive UI combinatorics or cosmetic variations (which belong in Vitest frontend
      suites).
* **Validation of Critical Destructive Actions:**
    * For multi-scope destructive actions (e.g., project purge, account deletion), verify that the confirmation dialog
      appears, the action button remains disabled until the exact confirmation keyword is typed (e.g., `"SUPPRIMER"`),
      the text is submitted, and the deletion is finalized.
* **Console Health & Server Stability:**
    * Ensure absence of uncaught console errors (`console.error`) or unhandled HTTP 500 server crashes during scenario
      execution.

### 4. Scenario Structure & Living Documentation (`test.step` & AAA)

* **Living Documentation via `test.step()`:**
    * Every logical phase of a test must be wrapped in a descriptive
      `await test.step('Clear human step description', async () => { ... })` block.
    * Steps must be expressive to simplify debugging inside Playwright HTML reports and the Trace Viewer.
* **AAA Pattern (Arrange, Act, Assert):**
    * Structure scenario steps logically:
        * Context setup / initial route visit (Arrange).
        * Executing business actions through Page Objects (Act).
        * Verifying observable screen state (Assert).
* **Test Suite Integrity:**
    * Bypassing CI using disabled tests (`test.skip()`, `test.fixme()`) without explicit tracking ticket reference and
      blocker justification is strictly forbidden.

## Output Format

1. **Partial Score:** Start at 100, apply deductions (**blocker −40**, **should-fix −10**, **nit −2.5**), and display
   the score (e.g., `QA: 90/100`).
2. **List of Anomalies:** Grouped by severity with exact locations (`file:line`), explanation of the flaw (arbitrary
   timeout, fragile selector, missing `test.step()`, synchronous assertion), and concrete remediation code.
3. **Test Debt:** Informative findings in untouched pre-existing code (no score deduction).
