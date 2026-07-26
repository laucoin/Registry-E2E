import { drawerTitle } from './support/antd'
import { movementReason, OPTIONS_ALERT, seedAlert, seedMovement, seedParticipant, } from './support/domain'
import { expect, test } from './support/fixtures'

/**
 * Phase H (parity batch): the smaller parity items —
 * 1. per-entity movement history (participant/vehicle/activity → GET /{id}/movements)
 * 2. project enable/disable (POST /{id}/disable|enable) surfaced on the list card
 * 3. a live "in progress since" chronometer on open alerts (frontend only)
 * Each asserts the wired behaviour with API-seeded data + structural checks
 * (AntD date-pickers/selects stay out of the automation path).
 */
test.describe('parity batch — Phase H', () => {
	test('participant movement history lists the entity’s movements', async ({ page, api, project }) => {
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Nadia',
			lastName: 'Roux',
			birthday: '1992-02-02',
		})
		const reason = await movementReason(api, project.id)
		await seedMovement(api, project.id, {
			type: 'OUT',
			reason: reason.value,
			content: [{ participantId }],
		})

		await page.goto(`/projects/${project.id}/participants`)
		await page.getByTestId('participant-history').first().click()
		await expect(drawerTitle(page)).toContainText(/Movement history|Historique des mouvements/)
		await expect(page.getByTestId('movement-history-list').locator('li')).toHaveCount(1)
	})

	/**
	 * Disables via the API, then confirms the list shows the disabled state and
	 * re-enables through the card menu. The search lives in a collapsed panel,
	 * and Input.Search puts the testid on its wrapper, so the inner input is
	 * driven directly.
	 */
	test('project can be disabled and re-enabled from the list', async ({ page, api, projects }) => {
		const project = await projects.create()
		await api.post(`/api/v2/projects/${project.id}/disable`)

		await page.goto('/projects')
		await page.getByRole('button', { name: /Rechercher|Search/ }).click()
		const search = page.locator('.ant-input-search input').first()
		await search.fill(project.name)
		await search.press('Enter')

		const card = page.locator('.project-card', { hasText: project.name })
		await expect(card.getByTestId('project-disabled-tag')).toBeVisible()

		await card.getByTestId('project-row-actions').click()
		await page.getByTestId('project-action-enable').click()

		await expect(card.getByTestId('project-disabled-tag')).toHaveCount(0)
	})

	/**
	 * ALERT requires ACTIVITY + COMMUNICATION (option dependency graph), so the
	 * seeded project enables all three.
	 */
	test('open alerts show a live in-progress chronometer', async ({ page, api, projects }) => {
		const project = await projects.create({ options: OPTIONS_ALERT })
		await seedAlert(api, project.id, { title: 'Timer alert', dateTime: '2026-07-10T09:00:00.000Z' })

		await page.goto(`/projects/${project.id}/alerts`)
		const elapsed = page.getByTestId('alert-elapsed').first()
		await expect(elapsed).toBeVisible()
		await expect(elapsed).toContainText('⏱')
	})
})
