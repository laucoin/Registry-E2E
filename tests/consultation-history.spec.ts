import { drawerTitle } from './support/antd'
import {
	OPTION,
	OPTIONS_COMMUNICATION,
	PROJECT_ROLE,
	seedActivity,
	seedMovement,
	seedParticipant,
	seedVehicle,
} from './support/domain'
import { expect, test } from './support/fixtures'

/**
 * critical-scenarios.md §15 — the per-entity movement history. Every entity that
 * can take part in a movement exposes one, and it is gated by its own
 * <DOMAIN>_HISTORY_R authority: PROJECT_PARTICIPANT is the one role that holds
 * read on participants but NOT their history (roles-and-permissions.md), which
 * makes it the case worth asserting.
 */
test.describe('consultation — movement history', () => {
	test('a vehicle’s movement history lists the movements it was assigned to', async ({ page, api, projects }) => {
		// Arrange
		const project = await projects.create({ options: [OPTION.VEHICLE] })
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Vehicle',
			lastName: 'Historian',
			birthday: '1990-01-01',
		})
		const vehicleId = await seedVehicle(api, project.id, {
			licensePlate: 'HI-789-ST',
			brand: 'Renault',
			model: 'Trafic',
		})
		await seedMovement(api, project.id, {
			type: 'OUT',
			reason: 'SHOPPING',
			content: [{ participantId, vehicleId }],
		})

		// Act
		await page.goto(`/projects/${project.id}/vehicles`)
		await page.getByTestId('vehicle-history').first().click()

		// Assert
		await expect(drawerTitle(page)).toContainText(/Movement history|Historique des mouvements/)
		await expect(page.getByTestId('movement-history-list').locator('li')).toHaveCount(1)
		await expect(page.getByTestId('movement-history-driver')).toContainText(/Vehicle HISTORIAN/i)
	})

	/**
	 * A vehicle's history is opened to find out WHO had it, so the participant it
	 * was assigned to is named on the row. Participants and activities have no
	 * such line: the entity being looked up IS the answer there.
	 */
	test('a participant’s movement history names no driver', async ({ page, api, projects }) => {
		// Arrange
		const project = await projects.create({ options: [OPTION.VEHICLE] })
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Solo',
			lastName: 'Walker',
			birthday: '1990-01-01',
		})
		const vehicleId = await seedVehicle(api, project.id, {
			licensePlate: 'NO-000-DR',
			brand: 'Peugeot',
			model: 'Boxer',
		})
		await seedMovement(api, project.id, {
			type: 'OUT',
			reason: 'SHOPPING',
			content: [{ participantId, vehicleId }],
		})

		// Act
		await page.goto(`/projects/${project.id}/participants`)
		await page.getByTestId('participant-history').first().click()

		// Assert
		await expect(page.getByTestId('movement-history-list').locator('li')).toHaveCount(1)
		await expect(page.getByTestId('movement-history-driver')).toHaveCount(0)
	})

	test('an activity’s movement history lists the outings it justified', async ({ page, api, projects }) => {
		// Arrange
		const project = await projects.create({ options: OPTIONS_COMMUNICATION })
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Activity',
			lastName: 'Historian',
			birthday: '1990-01-01',
		})
		const activityId = await seedActivity(api, project.id, { name: 'Rando' })
		await seedMovement(api, project.id, { type: 'OUT', activityId, content: [{ participantId }] })

		// Act
		await page.goto(`/projects/${project.id}/activities`)
		await page.getByTestId('activity-history').first().click()

		// Assert
		await expect(drawerTitle(page)).toContainText(/Movement history|Historique des mouvements/)
		await expect(page.getByTestId('movement-history-list').locator('li')).toHaveCount(1)
	})

	test('movement history is hidden from a role without the history permission', async ({
																							 api,
																							 project,
																							 grantRole,
																							 apiAs,
																							 pageAs
																						 }) => {
		// Arrange
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Hidden',
			lastName: 'History',
			birthday: '1990-01-01',
		})
		await seedMovement(api, project.id, { type: 'IN', content: [{ participantId }] })
		await grantRole(project.id, 'member', PROJECT_ROLE.PARTICIPANT)

		// Act
		const memberApi = await apiAs('member')
		const response = await memberApi.raw(
			'GET',
			`/api/v2/projects/${project.id}/participants/${participantId}/movements`,
		)

		// Assert
		expect(response.status(), 'a participant holds no history read').toBeGreaterThanOrEqual(400)
		const memberPage = await pageAs('member')
		await memberPage.goto(`/projects/${project.id}/participants`)
		await expect(memberPage.getByTestId('participant-history')).toHaveCount(0)
	})
})
