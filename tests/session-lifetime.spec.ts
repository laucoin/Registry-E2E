import { expect, test } from '@playwright/test'
import { account } from './support/actors'
import { idpPassword, signInThroughIdp } from './support/idp'

/**
 * critical-scenarios.md §1 — the time-dependent half of the session contract:
 * a two-tier server-side lifetime, an absolute cap plus a sliding
 * idle timeout, and a silent refresh in between.
 *
 * Runs ONLY under the `nuxt-session` Playwright project, against the dedicated
 * instance in ci/compose.e2e.yml with NUXT_SESSION_IDLE_MAX_AGE=30 and
 * NUXT_SESSION_MAX_AGE=90. Production values are 30 min and 8 h, which cannot
 * be observed in a test; lowering them on the main instance would expire every
 * other journey mid-run, so the lifetimes get their own server rather than the
 * suite getting a 30-minute sleep.
 *
 * Each journey signs in for itself — a session's beginning is what dates it.
 */
const IDLE_MAX_AGE_SECONDS = 30
const ABSOLUTE_MAX_AGE_SECONDS = 90

test.describe('session lifetime (short-session instance)', () => {
	test.describe.configure({ mode: 'serial', timeout: 180_000 })

	test.skip(
		() => !process.env.E2E_NUXT_SESSION_URL,
		'set E2E_NUXT_SESSION_URL to run against the short-session instance',
	)

	/**
	 * The access token dies well before the idle window does, so continuing to
	 * work across its lifetime must be invisible: the proxy refreshes once and
	 * replays, and no request surfaces a 401 to the user.
	 */
	test('an expiring access token is refreshed without signing me out', async ({ page, baseURL }) => {
		// Arrange
		await signInThroughIdp(page, account('member').username, idpPassword())
		await page.waitForURL(url => url.href.startsWith(baseURL!))

		const failures: number[] = []
		page.on('response', (response) => {
			if (response.url().includes('/api/') && response.status() === 401) {
				failures.push(response.status())
			}
		})

		// Act
		for (let tick = 0; tick < 4; tick += 1) {
			await page.waitForTimeout((IDLE_MAX_AGE_SECONDS / 3) * 1000)
			await page.goto('/projects')
			await expect(page.getByTestId('header-brand')).toBeVisible()
		}

		// Assert
		expect(failures, 'staying active must never surface a 401').toEqual([])
		expect((await page.request.get('/auth/me').then(r => r.json())).authenticated).toBe(true)
	})

	/**
	 * The refresh has to survive CONCURRENCY, not just the passage of time. A
	 * page fires many API calls at once, and requests already in flight still
	 * carry the previous cookie once one of them rotates the tokens. Replaying a
	 * consumed refresh token at the IdP is reuse, which Keycloak/Authentik answer
	 * by revoking the whole family — the live session dies and the user is told
	 * to sign in again for no reason. Bursts are fired across the token's
	 * lifetime because the damage only happens in the moments around a rotation.
	 */
	test('concurrent calls around a token rotation never cost me the session', async ({ page, baseURL }) => {
		// Arrange
		await signInThroughIdp(page, account('member').username, idpPassword())
		await page.waitForURL(url => url.href.startsWith(baseURL!))

		const reauthRequired: string[] = []
		page.on('response', (response) => {
			if (response.url().includes('/api/') && response.headers()['x-registry-reauth'] === '1') {
				reauthRequired.push(response.url())
			}
		})

		// Act
		const statuses: number[] = []
		for (let tick = 0; tick < 4; tick += 1) {
			await page.waitForTimeout((IDLE_MAX_AGE_SECONDS / 3) * 1000)
			const burst = await Promise.all(Array.from({ length: 8 }, () =>
				page.request.get('/api/v2/users/profiles?size=1')))
			statuses.push(...burst.map(response => response.status()))
		}

		// Assert
		expect(reauthRequired, 'a live session must never be asked to re-authenticate').toEqual([])
		expect(statuses.filter(status => status !== 200), 'every concurrent call is served').toEqual([])
		expect((await page.request.get('/auth/me').then(r => r.json())).authenticated).toBe(true)
	})

	/**
	 * The idle timeout is meant to be invisible when the IdP session is still
	 * alive: the app bounces through the provider and comes straight back to the
	 * page that was asked for, with no sign-in form and no error.
	 */
	test('an idle session self-heals on my next action', async ({ page, baseURL }) => {
		// Arrange
		await signInThroughIdp(page, account('member').username, idpPassword())
		await page.waitForURL(url => url.href.startsWith(baseURL!))

		// Act
		await page.waitForTimeout((IDLE_MAX_AGE_SECONDS + 10) * 1000)
		await page.goto('/projects')

		// Assert
		await expect(page).toHaveURL(/\/projects\/?$/)
		await expect(page.getByTestId('header-brand')).toBeVisible()
		await expect(page.getByRole('alert')).toHaveCount(0)
		expect((await page.request.get('/auth/me').then(r => r.json())).authenticated).toBe(true)
	})

	/**
	 * The absolute cap is the one that must NOT self-heal silently into an
	 * unbounded session: it applies from login regardless of activity, so a
	 * continuously busy session still ends. Staying active throughout is the
	 * point — it is what separates this from the idle timeout above.
	 */
	test('the absolute session cap applies regardless of activity', async ({ page, baseURL }) => {
		// Arrange
		await signInThroughIdp(page, account('member').username, idpPassword())
		await page.waitForURL(url => url.href.startsWith(baseURL!))
		const sealedAt = Date.now()

		// Act
		while (Date.now() - sealedAt < (ABSOLUTE_MAX_AGE_SECONDS + 15) * 1000) {
			await page.waitForTimeout(10_000)
			await page.request.get('/api/v2/users/profiles?size=1')
		}

		// Assert
		const me = await page.request.get('/auth/me').then(r => r.json())
		expect(me.authenticated, 'the absolute cap ends even a continuously active session').toBe(false)
	})
})
