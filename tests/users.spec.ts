import { expect, test } from '@playwright/test'

test.describe('users administration', () => {
	/**
	 * The name assertion tolerates both whitespace kinds: the rendered name may
	 * join first/last with a non-breaking space.
	 */
	test('the users area lists accounts with role and status', async ({ page }) => {
		await page.goto('/users')

		await expect(page.getByText(/spike[\s ]+test/i).first()).toBeVisible()
		await expect(page.getByText(/administrat/i).first()).toBeVisible()
		await expect(page.getByText(/actif|active/i).first()).toBeVisible()
	})

	/**
	 * The users list carries a lone text field and no filter controls, so its
	 * panel header is "Rechercher" — "Rechercher & Filtrer" is reserved for the
	 * domains that actually render filters.
	 */
	test('the list offers search and shows its data freshness', async ({ page }) => {
		await page.goto('/users')

		await expect(page.getByText(/rechercher|search/i).first()).toBeVisible()
		await expect(page.getByText(/dernière actualisation|last refresh/i).first()).toBeVisible()
	})
})
