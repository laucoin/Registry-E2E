---
name: architecture-review
description: Evaluates architecture, modularity, design patterns, and strict idempotency for Playwright E2E tests. Enforces Page Object Model (POM) separation, custom fixture encapsulation (test.extend), optimized session handling (storageState), infinite re-executability without state pollution, and collision-free parallel execution.
---

# Architecture Review — Playwright E2E Tests

Examine the change (diff, newly added files, or refactorings) against software architecture, modularity,
maintainability, and reproducibility principles for the Playwright E2E test repository. Only touched or newly added
files are scored; discrepancies identified in untouched legacy code are reported as technical debt without score
deductions. Start with a baseline score of **100 points** and apply deductions: **blocker −40**, **should-fix −10**,
**nit −2.5** (minimum floor at 0).

---

## Evaluation Criteria

### 1. Strict Idempotency & Temporal Reproducibility

- **Guaranteed Absolute Idempotency:**
    - The entire test suite (or any isolated spec) must yield the exact same green outcome whether run **15 times in 15
      minutes or once every 15 days**, assuming unchanging application code.
    - **Zero Persistent State Pollution:** A test must never leave an environment in a dirty state that causes
      subsequent runs—or sibling tests—to fail (e.g., uniqueness constraint violations, unreset counters, altered global
      flags, or undeleted shared entities).
- **Zero Inter-Test Coupling:**
    - Every test must be completely autonomous. Spec B must never depend on the execution order, side effects, or
      datasets produced by Spec A.

### 2. Design Patterns: Page Object Model (POM) & Component Objects

- **Strict Responsibility Boundaries:**
    - **Spec Files (`.spec.ts`):** Exclusively dedicated to high-level business scenario orchestration using descriptive
      steps (`test.step()`) and top-level behavioral assertions.
    - **Absolute Ban on Raw Selectors in Specs:** Direct calls to `page.locator()`, `page.getByTestId()`,
      `page.getByRole()`, or low-level DOM queries inside `.spec.ts` files are strictly prohibited. All locators and raw
      browser interactions must be encapsulated inside Page Objects or Component Objects.
- **Granularity & Object Reusability:**
    - **Page Objects:** Model distinct routed views or pages (e.g., `ProjectListPage`, `UserDetailsPage`) using
      intention-revealing action methods (e.g., `archiveProject(confirmationKeyword: string)` rather than chained
      low-level clicks).
    - **Component Objects:** Recurring or complex widgets (confirmation dialogs, navigation drawers, paginated tables)
      must be extracted into dedicated, reusable component classes composed within Page Objects.

### 3. Authentication & Session Strategy (`storageState`)

- **Ban on Repetitive UI Logins:**
    - Replaying interactive login forms (entering credentials on every spec run) is strictly forbidden.
- **Playwright Setup Projects & Cached Sessions:**
    - Use Playwright global setup or project dependencies (`auth.setup.ts`) to authenticate once per role profile (e.g.,
      `admin`, `contributor`, `readonly`) and persist cookies/tokens into reusable state snapshots (`storageState`).
    - Inject the required session state at the project configuration level or through targeted fixtures.

### 4. Encapsulation via Custom Fixtures (`test.extend`)

- **Declarative Injection:**
    - Do not manually instantiate Page Objects inside `beforeEach` blocks via `new MyPage(page)`.
    - Use extended Playwright fixtures (`test.extend<{ projectPage: ProjectPage, ... }>()`) to inject pre-configured
      Page Objects and context directly into test function arguments.
- **Self-Cleaning Lifecycles (Teardown):**
    - Fixtures must own their setup and teardown logic using the `await use(...)` pattern to clean up created entities
      and guarantee idempotency.

### 5. Data Isolation & Deterministic Parallel Execution

- **Zero Inter-Worker Conflicts:**
    - The suite must run reliably across multiple parallel workers without database collisions or race conditions.
- **Ephemeral & Unique Test Data:**
    - Dynamically generated entities must use collision-proof naming (e.g., domain prefix + timestamp or short UUID) to
      prevent clashes across repeated runs.
- **Targeted Network Routing vs. Real Integration:**
    - Critical golden-path tests run against real integration environments.
    - When mocking is required (e.g., simulating third-party service outages or HTTP 500 crashes), route interceptors
      must be strictly scoped via `page.route()` and automatically cleaned up when the test finishes.

---

## Output Format

1. **Partial Score:** Start at 100, apply deductions (**blocker −40**, **should-fix −10**, **nit −2.5**), and display
   the score (e.g., `Architecture: 90/100`).
2. **List of Anomalies:** Grouped by severity with exact locations (`file:line`), explanation of the flaw (idempotency
   violation, raw DOM selector inside spec, manual instantiation outside fixtures, repetitive login), and concrete
   remediation code.
3. **Architectural Debt:** Informative findings in untouched pre-existing code (no score deduction).
