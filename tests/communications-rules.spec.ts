import {
	movementReason,
	OPTIONS_ALERT,
	OPTIONS_COMMUNICATION,
	PROJECT_ROLE,
	seedAlert,
	seedCommunication,
	seedGuestMovement,
	seedMovement,
	seedParticipant,
} from './support/domain'
import { expect, test } from './support/fixtures'

/**
 * critical-scenarios.md §11 — a thread traces exchanges with people who are OFF
 * SITE, which is the reason behind every rule here: only an exit of registered
 * participants can carry one, only an open alert can be discussed, and a message
 * can never predate the record it hangs off (communications.md).
 */
test.describe('communications — attachment rules', () => {
	test('a message can only attach to an exit carrying registered participants', async ({ api, projects }) => {
		// Arrange
		const project = await projects.create({ options: OPTIONS_COMMUNICATION })
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'On',
			lastName: 'Site',
			birthday: '1990-01-01',
		})
		const entryId = await seedMovement(api, project.id, { type: 'IN', content: [{ participantId }] })
		const guestExitId = await seedGuestMovement(api, project.id, {
			type: 'IN',
			reason: 'VISIT',
			guests: [{ firstName: 'Guest', lastName: 'Thread', birthday: '1980-01-01' }],
		})

		// Act
		const onEntry = await api.raw('POST', `/api/v2/projects/${project.id}/communications`, {
			movementId: entryId,
			dateTime: '2026-07-10T10:00:00.000Z',
			message: 'Should not attach',
		})
		const onGuest = await api.raw('POST', `/api/v2/projects/${project.id}/communications`, {
			movementId: guestExitId,
			dateTime: '2026-07-10T10:00:00.000Z',
			message: 'Should not attach either',
		})

		// Assert
		expect(onEntry.status()).toBeGreaterThanOrEqual(400)
		expect(await onEntry.text()).toContain('COMMUNICATION_MOVEMENT_TYPE_NOT_OUT')
		expect(onGuest.status()).toBeGreaterThanOrEqual(400)
		expect(await onGuest.text()).toContain('COMMUNICATION_MOVEMENT_CONTENT_TYPE_NOT_REGISTERED')
	})

	test('a closed alert can no longer be discussed', async ({ api, projects }) => {
		// Arrange
		const project = await projects.create({ options: OPTIONS_ALERT })
		const alertId = await seedAlert(api, project.id, {
			title: 'Closing alert',
			dateTime: '2026-07-10T09:00:00.000Z',
		})
		await api.post(`/api/v2/projects/${project.id}/alerts/${alertId}/resolve`)

		// Act
		const refused = await api.raw('POST', `/api/v2/projects/${project.id}/communications`, {
			alertId,
			dateTime: '2026-07-10T10:00:00.000Z',
			message: 'Anyone still there?',
		})

		// Assert
		expect(refused.status()).toBeGreaterThanOrEqual(400)
		expect(await refused.text())
			.toContain('COMMUNICATION_ALERT_IS_NOT_COMPATIBLE_WITH_COMMUNICATION_CREATION')

		await api.post(`/api/v2/projects/${project.id}/alerts/${alertId}/reopen`)
		const reopened = await api.raw('POST', `/api/v2/projects/${project.id}/communications`, {
			alertId,
			dateTime: '2026-07-10T11:00:00.000Z',
			message: 'Back open',
		})
		expect(reopened.ok(), 'reopening makes the thread writable again').toBeTruthy()
	})

	/**
	 * A thread is a chronology: a message that predates its own subject would
	 * make the timeline unreadable.
	 */
	test('a message cannot predate the record it is linked to', async ({ api, projects }) => {
		// Arrange
		const project = await projects.create({ options: OPTIONS_ALERT })
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Timeline',
			lastName: 'Order',
			birthday: '1990-01-01',
		})
		const reason = await movementReason(api, project.id)
		const movementId = await seedMovement(api, project.id, {
			type: 'OUT',
			dateTime: '2026-07-10T10:00:00.000Z',
			reason: reason.value,
			content: [{ participantId }],
		})
		const alertId = await seedAlert(api, project.id, {
			title: 'Timed alert',
			dateTime: '2026-07-10T10:00:00.000Z',
		})

		// Act
		const beforeMovement = await api.raw('POST', `/api/v2/projects/${project.id}/communications`, {
			movementId,
			dateTime: '2026-07-10T09:00:00.000Z',
			message: 'Too early',
		})
		const beforeAlert = await api.raw('POST', `/api/v2/projects/${project.id}/communications`, {
			alertId,
			dateTime: '2026-07-10T09:00:00.000Z',
			message: 'Too early as well',
		})

		// Assert
		expect(beforeMovement.status()).toBeGreaterThanOrEqual(400)
		expect(await beforeMovement.text()).toContain('COMMUNICATION_MOVEMENT_IS_AFTER_COMMUNICATION')
		expect(beforeAlert.status()).toBeGreaterThanOrEqual(400)
		expect(await beforeAlert.text()).toContain('COMMUNICATION_ALERT_IS_AFTER_COMMUNICATION')
	})

	test('a message is capped, and one with no target is refused', async ({ api, projects }) => {
		// Arrange
		const project = await projects.create({ options: OPTIONS_COMMUNICATION })
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Wordy',
			lastName: 'Reporter',
			birthday: '1990-01-01',
		})
		const reason = await movementReason(api, project.id)
		const movementId = await seedMovement(api, project.id, {
			type: 'OUT',
			reason: reason.value,
			content: [{ participantId }],
		})

		// Act
		const tooLong = await api.raw('POST', `/api/v2/projects/${project.id}/communications`, {
			movementId,
			dateTime: '2026-07-10T10:00:00.000Z',
			message: 'x'.repeat(251),
		})
		const noTarget = await api.raw('POST', `/api/v2/projects/${project.id}/communications`, {
			dateTime: '2026-07-10T10:00:00.000Z',
			message: 'Floating message',
		})

		// Assert
		expect(tooLong.status()).toBeGreaterThanOrEqual(400)
		expect(await tooLong.text()).toContain('COMMUNICATION_MESSAGE_TOO_LONG')
		expect(noTarget.status()).toBeGreaterThanOrEqual(400)
		expect(await noTarget.text()).toContain('COMMUNICATION_MOVEMENT_OR_ALERT_NULL')
	})

	/**
	 * PROJECT_PARTICIPANT holds C+R on communications but no D: they can report,
	 * they cannot erase.
	 */
	test('a participant cannot delete a message', async ({ api, projects, grantRole, apiAs }) => {
		// Arrange
		const project = await projects.create({ options: OPTIONS_COMMUNICATION })
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Cannot',
			lastName: 'Erase',
			birthday: '1990-01-01',
		})
		const reason = await movementReason(api, project.id)
		const movementId = await seedMovement(api, project.id, {
			type: 'OUT',
			reason: reason.value,
			content: [{ participantId }],
		})
		const communicationId = await seedCommunication(api, project.id, {
			movementId,
			dateTime: '2026-07-10T10:00:00.000Z',
			message: 'Reported from the field',
		})
		await grantRole(project.id, 'member', PROJECT_ROLE.PARTICIPANT)
		const memberApi = await apiAs('member')

		// Act
		const response = await memberApi.raw(
			'DELETE',
			`/api/v2/projects/${project.id}/communications/${communicationId}`,
		)

		// Assert
		expect(response.status(), 'a participant must not delete a message').toBeGreaterThanOrEqual(400)
		const stillThere = await api.raw('GET', `/api/v2/projects/${project.id}/communications/${communicationId}`)
		expect(stillThere.ok(), 'the message stays in the thread').toBeTruthy()
	})
})

