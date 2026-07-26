import { fillDateTime, selectItem } from './support/antd'
import {
	OPTION,
	OPTIONS_ALERT,
	OPTIONS_ALL,
	seedActivity,
	seedAlert,
	seedGroup,
	seedMovement,
	seedParticipant,
	todayIso,
} from './support/domain'
import { expect, test } from './support/fixtures'

/**
 * An hour before `SEED_DATE_TIME`, so an arrival seeded with it is unambiguously
 * older than an exit seeded with the default: presence reads the LAST movement,
 * and equal timestamps leave "last" undecided.
 */
const ARRIVAL_DATE_TIME = '2026-07-10T08:00:00.000Z'

/**
 * The dashboard and the domain lists read as a board someone works FROM, not a
 * report they read. Three things follow from that and are asserted here: a name
 * due today is a job you can start with one click, two parties out on the same
 * activity are told apart, and a hidden record is gone from the board entirely.
 */
test.describe('project home — acting on the board', () => {
	/**
	 * The whole reason a participant is listed under "arrivals today" is that
	 * somebody has to check them in, so the row opens the movement form pointed at
	 * them: right direction, right person, nothing to re-find in a picker.
	 *
	 * The form opens OVER the board rather than on the movements page — the board
	 * is a worklist, and being sent elsewhere for each name loses the operator's
	 * place in it — so the address must not move.
	 */
	test('an expected arrival opens the movement form pre-filled for that person', async ({ page, api, projects }) => {
		// Arrange
		const project = await projects.create({ options: OPTIONS_ALL })
		const expected = await seedParticipant(api, project.id, {
			firstName: 'Prefill',
			lastName: 'Arrival',
			birthday: '1990-01-01',
		})
		await api.patch(`/api/v2/projects/${project.id}/participants/${expected}`, {
			firstName: 'Prefill',
			lastName: 'Arrival',
			birthday: '1990-01-01',
			startAvailability: { date: todayIso() },
		})

		// Act
		await page.goto(`/projects/${project.id}`)
		await page.getByTestId('overview-arrivals-participant').first().click()

		// Assert
		await expect(page.getByTestId('movement-form-participants')).toContainText(/Prefill ARRIVAL/i)
		await expect(page, 'the board keeps its place').toHaveURL(new RegExp(`/projects/${project.id}$`))
		await expect(page.getByTestId('movement-form-type')).toBeVisible()
		const entry = page.getByTestId('movement-form-type').locator('input[value="IN"]')
		await expect(entry).toBeChecked()
	})

	/**
	 * A departure seeds the opposite direction — the panel it came from is the
	 * only thing that says which.
	 */
	test('an expected departure opens the movement form on an exit', async ({ page, api, projects }) => {
		// Arrange
		const project = await projects.create({ options: OPTIONS_ALL })
		const leaving = await seedParticipant(api, project.id, {
			firstName: 'Prefill',
			lastName: 'Departure',
			birthday: '1990-01-01',
		})
		await api.patch(`/api/v2/projects/${project.id}/participants/${leaving}`, {
			firstName: 'Prefill',
			lastName: 'Departure',
			birthday: '1990-01-01',
			endAvailability: { date: todayIso() },
		})
		await seedMovement(api, project.id, { type: 'IN', content: [{ participantId: leaving }] })

		// Act
		await page.goto(`/projects/${project.id}`)
		await page.getByTestId('overview-departures-participant').first().click()

		// Assert
		await expect(page.getByTestId('movement-form-type').locator('input[value="OUT"]')).toBeChecked()
		await expect(page.getByTestId('movement-form-participants')).toContainText(/Prefill DEPARTURE/i)
		await expect(page, 'the board keeps its place').toHaveURL(new RegExp(`/projects/${project.id}$`))
	})

	/**
	 * A group row seeds every member the movement can actually take, which is what
	 * makes the shortcut worth having on a coach-load of people.
	 */
	test('an expected group arrival pre-fills its members', async ({ page, api, projects }) => {
		// Arrange
		const project = await projects.create({ options: OPTIONS_ALL })
		const member = await seedParticipant(api, project.id, {
			firstName: 'Grouped',
			lastName: 'Member',
			birthday: '1990-01-01',
		})
		await seedGroup(api, project.id, {
			name: 'Prefill band',
			members: [member],
			startAvailability: { date: todayIso() },
		})

		// Act
		await page.goto(`/projects/${project.id}`)
		await page.getByTestId('overview-arrivals-group').first().click()

		// Assert
		await expect(page.getByTestId('movement-form-participants')).toContainText(/Grouped MEMBER/i)
		await expect(page, 'the board keeps its place').toHaveURL(new RegExp(`/projects/${project.id}$`))
	})

	/**
	 * The URL carries the instruction, so it must not survive it: reloading the
	 * movements page after acting on a row would otherwise re-open the form.
	 */
	test('the pre-fill instruction is stripped from the address', async ({ page, api, projects }) => {
		// Arrange
		const project = await projects.create({ options: OPTIONS_ALL })
		const expected = await seedParticipant(api, project.id, {
			firstName: 'Transient',
			lastName: 'Seed',
			birthday: '1990-01-01',
		})
		await api.patch(`/api/v2/projects/${project.id}/participants/${expected}`, {
			firstName: 'Transient',
			lastName: 'Seed',
			birthday: '1990-01-01',
			startAvailability: { date: todayIso() },
		})

		// Act
		await page.goto(`/projects/${project.id}`)
		await page.getByTestId('overview-arrivals-participant').first().click()
		await expect(page.getByTestId('movement-form-participants')).toBeVisible()

		// Assert
		await expect(page).not.toHaveURL(/record=/)
	})
})

