import { account } from './support/actors'
import { clickUntilVisible } from './support/antd'
import { expect, test } from './support/fixtures'
import { identificationField, idpPassword, signInThroughIdp } from './support/idp'
import { purgeUserByEmail } from './support/users'

/**
 * critical-scenarios.md §1 — how a session ENDS. Sign-out is RP-initiated:
 * the BFF clears both sealed cookies and hands back the IdP
 * end-session URL for the browser to follow, so "signed out" has to mean both
 * that the local session is gone AND that a protected page bounces back to
 * sign-in rather than rendering from a stale cache.
 *
 * Signs in inside the test, in its own context, and uses the disposable `signout`
 * account rather than a persisted one: RP-initiated logout ends the IdP session
 * too, which would rotate the refresh token behind an actor whose storageState
 * every later journey depends on. `signout` is provisioned on first sign-in and
 * its row is deleted afterwards, so the account is left as it was found.
 *
 * Sign-out hands the browser to the IdP and LEAVES it there: Authentik ends the
 * flow on its own sign-in page rather than the `post_logout_redirect_uri` the BFF
 * asks for. That is the IdP's behaviour, not a Registry contract — the scenario
 * only requires the session gone and a protected page sending the user back to
 * sign-in — so the journey waits for the departure to the IdP rather than for a
 * return that never comes. Waiting on the app origin instead would pass instantly,
 * because the browser has not left yet when the click resolves; the next `goto`
 * would then abort the logout redirect in flight, the IdP session would survive,
 * and the protected page would silently sign the user straight back in through
 * SSO — precisely the defect this journey exists to catch.
 *
 * "Back to sign-in" is therefore the IdP's own prompt, not the app's landing
 * button: the auth middleware answers a protected route with a full-page redirect
 * to the BFF login route, so /projects never renders app chrome for a
 * signed-out visitor — the login button lives on the public landing page, a route
 * this journey never asks for.
 */
test.describe('authentication — signing out', () => {
	test('signing out clears the session', async ({ browser, baseURL, api }) => {
		// Arrange
		const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } })
		const page = await context.newPage()

		try {
			await signInThroughIdp(page, account('signout').username, idpPassword())
			await page.waitForURL(url => url.href.startsWith(baseURL!))
			await clickUntilVisible(page.getByTestId('header-avatar'), page.getByTestId('header-logout'))
			await expect(page.getByText(account('signout').displayName).first()).toBeVisible()
			expect((await page.request.get('/auth/me').then(r => r.json())).authenticated).toBe(true)

			// Act
			await page.getByTestId('header-logout').click()
			await page.waitForURL(/\/flow\//, { timeout: 20000 })

			// Assert
			await expect(async () => {
				const me = await page.request.get('/auth/me')
				expect((await me.json()).authenticated, 'the session must be cleared').toBe(false)
			}).toPass({ timeout: 20000 })

			await expect(identificationField(page), 'signing out lands on the IdP prompt').toBeVisible()

			await page.goto('/projects')
			await expect(page, 'a protected page bounces to the IdP').toHaveURL(/\/flow\//)
			await expect(identificationField(page)).toBeVisible()
			await expect(page.getByTestId('project-row')).toHaveCount(0)
		} finally {
			await context.close()
			await purgeUserByEmail(api, account('signout').email)
		}
	})

	/**
	 * Both /auth/login and the callback bounce to /?idp=down when the provider is
	 * unreachable (a TypeError from the code exchange is a network failure, not
	 * an OIDC error). The user-visible contract is what this asserts: the public
	 * landing page with a translated explanation, never a connection error page.
	 * Taking Authentik down for real would break every other journey in the run,
	 * so the degraded surface is reached through the route the BFF redirects to.
	 */
	test('an unreachable identity provider degrades gracefully', async ({ browser, baseURL }) => {
		// Arrange
		const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } })
		const page = await context.newPage()

		try {
			// Act
			await page.goto('/?idp=down')

			// Assert
			await expect(page.getByRole('alert')).toContainText(
				/connexion indisponible|sign-in unavailable/i,
			)
			await expect(page.getByRole('alert')).toContainText(
				/fournisseur d'identité|identity provider/i,
			)
			await expect(page.getByRole('button', { name: /log in|se connecter/i }).first()).toBeVisible()
		} finally {
			await context.close()
		}
	})
})
