import { expect, type Page } from '@playwright/test'

// Reach the IdP sign-in from the app root. Angular redirects on its own; the
// Nuxt landing page needs its login button clicked — and SSR renders that
// button before hydration attaches the handler, so the click retries until
// navigation actually happens.
export async function reachIdpSignIn(page: Page): Promise<void> {
    await page.goto('/')
    await expect(async () => {
        if (!page.url().includes('/realms/')) {
            const loginButton = page.getByRole('button', { name: /log in|se connecter/i }).first()
            if (await loginButton.count() > 0) {
                await loginButton.click()
            }
            await page.waitForURL(/\/realms\//, { timeout: 3000 })
        }
    }).toPass({ timeout: 20000 })
    await expect(page.getByRole('heading', { name: /sign in to your account/i })).toBeVisible()
}
