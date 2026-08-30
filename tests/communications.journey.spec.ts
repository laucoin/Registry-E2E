import { drawerTitle, fillDateTime, selectItem, sendThreadMessage } from './support/antd'
import { OPTIONS_ALERT, seedActivity, seedAlert, seedMovement, seedParticipant, } from './support/domain'
import { expect, type ProjectHandle, test } from './support/fixtures'

/**
 * Communications are entity-only (QA U4)
 * — no standalone page; the thread drawer on the parent record is the ONLY
 * surface. This journey covers the ALERT thread (movement threads are covered
 * by movement-comms.spec.ts): the standalone route is gone, the alert row
 * opens its thread (already holding the transactional initial communication),
 * and a message can be composed, edited and deleted in place. The seeded
 * project enables all three options because COMMUNICATION needs ACTIVITY and
 * the ALERT target needs both (backend option graph).
 */
test.describe('communication threads (Nuxt rewrite)', () => {
	let project: ProjectHandle

	test.beforeEach(async ({ api, projects }) => {
		project = await projects.create({ name: 'communications', options: OPTIONS_ALERT })
		await seedAlert(api, project.id, {
			title: 'Thread target',
			dateTime: '2026-07-10T09:00:00.000Z',
			message: 'Départ signalé.',
		})
	})

	test('the standalone communications page is gone', async ({ page }) => {
		const response = await page.goto(`/projects/${project.id}/communications`)
		expect(response?.status()).toBe(404)
		await expect(page.getByTestId('project-tab-communications')).toHaveCount(0)
	})

	/**
	 * The thread opens already holding the transactional initial communication;
	 * a composed message is pre-attached to the alert (no attach picker), then
	 * edited and deleted in place.
	 */
	test('an alert thread reads, composes, edits and deletes in place', async ({ page }) => {
		await page.goto(`/projects/${project.id}/alerts`)

		await page.getByTestId('alert-communications').click()
		await expect(page.getByTestId('alert-thread-drawer')).toBeVisible()
		await expect(page.getByTestId('alert-thread-list')).toContainText(/départ signalé/i)

		await page.getByTestId('thread-message').fill('Point de situation.')
		await fillDateTime(page, 'thread-datetime', '2026-07-12 10:00:00')
		await page.getByTestId('thread-send').click()
		await expect(page.getByTestId('alert-thread-list')).toContainText(/point de situation/i)

		const sent = page.locator('.thread__item').filter({ hasText: /point de situation/i })
		await sent.locator('[data-testid^=thread-edit-]').click()
		await sendThreadMessage(page, 'Point de situation (corrigé).')
		await expect(page.getByTestId('alert-thread-list')).toContainText(/corrigé/i)

		const edited = page.locator('.thread__item').filter({ hasText: /corrigé/i })
		await edited.locator('[data-testid^=thread-delete-]').click()
		await page.getByTestId('thread-delete-confirm').click()
		await expect(page.getByTestId('alert-thread-list')).not.toContainText(/corrigé/i)
	})

	/**
	 * Seeds an ongoing activity outing to lend its voice, dated BEFORE the
	 * seeded alert: a communication can't predate its linked movement
	 * (validateNoMovementConflict) and the composer prefills the alert's
	 * dateTime. In the movement thread the voice toggle posts "as the
	 * movement"; in the alert thread attaching the outing IS the movement
	 * voice.
	 */
	test('messages can speak with the movement voice in both threads', async ({ page, api }) => {
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Ana',
			lastName: 'Out',
			birthday: '1990-01-01',
		})
		const activityId = await seedActivity(api, project.id, { name: 'Rando' })
		await seedMovement(api, project.id, {
			type: 'OUT',
			dateTime: '2026-07-05T08:00:00.000Z',
			activityId,
			content: [{ participantId }],
		})

		await page.goto(`/projects/${project.id}/movements`)
		await page.getByTestId('movement-communications').click()
		await expect(page.getByTestId('movement-thread-drawer')).toBeVisible()
		await page.getByTestId('thread-voice').getByText(/au nom du mouvement|as the movement/i).click()
		await sendThreadMessage(page, 'RAS, on continue.')
		const voiced = page.locator('.thread__item').filter({ hasText: /on continue/i })
		await expect(voiced.locator('.thread__author--movement')).toContainText(/rando/i)

		await sendThreadMessage(page, 'Bien noté.')
		const own = page.locator('.thread__item').filter({ hasText: /bien noté/i })
		await expect(own.locator('.thread__author--movement')).toHaveCount(0)
		await page.keyboard.press('Escape')

		await page.goto(`/projects/${project.id}/alerts`)
		await page.getByTestId('alert-communications').click()
		await expect(page.getByTestId('alert-thread-drawer')).toBeVisible()
		await page.getByTestId('thread-voice-movement').click()
		await selectItem(page, /rando/i).click()
		await drawerTitle(page).click()
		await page.getByTestId('thread-voice').getByText(/au nom du mouvement|as the movement/i).click()
		await sendThreadMessage(page, 'Le groupe est à l’abri.')
		const alertVoiced = page.locator('.thread__item').filter({ hasText: /à l’abri/i })
		await expect(alertVoiced.locator('.thread__author--movement')).toContainText(/rando/i)
	})

	/**
	 * Attaching a movement to an alert message and SIGNING it as that movement
	 * used to be the same gesture, so there was no way to say "this is me,
	 * about that outing". The voice is now an explicit choice on both kinds of
	 * thread.
	 */
	test('an alert message can be attached to a movement and still be signed by me', async ({
																								page,
																								api,
																								projects
																							}) => {
		// Arrange
		const project = await projects.create({ options: OPTIONS_ALERT })
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Own',
			lastName: 'Voice',
			birthday: '1990-01-01',
		})
		const activityId = await seedActivity(api, project.id, { name: 'Rando' })
		await seedMovement(api, project.id, { type: 'OUT', activityId, content: [{ participantId }] })
		await seedAlert(api, project.id, { title: 'Orage', dateTime: '2026-07-12T08:00:00.000Z' })

		// Act
		await page.goto(`/projects/${project.id}/alerts`)
		await page.getByTestId('alert-communications').click()
		await expect(page.getByTestId('alert-thread-drawer')).toBeVisible()
		await page.getByTestId('thread-voice-movement').click()
		await selectItem(page, /rando/i).click()
		await drawerTitle(page).click()
		await sendThreadMessage(page, 'Je confirme depuis la base.')

		// Assert
		const mine = page.locator('.thread__item').filter({ hasText: /depuis la base/i })
		await expect(mine.locator('.thread__author--movement')).toHaveCount(0)
	})
})
