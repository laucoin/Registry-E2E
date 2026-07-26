import type { Browser, BrowserContext } from '@playwright/test'
import { account } from './support/actors'
import { registryApi, type RegistryApi } from './support/api'
import { uniqueName, USER_ROLE } from './support/domain'
import { expect, test } from './support/fixtures'
import { idpPassword, signInThroughIdp } from './support/idp'
import { findUserByEmail } from './support/users'

/**
 * Erasure carries the SAME guards as blocking, and they matter more here:
 * blocking is repaired with one UPDATE, a deletion is not repaired at all. An
 * administrator must not delete their own row, nor the last administrator of a
 * project, nor the last platform administrator.
 *
 * Every destructive probe is aimed at a disposable identity, never at the account
 * the suite signs in as: these tests assert a refusal, and a test asserting a
 * refusal has to survive the refusal NOT happening — otherwise a missing guard
 * destroys the environment instead of reporting itself.
 *
 * `purge` is a SECOND disposable account rather than `burn`, which
 * auth-provisioning.spec.ts deletes earlier in the run. Sharing one identity made
 * these journeys pass alone and fail in the full suite; they need one that is
 * still intact.
 *
 * `purge` is deliberately absent from ci/seed/seed.sql, so it holds no backend row
 * until it signs in once — every test here therefore starts by provisioning it.
 */
async function signInPurgeTarget(browser: Browser, baseURL: string): Promise<{
	context: BrowserContext
	api: RegistryApi
}> {
	const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } })
	const page = await context.newPage()
	await signInThroughIdp(page, account('purge').username, idpPassword())
	await page.waitForURL(url => url.href.startsWith(baseURL))
	return { context, api: registryApi(page) }
}

test.describe('users administration — purge guards', () => {
	test('the last administrator of a project cannot be deleted', async ({ browser, baseURL, api }) => {
		// Arrange
		const { context, api: purgeApi } = await signInPurgeTarget(browser, baseURL!)
		let projectId: string | undefined

		try {
			const created = await purgeApi.post<{ id: string }>('/api/v2/projects', {
				name: uniqueName('purge guard'),
				begin: { date: '2026-07-01' },
				end: { date: '2026-08-31' },
				options: [],
			})
			projectId = created.id
			const target = await findUserByEmail(api, account('purge').email)

			// Act
			const response = await api.raw('DELETE', `/api/v2/users/${target.id}`)

			// Assert
			expect(response.status(), 'deleting a project’s last administrator must be refused')
				.toBeGreaterThanOrEqual(400)
			expect(await response.text()).toContain('USER_DELETE_LAST_PROJECT_ADMINISTRATOR')
		} finally {
			if (projectId) {
				await purgeApi.discard(`/api/v2/projects/${projectId}`)
			}
			await context.close()
		}
	})

	/**
	 * The caller is `purge`, promoted for the length of the test, so a missing
	 * guard costs a disposable identity rather than the administrator every other
	 * journey depends on.
	 */
	test('an administrator cannot delete their own row', async ({ browser, baseURL, api }) => {
		// Arrange
		const { context, api: purgeApi } = await signInPurgeTarget(browser, baseURL!)
		const target = await findUserByEmail(api, account('purge').email)

		try {
			await api.patch(`/api/v2/users/${target.id}`, { role: USER_ROLE.ADMINISTRATOR })

			// Act
			const response = await purgeApi.raw('DELETE', `/api/v2/users/${target.id}`)

			// Assert
			expect(response.status(), 'deleting your own row must be refused').toBeGreaterThanOrEqual(400)
			expect(await response.text()).toContain('USER_DELETE_CURRENT_USER')
		} finally {
			await context.close()
			await api.raw('PATCH', `/api/v2/users/${target.id}`, { role: USER_ROLE.USER })
		}
	})

	/**
	 * Only meaningful when the caller really is the last level-0 account. The
	 * backend's own dev dataset seeds three, so this skips rather than asserting a
	 * guard that cannot fire — and it reads the precondition before deleting
	 * anything.
	 *
	 * Being the last administrator does not change which guard answers: the
	 * directory delete rejects a caller aiming at their own row before it ever
	 * consults the last-administrator rule. That ordering is what this asserts —
	 * the stronger-sounding refusal never masks the self guard.
	 */
	test('the last platform administrator is refused their own directory deletion', async ({ api }) => {
		// Arrange
		const page = await api.get<{
			content: Array<{ id: string, email?: string, role?: { value: string } | string }>
		}>(
			'/api/v2/users?page=0&size=200',
		)
		const administrators = page.content.filter((user) => {
			const role = typeof user.role === 'string' ? user.role : user.role?.value
			return role === USER_ROLE.ADMINISTRATOR
		})
		const self = administrators.find(user => user.email === account('admin').email)
		expect(self, 'the caller holds the administrator role').toBeTruthy()
		test.skip(
			administrators.length > 1,
			`${administrators.length} platform administrators exist — the last-administrator guard cannot fire`,
		)

		// Act
		const response = await api.raw('DELETE', `/api/v2/users/${self!.id}`)

		// Assert
		expect(response.status(), 'deleting your own row from the directory must be refused')
			.toBeGreaterThanOrEqual(400)
		expect(await response.text()).toContain('USER_DELETE_CURRENT_USER')
	})
})
