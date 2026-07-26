import { expect, test as setup } from '@playwright/test'
import { reachIdpSignIn } from './support/idp'

// ADR 021 — the login FIXTURE is the one piece allowed to differ per target:
// the Angular app auto-redirects unauthenticated visitors to the IdP, the Nuxt
// app shows a landing page with a login button. The asserted journey (sign in
// at the IdP, land back authenticated) is identical.
setup('sign in through the IdP and persist the session', async ({ page }, testInfo) => {
    const username = process.env.E2E_USERNAME
    const password = process.env.E2E_PASSWORD
    if (!username || !password) {
        throw new Error('E2E_USERNAME / E2E_PASSWORD must be set (see .env.example)')
    }

    await reachIdpSignIn(page)
    await page.getByRole('textbox', { name: /email/i }).fill(username)
    await page.getByRole('textbox', { name: /password/i }).fill(password)
    await page.getByRole('button', { name: /sign in/i }).click()

    // Back in the app, authenticated: the user identity is visible.
    await page.waitForURL(url => url.href.startsWith(testInfo.project.use.baseURL as string))
    await expect(page.getByText(/spike/i).first()).toBeVisible()

    const target = testInfo.project.name.replace('-setup', '')
    await page.context().storageState({ path: `.auth/${target}.json` })
})
