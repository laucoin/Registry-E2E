import {
	OPTIONS_COMMUNICATION,
	SEED_DATE_TIME,
	seedActivity,
	seedCommunication,
	seedMovement,
	seedParticipant,
} from './support/domain'
import { expect, type ProjectHandle, test } from './support/fixtures'

/**
 * The live board of the project shell. It used to be a sub-tab of the project
 * home — a second tab bar under the first — and is a top-level tab of its own
 * now: Dashboard / Currently out, each its own route, one click from anywhere in
 * the project. The outings board that briefly sat between them is gone: the
 * dashboard panel it duplicated says the same thing on the page an operator
 * lands on, chronometer included.
 */
test.describe('project shell — the live board', () => {
	let project: ProjectHandle

	/**
	 * Seeds both kinds of exit: Ana leaves on an activity outing, Ben leaves
	 * classically, and a radio check-in communication is attached to the outing so
	 * its "last contact" chronometer counts from it.
	 */
	test.beforeEach(async ({ api, projects }) => {
		project = await projects.create({ name: 'live boards', options: OPTIONS_COMMUNICATION })
		const ana = await seedParticipant(api, project.id, {
			firstName: 'Ana',
			lastName: 'Out',
			birthday: '1990-01-01',
		})
		const ben = await seedParticipant(api, project.id, {
			firstName: 'Ben',
			lastName: 'Away',
			birthday: '1991-01-01',
		})
		const activityId = await seedActivity(api, project.id, { name: 'Rando' })
		const outingId = await seedMovement(api, project.id, {
			type: 'OUT',
			activityId,
			content: [{ participantId: ana }],
		})
		await seedCommunication(api, project.id, {
			movementId: outingId,
			dateTime: SEED_DATE_TIME,
			message: 'Contact radio.',
		})
		await seedMovement(api, project.id, {
			type: 'OUT',
			reason: 'SHOPPING',
			content: [{ participantId: ben }],
		})
	})

	/**
	 * The merge is the point of the assertion on `home-tab-*`: the project home
	 * carried its own bar (Dashboard / activities / movements) under the shell's,
	 * and an operator had to drill through two levels to reach a board. One bar
	 * is the contract now — a second one reappearing is the regression, and so is
	 * the outings tab coming back beside a dashboard that already draws it.
	 */
	test('one tab bar carries the dashboard and the board', async ({ page }) => {
		// Arrange
		await page.goto(`/projects/${project.id}`)

		// Assert
		await expect(page.getByTestId('project-tab-dashboard')).toBeVisible()
		await expect(page.getByTestId('project-tab-current')).toBeVisible()
		await expect(page.getByTestId('project-tab-ongoing'), 'the outings tab is the dashboard panel now')
			.toHaveCount(0)
		await expect(page.locator('[data-testid^=home-tab-]'), 'the home sub-tabs are gone').toHaveCount(0)

		// Assert
		const outingRow = page.getByTestId('ongoing-outing-row').first()
		await expect(outingRow).toContainText(/rando/i)
		await expect(outingRow).toContainText('⏱')
		await expect(outingRow).toContainText(/dernier contact|last contact/i)

		// Act + Assert
		await page.getByTestId('project-tab-current').click()
		await expect(page).toHaveURL(new RegExp(`/projects/${project.id}/current$`))
		await expect(page.getByTestId('presence-board-row')).toHaveCount(2)
		await expect(page.getByTestId('presence-board-list')).toContainText(/ana/i)
		await expect(page.getByTestId('presence-board-list')).toContainText(/ben/i)

		// Act + Assert
		await page.getByTestId('project-tab-dashboard').click()
		await expect(page).toHaveURL(new RegExp(`/projects/${project.id}$`))
		await expect(page.getByTestId('overview-presence')).toBeVisible()
	})

	/**
	 * The board is a route, so it is shareable and survives a reload — what the
	 * `?tab=` query used to provide before the levels were merged.
	 */
	test('the board deep-links to its own route', async ({ page }) => {
		// Act
		await page.goto(`/projects/${project.id}/current`)

		// Assert
		await expect(page.getByTestId('presence-board-row')).toHaveCount(2)
	})

	/**
	 * Both people left, so both read as out — the board says which state each one
	 * is in rather than listing only the missing and leaving the rest implied.
	 */
	test('the board states whether each person is in or out', async ({ page }) => {
		// Act
		await page.goto(`/projects/${project.id}/current`)

		// Assert
		await expect(page.getByTestId('presence-row-status')).toHaveCount(2)
		await expect(page.getByTestId('presence-row-status').first()).toContainText(/absent|away/i)
	})

	test('attendance “View all” opens the presence detail over the dashboard', async ({ page }) => {
		// Arrange
		await page.goto(`/projects/${project.id}`)

		// Act
		await page.getByTestId('overview-presence-view-all').click()

		// Assert
		await expect(page.getByTestId('presence-drawer-participants')).toBeVisible()
	})

	test('clicking an outing opens its communications thread', async ({ page }) => {
		await page.goto(`/projects/${project.id}`)
		await page.getByTestId('ongoing-outing-row').first().click()
		await expect(page.getByTestId('movement-thread-drawer')).toBeVisible()
		await expect(page.getByTestId('movement-thread-list')).toContainText(/contact radio/i)
	})
})
