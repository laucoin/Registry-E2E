import { expect, test } from './support/fixtures'

/**
 * Phase D (parity batch): users-admin actions on /users. Nuxt-only. The mutations
 * (role/block/unblock/delete) hit shared, privileged global users (the only other
 * account is a protected administrator the backend refuses to block — 409), so
 * this asserts the UI wiring — row actions on non-self rows, the role-edit modal
 * prefilled — rather than mutating shared state. Endpoint reachability + payloads
 * are the same $fetch pattern proven by the members invite round-trip.
 */
test.describe('users admin (parity batch)', () => {
	/**
	 * Self rows carry no action menu, so the admin (spike) needs at least one
	 * other user to act on. The role Modal teleports to <body>, so it is
	 * asserted via its title plus the prefilled select.
	 */
	test('non-self rows expose admin actions and a prefilled role modal', async ({ page }) => {
		await page.goto('/users')
		await expect(page.getByTestId('users-list')).toBeVisible()
		await expect(page.getByText(/dernière actualisation|last refresh/i).first()).toBeVisible()

		const actions = page.getByTestId('user-row-actions')
		test.skip(await actions.count() === 0, 'caller lacks user-admin authorities here')

		await actions.first().click()
		await expect(page.getByTestId('user-action-role')).toBeVisible()
		await expect(page.getByTestId('user-action-block')).toBeVisible()
		await expect(page.getByTestId('user-action-delete')).toBeVisible()

		await page.getByTestId('user-action-role').click()
		await expect(page.locator('.ant-modal-title')).toHaveText(/Edit role|Modifier le rôle/)
		await expect(page.getByTestId('user-role-select')).toBeVisible()
		await expect(page.getByTestId('user-role-select')).not.toHaveText('')
	})
})
