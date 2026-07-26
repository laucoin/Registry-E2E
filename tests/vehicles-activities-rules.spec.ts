import { projectNavEntry } from './support/antd'
import { OPTION, PROJECT_ROLE, seedActivity, seedMovement, seedParticipant, seedVehicle, } from './support/domain'
import { expect, test } from './support/fixtures'

/**
 * critical-scenarios.md §9 and §10 — the two option-gated reference domains.
 * Both are closed to PROJECT_PARTICIPANT entirely (roles-and-permissions.md: the
 * role has no access at all, though it may still assign an existing vehicle
 * inside a movement), and both keep their history when disabled: disabling is a
 * soft hide from future selection, never a delete.
 */
test.describe('vehicles — presence, disabling and role gating', () => {
	test('vehicle presence follows its latest movement', async ({ api, projects }) => {
		// Arrange
		const project = await projects.create({ options: [OPTION.VEHICLE] })
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Vehicle',
			lastName: 'Driver',
			birthday: '1990-01-01',
		})
		const vehicleId = await seedVehicle(api, project.id, {
			licensePlate: 'PR-123-ES',
			brand: 'Renault',
			model: 'Trafic',
		})
		const url = `/api/v2/projects/${project.id}/vehicles/${vehicleId}`

		// Act
		await seedMovement(api, project.id, {
			type: 'OUT',
			dateTime: '2026-07-10T09:00:00.000Z',
			reason: 'SHOPPING',
			content: [{ participantId, vehicleId }],
		})
		const afterExit = await api.get<{ status?: { value: string } | string }>(url)

		await seedMovement(api, project.id, {
			type: 'IN',
			dateTime: '2026-07-10T18:00:00.000Z',
			content: [{ participantId, vehicleId }],
		})
		const afterReturn = await api.get<{ status?: { value: string } | string }>(url)

		// Assert
		const read = (v: { status?: { value: string } | string }) =>
			typeof v.status === 'string' ? v.status : v.status?.value
		expect(read(afterExit), 'the vehicle reads as out').toBe('OUT')
		expect(read(afterReturn), 'a later IN brings it back').toBe('IN')
	})

	test('disabling a vehicle hides it from selection without losing its history', async ({ api, projects }) => {
		// Arrange
		const project = await projects.create({ options: [OPTION.VEHICLE] })
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Past',
			lastName: 'Trip',
			birthday: '1990-01-01',
		})
		const vehicleId = await seedVehicle(api, project.id, {
			licensePlate: 'HI-456-ST',
			brand: 'Renault',
			model: 'Master',
		})
		await seedMovement(api, project.id, {
			type: 'OUT',
			reason: 'SHOPPING',
			content: [{ participantId, vehicleId }],
		})

		// Act
		await api.post(`/api/v2/projects/${project.id}/vehicles/${vehicleId}/disable`)

		// Assert
		const eligible = await api.get<Array<{ id: string }> | { content: Array<{ id: string }> }>(
			`/api/v2/projects/${project.id}/movements/eligible-vehicles`,
		)
		const offered = Array.isArray(eligible) ? eligible : eligible.content
		expect(offered.some(entry => entry.id === vehicleId), 'a disabled vehicle is not offered').toBe(false)

		const history = await api.raw('GET', `/api/v2/projects/${project.id}/vehicles/${vehicleId}/movements`)
		expect(history.ok(), 'its movement history stays readable').toBeTruthy()
	})

	test('a participant cannot manage vehicles', async ({ projects, grantRole, apiAs, pageAs }) => {
		// Arrange
		const project = await projects.create({ options: [OPTION.VEHICLE] })
		await grantRole(project.id, 'member', PROJECT_ROLE.PARTICIPANT)
		const memberApi = await apiAs('member')

		// Act
		const response = await memberApi.raw('POST', `/api/v2/projects/${project.id}/vehicles`, {
			licensePlate: 'NO-000-PE',
			brand: 'Renault',
			model: 'Kangoo',
		})

		// Assert
		expect(response.status(), 'a participant must not create a vehicle').toBeGreaterThanOrEqual(400)
		const memberPage = await pageAs('member')
		await memberPage.goto(`/projects/${project.id}`)
		await expect(await projectNavEntry(memberPage, 'vehicles')).toHaveCount(0)
	})

	test('brand, model and the availability order are validated', async ({ api, projects }) => {
		// Arrange
		const project = await projects.create({ options: [OPTION.VEHICLE] })

		// Act
		const blankBrand = await api.raw('POST', `/api/v2/projects/${project.id}/vehicles`, {
			licensePlate: 'AA-111-AA',
			brand: '',
			model: 'Trafic',
		})
		const invertedWindow = await api.raw('POST', `/api/v2/projects/${project.id}/vehicles`, {
			licensePlate: 'BB-222-BB',
			brand: 'Renault',
			model: 'Trafic',
			startAvailability: { date: '2026-08-20' },
			endAvailability: { date: '2026-07-05' },
		})

		// Assert
		expect(blankBrand.status()).toBeGreaterThanOrEqual(400)
		expect(await blankBrand.text()).toContain('VEHICLE_BRAND_NULL_OR_BLANK')
		expect(invertedWindow.status()).toBeGreaterThanOrEqual(400)
		expect(await invertedWindow.text()).toContain('VEHICLE_START_LATER_THAN_END')
	})
})

