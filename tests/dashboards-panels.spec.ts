import {
	daysFromTodayIso,
	invite,
	OPTION,
	OPTIONS_COMMUNICATION,
	PROJECT_ROLE,
	seedActivity,
	seedGroup,
	seedMovement,
	seedParticipant,
	todayIso,
} from './support/domain'
import { account, expect, test } from './support/fixtures'

/**
 * critical-scenarios.md §13 — the dashboard panels (dashboards spec). Two rules carry
 * the real complexity:
 *
 * Arrivals/departures use the EFFECTIVE availability window — the
 * participant's own if set, otherwise their group's (a COALESCE, so the
 * participant always wins) — and exclude anyone already in the state the
 * panel predicts: someone on site is not an expected arrival.
 *
 * The ongoing-activity chronometer counts from the outing's LAST
 * communication, falling back to the outing's own timestamp when the thread
 * is still empty.
 *
 * The counts are asserted against the per-panel endpoints because the rendered
 * card shows a formatted, localised summary; the panel's presence is asserted
 * separately so a passing count cannot hide an unrendered card.
 */
test.describe('dashboards — arrivals and departures', () => {
	async function arrivingToday(api: { get: <T>(url: string) => Promise<T> }, projectId: string) {
		return api.get<{ content?: Array<{ id: string }> } | Array<{ id: string }>>(
			`/api/v2/projects/${projectId}/participants/arriving-today`,
		)
	}

	async function departingToday(api: { get: <T>(url: string) => Promise<T> }, projectId: string) {
		return api.get<{ content?: Array<{ id: string }> } | Array<{ id: string }>>(
			`/api/v2/projects/${projectId}/participants/departing-today`,
		)
	}

	function ids(result: { content?: Array<{ id: string }> } | Array<{ id: string }>): string[] {
		return (Array.isArray(result) ? result : result.content ?? []).map(entry => entry.id)
	}

	test('arrivals today uses the participant’s own window over the group’s', async ({ api, project }) => {
		// Arrange
		const ownWindowLater = await seedParticipant(api, project.id, {
			firstName: 'Later',
			lastName: 'Arrival',
			birthday: '1990-01-01',
		})
		await api.patch(`/api/v2/projects/${project.id}/participants/${ownWindowLater}`, {
			firstName: 'Later',
			lastName: 'Arrival',
			birthday: '1990-01-01',
			startAvailability: { date: daysFromTodayIso(1) },
		})
		await seedGroup(api, project.id, { name: 'Arriving group', members: [ownWindowLater] })

		// Act
		const arrivals = ids(await arrivingToday(api, project.id))

		// Assert
		expect(arrivals, 'the participant’s own later window wins over the group’s')
			.not.toContain(ownWindowLater)
	})

	test('a participant already on site is not an expected arrival', async ({ api, project }) => {
		// Arrange
		const expected = await seedParticipant(api, project.id, {
			firstName: 'Expected',
			lastName: 'Arrival',
			birthday: '1990-01-01',
		})
		const alreadyHere = await seedParticipant(api, project.id, {
			firstName: 'Already',
			lastName: 'Here',
			birthday: '1991-01-01',
		})
		for (const id of [expected, alreadyHere]) {
			await api.patch(`/api/v2/projects/${project.id}/participants/${id}`, {
				firstName: id === expected ? 'Expected' : 'Already',
				lastName: id === expected ? 'Arrival' : 'Here',
				birthday: id === expected ? '1990-01-01' : '1991-01-01',
				startAvailability: { date: todayIso() },
			})
		}
		await seedMovement(api, project.id, { type: 'IN', content: [{ participantId: alreadyHere }] })

		// Act
		const arrivals = ids(await arrivingToday(api, project.id))

		// Assert
		expect(arrivals, 'someone already present is not an expected arrival').not.toContain(alreadyHere)
	})

	test('departures today counts on-site participants whose window ends today', async ({ api, project }) => {
		// Arrange
		const leaving = await seedParticipant(api, project.id, {
			firstName: 'Leaving',
			lastName: 'Today',
			birthday: '1990-01-01',
		})
		await api.patch(`/api/v2/projects/${project.id}/participants/${leaving}`, {
			firstName: 'Leaving',
			lastName: 'Today',
			birthday: '1990-01-01',
			endAvailability: { date: todayIso() },
		})
		await seedMovement(api, project.id, { type: 'IN', content: [{ participantId: leaving }] })

		// Act
		const departures = ids(await departingToday(api, project.id))

		// Assert
		expect(departures, 'an on-site participant whose window ends today is expected to leave')
			.toContain(leaving)
	})

	test('a participant already off site is not an expected departure', async ({ api, project }) => {
		// Arrange
		const gone = await seedParticipant(api, project.id, {
			firstName: 'Already',
			lastName: 'Gone',
			birthday: '1990-01-01',
		})
		await api.patch(`/api/v2/projects/${project.id}/participants/${gone}`, {
			firstName: 'Already',
			lastName: 'Gone',
			birthday: '1990-01-01',
			endAvailability: { date: todayIso() },
		})
		await seedMovement(api, project.id, { type: 'IN', content: [{ participantId: gone }] })
		await seedMovement(api, project.id, {
			type: 'OUT',
			dateTime: '2026-07-11T09:00:00.000Z',
			reason: 'SHOPPING',
			content: [{ participantId: gone }],
		})

		// Act
		const departures = ids(await departingToday(api, project.id))

		// Assert
		expect(departures, 'someone already absent is not an expected departure').not.toContain(gone)
	})
})

