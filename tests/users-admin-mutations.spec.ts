import { account } from './support/actors'
import { clickUntilVisible } from './support/antd'
import { registryApi } from './support/api'
import { invite, PROJECT_ROLE, uniqueName, USER_ROLE } from './support/domain'
import { expect, test } from './support/fixtures'
import { idpPassword, signInThroughIdp } from './support/idp'
import { directory, findUserByEmail, findUserIdByEmail, purgeUserByEmail, roleOf } from './support/users'

/**
 * critical-scenarios.md §14 — the users-administration MUTATIONS, which the
 * existing users-admin.spec.ts deliberately left alone because it had no
 * account it could safely change. The `-blocked` account exists for exactly
 * this: it is touched by nothing else, and ci/seed/seed.sql resets it on every
 * run, so a journey killed mid-mutation cannot poison the next run.
 *
 * Erasure in this domain is a real deletion, and never signing in as someone
 * (users.md) — the two scenarios below assert both halves of that.
 */
test.describe('users administration — mutations', () => {
	test('an ordinary user cannot reach the directory', async ({ apiAs, pageAs }) => {
		// Arrange
		const memberApi = await apiAs('member')

		// Act
		const response = await memberApi.raw('GET', '/api/v2/users?page=0&size=20')

		// Assert
		expect(response.status(), 'the directory is closed to a global USER').toBeGreaterThanOrEqual(400)
		const memberPage = await pageAs('member')
		await memberPage.goto('/')
		await expect(memberPage.getByTestId('nav-users')).toHaveCount(0)
	})

	/**
	 * Closes the ⚠️ on users-admin.spec.ts: that spec asserts the role modal is
	 * prefilled but never that a change is applied. The account is restored
	 * afterwards so the journey is idempotent.
	 */
	test('an administrator changes a global role and the change is applied', async ({ api }) => {
		// Arrange
		const target = await findUserByEmail(api, account('blocked').email)
		expect(roleOf(target)).toBe(USER_ROLE.USER)

		try {
			// Act
			await api.patch(`/api/v2/users/${target.id}`, { role: USER_ROLE.ADMINISTRATOR })

			// Assert
			const promoted = await findUserByEmail(api, account('blocked').email)
			expect(roleOf(promoted), 'the new role is persisted').toBe(USER_ROLE.ADMINISTRATOR)
		} finally {
			await api.raw('PATCH', `/api/v2/users/${target.id}`, { role: USER_ROLE.USER })
		}
	})

	/**
	 * The directory half of block/unblock; auth-provisioning.spec.ts asserts the
	 * sign-in half. Blocking is modelled as visible = FALSE, surfaced as the
	 * "Blocked" status tag.
	 */
	test('blocking an account is reflected in the directory, and unblocking restores it', async ({ page, api }) => {
		// Arrange
		const target = await findUserByEmail(api, account('blocked').email)

		try {
			// Act
			await api.post(`/api/v2/users/${target.id}/block`)

			// Assert
			await page.goto('/users')
			const row = page.getByTestId('users-list').locator('.ant-list-item')
				.filter({ hasText: account('blocked').displayName })
			await expect(row).toContainText(/bloqué|blocked/i)

			await api.post(`/api/v2/users/${target.id}/unblock`)
			await page.reload()
			await expect(row).toContainText(/actif|active/i)
		} finally {
			await api.raw('POST', `/api/v2/users/${target.id}/unblock`)
		}
	})

	/**
	 * Anonymization is irreversible, so the target is a LIGHT user — created
	 * fresh by inviting an address no account holds (user-invitations.md) — which
	 * makes the journey repeatable without consuming an IdP identity.
	 */
	test('deleting a user erases the account and its memberships', async ({ api, project }) => {
		// Arrange
		const email = `${uniqueName('light').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}@example.test`
		await invite(api, project.id, email, PROJECT_ROLE.PARTICIPANT)
		const light = await findUserByEmail(api, email)

		// Act
		await api.remove(`/api/v2/users/${light.id}`)

		// Assert
		expect((await directory(api)).some(user => user.id === light.id), 'the row is gone').toBe(false)
		const members = await api.get<{ content: Array<{ user?: { email?: string } }> }>(
			`/api/v2/projects/${project.id}/profiles?page=0&size=50`,
		)
		expect(members.content.some(profile => profile.user?.email === email),
			'the membership went with the account').toBe(false)
	})

	/**
	 * v1 called this "impersonate", which it never was: erasing an account must
	 * leave the CALLER's own session exactly as it was.
	 */
	test('deleting a user is not signing in as someone', async ({ page, api, project }) => {
		// Arrange
		const email = `${uniqueName('light').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}@example.test`
		await invite(api, project.id, email, PROJECT_ROLE.PARTICIPANT)
		const light = await findUserByEmail(api, email)

		// Act
		await api.remove(`/api/v2/users/${light.id}`)

		// Assert
		await page.goto('/')
		await clickUntilVisible(page.getByTestId('header-avatar'), page.getByTestId('header-user'))
		await expect(page.getByText(account('admin').displayName).first()).toBeVisible()
		const me = await api.get<{ email?: string }>('/api/v1/authentication/user/current')
		expect(me.email, 'the caller is still themselves').toBe(account('admin').email)
	})

	/**
	 * The role ceiling, as far as this deployment can express it. The seeded role
	 * table holds exactly two global roles — USER_ADMINISTRATOR (level 0) and
	 * USER (level 9000) — and USER carries no REGISTRY_USER_U at all, so
	 * USER_ASSIGNS_ROLE_HIGHER_THAN_ITS_OWN is unreachable: the only caller who
	 * can reach the endpoint already sits at level 0. What IS assertable, and is
	 * the ceiling's effect here, is that a lesser account cannot change anyone's
	 * role. Add the exact-code assertion if an intermediate global role is ever
	 * introduced.
	 */
	test('a user may only assign roles at or below their own level', async ({ api, apiAs }) => {
		// Arrange
		const target = await findUserByEmail(api, account('blocked').email)
		const memberApi = await apiAs('member')

		// Act
		const response = await memberApi.raw('PATCH', `/api/v2/users/${target.id}`, {
			role: USER_ROLE.ADMINISTRATOR,
		})

		// Assert
		expect(response.status(), 'a global USER cannot hand out a role it does not hold')
			.toBeGreaterThanOrEqual(400)
		const unchanged = await findUserByEmail(api, account('blocked').email)
		expect(roleOf(unchanged), 'the target keeps its role').toBe(USER_ROLE.USER)
	})

	/**
	 * users.md promises USER_BLOCK_CURRENT_USER / USER_DELETE_CURRENT_USER — no
	 * administrator acts on their own row. Measured on 2026-08-07 the API guard does
	 * NOT hold: POST /users/{self}/block succeeds, and because a blocked account
	 * cannot call unblock either, the caller locks itself out irrecoverably (every
	 * later request answers 423 AUTH_BLOCKED_ACCOUNT). Driving that from a test
	 * would destroy the environment, so this asserts the affordance the UI actually
	 * enforces and leaves the API-level gap recorded rather than exercised.
	 */
	test('an administrator is offered no action on their own directory row', async ({ page, api }) => {
		// Arrange
		const self = await findUserByEmail(api, account('admin').email)

		// Act
		await page.goto('/users')
		const ownRow = page.getByTestId('users-list').locator('.ant-list-item')
			.filter({ hasText: account('admin').displayName })

		// Assert
		await expect(ownRow.first()).toBeVisible()
		await expect(ownRow.first().getByTestId('user-row-actions'), 'no action menu on the caller’s own row')
			.toHaveCount(0)
		expect(self.id, 'the caller is a real directory row').toBeTruthy()
	})

	/**
	 * The guard crosses into the project plane: blocking globally would strand a
	 * project with no administrator, so it is refused and the message names the
	 * project (users.md).
	 */
	test('the last administrator of a project cannot be blocked globally', async ({ api, projects }) => {
		// Arrange
		await projects.create({ name: 'last admin guard', as: 'member' })
		const target = await findUserByEmail(api, account('member').email)

		try {
			// Act
			const response = await api.raw('POST', `/api/v2/users/${target.id}/block`)

			// Assert
			expect(response.status(), 'blocking a project’s last administrator must be refused')
				.toBeGreaterThanOrEqual(400)
			expect(await response.text()).toContain('USER_BLOCK_LAST_PROJECT_ADMINISTRATOR')
		} finally {
			await api.raw('POST', `/api/v2/users/${target.id}/unblock`)
		}
	})

	/**
	 * Self-service (@p2): any user may delete their OWN account, with no
	 * administrator involved. Driven with `selfpurge`, an identity dedicated to
	 * this journey alone — running it as `member` would destroy the account every
	 * role-gating journey depends on.
	 */
	test('any user may delete their own account', async ({ browser, baseURL, api }) => {
		// Arrange
		const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } })
		const page = await context.newPage()

		try {
			await signInThroughIdp(page, account('selfpurge').username, idpPassword())
			await page.waitForURL(url => url.href.startsWith(baseURL!))
			const selfApi = registryApi(page)
			expect((await selfApi.raw('GET', '/api/v1/authentication/user/current')).ok()).toBeTruthy()

			// Act
			const response = await selfApi.raw('DELETE', '/api/v2/users/me')

			// Assert
			expect(response.ok(), `an ordinary user deletes themselves (${response.status()})`).toBeTruthy()
			expect(await findUserIdByEmail(api, account('selfpurge').email),
				'the row is gone from the directory').toBeUndefined()
		} finally {
			await context.close()
			await purgeUserByEmail(api, account('selfpurge').email)
		}
	})
})