test.describe('project home — hidden records leave the board', () => {
	/**
	 * Disabling an alert is how a false alarm is taken off the board; a dashboard
	 * that keeps showing it makes disabling pointless.
	 */
	test('a disabled alert disappears from the overview', async ({ page, api, projects }) => {
		// Arrange
		const project = await projects.create({ options: OPTIONS_ALERT })
		const alertId = await api.post<{ id: string }>(`/api/v2/projects/${project.id}/alerts`, {
			title: 'Hidden alarm',
			dateTime: '2026-07-10T09:00:00.000Z',
		}).then(created => created.id)

		await page.goto(`/projects/${project.id}`)
		await expect(page.getByTestId('overview-alerts')).toContainText(/hidden alarm/i)

		// Act
		await api.post(`/api/v2/projects/${project.id}/alerts/${alertId}/disable`)
		await page.reload()

		// Assert
		await expect(page.getByTestId('overview-alerts')).not.toContainText(/hidden alarm/i)
	})

	/**
	 * The same for a movement: a mis-keyed exit that is disabled must stop
	 * counting as somebody still out — the board keeps listing the person, since
	 * the project still expects them on site, and flips the state it reports.
	 * Presence is the LAST visible movement, so the arrival has to be recorded
	 * first: without it, disabling the exit leaves no movement at all and the
	 * person is "not arrived yet", not back inside.
	 */
	test('a disabled movement puts the person back inside on the presence board', async ({ page, api, projects }) => {
		// Arrange
		const project = await projects.create({ options: [OPTION.VEHICLE] })
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Mistaken',
			lastName: 'Exit',
			birthday: '1990-01-01',
		})
		await seedMovement(api, project.id, {
			type: 'IN',
			dateTime: ARRIVAL_DATE_TIME,
			content: [{ participantId }],
		})
		const movementId = await seedMovement(api, project.id, {
			type: 'OUT',
			reason: 'SHOPPING',
			content: [{ participantId }],
		})

		await page.goto(`/projects/${project.id}/current`)
		await expect(page.getByTestId('presence-row-status')).toContainText(/absent|away/i)

		// Act
		await api.post(`/api/v2/projects/${project.id}/movements/${movementId}/disable`)
		await page.reload()

		// Assert
		await expect(page.getByTestId('presence-board-row')).toHaveCount(1)
		await expect(page.getByTestId('presence-row-status')).toContainText(/présent|present/i)
	})
})

