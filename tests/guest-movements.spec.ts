import { OPTION, seedGuestMovement, seedVehicle } from './support/domain'
import { expect, test } from './support/fixtures'

/**
 * critical-scenarios.md §8 — guests were entirely unautomated, and the oracle
 * calls them "half the presence picture". Their content rules INVERT by
 * direction (@MovementGuestContent, movements.md):
 * IN  → brand-new people under `guests`, no existing content, reason REQUIRED
 * OUT → guests already on site under `content`, no new guests, reason optional
 * Guests carry no vehicle, pool, group or activity — none exist on the DTO.
 *
 * VISIT is an IN reason for guests; SHOPPING and friends are the registered-OUT
 * set, which is why the guest drawer filters the motive list by contentType.
 */
const ARRIVAL_REASON = 'VISIT'

test.describe('guest movements', () => {
	async function guestsOnSite(
		api: { get: <T>(url: string) => Promise<T> },
		projectId: string,
	): Promise<number> {
		const status = await api.get<{ guests?: number }>(
			`/api/v2/projects/${projectId}/movements/participants/status`,
		)
		return status.guests ?? 0
	}

	test('a guest is created on arrival', async ({ api, project }) => {
		// Arrange
		const before = await guestsOnSite(api, project.id)

		// Act
		await seedGuestMovement(api, project.id, {
			type: 'IN',
			reason: ARRIVAL_REASON,
			guests: [{ firstName: 'Visiting', lastName: 'Parent', birthday: '1980-03-03' }],
		})

		// Assert
		expect(await guestsOnSite(api, project.id), 'the arriving guest is on site').toBe(before + 1)
		const participants = await api.get<{
			content: Array<{ firstName: string, type?: { value: string } | string }>
		}>(
			`/api/v2/projects/${project.id}/participants?type=GUEST`,
		)
		expect(participants.content.some(person => person.firstName === 'Visiting'),
			'the guest was created as a participant').toBe(true)
	})

	/**
	 * The exit references a guest the arrival created, which is the only way an
	 * OUT can name anybody — there is no guest directory to pick from otherwise.
	 */
	test('a guest leaves by referencing an existing guest', async ({ api, project }) => {
		// Arrange
		await seedGuestMovement(api, project.id, {
			type: 'IN',
			reason: ARRIVAL_REASON,
			guests: [{ firstName: 'Departing', lastName: 'Visitor', birthday: '1980-04-04' }],
		})
		const guests = await api.get<{ content: Array<{ id: string, firstName: string }> }>(
			`/api/v2/projects/${project.id}/participants?type=GUEST`,
		)
		const guest = guests.content.find(person => person.firstName === 'Departing')
		expect(guest, 'the arrival created the guest').toBeTruthy()

		// Act
		await seedGuestMovement(api, project.id, {
			type: 'OUT',
			dateTime: '2026-07-11T09:00:00.000Z',
			participantIds: [guest!.id],
		})

		// Assert
		expect(await guestsOnSite(api, project.id), 'the departed guest is no longer on site').toBe(0)
	})

	test('guests on site are counted in the live headcount', async ({ api, project }) => {
		// Arrange
		await seedGuestMovement(api, project.id, {
			type: 'IN',
			reason: ARRIVAL_REASON,
			guests: [
				{ firstName: 'Stayer', lastName: 'One', birthday: '1980-05-05' },
				{ firstName: 'Leaver', lastName: 'Two', birthday: '1981-06-06' },
			],
		})
		const guests = await api.get<{ content: Array<{ id: string, firstName: string }> }>(
			`/api/v2/projects/${project.id}/participants?type=GUEST`,
		)
		const leaver = guests.content.find(person => person.firstName === 'Leaver')

		// Act
		await seedGuestMovement(api, project.id, {
			type: 'OUT',
			dateTime: '2026-07-11T09:00:00.000Z',
			participantIds: [leaver!.id],
		})

		// Assert
		expect(await guestsOnSite(api, project.id), 'two arrived and one left').toBe(1)
	})

	test('a guest entry with no new guest is refused', async ({ api, project }) => {
		// Act
		const response = await api.raw('POST', `/api/v2/projects/${project.id}/movements/guests`, {
			type: 'IN',
			dateTime: '2026-07-10T09:00:00.000Z',
			reason: ARRIVAL_REASON,
			guests: [],
		})

		// Assert
		expect(response.status()).toBeGreaterThanOrEqual(400)
		expect(await response.text()).toContain('MOVEMENT_ODD_GUEST_CONTENT')
	})

	/**
	 * Both lists are sent so the movement is well-formed apart from the rule under
	 * test. MOVEMENT_ODD_GUEST_CONTENT is that rule: the @MovementGuestContent
	 * annotation on the creation DTO refuses an OUT that carries new guests. The
	 * edit-time counterpart, MOVEMENT_REMOVE_GUEST_CONTENT, guards a different
	 * journey — removing a guest from an existing movement — and cannot fire here.
	 */
	test('a guest exit carrying new guests is refused', async ({ api, project }) => {
		// Act
		const arrival = await seedGuestMovement(api, project.id, {
			type: 'IN',
			reason: ARRIVAL_REASON,
			guests: [{ firstName: 'Present', lastName: 'Already', birthday: '1980-07-07' }],
		})
		expect(arrival, 'a guest is on site to reference').toBeTruthy()
		const onSite = await api.get<{ content: Array<{ id: string }> }>(
			`/api/v2/projects/${project.id}/participants?type=GUEST`,
		)
		const response = await api.raw('POST', `/api/v2/projects/${project.id}/movements/guests`, {
			type: 'OUT',
			dateTime: '2026-07-11T09:00:00.000Z',
			reason: null,
			content: [{ participantId: onSite.content[0]!.id }],
			guests: [{ firstName: 'Should', lastName: 'Fail', birthday: '1980-07-07' }],
		})

		// Assert
		expect(response.status()).toBeGreaterThanOrEqual(400)
		expect(await response.text()).toContain('MOVEMENT_ODD_GUEST_CONTENT')
	})

	/**
	 * The reciprocal of the registered rule: an unjustified GUEST movement is
	 * assumed to be a departure, so an arrival must carry a reason.
	 */
	test('a guest with no reason must be leaving', async ({ api, project }) => {
		// Act
		const response = await api.raw('POST', `/api/v2/projects/${project.id}/movements/guests`, {
			type: 'IN',
			dateTime: '2026-07-10T09:00:00.000Z',
			reason: null,
			guests: [{ firstName: 'Unjustified', lastName: 'Arrival', birthday: '1980-08-08' }],
		})

		// Assert
		expect(response.status()).toBeGreaterThanOrEqual(400)
		expect(await response.text()).toContain('MOVEMENT_TYPE_AND_REASON_ARE_INCOMPATIBLE')
	})

	/**
	 * Vehicles are allowed only on REGISTERED content, so the option being on
	 * changes nothing for guests.
	 *
	 * The rule is structural rather than a refusal: GuestMovementWriterDto models
	 * no vehicle at all, so a `vehicleId` sent alongside guest content is ignored
	 * and the movement is created without one. Asserting a 4xx here would be
	 * asserting a guard that cannot exist; what matters is that the vehicle does
	 * not make it onto the record.
	 */
	test('a vehicle is ignored on a guest movement', async ({ api, projects }) => {
		// Arrange
		const project = await projects.create({ options: [OPTION.VEHICLE] })
		const vehicleId = await seedVehicle(api, project.id, {
			licensePlate: 'GG-000-GG',
			brand: 'Renault',
			model: 'Trafic',
		})
		await seedGuestMovement(api, project.id, {
			type: 'IN',
			reason: ARRIVAL_REASON,
			guests: [{ firstName: 'Carless', lastName: 'Guest', birthday: '1980-09-09' }],
		})
		const guests = await api.get<{ content: Array<{ id: string }> }>(
			`/api/v2/projects/${project.id}/participants?type=GUEST`,
		)

		// Act
		const response = await api.raw('POST', `/api/v2/projects/${project.id}/movements/guests`, {
			type: 'OUT',
			dateTime: '2026-07-11T09:00:00.000Z',
			reason: null,
			content: [{ participantId: guests.content[0]!.id, vehicleId }],
		})

		// Assert
		expect(response.ok(), 'the guest movement is created').toBeTruthy()
		const movements = await api.get<{ content: Array<{ vehicle?: unknown }> }>(
			`/api/v2/projects/${project.id}/movements?contentType=GUEST`,
		)
		expect(movements.content.length, 'both guest movements are recorded').toBeGreaterThan(0)
		for (const movement of movements.content) {
			expect(movement.vehicle ?? null, 'a guest movement must not carry a vehicle').toBeNull()
		}
	})

	/**
	 * The guest flow has its own drawer, and its rows are tagged so the list can
	 * be read at a glance without opening each one.
	 */
	test('guest movements are recorded from their own drawer and tagged in the list', async ({
																								 page,
																								 api,
																								 project
																							 }) => {
		// Arrange
		await seedGuestMovement(api, project.id, {
			type: 'IN',
			reason: ARRIVAL_REASON,
			guests: [{ firstName: 'Tagged', lastName: 'Guest', birthday: '1980-10-10' }],
		})

		// Act
		await page.goto(`/projects/${project.id}/movements`)

		// Assert
		await expect(page.getByTestId('movement-guest-create')).toBeVisible()
		await expect(page.getByTestId('movement-row').first()).toContainText(/invité|guest/i)
	})
})
