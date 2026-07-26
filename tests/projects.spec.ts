import { expect, test } from '@playwright/test'

/**
 * Parity journey: project lifecycle (the CRUD reference shape for
 * all domain journeys). Creates its own data and deletes it again, so the
 * suite leaves the environment as it found it.
 */

test.describe('projects', () => {
	/**
	 * Creates through the two-step wizard (Informations → Options) on the
	 * normal dated path — a date-less create succeeds in the DB but 500s on the
	 * response, a pre-existing v1 bug (see the suite README). fill() bypasses
	 * the datepicker's parsing, so date/time values go in as real keystrokes +
	 * blur. The wizard exposes properly LABELLED date/time fields, so
	 * the fields are selected by label, with the positional combobox kept as a
	 * fallback. The wizard
	 * stays put after creating, so the test waits on the create call (v1 or v2
	 * path) itself, then deletes the project again via the row's options menu.
	 */
	test('a project can be created and deleted again', async ({ page }) => {
		const name = `E2E Parity ${Date.now()}`

		await page.goto('/projects/create')
		await page.getByPlaceholder(/camp/i).fill(name)
		const pickerFields: Array<[RegExp, string, string]> = [
			[/date de début|start date/i, '01/08/2026', '2026-08-01'],
			[/heure de début|start time/i, '08:00', '08:00'],
			[/date de fin|end date/i, '31/08/2026', '2026-08-31'],
			[/heure de fin|end time/i, '18:00', '18:00'],
		]
		const legacyPickers = page.getByRole('combobox')
		for (const [index, field] of pickerFields.entries()) {
			const [label, legacyValue, labelledValue] = field
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
		const created = page.waitForResponse(
			response => /\/api\/v\d\/projects$/.test(response.url()) && response.request().method() === 'POST',
		)
		await page.getByRole('button', { name: /créer|create/i }).last().click()
		expect((await created).status()).toBeLessThan(300)

		await page.goto('/projects')
		await expect(page.getByText(name).first()).toBeVisible()

		await page.getByRole('button', { name: /menu\.options|options/i }).first().click()
		await page.getByText(/supprimer|delete/i).first().click()
		await page.getByRole('button', { name: /oui|supprimer|confirm|yes/i }).last().click()

		await expect(page.getByText(name)).toHaveCount(0, { timeout: 10_000 })
	})
})
