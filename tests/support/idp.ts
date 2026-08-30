import { expect, type Page } from '@playwright/test'

/**
 * Reach the IdP sign-in from the app root. The landing page needs its login
 * button clicked — and SSR renders that button before hydration attaches the
 * handler, so the click retries until
 * navigation actually happens. Authentik serves its login under the flow
 * executor route (/if/flow/<slug>/), so that path — not Keycloak's /realms/ —
 * marks that we have left the app and reached the IdP.
 */
export async function reachIdpSignIn(page: Page): Promise<void> {
	await page.goto('/')
	await expect(async () => {
		if (!page.url().includes('/flow/')) {
			const loginButton = page.getByRole('button', { name: /log in|se connecter/i }).first()
			if (await loginButton.count() > 0) {
				await loginButton.click()
			}
			await page.waitForURL(/\/flow\//, { timeout: 3000 })
		}
	}).toPass({ timeout: 20000 })
	await expect(identificationField(page)).toBeVisible()
}

/**
 * The identification stage renders a single textbox named "Email or Username"
 * (locale dependent — Authentik falls back to English when a translation is
 * missing).
 */
export function identificationField(page: Page) {
	return page.getByRole('textbox', { name: /email|username|utilisateur|identifiant/i })
}

/**
 * Authentik's default authentication flow is two-staged: the identification
 * stage takes the username and advances, then the password stage takes the
 * secret. Both advance with a "Continue"/"Log in" button.
 *
 * Lives here rather than in auth.setup.ts because the provisioning and
 * session-lifetime journeys sign in DURING the test — they assert what happens
 * as a session is established, so they cannot inherit a persisted one.
 */
export async function signInThroughIdp(page: Page, username: string, password: string): Promise<void> {
	await reachIdpSignIn(page)
	await identificationField(page).fill(username)
	await page.getByRole('button', { name: /continue|log in|sign in/i }).click()
	await page.getByLabel(/password|mot de passe/i).fill(password)
	await page.getByRole('button', { name: /continue|log in|sign in/i }).click()
}

export function idpPassword(): string {
	const password = process.env.E2E_PASSWORD
	if (!password) {
		throw new Error('E2E_PASSWORD must be set (see .env.example)')
	}
	return password
}
