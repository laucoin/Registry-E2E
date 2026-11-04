---
name: techlead-review
description: Evaluates software craft, code maintainability, strict TypeScript typing, AST/ESLint standards, and
    complexity thresholds for the Playwright E2E repository. Enforces zero `any`, a ban on parent relative imports
    (mandatory @pages, @fixtures, @components aliases), strict import sorting, line limits (methods <= 25 lines, specs <=
    150 lines), zero branching in specs (cyclomatic complexity of 1), lean CI artifacts, and bilingual conventions.
---

# TechLead Review — Playwright E2E Tests (Craft, Typing, ESLint & Metrics)

Examine the change (diff, newly added `.spec.ts` files, Page Objects, fixtures, or configuration) against software
engineering standards, TypeScript quality, linter rules (ESLint/AST), and maintainability thresholds for the Playwright
E2E test repository. Only touched or newly added files are scored; discrepancies identified in untouched legacy code are
reported as technical debt without score deductions. Start with a baseline score of **100 points** and apply deductions:
**blocker −40**, **should-fix −10**, **nit −2.5** (minimum floor at 0).

## Evaluation Criteria & Strict Thresholds

### 1. Function Metrics & Complexity (Hard Limits)

* **Method & Function Line Length:** A function or method (in a Page Object, fixture, or helper) must not exceed **25
  lines** excluding signature declarations, blank lines, and comments (`max-lines-per-function`). Decompose or extract
  blocks exceeding this threshold.
* **Scenario & Spec File Sizing:**
    * An individual `test()` scenario must not exceed **50 to 70 lines** of orchestration code.
    * A spec file (`.spec.ts`) must not exceed **150 lines**. Split suites exceeding this threshold into themed scenario
      files.
* **Parameter Count:** Maximum **7 parameters** per function, Page Object method, or constructor
  (`@typescript-eslint/max-params`). Group excess arguments into a typed configuration object or interface.
* **Nesting Level:** Maximum **2 nesting levels** (`max-depth`).
* **Deterministic Cyclomatic Complexity:**
    * **Spec Files (`.spec.ts`): Cyclomatic Complexity of 1 (Zero Branching).** Absolute ban on conditional structures
      (`if`, `switch`) and loops (`for`, `while`) inside test scenarios. An E2E test must be strictly linear and
      deterministic.
    * **Page Objects & Fixtures:** Cyclomatic complexity capped at a maximum of **4** (`complexity`).
* **Parameter Immutability:** Parameter reassignment is strictly prohibited (`no-param-reassign` with `props: true`).

### 2. Strict TypeScript Typing & Clean Code Hygiene

* **Absolute Ban on `any`:**
    * **Zero `any` allowed** (`@typescript-eslint/no-explicit-any`). Every method parameter, return type, fixture
      property, or intercepted API payload must be strictly typed.
    * No abusive type casts (`as unknown as ...` or `as any`) to bypass typing contracts.
* **Explicit Return Types:**
    * Explicit return types are mandatory on all public Page Object methods and helper functions
      (`explicit-function-return-type`).
    * Redundant type annotations on trivially inferrable variables are prohibited (`no-inferrable-types`).
* **Workspace Hygiene:**
    * Zero unused imports, orphaned variables, or stray test hooks (`.only` or `.skip`).
    * Clean verification pass with zero lint errors or compiler warnings (`pnpm lint` and `pnpm typecheck`).

### 3. Import Hygiene & Path Aliases

* **Absolute Ban on Parent Relative Imports:**
    * Relative imports traversing upward (`../`) are strictly prohibited (`@typescript-eslint/no-restricted-imports`).
    * Mandatory use of path aliases configured in `tsconfig.json`:
        * `@pages/` (Page Objects)
        * `@components/` (Reusable Component Objects)
        * `@fixtures/` (Extended Playwright fixtures)
        * `@data/` or `@helpers/` (Data factories, utility functions)
* **Import Ordering & Grouping (`simple-import-sort`):**
    1. Playwright test packages (`^@playwright/test`)
    2. External third-party packages (e.g., `dotenv`)
    3. Internal path aliases (`^@(pages|components|fixtures|data|helpers)/`)
    4. Sibling relative imports (`^\\.`)

### 4. Page Object Craft & CI Performance

* **Encapsulation & Intention-Driven Methods:**
    * Internal locators must be declared as `readonly Locator`.
    * Page Object methods must reflect clear business intentions (e.g., `archiveProject(keyword: string)`) rather than
      superficial single-click wrappers.
* **Lean CI Artifacts Management:**
    * Execution traces configured to `on-first-retry` or `retain-on-failure`.
    * Video recording configured to `retain-on-failure` or `off`.
    * Screenshots configured to `only-on-failure`.
* **Controlled Timeouts:**
    * Adhere to global Playwright timeout configurations. Arbitrary massive local overrides (e.g.,
      `test.setTimeout(120000)`) masking structural flakiness are strictly forbidden.

### 5. Linguistic Conventions & Documentation

* **Code in English:** File names, class identifiers, methods, variables, `test('...')` titles, and `test.step('...')`
  labels must be written in clear, accurate English.
* **Comments in French:** Explanatory comments (`// ...`) and JSDoc annotations must be written in French, focusing on
  *why* an architectural choice was made rather than *what* the code does.
* **Documentation Headers:** Complex Page Objects and fixtures must include the standard documentation header:
  `/** Objectif: ... | Périmètre: ... | Limites: ... */`.
* **Editorial Quality:** Zero typographical or spelling errors in test step descriptions and reporting logs.

## Output Format

1. **Partial Score:** Start at 100, apply deductions (**blocker −40**, **should-fix −10**, **nit −2.5**), and display
   the score (e.g., `TechLead: 90/100`).
2. **List of Anomalies:** Grouped by severity with exact locations (`file:line`), broken AST/metric rule (e.g., parent
   import `../`, method > 25 lines, branching in spec, `any` usage), and exact remediation code.
3. **Technical Debt:** Informative findings in untouched pre-existing code (no score deduction).