test.describe('lists — what the row must say', () => {
	/**
	 * The presence filter selects on a state the card never named: the API sends
	 * the status as a duration phrase ("depuis 3 h"), which says when but not
	 * whether. Filtering on "present" and reading a duration on every card left
	 * no way to see the filter had done anything.
	 */
	test('a participant card names the presence state, not only its duration', async ({ page, api, projects }) => {
		// Arrange
		const project = await projects.create()
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Present',
			lastName: 'Person',
			birthday: '1990-01-01',
		})
		await seedMovement(api, project.id, { type: 'IN', content: [{ participantId }] })

		// Act
		await page.goto(`/projects/${project.id}/participants`)

		// Assert
		await expect(page.getByTestId('participant-presence').first()).toContainText(/Présent|Present/i)
	})

	test('an activity card marks its duration with a stopwatch', async ({ page, api, projects }) => {
		// Arrange
		const project = await projects.create({ options: [OPTION.ACTIVITY] })
		await seedActivity(api, project.id, { name: 'Timed rando', duration: 'PT2H' })

		// Act
		await page.goto(`/projects/${project.id}/activities`)

		// Assert
		await expect(page.getByTestId('activity-duration').first()).toContainText('⏱')
	})

	/**
	 * Discussions is the action taken on a live outing and details a lookup, so
	 * the discussion button comes first. The order IS the assertion.
	 */
	test('the movement row offers discussions before details', async ({ page, api, projects }) => {
		// Arrange
		const project = await projects.create({ options: OPTIONS_ALERT })
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Ordered',
			lastName: 'Row',
			birthday: '1990-01-01',
		})
		await seedMovement(api, project.id, {
			type: 'OUT',
			reason: 'SHOPPING',
			content: [{ participantId }],
		})

		// Act
		await page.goto(`/projects/${project.id}/movements`)
		const row = page.getByTestId('movement-row').first()

		// Assert
		const buttons = row.locator('[data-testid="movement-communications"], [data-testid="movement-details"]')
		await expect(buttons).toHaveCount(2)
		await expect(buttons.nth(0)).toHaveAttribute('data-testid', 'movement-communications')
		await expect(buttons.nth(1)).toHaveAttribute('data-testid', 'movement-details')
		await expect(buttons.nth(0)).toContainText(/Discussions/i)
	})
})

