import { expect, test as setup } from '@playwright/test'
import { ACCOUNTS, storageStatePath } from './support/actors'
import { clickUntilVisible } from './support/antd'
import { signInThroughIdp } from './support/idp'

/**
 * One persisted session per seeded actor, so the refusal journeys can hold two
 * identities at once. Each account gets its own browser context so the
 * persisted states never share cookies.
 */
setup('sign in through the IdP and persist the sessions', async ({ browser }, testInfo) => {
	const password = process.env.E2E_PASSWORD
	if (!process.env.E2E_USERNAME || !password) {
		throw new Error('E2E_USERNAME / E2E_PASSWORD must be set (see .env.example)')
	}

	const baseURL = testInfo.project.use.baseURL as string
	const accounts = ACCOUNTS.filter(candidate => candidate.signInAtSetup)

	/**
	 * One full IdP round-trip per account, sequentially, in a single test — the
	 * 30 s default covers one sign-in but not several, and the budget has to grow
	 * with the roster rather than be a fixed number someone re-raises each time an
	 * account is added.
	 */
	setup.setTimeout(45_000 * accounts.length)

	for (const { actor, username, displayName } of accounts) {
		const context = await browser.newContext({ baseURL })
		const page = await context.newPage()
		try {
			await signInThroughIdp(page, username, password)
			await page.waitForURL(url => url.href.startsWith(baseURL))
			await expect(page.getByTestId('header-avatar')).toBeVisible()
			await clickUntilVisible(page.getByTestId('header-avatar'), page.getByTestId('header-user'))
			await expect(page.getByText(displayName).first()).toBeVisible()
			await context.storageState({ path: storageStatePath(actor) })
		} finally {
			await context.close()
		}
	}
})
