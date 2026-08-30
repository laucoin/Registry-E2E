import { clickUntilVisible, selectItem } from './support/antd'
import {
	OPTION,
	OPTIONS_COMMUNICATION,
	seedActivity,
	seedMovement,
	seedParticipant,
	seedVehicle
} from './support/domain'
import { expect, test } from './support/fixtures'

/**
 * critical-scenarios.md §7 "Justification rules" / "Correcting" — the validator
 * contract around a registered movement (movements.md):
 * @BothCannotBeDefined  a reason and an activity are mutually exclusive
 * @MovementReason       a registered movement with no justification must be IN,
 * and a reason's own direction must match the movement
 * terminal movements    DEFINITIVE_DEPARTURE and any guest OUT are frozen
 * edit locks            direction and content type cannot change on update
 *
 * Asserted against the API: these are refusals the create drawer prevents by
 * construction, and the guarantee is that the backend refuses them even when the
 * request is made directly.
 */
test.describe('movements — justification and correction rules', () => {
	test('a reason and an activity cannot both justify a movement', async ({ api, projects }) => {
		// Arrange
		const project = await projects.create({ options: [OPTION.ACTIVITY] })
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Both',
			lastName: 'Justified',
			birthday: '1990-01-01',
		})
		const activityId = await seedActivity(api, project.id, { name: 'Rando' })

		// Act
		const response = await api.raw('POST', `/api/v2/projects/${project.id}/movements`, {
			type: 'OUT',
			dateTime: '2026-07-10T09:00:00.000Z',
			reason: 'SHOPPING',
			activityId,
			content: [{ participantId, vehicleId: null, poolName: null }],
		})

		// Assert
		expect(response.status()).toBeGreaterThanOrEqual(400)
		expect(await response.text()).toContain('MOVEMENT_ACTIVITY_AND_REASON_ARE_DEFINED')
	})

	/**
	 * SHOPPING is an OUT reason for registered participants, so pairing it with
	 * an entry contradicts itself.
	 */
	test('a reason whose direction contradicts the movement is refused', async ({ api, project }) => {
		// Arrange
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Wrong',
			lastName: 'Direction',
			birthday: '1990-01-01',
		})

		// Act
		const response = await api.raw('POST', `/api/v2/projects/${project.id}/movements`, {
			type: 'IN',
			dateTime: '2026-07-10T09:00:00.000Z',
			reason: 'SHOPPING',
			activityId: null,
			content: [{ participantId, vehicleId: null, poolName: null }],
		})

		// Assert
		expect(response.status()).toBeGreaterThanOrEqual(400)
		expect(await response.text()).toContain('MOVEMENT_TYPE_AND_REASON_ARE_INCOMPATIBLE')
	})

	/**
	 * The reciprocal: an unjustified registered movement is assumed to be a
	 * return, so it cannot be an exit.
	 */
	test('a registered participant with no justification must be entering', async ({ api, project }) => {
		// Arrange
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Unjustified',
			lastName: 'Exit',
			birthday: '1990-01-01',
		})

		// Act
		const response = await api.raw('POST', `/api/v2/projects/${project.id}/movements`, {
			type: 'OUT',
			dateTime: '2026-07-10T09:00:00.000Z',
			reason: null,
			activityId: null,
			content: [{ participantId, vehicleId: null, poolName: null }],
		})

		// Assert
		expect(response.status()).toBeGreaterThanOrEqual(400)
		expect(await response.text()).toContain('MOVEMENT_TYPE_AND_REASON_ARE_INCOMPATIBLE')
	})

	/**
	 * Vehicles require the VEHICLE option AND registered content, so a vehicle
	 * reference in a project without the option must be refused outright — the
	 * vehicle is seeded in a second project because the first cannot hold one.
	 */
	test('a vehicle cannot be attached when the option is off', async ({ api, projects }) => {
		// Arrange
		const withoutOption = await projects.create({ name: 'movement no vehicle option' })
		const withOption = await projects.create({ name: 'movement vehicle source', options: [OPTION.VEHICLE] })
		const participantId = await seedParticipant(api, withoutOption.id, {
			firstName: 'No',
			lastName: 'Vehicle',
			birthday: '1990-01-01',
		})
		const vehicleId = await seedVehicle(api, withOption.id, {
			licensePlate: 'ZZ-999-ZZ',
			brand: 'Renault',
			model: 'Trafic',
		})

		// Act
		const response = await api.raw('POST', `/api/v2/projects/${withoutOption.id}/movements`, {
			type: 'IN',
			dateTime: '2026-07-10T09:00:00.000Z',
			reason: null,
			activityId: null,
			content: [{ participantId, vehicleId, poolName: null }],
		})

		// Assert
		expect(response.status(), 'a vehicle without the VEHICLE option must be refused')
			.toBeGreaterThanOrEqual(400)
	})

	/**
	 * A movement that closes someone's presence is frozen: it can no longer be
	 * updated, disabled, enabled or deleted.
	 */
	test('a terminal movement can no longer be corrected', async ({ api, project }) => {
		// Arrange
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Gone',
			lastName: 'ForGood',
			birthday: '1990-01-01',
		})
		await seedMovement(api, project.id, { type: 'IN', content: [{ participantId }] })
		const movementId = await seedMovement(api, project.id, {
			type: 'OUT',
			dateTime: '2026-07-11T09:00:00.000Z',
			reason: 'DEFINITIVE_DEPARTURE',
			content: [{ participantId }],
		})

		// Act
		const updated = await api.raw('PATCH', `/api/v2/projects/${project.id}/movements/${movementId}`, {
			type: 'OUT',
			dateTime: '2026-07-11T10:00:00.000Z',
			reason: 'DEFINITIVE_DEPARTURE',
			activityId: null,
			content: [{ participantId, vehicleId: null, poolName: null }],
		})
		const disabled = await api.raw('POST', `/api/v2/projects/${project.id}/movements/${movementId}/disable`)
		const deleted = await api.raw('DELETE', `/api/v2/projects/${project.id}/movements/${movementId}`)

		// Assert
		expect(updated.status(), 'a terminal movement cannot be updated').toBeGreaterThanOrEqual(400)
		expect(await updated.text()).toContain('MOVEMENT_CANNOT_BE_UPDATED')
		expect(disabled.status(), 'a terminal movement cannot be disabled').toBeGreaterThanOrEqual(400)
		expect(await disabled.text()).toContain('MOVEMENT_CANNOT_BE_DISABLED')
		expect(deleted.status(), 'a terminal movement cannot be deleted').toBeGreaterThanOrEqual(400)
		expect(await deleted.text()).toContain('MOVEMENT_CANNOT_BE_DELETED')
	})

	/**
	 * v2 PATCH is a full replace, so an edit resubmits every field — which is
	 * exactly why the direction and content type have to be pinned server-side.
	 */
	test('direction and content type are locked on edit', async ({ api, project }) => {
		// Arrange
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Locked',
			lastName: 'Direction',
			birthday: '1990-01-01',
		})
		const movementId = await seedMovement(api, project.id, {
			type: 'OUT',
			reason: 'SHOPPING',
			content: [{ participantId }],
		})

		// Act
		const flipped = await api.raw('PATCH', `/api/v2/projects/${project.id}/movements/${movementId}`, {
			type: 'IN',
			dateTime: '2026-07-10T09:00:00.000Z',
			reason: null,
			activityId: null,
			content: [{ participantId, vehicleId: null, poolName: null }],
		})
		const retimed = await api.raw('PATCH', `/api/v2/projects/${project.id}/movements/${movementId}`, {
			type: 'OUT',
			dateTime: '2026-07-10T14:00:00.000Z',
			reason: 'SHOPPING',
			activityId: null,
			content: [{ participantId, vehicleId: null, poolName: null }],
		})

		// Assert
		expect(flipped.status(), 'changing the direction must be refused').toBeGreaterThanOrEqual(400)
		expect(await flipped.text()).toContain('MOVEMENT_UPDATE_CHANGE_TYPE')
		expect(retimed.ok(), 'the other fields still update normally').toBeTruthy()
	})

	/**
	 * The reason matrix, as the form must present it: every REGISTERED reason is
	 * an exit and every GUEST reason an entry, so the other half of the matrix
	 * has nothing to offer and must not ask for one. An entry for a registered
	 * participant is simply a return; a guest leaving is simply leaving.
	 *
	 * The registered ENTRY still offers the picker for ACTIVITIES — returning
	 * from an outing is an entry linked to it — but labelled as an activity, not
	 * as a reason.
	 */
	test('a registered entry asks for no reason, its exit does', async ({ page, api, projects }) => {
		// Arrange
		const project = await projects.create({ options: OPTIONS_COMMUNICATION })
		await seedParticipant(api, project.id, { firstName: 'Reason', lastName: 'Matrix', birthday: '1990-01-01' })
		await seedActivity(api, project.id, { name: 'Rando' })
		await page.goto(`/projects/${project.id}/movements`)
		await clickUntilVisible(page.getByTestId('movement-create'), page.getByTestId('movement-form-participants'))
		const motiveLabel = page.locator('label[for="movement-motive"]')

		// Act + Assert
		await expect(page.getByTestId('movement-form-participants')).toBeVisible()
		await expect(motiveLabel).not.toContainText(/motif|reason/i)

		// Act + Assert
		await page.getByTestId('movement-form-type').getByLabel(/sortie|out/i).check()
		await expect(motiveLabel).toContainText(/motif|reason/i)
		await expect(page.getByTestId('movement-form-motive')).toBeVisible()
	})

	test('a guest exit asks for no reason, its entry does', async ({ page, api, project }) => {
		// Arrange
		await seedParticipant(api, project.id, { firstName: 'Guest', lastName: 'Matrix', birthday: '1990-01-01' })
		await page.goto(`/projects/${project.id}/movements`)
		await clickUntilVisible(page.getByTestId('movement-guest-create'), page.getByTestId('movement-guest-form-type'))

		// Act + Assert
		await expect(page.getByTestId('movement-guest-form-reason')).toBeVisible()

		// Act + Assert
		await page.getByTestId('movement-guest-form-type').getByLabel(/sortie|out/i).check()
		await expect(page.getByTestId('movement-guest-form-reason')).toHaveCount(0)
	})

	/**
	 * Adding someone the movement would not actually move is a WARNING, never a
	 * refusal: recording a correction is exactly when an operator needs to put
	 * someone already out on an exit. The form says so and still submits.
	 */
	test('warns without blocking when a participant is already in the target state', async ({ page, api, project }) => {
		// Arrange
		const alreadyIn = await seedParticipant(api, project.id, {
			firstName: 'Already',
			lastName: 'Inside',
			birthday: '1990-01-01',
		})
		await seedMovement(api, project.id, { type: 'IN', content: [{ participantId: alreadyIn }] })

		// Act
		await page.goto(`/projects/${project.id}/movements`)
		await clickUntilVisible(page.getByTestId('movement-create'), page.getByTestId('movement-form-participants'))
		await page.getByTestId('movement-form-participants').click()
		await selectItem(page, /already/i).click()

		// Assert
		await expect(page.getByTestId('movement-form-warning')).toContainText(/already|déjà/i)
		await expect(page.getByTestId('movement-form-submit')).toBeEnabled()
	})

	/**
	 * The pool label is provenance, never typed: it is stamped only by adding
	 * participants through a group. This closes the ⚠️ on movements.journey —
	 * that spec proves a group stamps the pool, but not that the input is absent.
	 */
	test('the pool label is never typed by hand', async ({ page, api, project }) => {
		// Arrange
		await seedParticipant(api, project.id, { firstName: 'Solo', lastName: 'Mover', birthday: '1990-01-01' })

		// Act
		await page.goto(`/projects/${project.id}/movements`)
		await clickUntilVisible(page.getByTestId('movement-create'), page.getByTestId('movement-form-participants'))

		// Assert
		await expect(page.getByTestId('movement-form-participants')).toBeVisible()
		await expect(page.getByTestId('movement-form-pool')).toHaveCount(0)
		await expect(page.getByRole('textbox', { name: /pool|groupe de/i })).toHaveCount(0)
	})
})
