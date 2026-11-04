---
name: code-review
description: Review gate for the Playwright E2E testing repository (regression safety net & critical golden paths). Sequentially orchestrates architecture & fixtures, cybersecurity & CI secrets, QA strategy & anti-flakiness (data-test-id, web-first assertions), and techlead & craft standards from macro to micro, delegating details to sub-skills on a /100 scale with iterative re-checks.
---

# Code Review — Playwright E2E Tests (Orchestrator)

## 0. Scope, Volumetry & Safety Net Philosophy

- **Analysis Scope:** Evaluates the diff of the active branch against `main` (`git diff main...HEAD`). Only modified and
  newly introduced files are scored. Pre-existing discrepancies in untouched code are documented informatively as
  technical debt without score deductions.
- **Regression Safety Net Philosophy:** This repository serves as an unbreakable **regression safety net** during major
  upgrades (Angular versions, pnpm updates, dependency bumps, backend refactorings).
    - Absolute priority on **Critical Golden Paths**: authentication, end-to-end entity creation/editing workflows,
      destructive actions protected by typed confirmation keywords, and core navigation without application crashes
      (zero 500 errors or unhandled client-side JS exceptions).
    - Reject over-specification and exhaustive combinatorics (which belong in Vitest frontend unit/component suites).
- **Scenario Specification Format:** Prohibit Cucumber/Gherkin (unjustified glue-code maintenance tax). Use **native
  TypeScript** exclusively, structured via **`test.step()`** to provide clear, actionable reporting in the Playwright
  HTML report and Trace Viewer.

---

## Contract: Sequential, Iterative, and Interactive Review (Macro -> Micro)

Analysis proceeds **category by category, from macro to micro**, delegating each specialized domain to its designated
sub-skill.

- **Stop & Re-check Rule:** At the end of each category:
    - If the score reaches **100/100**, proceed directly to the next category.
    - If issues are detected (e.g., 80/100), **stop immediately**. Collaborate with the developer to apply fixes, then
      **re-evaluate this exact category** to refresh the score (aiming for 100/100) before continuing.
- **Evidence over Opinion:** Run preliminary typechecks and linting (`pnpm lint` and `pnpm typecheck` or workspace
  equivalents) to ensure foundational code health.
- **Branches & Commits:** Disregard commit messages, branch naming conventions, and commit counts during evaluation.

---

## Evaluation Sequence & Sub-Skill Delegation

The orchestrator delegates evaluations in the following strict descending order:

### 1. Architecture, Fixtures & Test Data Strategy (Macro)

- **Delegated skill:** `architecture-review`
- *Verifies:*
    - **Modularity & Page Object Model:** Strict adherence to Page Object Model (POM) or Component Object structures.
      Zero raw DOM locators or low-level interaction plumbing inside `.spec.ts` test files.
    - **High-Performance Authentication (`storageState`):** Reusable session states via Playwright setup projects
      (`storageState`). Ban replaying the full UI login flow before every individual test.
    - **Custom Fixtures:** Clean encapsulation of Page Object instantiation and setup routines using extended Playwright
      fixtures (`test.extend<{ ... }>()`).
    - **Data Isolation:** Dynamic, collision-free test data generation (e.g., timestamped or UUID-suffixed entities) to
      guarantee safe parallel execution across multiple workers.

### 2. Cybersecurity, Secrets & Data Hygiene

- **Delegated skill:** `cybersecurity-review`
- *Verifies:*
    - **Secrets & Credentials Management:** Zero plaintext passwords, API keys, or private tokens in `.spec.ts` files,
      fixtures, or Playwright configuration files. Mandatory ingestion via environment variables (`process.env`).
    - **Data Hygiene & PII Protection:** Zero real Personal Identifiable Information (PII) or production dumps in mock
      datasets or test fixtures.
    - **Supply Chain Security:** Routine scanning of test framework dependencies via `pnpm audit`.

### 3. QA, Anti-Flakiness & Locator Robustness (Reliability)

- **Delegated skill:** `qa-review`
- *Verifies:*
    - **Deterministic Locators & `data-test-id`:** Prioritize `page.getByTestId('...')` (guaranteed by the frontend QA
      contract) and accessible roles (`page.getByRole(...)`). Ban brittle CSS selectors coupled to layout or styling
      (e.g., `.btn-primary > span`).
    - **Zero Flakiness & Web-First Assertions:** Absolute ban on `page.waitForTimeout()` and arbitrary `sleep()`.
      Mandatory use of auto-waiting web-first assertions (`await expect(locator).toBeVisible()`).
    - **Critical Highway Coverage:** Verification of high-value business workflows, including heavy destructive actions
      gated by typed confirmation inputs (e.g., explicitly typing `"SUPPRIMER"`).
    - **Scenario Structure:** Flawless readability using the AAA pattern (`// Arrange`, `// Act`, `// Assert`) and
      native `test.step()` blocks.

### 4. TechLead, Craft & Execution Performance (Micro)

- **Delegated skill:** `techlead-review`
- *Verifies:*
    - **Metrics & Readability:** Concise test scenarios, DRY page object methods, and elimination of bloated test
      bodies.
    - **Strict TypeScript Typing:** Complete ban on `any`, rigorous typing of custom fixtures, options objects, and
      helper return types.
    - **Playwright Configuration & CI Performance:** Optimal timeout configuration; trace, video, and screenshot
      generation constrained to failed runs only (`on-first-retry` or `retain-on-failure`) to minimize CI runtime.
    - **Linguistic Conventions:** Test titles, steps, and code identifiers in clear English; explanatory architectural
      notes in French when needed.

---

## Scoring Scale (/100) & Output Format

For each evaluated category (1 through 4):

- **Baseline score of 100 points**, applying standard deductions: **blocker −40**, **should-fix −10**, **nit −2.5**
  (minimum floor at 0).
- Output the current category score out of 100, provide a categorized list of findings with explicit remediation steps,
  and execute the re-check loop until 100/100 is achieved before advancing to the next category.