/**
 * critical-scenarios.md §13 — the group half of the "due today" panels, and the
 * birthday card.
 *
 * A group is due today when its OWN window opens (or closes) today and it still
 * holds someone the movement concerns: a member with no date of their own — so
 * the group's date is what governs them — who has not already made that move.
 * Without that second condition the panel listed groups whose members were all
 * long since on site.
 *
 * Both sides come from ONE endpoint per panel (`arrivals-today` /
 * `departures-today`); the backend queries participants and groups
 * concurrently, which is only worth anything if the client asks once.
 */
test.describe('dashboards — groups due today and birthdays', () => {
	interface DueToday {
		participants: Array<{ id: string }>
		groups: Array<{ id: string }>
	}

	async function dueToday(
		api: { get: <T>(url: string) => Promise<T> },
		projectId: string,
		panel: 'arrivals' | 'departures',
	): Promise<DueToday> {
		return api.get<DueToday>(`/api/v2/projects/${projectId}/participants/${panel}-today`)
	}

	test('a group whose window opens today, with an unmoved dateless member, is an arrival', async ({
																										api,
																										project
																									}) => {
		// Arrange
		const dateless = await seedParticipant(api, project.id, {
			firstName: 'Dateless',
			lastName: 'Member',
			birthday: '1990-01-01',
		})
		const groupId = await seedGroup(api, project.id, {
			name: 'Arriving band',
			members: [dateless],
			startAvailability: { date: todayIso() },
		})

		// Act
		const arrivals = await dueToday(api, project.id, 'arrivals')

		// Assert
		expect(arrivals.groups.map(g => g.id), 'the group governs a member who set no date of their own')
			.toContain(groupId)
	})

	test('a group whose members have all arrived is no longer an expected arrival', async ({ api, project }) => {
		// Arrange
		const arrived = await seedParticipant(api, project.id, {
			firstName: 'Already',
			lastName: 'Arrived',
			birthday: '1990-01-01',
		})
		const groupId = await seedGroup(api, project.id, {
			name: 'Settled band',
			members: [arrived],
			startAvailability: { date: todayIso() },
		})
		await seedMovement(api, project.id, { type: 'IN', content: [{ participantId: arrived }] })

		// Act
		const arrivals = await dueToday(api, project.id, 'arrivals')

		// Assert
		expect(arrivals.groups.map(g => g.id), 'nobody left to see in')
			.not.toContain(groupId)
	})

	test('a group whose window closes today, with a member still to leave, is a departure', async ({
																									   api,
																									   project
																								   }) => {
		// Arrange
		const staying = await seedParticipant(api, project.id, {
			firstName: 'Still',
			lastName: 'Here',
			birthday: '1990-01-01',
		})
		const groupId = await seedGroup(api, project.id, {
			name: 'Leaving band',
			members: [staying],
			endAvailability: { date: todayIso() },
		})

		// Act
		const departures = await dueToday(api, project.id, 'departures')

		// Assert
		expect(departures.groups.map(g => g.id), 'a member with no departure date of their own is still to see off')
			.toContain(groupId)
	})

	test('a group whose members have definitively departed is no longer a departure', async ({ api, project }) => {
		// Arrange
		const gone = await seedParticipant(api, project.id, {
			firstName: 'Gone',
			lastName: 'ForGood',
			birthday: '1990-01-01',
		})
		const groupId = await seedGroup(api, project.id, {
			name: 'Emptied band',
			members: [gone],
			endAvailability: { date: todayIso() },
		})
		await seedMovement(api, project.id, { type: 'IN', content: [{ participantId: gone }] })
		await seedMovement(api, project.id, {
			type: 'OUT',
			dateTime: '2026-07-11T09:00:00.000Z',
			reason: 'DEFINITIVE_DEPARTURE',
			content: [{ participantId: gone }],
		})

		// Act
		const departures = await dueToday(api, project.id, 'departures')

		// Assert
		expect(departures.groups.map(g => g.id), 'a definitive departure leaves nothing to see off')
			.not.toContain(groupId)
	})

	/**
	 * A birthday recurs: the card matches the DAY and MONTH, never the year.
	 * Matching the stored date against CURRENT_DATE only ever found someone born
	 * today, so the card was empty for the whole project.
	 */
	test('the birthday card matches on the day and month, not the year', async ({ api, project }) => {
		// Arrange
		const today = new Date()
		const monthDay = `${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`
		const celebrating = await seedParticipant(api, project.id, {
			firstName: 'Birthday',
			lastName: 'Person',
			birthday: `1990-${monthDay}`,
		})
		const other = await seedParticipant(api, project.id, {
			firstName: 'Other',
			lastName: 'Day',
			birthday: '1990-01-02',
		})

		// Act
		const birthdays = await api.get<Array<{ id: string }>>(
			`/api/v2/projects/${project.id}/participants/birthdays`,
		)

		// Assert
		expect(birthdays.map(p => p.id), 'born on this day and month, decades ago').toContain(celebrating)
		expect(birthdays.map(p => p.id), 'a different day is not a birthday').not.toContain(other)
	})
})

