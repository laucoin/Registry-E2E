import { clickUntilVisible, fillDateTime } from './support/antd'
import { OPTIONS_ALERT } from './support/domain'
import { expect, type ProjectHandle, test } from './support/fixtures'

/**
 * Alert create → the status verb cycle
 * (resolve → reopen → cancel), asserted through the flipping available actions.
 * The opening message is optional and only a written one opens the thread, so an
 * alert raised with a title alone stays deletable — it used to spawn a blank
 * communication and trip ALERT_DELETE_HAS_COMMUNICATION on its own.
 * Alerts are option-gated (ALERT), which itself depends on ACTIVITY +
 * COMMUNICATION (backend option graph), so the seeded project enables all three.
 */
test.describe('alert lifecycle (Nuxt rewrite)', () => {
	let project: ProjectHandle

	test.beforeEach(async ({ page, projects }) => {
		project = await projects.create({ name: 'alerts', options: OPTIONS_ALERT })
		await page.goto(`/projects/${project.id}/alerts`)
	})

	test('create an alert and drive its status verb cycle via test hooks', async ({ page }) => {
		await clickUntilVisible(page.getByTestId('alert-create'), page.getByTestId('alert-form-title'))
		await page.getByTestId('alert-form-title').fill('Alerte test')
		await fillDateTime(page, 'alert-form-datetime', '2026-07-15 09:00:00')
		await page.getByTestId('alert-form-submit').click()

		const row = page.getByTestId('alert-row').filter({ hasText: /alerte test/i })
		await expect(row).toBeVisible()

		await row.getByTestId('alert-row-actions').click()
		await page.getByTestId('alert-action-resolve').click()
		await row.getByTestId('alert-row-actions').click()
		await expect(page.getByTestId('alert-action-reopen')).toBeVisible()

		await page.getByTestId('alert-action-reopen').click()
		await row.getByTestId('alert-row-actions').click()
		await expect(page.getByTestId('alert-action-resolve')).toBeVisible()

		await page.getByTestId('alert-action-cancel').click()
		await row.getByTestId('alert-row-actions').click()
		await expect(page.getByTestId('alert-action-reopen')).toBeVisible()
	})

	/**
	 * The opening message is optional, so leaving it blank must open no thread at
	 * all. Deletion is the observable proof: the backend refuses to delete an
	 * alert that carries communications (ALERT_DELETE_HAS_COMMUNICATION), so an
	 * alert raised with a title alone used to be undeletable because of a blank
	 * message it never carried.
	 */
	test('an alert raised without a message opens no thread and stays deletable', async ({ page }) => {
		// Arrange
		await clickUntilVisible(page.getByTestId('alert-create'), page.getByTestId('alert-form-title'))
		await page.getByTestId('alert-form-title').fill('Alerte muette')
		await fillDateTime(page, 'alert-form-datetime', '2026-07-15 09:00:00')

		// Act
		await page.getByTestId('alert-form-submit').click()

		// Assert
		const row = page.getByTestId('alert-row').filter({ hasText: /alerte muette/i })
		await expect(row).toBeVisible()

		await row.getByTestId('alert-communications').click()
		await expect(page.getByTestId('alert-thread-drawer')).toBeVisible()
		await expect(page.getByTestId('alert-thread-list')).toBeHidden()
		await page.reload()

		await row.getByTestId('alert-row-actions').click()
		await page.getByTestId('alert-action-delete').click()
		await page.getByTestId('alert-delete-confirm').click()
		await expect(row).toBeHidden()
	})

	test('an alert raised with a message opens the thread with it', async ({ page }) => {
		// Arrange
		await clickUntilVisible(page.getByTestId('alert-create'), page.getByTestId('alert-form-title'))
		await page.getByTestId('alert-form-title').fill('Alerte bavarde')
		await fillDateTime(page, 'alert-form-datetime', '2026-07-15 09:00:00')
		await page.getByTestId('alert-form-message').fill('Le groupe est à l’abri')

		// Act
		await page.getByTestId('alert-form-submit').click()

		// Assert
		const row = page.getByTestId('alert-row').filter({ hasText: /alerte bavarde/i })
		await expect(row).toBeVisible()

		await row.getByTestId('alert-communications').click()
		const thread = page.getByTestId('alert-thread-list')
		await expect(thread).toBeVisible()
		await expect(thread.locator('li')).toHaveCount(1)
		await expect(thread).toContainText('Le groupe est à l’abri')
	})
})
