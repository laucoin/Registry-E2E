import type { Page } from '@playwright/test'
import { account } from './support/actors'
import { registryApi } from './support/api'
import { expect, test } from './support/fixtures'
import { idpPassword, signInThroughIdp } from './support/idp'
import { directory, findUserByEmail, findUserIdByEmail, purgeUserByEmail, roleOf } from './support/users'

/**
 * critical-scenarios.md §1 — how a session BEGINS, and the ways the backend
 * refuses to start one (security.md's JWT → user flowchart):
 * blocked        → 423 AUTH_BLOCKED_ACCOUNT
 * email in use   → 409 AUTH_EMAIL_ALREADY_USED
 * unverified     → 403 AUTH_EMAIL_NOT_VERIFIED (linking an invitation only)
 * otherwise      → auto-provision with the default USER role
 *
 * These journeys sign in DURING the test, in their own context, because the
 * thing under test is the establishment of the session — a persisted
 * storageState would skip precisely what is being asserted. The BFF's callback
 * never talks to Spring, so a refusal surfaces on the first proxied API call,
 * not on the redirect back.
 */
test.describe('authentication — provisioning and refusals', () => {
	async function currentUser(page: Page) {
		return registryApi(page).raw('GET', '/api/v1/authentication/user/current')
	}

	/**
	 * peekSession never mints a session cookie, so an anonymous visit leaves
	 * nothing to hijack. Asserted on the public landing page, the rewrite's entry
	 * point for an unauthenticated visitor.
	 *
	 * The oracle words this as "no cookie is set", but the app does set one:
	 * `registry-system-dark`, the client-side prefers-color-scheme hint
	 * that lets the first SSR paint match the visitor's mode. It carries no
	 * identity, so the assertion is on the property that actually matters —
	 * nothing session-bearing — rather than on a bare count, which would fail on
	 * a functional cookie while still passing if a session cookie replaced it.
	 */
	test('an anonymous visitor is issued no session cookie', async ({ browser, baseURL }) => {
		// Arrange
		const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } })
		const page = await context.newPage()

		try {
			// Act
			await page.goto('/')
			await expect(page.getByRole('button', { name: /log in|se connecter/i }).first()).toBeVisible()

			// Assert
			const cookies = await context.cookies()
			const sessionBearing = cookies.filter(cookie =>
				cookie.name.startsWith('registry-session') || cookie.name.startsWith('registry-login'))
			expect(sessionBearing, 'an anonymous visit must mint no session').toEqual([])
			expect(cookies.every(cookie => !cookie.httpOnly), 'nothing server-sealed is set').toBe(true)
		} finally {
			await context.close()
		}
	})

	/**
	 * `fresh` is deliberately absent from ci/seed/seed.sql, so this is a genuine
	 * first contact. Its backend row is deleted afterwards to leave the next run
	 * the same unprovisioned starting point.
	 */
	test('a first sign-in provisions the account with the default role', async ({ browser, baseURL, api }) => {
		// Arrange
		const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } })
		const page = await context.newPage()

		try {
			// Act
			await signInThroughIdp(page, account('fresh').username, idpPassword())
			await page.waitForURL(url => url.href.startsWith(baseURL!))

			// Assert
			const response = await currentUser(page)
			expect(response.ok(), `the new account is provisioned (${response.status()})`).toBeTruthy()
			const user = await response.json()
			expect(roleOf(user)).toBe('USER')
		} finally {
			await context.close()
			await purgeUserByEmail(api, account('fresh').email)
		}
	})

	/**
	 * The collision is refused before any row is written, which is what makes
	 * this repeatable: `clash` carries the administrator's email on a different
	 * provider identity, and the administrator's row already holds an oidc_id,
	 * so the link path is never taken.
	 */
	test('an email already tied to another identity is refused', async ({ browser, baseURL }) => {
		// Arrange
		const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } })
		const page = await context.newPage()

		try {
			// Act
			await signInThroughIdp(page, account('clash').username, idpPassword())
			await page.waitForURL(url => url.href.startsWith(baseURL!))

			// Assert
			const response = await currentUser(page)
			expect(response.status(), 'a duplicate email must be refused').toBeGreaterThanOrEqual(400)
			expect(await response.text()).toContain('AUTH_EMAIL_ALREADY_USED')
		} finally {
			await context.close()
		}
	})

	/**
	 * The address is identity-grade evidence only when the IdP vouches for it:
	 * claiming an invitation hands the caller a role and pending project profiles
	 * somebody else set up, so an unverified claim must not be allowed to. Only the
	 * LINK path is gated — a brand-new identity self-registers unprivileged, which
	 * is what the first-sign-in journey above asserts.
	 *
	 * `unverified` is seeded as an invitation (ci/seed/seed.sql) and its Authentik
	 * account carries `email_verified: false`. Refused before any row is written,
	 * so like the collision above it needs no cleanup and never drifts.
	 *
	 * The API exposes no link state, so "still unclaimed" is asserted the way it is
	 * observable: the address still resolves to exactly one row, the same one, so
	 * nothing was linked, duplicated or self-registered alongside it.
	 */
	test('an invitation is not claimed by an identity whose address is unverified', async ({ browser, baseURL, api }) => {
		// Arrange
		const invited = await findUserByEmail(api, account('unverified').email)
		const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } })
		const page = await context.newPage()

		try {
			// Act
			await signInThroughIdp(page, account('unverified').username, idpPassword())
			await page.waitForURL(url => url.href.startsWith(baseURL!))

			// Assert
			const response = await currentUser(page)
			expect(response.status(), 'an unverified address must not claim an invitation').toBe(403)
			expect(await response.text()).toContain('AUTH_EMAIL_NOT_VERIFIED')

			const rows = (await directory(api)).filter(user => user.email === account('unverified').email)
			expect(rows.map(row => row.id), 'the refusal wrote nothing').toEqual([invited.id])
		} finally {
			await context.close()
		}
	})

	/**
	 * Blocking is reversible, so the journey asserts both halves; `blocked` is a
	 * dedicated account so neither half can disturb a session another spec holds.
	 */
	test('a blocked account is refused at sign-in, and unblocking restores it', async ({ browser, baseURL, api }) => {
		// Arrange
		const target = await findUserByEmail(api, account('blocked').email)
		await api.post(`/api/v2/users/${target.id}/block`)
		const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } })
		const page = await context.newPage()

		try {
			// Act
			await signInThroughIdp(page, account('blocked').username, idpPassword())
			await page.waitForURL(url => url.href.startsWith(baseURL!))

			// Assert
			const refused = await currentUser(page)
			expect(refused.status(), 'a blocked account must be refused').toBeGreaterThanOrEqual(400)
			expect(await refused.text()).toContain('AUTH_BLOCKED_ACCOUNT')

			await api.post(`/api/v2/users/${target.id}/unblock`)
			await expect(async () => {
				const restored = await currentUser(page)
				expect(restored.ok(), `unblocking restores access (${restored.status()})`).toBeTruthy()
			}).toPass({ timeout: 15000 })
		} finally {
			await context.close()
			await api.raw('POST', `/api/v2/users/${target.id}/unblock`)
		}
	})

	/**
	 * Erasure leaves nothing behind, so the identity is free again: the second
	 * sign-in provisions a NEW account rather than being refused. That self-healing
	 * is the point — the old anonymized row kept its oidc_id, which both blocked the
	 * identity for good and could not be deleted through the API, so an environment
	 * that survived between runs poisoned this journey permanently.
	 */
	test('a deleted account signs in again as a new one', async ({ browser, baseURL, api }) => {
		// Arrange
		const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } })
		const page = await context.newPage()

		try {
			await signInThroughIdp(page, account('burn').username, idpPassword())
			await page.waitForURL(url => url.href.startsWith(baseURL!))
			expect((await currentUser(page)).ok(), 'the account exists before it is deleted').toBeTruthy()
			const before = await findUserByEmail(api, account('burn').email)

			// Act
			await api.remove(`/api/v2/users/${before.id}`)

			// Assert
			expect(await findUserIdByEmail(api, account('burn').email),
				'the row is gone from the directory').toBeUndefined()

			const second = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } })
			try {
				const secondPage = await second.newPage()
				await signInThroughIdp(secondPage, account('burn').username, idpPassword())
				await secondPage.waitForURL(url => url.href.startsWith(baseURL!))
				expect((await currentUser(secondPage)).ok(), 'signing in again provisions a new account').toBeTruthy()

				const after = await findUserByEmail(api, account('burn').email)
				expect(after.id, 'it is a different account, not the old one').not.toBe(before.id)
				expect(roleOf(after), 'provisioned with the default role').toBe('USER')
			} finally {
				await second.close()
			}
		} finally {
			await context.close()
			await purgeUserByEmail(api, account('burn').email)
		}
	})
})
