---
name: test
description: Generates deterministic, anti-flaky, and idempotent Playwright E2E tests, Page Objects, and extended fixtures. Enforces the regression safety net philosophy (Golden Paths, destructive confirmations), strict Page Object Model (POM) encapsulation, living documentation via test.step() with the AAA pattern, prioritized data-test-id / accessible role locators, and session caching (storageState).
---

# Test Writer — Playwright E2E Tests (Scenarios, Page Objects & Fixtures)

## Role & Safety Net Philosophy

Generate or refactor Playwright E2E test code in strict TypeScript. Act as an engineering guide to build a **durable,
high-return regression safety net**:

* **Priority on Critical Highways (Golden Paths):** Authentication/session restoration, complete entity lifecycle
  (creation, edition) end-to-end, destructive actions gated by confirmation keywords, and core flows running without
  application crashes (zero HTTP 500 errors or uncaught browser console exceptions).
* **Zero Cucumber/Gherkin:** Native **pure TypeScript** exclusively, structured with **`test.step()`** to provide
  self-documenting reports in the Playwright HTML report and Trace Viewer.
* **Strict Idempotency:** Every generated scenario must run repeatedly in isolation or parallel without persistent state
  pollution, unique database constraint collisions, or reliance on shared preconditions.

---

## Design Invariants & Mandatory Patterns

### 1. Declarative Scenario Structure (`.spec.ts`)

* **Living Documentation & Step Segmentation:**
    * Segment scenarios into descriptive steps via `test.step()` following the AAA pattern:
        * Step 1: Context setup / navigation (`// Arrange`).
        * Step 2: High-level action execution through Page Objects (`// Act`).
        * Step 3: Observable state verification via Web-First Assertions (`// Assert`).
    * **Absolute Ban on Raw Selectors in `.spec.ts`:** No direct `page.locator()`, `getByTestId()`, or direct
      `page.click()` calls. The spec file exclusively orchestrates Page Object methods and top-level assertions.
* **Deterministic Cyclomatic Complexity:**
    * Zero conditional statements (`if`, `switch`) or loops (`for`, `while`) inside `.spec.ts` files. Every scenario
      must be strictly linear.
* **Conciseness & Sizing:**
    * Spec files must not exceed **150 lines**. Individual test scenarios must remain within **50–70 lines**.

### 2. Page Objects & Component Objects Design

* **Resilient Locators & Typing:**
    * Declare target UI elements as `readonly Locator` properties.
    * **Deterministic Locator Hierarchy:**
        1. `this.page.getByTestId('...')` (aligned with the frontend invariant guaranteeing `data-test-id` on all
           interactive components).
        2. `this.page.getByRole('button', { name: '...' })`, `getByLabel('...')` for accessible semantics.
        3. Strict ban on structural CSS or XPath selectors (e.g., `div > span.btn`).
* **Intention-Revealing Methods:**
    * Methods must represent cohesive business actions (e.g., `async archiveProject(keyword: string): Promise<void>`).
    * Strict metrics: **≤ 25 lines** per method, **≤ 7 parameters**, cyclomatic complexity **≤ 4**.
* **Reusable Component Objects:**
    * Recurring UI elements (e.g., confirmation modals with typed verification inputs) must be isolated as reusable
      classes in `@components/`.

### 3. Custom Fixtures & Session Management (`test.extend`)

* **Declarative Dependency Injection:**
    * Never manually instantiate Page Objects inside tests using `new MyPage(page)`.
    * Extend Playwright base test via `test.extend<{ myPage: MyPage }>` located under `@fixtures/`.
* **Session Reuse (`storageState`):**
    * Do not fill in login forms in individual tests. Leverage cached authentication state configured in Playwright
      (`storageState: 'playwright/.auth/user.json'`).

### 4. Zero Flakiness & Web-First Assertions

* **Auto-Waiting Assertions Exclusively:**
    * Use `await expect(locator).toBeVisible()`, `toBeEnabled()`, `toHaveText()`, etc.
    * **Strict ban on `page.waitForTimeout()` or `sleep()`**.

---

## Reference Blueprint Template

### A. The Page Object (`pages/project-details.page.ts`)

```typescript
import { type Locator, type Page } from '@playwright/test';
import { ConfirmationModalComponent } from '@components/confirmation-modal.component';

/** Objectif: Encapsuler les interactions de la vue détail projet | Périmètre: Vue projet | Limites: Hors listes globales */
export class ProjectDetailsPage {
	readonly statusBadge: Locator;
	readonly archiveButton: Locator;
	readonly confirmationModal: ConfirmationModalComponent;

	constructor(private readonly page: Page) {
		this.statusBadge = page.getByTestId('project-status-badge');
		this.archiveButton = page.getByTestId('archive-project-button');
		this.confirmationModal = new ConfirmationModalComponent(page);
	}

	async goto(projectId: string): Promise<void> {
		await this.page.goto(`/projects/${projectId}`);
	}

	async archiveProject(validationKeyword: string): Promise<void> {
		await this.archiveButton.click();
		await this.confirmationModal.confirmWithKeyword(validationKeyword);
	}
}
```

### B. The Extended Fixture (`fixtures/e2e.fixture.ts`)

```typescript
import { test as baseTest } from '@playwright/test';
import { ProjectDetailsPage } from '@pages/project-details.page';

interface E2EFixtures {
	projectDetailsPage: ProjectDetailsPage;
}

export const test = baseTest.extend<E2EFixtures>({
	projectDetailsPage: async ({ page }, use) => {
		const projectPage = new ProjectDetailsPage(page);
		await use(projectPage);
	},
});

export { expect } from '@playwright/test';
```

### C. The Scenario Spec (`specs/project-archival.spec.ts`)

```typescript
import { expect, test } from '@fixtures/e2e.fixture';

test.describe('Project Lifecycle & Archival', () => {
	test('should successfully archive an active project with required confirmation keyword', async ({
																										projectDetailsPage,
																									}) => {
		const uniqueProjectId = `proj-${Date.now()}`;

		// Arrange
		await test.step('Navigate to project details view', async () => {
			await projectDetailsPage.goto(uniqueProjectId);
		});

		// Act
		await test.step('Trigger project archival with security confirmation keyword', async () => {
			await projectDetailsPage.archiveProject('SUPPRIMER');
		});

		// Assert
		await test.step('Verify project status reflects archived state', async () => {
			await expect(projectDetailsPage.statusBadge).toHaveText('Archivé');
		});
	});
});
```

---

## Linguistic & Writing Conventions

* **Code & Scenarios in English:** Variable names, fixtures, class names, method signatures, `test('...')` titles, and
  `test.step('...')` step labels must be written in clear English.
* **Comments in French:** Explanatory comments (`// ...`) and JSDoc documentation written in French, emphasizing *why*
  an implementation decision was made.
* **Path Aliases:** Strict use of path aliases (`@pages/`, `@components/`, `@fixtures/`, `@data/`) with zero parent
  relative imports (`../`).