test.describe('project home — telling two outings apart', () => {
	/**
	 * Two parties out on the same activity carry the same name, and a board whose
	 * job is to say who is still out must not print the same line twice. The
	 * departure time is what distinguishes them — and it appears only when there
	 * IS something to distinguish.
	 *
	 * The backend joins the activity name to its "(Activity)" qualifier with a
	 * NON-BREAKING space, which Playwright does not fold into a plain one — hence
	 * `\s` rather than a literal space before the parenthesis.
	 */
	test('a second outing on the same activity is stamped with its departure time', async ({ page, api, projects }) => {
		// Arrange
		const project = await projects.create({ options: OPTIONS_ALL })
		const activityId = await seedActivity(api, project.id, { name: 'Doubled rando' })
		const first = await seedParticipant(api, project.id, {
			firstName: 'First',
			lastName: 'Party',
			birthday: '1990-01-01',
		})
		const second = await seedParticipant(api, project.id, {
			firstName: 'Second',
			lastName: 'Party',
			birthday: '1991-01-01',
		})
		await seedMovement(api, project.id, {
			type: 'OUT',
			activityId,
			dateTime: '2026-07-10T09:00:00.000Z',
			content: [{ participantId: first }],
		})
		await seedMovement(api, project.id, {
			type: 'OUT',
			activityId,
			dateTime: '2026-07-10T14:00:00.000Z',
			content: [{ participantId: second }],
		})

		// Act
		await page.goto(`/projects/${project.id}`)
		const panel = page.getByTestId('overview-ongoing')

		// Assert
		await expect(panel).toContainText(/doubled rando/i)
		await expect(panel.locator('li')).toHaveCount(2)
		await expect(panel.locator('li').filter({ hasText: /doubled rando\s\(/i })).toHaveCount(2)
	})

	test('a single outing on an activity carries no departure-time stamp', async ({ page, api, projects }) => {
		// Arrange
		const project = await projects.create({ options: OPTIONS_ALL })
		const activityId = await seedActivity(api, project.id, { name: 'Lone rando' })
		const walker = await seedParticipant(api, project.id, {
			firstName: 'Lone',
			lastName: 'Walker',
			birthday: '1990-01-01',
		})
		await seedMovement(api, project.id, {
			type: 'OUT',
			activityId,
			content: [{ participantId: walker }],
		})

		// Act
		await page.goto(`/projects/${project.id}`)
		const panel = page.getByTestId('overview-ongoing')

		// Assert
		await expect(panel).toContainText(/lone rando/i)
		await expect(panel.locator('li').filter({ hasText: /lone rando \(\d/i })).toHaveCount(0)
	})
})

test.describe('communications — escalating an outing', () => {
	/**
	 * A message about an outing in progress is where an incident first gets
	 * written down. Raising the alert from that message is what stops it being
	 * retyped — and the backend seeds the new alert's thread with it in the same
	 * transaction, so the message belongs to both threads.
	 */
	test('a message on an activity outing can raise an alert carrying it', async ({ page, api, projects }) => {
		// Arrange
		const project = await projects.create({ options: OPTIONS_ALERT })
		const activityId = await seedActivity(api, project.id, { name: 'Escalated rando' })
		const walker = await seedParticipant(api, project.id, {
			firstName: 'Escalating',
			lastName: 'Walker',
			birthday: '1990-01-01',
		})
		await seedMovement(api, project.id, {
			type: 'OUT',
			activityId,
			content: [{ participantId: walker }],
		})

		// Act
		await page.goto(`/projects/${project.id}`)
		await page.getByTestId('ongoing-outing-row').first().click()
		await expect(page.getByTestId('movement-thread-drawer')).toBeVisible()
		await page.getByTestId('thread-escalate').locator('input[value="new"]').check()
		await page.getByTestId('thread-escalate-title').fill('Blessure en course')
		await page.getByTestId('thread-message').fill('Un participant s’est tordu la cheville.')
		await fillDateTime(page, 'thread-datetime', '2026-07-10 10:00:00')
		await page.getByTestId('thread-send').click()

		// Assert
		await expect(page.getByTestId('movement-thread-list')).toContainText(/tordu la cheville/i)

		const alerts = await api.get<{ content: Array<{ id: string, title: string }> }>(
			`/api/v2/projects/${project.id}/alerts?page=0&size=20`,
		)
		const raised = alerts.content.find(alert => /blessure en course/i.test(alert.title))
		expect(raised, 'the alert was raised from the message').toBeTruthy()
		const thread = await api.get<{ content: Array<{ message: string }> }>(
			`/api/v2/projects/${project.id}/alerts/${raised!.id}/communications?page=0&size=20`,
		)
		expect(thread.content.some(entry => /tordu la cheville/i.test(entry.message)),
			'the alert opens with the message that raised it').toBe(true)
	})

	/**
	 * The other half: an incident already being tracked gets the new message
	 * attached rather than a second alert raised.
	 */
	test('a message can be attached to an alert that already exists', async ({ page, api, projects }) => {
		// Arrange
		const project = await projects.create({ options: OPTIONS_ALERT })
		const activityId = await seedActivity(api, project.id, { name: 'Tracked rando' })
		const walker = await seedParticipant(api, project.id, {
			firstName: 'Reporting',
			lastName: 'Walker',
			birthday: '1990-01-01',
		})
		await seedMovement(api, project.id, {
			type: 'OUT',
			activityId,
			content: [{ participantId: walker }],
		})
		const alertId = await seedAlert(api, project.id, {
			title: 'Orage annoncé',
			dateTime: '2026-07-10T08:00:00.000Z',
		})

		// Act
		await page.goto(`/projects/${project.id}`)
		await page.getByTestId('ongoing-outing-row').first().click()
		await page.getByTestId('thread-escalate').locator('input[value="existing"]').check()
		await page.getByTestId('thread-escalate-alert').click()
		await selectItem(page, /orage annoncé/i).click()
		await page.getByTestId('thread-message').fill('Ils rentrent par le chemin bas.')
		await fillDateTime(page, 'thread-datetime', '2026-07-10 10:00:00')
		await page.getByTestId('thread-send').click()

		// Assert
		await expect(page.getByTestId('movement-thread-list')).toContainText(/chemin bas/i)
		const thread = await api.get<{ content: Array<{ message: string }> }>(
			`/api/v2/projects/${project.id}/alerts/${alertId}/communications?page=0&size=20`,
		)
		expect(thread.content.some(entry => /chemin bas/i.test(entry.message)),
			'the message joined the alert being tracked').toBe(true)
	})
})
