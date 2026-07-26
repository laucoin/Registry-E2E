import { expect, test } from '@playwright/test'
import { reachIdpSignIn } from './support/idp'

// ADR 021 — parity journey: authentication & shell. Authored against the
// CURRENT Angular app (captured behaviour, 2026-07-25); the same assertions
// run against the Nuxt rewrite. Intended differences go through
// divergence-log.md, never silent loosening.

test.describe('unauthenticated access', () => {
    // No stored session for these journeys.
    test.use({ storageState: { cookies: [], origins: [] } })

    test('a visitor is taken to the IdP sign-in', async ({ page }) => {
        // Angular: automatic redirect to the IdP. Nuxt: a login button leads
        // there (recorded divergence: the rewrite has a public landing page).
        await reachIdpSignIn(page)
    })
})

test.describe('authenticated shell', () => {
    test('the signed-in user sees their identity and role', async ({ page }) => {
        await page.goto('/')

        await expect(page.getByText(/spike/i).first()).toBeVisible()
        await expect(page.getByText(/administrat/i).first()).toBeVisible()
    })

    test('the main navigation exposes the projects and users areas', async ({ page }) => {
        await page.goto('/')

        await expect(page.getByRole('link', { name: /projets|projects/i }).first()).toBeVisible()
        await expect(page.getByRole('link', { name: /utilisateurs|users/i }).first()).toBeVisible()
    })

    test('a user without projects is offered the first-project creation', async ({ page }) => {
        await page.goto('/projects')

        await expect(page.getByText(/bienvenue sur registry/i)).toBeVisible()
        await expect(page.getByRole('button', { name: /créer mon premier projet/i })).toBeVisible()
    })
})
