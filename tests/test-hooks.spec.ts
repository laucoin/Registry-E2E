import { clickUntilVisible } from './support/antd'
import { expect, test } from './support/fixtures'

/**
 * The `data-testid` hook contract for the Nuxt rewrite. The original
 * parity specs select by role/text; these hooks are the rewrite's own
 * convention, and this spec drives the shell purely through getByTestId — the
 * resilient, i18n/layout-proof way domain journeys should select.
 */
test.describe('data-testid hooks (Nuxt rewrite)', () => {
	test('the shell exposes its navigation and controls by test id', async ({ page }) => {
		await page.goto('/')

		await expect(page.getByTestId('nav-projects')).toBeVisible()
		await expect(page.getByTestId('nav-users')).toBeVisible()

		await expect(page.getByTestId('header-avatar')).toBeVisible()
		await clickUntilVisible(page.getByTestId('header-avatar'), page.getByTestId('header-user'))

		await expect(page.getByTestId('header-user')).toBeVisible()
		await expect(page.getByTestId('nav-account')).toBeVisible()
		await expect(page.getByTestId('header-logout')).toBeVisible()
		await expect(page.getByTestId('theme-select')).toBeVisible()
		await expect(page.getByTestId('language-select')).toBeVisible()
	})

	test('a testid selector navigates the shell', async ({ page }) => {
		await page.goto('/')
		await page.getByTestId('nav-projects').click()
		await expect(page).toHaveURL(/\/projects\/?$/)
	})
})
