import { clickUntilVisible, expectDisableThenDelete } from './support/antd'
import { OPTION } from './support/domain'
import { expect, type ProjectHandle, test } from './support/fixtures'

/**
 * Activities are option-gated (ACTIVITY), so the project is seeded with it.
 */
test.describe('activity lifecycle (Nuxt rewrite)', () => {
	let project: ProjectHandle

	test.beforeEach(async ({ page, projects }) => {
		project = await projects.create({ name: 'activities', options: [OPTION.ACTIVITY] })
		await page.goto(`/projects/${project.id}/activities`)
	})

	test('create, disable, then delete an activity via test hooks', async ({ page }) => {
		await clickUntilVisible(page.getByTestId('activity-create'), page.getByTestId('activity-form-name'))
		await page.getByTestId('activity-form-name').fill('Randonnée en forêt')
		await page.getByTestId('activity-form-submit').click()

		const row = page.getByTestId('activity-row').filter({ hasText: /randonnée/i })
		await expect(row).toBeVisible()

		await expectDisableThenDelete(page, 'activity', row, /randonnée/i)
	})
})
