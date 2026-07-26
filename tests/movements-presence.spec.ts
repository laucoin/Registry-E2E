import { clickUntilVisible, selectItem } from './support/antd'
import { OPTION, PROJECT_ROLE, seedMovement, seedParticipant, seedVehicle } from './support/domain'
import { expect, test } from './support/fixtures'

/**
 * critical-scenarios.md §7 "Recording" / "Correcting" — presence is DERIVED from
 * the latest movement, never stored (participants.md), so every assertion here
 * reads it back rather than trusting the write. The live headcount card is the
 * product's core read: present minors, present majors, absent, guests on site.
 * The endpoint nests the registered head-count under `registered` and keeps
 * guests alongside it; absences are split by age just like presences.
 */
interface PresenceStatus {
	registered?: {
		presentMajors?: number
		presentMinors?: number
		absentMajors?: number
		absentMinors?: number
	}
	guests?: number
}

function presentMajors(status: PresenceStatus): number {
	return status.registered?.presentMajors ?? 0
}

function presentMinors(status: PresenceStatus): number {
	return status.registered?.presentMinors ?? 0
}

function absent(status: PresenceStatus): number {
	return (status.registered?.absentMajors ?? 0) + (status.registered?.absentMinors ?? 0)
}

test.describe('movements — presence and headcount', () => {
	async function status(
		api: { get: <T>(url: string) => Promise<T> },
		projectId: string,
	): Promise<PresenceStatus> {
		return api.get<PresenceStatus>(`/api/v2/projects/${projectId}/movements/participants/status`)
	}

	test('a registered participant leaves with a reason', async ({ api, project }) => {
		// Arrange
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Leaving',
			lastName: 'Adult',
			birthday: '1990-01-01',
		})
		await seedMovement(api, project.id, { type: 'IN', content: [{ participantId }] })
		const present = await status(api, project.id)

		// Act
		const response = await api.raw('POST', `/api/v2/projects/${project.id}/movements`, {
			type: 'OUT',
			dateTime: '2026-07-11T09:00:00.000Z',
			reason: 'SHOPPING',
			activityId: null,
			content: [{ participantId, vehicleId: null, poolName: null }],
		})

		// Assert
		expect(response.ok(), `an OUT with a reason is accepted (${response.status()})`).toBeTruthy()
		const after = await status(api, project.id)
		expect(presentMajors(after)).toBe(presentMajors(present) - 1)
		expect(absent(after)).toBe(absent(present) + 1)
	})

	/**
	 * Eligibility is direction-aware: someone on site is offered for an exit,
	 * which is what makes the as-it-happens flow a two-click operation.
	 *
	 * The direction is switched before the motive is picked: the form opens on IN
	 * and the motive list is direction-scoped, so an OUT motive such as "course"
	 * is simply not offered until the radio is moved.
	 */
	test('a participant who has entered becomes eligible to exit', async ({ page, api, project }) => {
		// Arrange
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Eligible',
			lastName: 'Exiter',
			birthday: '1990-01-01',
		})
		await seedMovement(api, project.id, { type: 'IN', content: [{ participantId }] })

		// Act
		await page.goto(`/projects/${project.id}/movements`)
		await clickUntilVisible(page.getByTestId('movement-create'), page.getByTestId('movement-form-participants'))
		await page.getByTestId('movement-form-type').getByText(/sortie|out/i).click()
		await page.getByTestId('movement-form-motive').click()
		await selectItem(page, /course|shopping/i).click()
		await page.getByTestId('movement-form-participants').click()

		// Assert
		await expect(selectItem(page, /eligible/i)).toBeVisible()
	})

	/**
	 * The headcount splits majors from minors because the driver rule and the
	 * supervision duty both hang off it.
	 */
	test('the live headcount reflects the recorded movements', async ({ api, project }) => {
		// Arrange
		const adult = await seedParticipant(api, project.id, {
			firstName: 'Grown',
			lastName: 'Up',
			birthday: '1990-01-01',
		})
		const minor = await seedParticipant(api, project.id, {
			firstName: 'Young',
			lastName: 'One',
			birthday: '2015-01-01',
		})
		const leaver = await seedParticipant(api, project.id, {
			firstName: 'Out',
			lastName: 'Again',
			birthday: '1991-01-01',
		})

		// Act
		await seedMovement(api, project.id, {
			type: 'IN',
			content: [{ participantId: adult }, { participantId: minor }, { participantId: leaver }],
		})
		await seedMovement(api, project.id, {
			type: 'OUT',
			dateTime: '2026-07-11T09:00:00.000Z',
			reason: 'SHOPPING',
			content: [{ participantId: leaver }],
		})

		// Assert
		const after = await status(api, project.id)
		expect(presentMajors(after), 'one major remains on site').toBe(1)
		expect(presentMinors(after), 'one minor remains on site').toBe(1)
		expect(absent(after), 'the leaver is absent').toBe(1)
	})

	/**
	 * There is no reverse action: a mistake is corrected by deleting the
	 * movement, and presence must fall back to whatever preceded it.
	 */
	test('deleting a mistaken movement restores the previous presence', async ({ api, project }) => {
		// Arrange
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Mistaken',
			lastName: 'Entry',
			birthday: '1990-01-01',
		})
		const before = await status(api, project.id)
		const movementId = await seedMovement(api, project.id, { type: 'IN', content: [{ participantId }] })
		expect(presentMajors(await status(api, project.id))).toBe(presentMajors(before) + 1)

		// Act
		await api.remove(`/api/v2/projects/${project.id}/movements/${movementId}`)

		// Assert
		const after = await status(api, project.id)
		expect(presentMajors(after), 'presence returns to what it was').toBe(presentMajors(before))
		expect(absent(after)).toBe(absent(before))
	})

	/**
	 * PROJECT_PARTICIPANT holds C+R on movements but no D (roles-and-permissions.md),
	 * asserted both as the absent affordance and as the refused request.
	 */
	test('a participant cannot delete a movement', async ({ api, project, grantRole, pageAs, apiAs }) => {
		// Arrange
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Undeletable',
			lastName: 'Movement',
			birthday: '1990-01-01',
		})
		const movementId = await seedMovement(api, project.id, { type: 'IN', content: [{ participantId }] })
		await grantRole(project.id, 'member', PROJECT_ROLE.PARTICIPANT)

		// Act
		const memberApi = await apiAs('member')
		const response = await memberApi.raw('DELETE', `/api/v2/projects/${project.id}/movements/${movementId}`)

		// Assert
		expect(response.status(), 'a participant must not delete a movement').toBeGreaterThanOrEqual(400)
		const memberPage = await pageAs('member')
		await memberPage.goto(`/projects/${project.id}/movements`)
		await expect(memberPage.getByTestId('movement-row')).toHaveCount(1)
		await expect(memberPage.getByTestId('movement-action-delete')).toHaveCount(0)
	})

	/**
	 * DEFINITIVE_DEPARTURE is terminal: the participant is gone for good, so they
	 * must not be offered back as someone who could return.
	 */
	test('definitive departure marks a participant as gone for good', async ({ api, project }) => {
		// Arrange
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Gone',
			lastName: 'Permanently',
			birthday: '1990-01-01',
		})
		await seedMovement(api, project.id, { type: 'IN', content: [{ participantId }] })

		// Act
		await seedMovement(api, project.id, {
			type: 'OUT',
			dateTime: '2026-07-11T09:00:00.000Z',
			reason: 'DEFINITIVE_DEPARTURE',
			content: [{ participantId }],
		})

		// Assert
		const participant = await api.get<{ status?: { value: string } | string }>(
			`/api/v2/projects/${project.id}/participants/${participantId}`,
		)
		const presence = typeof participant.status === 'string'
			? participant.status
			: participant.status?.value
		expect(presence, 'they are no longer on site').not.toBe('IN')

		const eligible = await api.get<{ participants?: Array<{ id: string }> }>(
			`/api/v2/projects/${project.id}/movements/eligible-participants-and-groups?contentType=REGISTERED`,
		)
		expect((eligible.participants ?? []).some(entry => entry.id === participantId),
			'someone definitively departed is not expected back').toBe(false)
	})

	/**
	 * Drivers must be majors, and the vehicle's own presence follows the
	 * movement it was assigned to.
	 */
	test('a vehicle is attached to a registered movement and counted out', async ({ api, projects }) => {
		// Arrange
		const project = await projects.create({ options: [OPTION.VEHICLE] })
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Driving',
			lastName: 'Major',
			birthday: '1990-01-01',
		})
		const vehicleId = await seedVehicle(api, project.id, {
			licensePlate: 'AA-111-BB',
			brand: 'Renault',
			model: 'Trafic',
		})
		await seedMovement(api, project.id, { type: 'IN', content: [{ participantId }] })

		// Act
		const response = await api.raw('POST', `/api/v2/projects/${project.id}/movements`, {
			type: 'OUT',
			dateTime: '2026-07-11T09:00:00.000Z',
			reason: 'SHOPPING',
			activityId: null,
			content: [{ participantId, vehicleId, poolName: null }],
		})

		// Assert
		expect(response.ok(), `a vehicle attaches to a registered movement (${response.status()})`).toBeTruthy()
		const vehicles = await api.get<{ present?: number, absent?: number }>(
			`/api/v2/projects/${project.id}/movements/vehicles/status`,
		)
		expect(vehicles.absent ?? 0, 'the vehicle is counted as away').toBeGreaterThanOrEqual(1)
	})
})