test.describe('activities — disabling, role gating and planning limits', () => {
	test('disabling an activity removes it from the movement picker', async ({ api, projects }) => {
		// Arrange
		const project = await projects.create({ options: [OPTION.ACTIVITY] })
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Went',
			lastName: 'Hiking',
			birthday: '1990-01-01',
		})
		const activityId = await seedActivity(api, project.id, { name: 'Rando' })
		await seedMovement(api, project.id, { type: 'OUT', activityId, content: [{ participantId }] })

		// Act
		await api.post(`/api/v2/projects/${project.id}/activities/${activityId}/disable`)

		// Assert
		const motives = await api.get<Array<{ value: string, kind: string }>>(
			`/api/v2/projects/${project.id}/movements/reasons?type=OUT&contentType=REGISTERED`,
		)
		expect((motives ?? []).some(motive => motive.value === activityId),
			'a disabled activity is no longer offered as a justification').toBe(false)

		const history = await api.raw('GET', `/api/v2/projects/${project.id}/activities/${activityId}/movements`)
		expect(history.ok(), 'its movement history stays readable').toBeTruthy()
	})

	test('a participant cannot manage activities', async ({ projects, grantRole, apiAs, pageAs }) => {
		// Arrange
		const project = await projects.create({ options: [OPTION.ACTIVITY] })
		await grantRole(project.id, 'member', PROJECT_ROLE.PARTICIPANT)
		const memberApi = await apiAs('member')

		// Act
		const response = await memberApi.raw('POST', `/api/v2/projects/${project.id}/activities`, {
			name: 'Unauthorised outing',
		})

		// Assert
		expect(response.status(), 'a participant must not create an activity').toBeGreaterThanOrEqual(400)
		const memberPage = await pageAs('member')
		await memberPage.goto(`/projects/${project.id}`)
		await expect(await projectNavEntry(memberPage, 'activities')).toHaveCount(0)
	})

	/**
	 * @MinUpperMax plus the floor of one: an activity nobody may attend is not a
	 * plan, it is a mistake.
	 *
	 * The range is a NESTED object with `lower`/`upper`, not two flat fields:
	 * unknown properties are dropped silently, so a flat payload validates nothing
	 * and comes back 200 as if the range had been accepted.
	 */
	test('the allowed-participants range is validated', async ({ api, projects }) => {
		// Arrange
		const project = await projects.create({ options: [OPTION.ACTIVITY] })

		// Act
		const inverted = await api.raw('POST', `/api/v2/projects/${project.id}/activities`, {
			name: 'Inverted range',
			allowedParticipants: { lower: 10, upper: 4 },
		})
		const tooLow = await api.raw('POST', `/api/v2/projects/${project.id}/activities`, {
			name: 'Nobody allowed',
			allowedParticipants: { lower: 0, upper: 4 },
		})

		// Assert
		expect(inverted.status()).toBeGreaterThanOrEqual(400)
		expect(await inverted.text()).toContain('ACTIVITY_ALLOWED_PARTICIPANTS_MAX_IS_HIGHER_THAN_MIN')
		expect(tooLow.status()).toBeGreaterThanOrEqual(400)
		expect(await tooLow.text()).toContain('ACTIVITY_ALLOWED_PARTICIPANTS_TOO_LOW')
	})

	test('the description is capped at 2000 characters', async ({ api, projects }) => {
		// Arrange
		const project = await projects.create({ options: [OPTION.ACTIVITY] })

		// Act
		const response = await api.raw('POST', `/api/v2/projects/${project.id}/activities`, {
			name: 'Verbose',
			description: 'x'.repeat(2001),
		})

		// Assert
		expect(response.status()).toBeGreaterThanOrEqual(400)
		expect(await response.text()).toContain('ACTIVITY_DESCRIPTION_TOO_LONG')
	})
})