test.describe('dashboards — ongoing activities and option gating', () => {
	/**
	 * The fallback matters because an outing's thread is empty until someone
	 * radios in, which is exactly when the operator most needs the elapsed time.
	 */
	test('the chronometer falls back to the outing’s own timestamp', async ({ page, api, projects }) => {
		// Arrange
		const project = await projects.create({ options: OPTIONS_COMMUNICATION })
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Silent',
			lastName: 'Outing',
			birthday: '1990-01-01',
		})
		const activityId = await seedActivity(api, project.id, { name: 'Rando' })
		await seedMovement(api, project.id, { type: 'OUT', activityId, content: [{ participantId }] })

		// Act
		await page.goto(`/projects/${project.id}`)

		// Assert
		const row = page.getByTestId('ongoing-outing-row').first()
		await expect(row).toContainText(/rando/i)
		await expect(row).toContainText('⏱')
		await expect(row, 'with no message the timer counts from the departure, not a last contact')
			.not.toContainText(/dernier contact|last contact/i)
	})

	test('an outing whose participants have returned is no longer ongoing', async ({ page, api, projects }) => {
		// Arrange
		const project = await projects.create({ options: OPTIONS_COMMUNICATION })
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Returned',
			lastName: 'Hiker',
			birthday: '1990-01-01',
		})
		const activityId = await seedActivity(api, project.id, { name: 'Rando' })
		await seedMovement(api, project.id, { type: 'OUT', activityId, content: [{ participantId }] })

		// Act
		await seedMovement(api, project.id, {
			type: 'IN',
			dateTime: '2026-07-10T18:00:00.000Z',
			content: [{ participantId }],
		})

		// Assert
		await page.goto(`/projects/${project.id}`)
		await expect(page.getByTestId('ongoing-outing-row')).toHaveCount(0)
	})

	/**
	 * Option-gated by design: a panel tied to an optional module is rendered only
	 * when that option is on.
	 */
	test('a card whose option is off is not rendered', async ({ page, projects }) => {
		// Arrange
		const bare = await projects.create({ name: 'overview no options' })
		const withVehicles = await projects.create({ name: 'overview vehicles', options: [OPTION.VEHICLE] })

		// Act
		await page.goto(`/projects/${bare.id}`)

		// Assert
		await expect(page.getByTestId('overview-presence')).toBeVisible()
		await expect(page.getByTestId('overview-vehicles')).toHaveCount(0)
		await expect(page.getByTestId('overview-alerts')).toHaveCount(0)

		await page.goto(`/projects/${withVehicles.id}`)
		await expect(page.getByTestId('overview-vehicles')).toBeVisible()
	})
})

test.describe('dashboards — invitations from the home page', () => {
	test('an invitation is accepted from the home page', async ({ api, project, pageAs, apiAs }) => {
		// Arrange
		await invite(api, project.id, account('member').email, PROJECT_ROLE.COORDINATOR)
		const memberPage = await pageAs('member')

		// Act
		await memberPage.goto('/')
		const panel = memberPage.getByTestId('dashboard-invites-received')
		await expect(panel).toContainText(project.name)
		await panel.getByTestId('dashboard-invite-accept').first().click()

		// Assert
		await expect(panel).not.toContainText(project.name)
		const memberApi = await apiAs('member')
		const accepted = await memberApi.get<{ content: Array<{ project?: { id: string } }> }>(
			'/api/v2/users/profiles?status=ACCEPTED&size=200',
		)
		expect(accepted.content.some(profile => profile.project?.id === project.id),
			'the profile is now ACCEPTED').toBe(true)
	})
})
