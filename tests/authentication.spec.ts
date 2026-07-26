import { expect, test } from '@playwright/test'
import { clickUntilVisible } from './support/antd'
import { reachIdpSignIn } from './support/idp'

test.describe('unauthenticated access', () => {
	test.use({ storageState: { cookies: [], origins: [] } })

	/**
	 * The app has a public landing page, so reaching the IdP means clicking its
	 * login button rather than following an automatic redirect.
	 */
	test('a visitor is taken to the IdP sign-in', async ({ page }) => {
		await reachIdpSignIn(page)
	})
})

test.describe('authenticated shell', () => {
	/**
	 * Identity and role live in the avatar menu now: the bar carries the initials,
	 * the panel behind them carries the name and the role.
	 */
	test('the signed-in user sees their identity and role', async ({ page }) => {
		await page.goto('/')

		await clickUntilVisible(page.getByTestId('header-avatar'), page.getByTestId('header-user'))
		await expect(page.getByText(/spike/i).first()).toBeVisible()
		await expect(page.getByText(/administrat/i).first()).toBeVisible()
	})

	test('the main navigation exposes the projects and users areas', async ({ page }) => {
		await page.goto('/')

		await expect(page.getByRole('link', { name: /projets|projects/i }).first()).toBeVisible()
		await expect(page.getByRole('link', { name: /utilisateurs|users/i }).first()).toBeVisible()
	})

	test('a user without projects is offered the first-project creation', async ({ page }) => {
		await page.goto('/projects')

		await expect(page.getByText(/bienvenue sur registry/i)).toBeVisible()
		await expect(page.getByRole('button', { name: /créer mon premier projet/i })).toBeVisible()
	})
})
