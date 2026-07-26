import { expect, test } from '@playwright/test'

// ADR 021 — parity journey: users administration (read-only assertions).
// Captured against the Angular app 2026-07-25. Requires the seeded admin
// test user (the list needs REGISTRY_USER_R).

test.describe('users administration', () => {
    test('the users area lists accounts with role and status', async ({ page }) => {
        await page.goto('/users')

        // The seeded users appear with their role label and an active status.
        //  : the Angular app joins first/last name with a non-breaking space.
        await expect(page.getByText(/spike[\s ]+test/i).first()).toBeVisible()
        await expect(page.getByText(/administrat/i).first()).toBeVisible()
        await expect(page.getByText(/actif|active/i).first()).toBeVisible()
    })

    test('the list offers search & filter and shows its data freshness', async ({ page }) => {
        await page.goto('/users')

        await expect(page.getByText(/rechercher & filtrer|search & filter/i).first()).toBeVisible()
        await expect(page.getByText(/dernière actualisation|last refresh/i).first()).toBeVisible()
    })
})
