import { clickUntilVisible, expectDisableThenDelete } from './support/antd'
import { OPTION } from './support/domain'
import { expect, type ProjectHandle, test } from './support/fixtures'

/**
 * Vehicles are option-gated (VEHICLE), so the project is seeded with it.
 */
test.describe('vehicle lifecycle (Nuxt rewrite)', () => {
	let project: ProjectHandle

	test.beforeEach(async ({ page, projects }) => {
		project = await projects.create({ name: 'vehicles', options: [OPTION.VEHICLE] })
		await page.goto(`/projects/${project.id}/vehicles`)
	})

	test('create, disable, then delete a vehicle via test hooks', async ({ page }) => {
		await clickUntilVisible(page.getByTestId('vehicle-create'), page.getByTestId('vehicle-form-licenseplate'))
		await page.getByTestId('vehicle-form-licenseplate').fill('AB-123-CD')
		await page.getByTestId('vehicle-form-brand').fill('Renault')
		await page.getByTestId('vehicle-form-model').fill('Trafic')
		await page.getByTestId('vehicle-form-submit').click()

		const row = page.getByTestId('vehicle-row').filter({ hasText: /AB-123-CD/i })
		await expect(row).toBeVisible()

		await expectDisableThenDelete(page, 'vehicle', row, /AB-123-CD/i)
	})
})
