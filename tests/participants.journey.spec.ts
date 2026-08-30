import { clickUntilVisible, expectDisableThenDelete, fillDate } from './support/antd'
import { expect, type ProjectHandle, test } from './support/fixtures'

/**
 * A domain WRITE journey (the parity suite covers the
 * shared global surfaces; the per-domain write drawers are Nuxt-only). Reference
 * pattern for the other domains: seed a project through the BFF, then drive the
 * full create → transition → delete lifecycle purely through data-testid hooks.
 */
test.describe('participant lifecycle (Nuxt rewrite)', () => {
	let project: ProjectHandle

	/**
	 * The fresh navigation after creating matters: it re-resolves the session
	 * profile (SSR), so the new project's scoped authorities are present for
	 * the project-authority guard.
	 */
	test.beforeEach(async ({ page, projects }) => {
		project = await projects.create({ name: 'participants' })
		await page.goto(`/projects/${project.id}/participants`)
	})

	/**
	 * AntD Input forwards the testid onto the <input> itself, so text fields
	 * fill directly; the DatePicker keeps the testid on its wrapper and its
	 * input is readonly, so the birthday is opened and typed, not fill()ed.
	 */
	test('create, disable, then delete a participant via test hooks', async ({ page }) => {
		await clickUntilVisible(page.getByTestId('participant-create'), page.getByTestId('participant-form-firstname'))
		await page.getByTestId('participant-form-firstname').fill('Journey')
		await page.getByTestId('participant-form-lastname').fill('Tester')
		await fillDate(page, 'participant-form-birthday', '2000-05-10')
		await page.getByTestId('participant-form-submit').click()

		const row = page.getByTestId('participant-row').filter({ hasText: /journey/i })
		await expect(row).toBeVisible()

		await expectDisableThenDelete(page, 'participant', row, /journey/i)
	})
})