test.describe('alerts — lifecycle rules', () => {
	/**
	 * Raising an alert with the optional message creates that first message
	 * transactionally, which is why an alert born with one is undeletable.
	 */
	test('raising an alert also records its initial message, making it undeletable', async ({ api, projects }) => {
		// Arrange
		const project = await projects.create({ options: OPTIONS_ALERT })

		// Act
		const alertId = await seedAlert(api, project.id, {
			title: 'Born with a thread',
			dateTime: '2026-07-10T09:00:00.000Z',
			message: 'Initial report.',
		})

		// Assert
		const thread = await api.get<{ content: Array<{ message: string }> }>(
			`/api/v2/projects/${project.id}/alerts/${alertId}/communications?page=0&size=20`,
		)
		expect(thread.content.some(entry => /initial report/i.test(entry.message)),
			'the optional message became the first communication').toBe(true)

		const deleted = await api.raw('DELETE', `/api/v2/projects/${project.id}/alerts/${alertId}`)
		expect(deleted.status(), 'an alert carrying a message cannot be deleted').toBeGreaterThanOrEqual(400)
		expect(await deleted.text()).toContain('ALERT_DELETE_HAS_COMMUNICATION')
	})

	/**
	 * The mirror image: the message is optional, and a blank one must open no
	 * thread at all. It used to seed a communication regardless — a row with an
	 * author, a timestamp and nothing to read — which also made the alert
	 * undeletable for a message nobody wrote. Whitespace counts as blank.
	 */
	for (const [label, message] of [
		['absent', undefined],
		['null', null],
		['blank', '   '],
	] as const) {
		test(`an alert raised with a ${label} message opens no thread and stays deletable`, async ({
																									   api,
																									   projects
																								   }) => {
			// Arrange
			const project = await projects.create({ options: OPTIONS_ALERT })

			// Act
			const alertId = await seedAlert(api, project.id, {
				title: `Born silent (${label})`,
				dateTime: '2026-07-10T09:00:00.000Z',
				message,
			})

			// Assert
			const thread = await api.get<{ content: unknown[] }>(
				`/api/v2/projects/${project.id}/alerts/${alertId}/communications?page=0&size=20`,
			)
			expect(thread.content, 'no communication was written for an unwritten message').toHaveLength(0)

			const deleted = await api.raw('DELETE', `/api/v2/projects/${project.id}/alerts/${alertId}`)
			expect(deleted.ok(), 'an alert with an empty thread can be deleted').toBeTruthy()
		})
	}

	/**
	 * `status` is mandatory on the writer DTO; omitting it fails on ALERT_STATUS_NULL
	 * before the lifecycle check is ever reached, which is not what this asserts.
	 */
	test('a closed alert cannot be edited', async ({ api, projects }) => {
		// Arrange
		const project = await projects.create({ options: OPTIONS_ALERT })
		const alertId = await seedAlert(api, project.id, {
			title: 'Frozen once closed',
			dateTime: '2026-07-10T09:00:00.000Z',
		})
		await api.post(`/api/v2/projects/${project.id}/alerts/${alertId}/resolve`)

		// Act
		const response = await api.raw('PATCH', `/api/v2/projects/${project.id}/alerts/${alertId}`, {
			title: 'Renamed while closed',
			dateTime: '2026-07-10T09:00:00.000Z',
			status: 'RESOLVED',
		})

		// Assert
		expect(response.status()).toBeGreaterThanOrEqual(400)
		expect(await response.text()).toContain('ALERT_STATUS_IS_NOT_UPDATABLE')
	})

	/**
	 * PROJECT_PARTICIPANT holds ALERT_U per the seed migrations, so a status
	 * change is within the role; what it lacks is ALERT_D.
	 */
	test('a participant may change an alert’s status but cannot delete it', async ({
																					   api,
																					   projects,
																					   grantRole,
																					   apiAs
																				   }) => {
		// Arrange
		const project = await projects.create({ options: OPTIONS_ALERT })
		const alertId = await seedAlert(api, project.id, {
			title: 'Status guarded',
			dateTime: '2026-07-10T09:00:00.000Z',
		})
		await grantRole(project.id, 'member', PROJECT_ROLE.PARTICIPANT)
		const memberApi = await apiAs('member')

		// Act
		const response = await memberApi.raw('POST', `/api/v2/projects/${project.id}/alerts/${alertId}/resolve`)

		// Assert
		expect(response.ok(), `a participant holds alert update (${response.status()})`).toBeTruthy()
		const deleted = await memberApi.raw('DELETE', `/api/v2/projects/${project.id}/alerts/${alertId}`)
		expect(deleted.status(), 'a participant must not delete an alert').toBeGreaterThanOrEqual(400)
	})
})
