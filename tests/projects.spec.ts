import { expect, test } from '@playwright/test'

// ADR 021 — parity journey: project lifecycle (the CRUD reference shape for
// all domain journeys). Creates its own data and deletes it again, so the
// suite leaves the environment as it found it.

test.describe('projects', () => {
    test('a project can be created and deleted again', async ({ page }) => {

        const name = `E2E Parity ${Date.now()}`

        // Create — the two-step wizard (Informations → Options), using the
        // normal dated path. (Discovered while authoring: a date-less create
        // succeeds in the DB but 500s on the response — pre-existing v1 bug,
        // see the suite README.) Date/time inputs are targeted positionally:
        // the app's placeholders are randomized examples and the fields carry
        // no accessible labels (ADR 015 material).
        await page.goto('/projects/create')
        await page.getByPlaceholder(/camp/i).fill(name)
        // fill() bypasses the datepicker's parsing — real keystrokes + blur
        // are required for the value to reach the form model.
        // Recorded divergence: the rewrite exposes properly LABELLED date/time
        // fields (ADR 015); the Angular wizard only offers anonymous comboboxes
        // targeted positionally. Labels are preferred, positions are the
        // legacy fallback.
        const pickerFields: Array<[RegExp, string, string]> = [
            [ /date de début|start date/i, '01/08/2026', '2026-08-01' ],
            [ /heure de début|start time/i, '08:00', '08:00' ],
            [ /date de fin|end date/i, '31/08/2026', '2026-08-31' ],
            [ /heure de fin|end time/i, '18:00', '18:00' ],
        ]
        const legacyPickers = page.getByRole('combobox')
        for (const [ index, field ] of pickerFields.entries()) {
            const [ label, legacyValue, labelledValue ] = field
            const labelled = page.getByRole('textbox', { name: label })
            if (await labelled.count() > 0) {
                await labelled.pressSequentially(labelledValue)
            } else {
                await legacyPickers.nth(index).pressSequentially(legacyValue)
            }
            await page.keyboard.press('Tab')
        }
        await page.getByRole('button', { name: /suivant|next/i }).click()
        await expect(page.getByText(/tout sélectionner|select all/i)).toBeVisible()
        // The app stays on the wizard after creating — wait for the create
        // call itself (v1 or v2 path) to succeed before moving on.
        const created = page.waitForResponse(
            response => /\/api\/v\d\/projects$/.test(response.url()) && response.request().method() === 'POST',
        )
        await page.getByRole('button', { name: /créer|create/i }).last().click()
        expect((await created).status()).toBeLessThan(300)

        // The project exists and is visible in the projects area.
        await page.goto('/projects')
        await expect(page.getByText(name).first()).toBeVisible()

        // Delete — via the row's options menu, confirming the dialog.
        await page.getByRole('button', { name: /menu\.options|options/i }).first().click()
        await page.getByText(/supprimer|delete/i).first().click()
        await page.getByRole('button', { name: /oui|supprimer|confirm|yes/i }).last().click()

        // Gone again.
        await expect(page.getByText(name)).toHaveCount(0, { timeout: 10_000 })
    })
})
