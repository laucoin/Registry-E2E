import { PROJECT_ROLE, seedGroup, seedMovement, seedParticipant } from './support/domain'
import { expect, test } from './support/fixtures'

/**
 * critical-scenarios.md §5 — presence is DERIVED from the latest movement, never
 * stored, and deletion is guarded twice: by recorded movements and by group
 * membership (participants.md).
 *
 * A REGISTERED participant's normal state is present (they live on site); a
 * GUEST's is off-site (they visit), which is why the two read differently before
 * any movement exists.
 * Derived presence is exposed as `status`, not `presence`: no movement at all
 * reads as outside ("not yet arrived"), the latest movement's direction decides
 * afterwards, and a participant outside their presence window counts as outside
 * whatever their movements say.
 */
interface PresenceView {
	status?: { value: string } | string
}

function presenceOf(participant: PresenceView): string | undefined {
	return typeof participant.status === 'string' ? participant.status : participant.status?.value
}

test.describe('participants — presence and deletion guards', () => {
	test('presence follows the latest movement', async ({ api, project }) => {
		// Arrange
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Derived',
			lastName: 'Presence',
			birthday: '1990-01-01',
		})
		const url = `/api/v2/projects/${project.id}/participants/${participantId}`

		// Act
		await seedMovement(api, project.id, {
			type: 'OUT',
			dateTime: '2026-07-10T09:00:00.000Z',
			reason: 'SHOPPING',
			content: [{ participantId }],
		})
		const afterExit = presenceOf(await api.get<PresenceView>(url))

		await seedMovement(api, project.id, {
			type: 'IN',
			dateTime: '2026-07-10T18:00:00.000Z',
			content: [{ participantId }],
		})
		const afterReturn = presenceOf(await api.get<PresenceView>(url))

		// Assert
		expect(afterExit, 'an OUT makes them absent').toBe('OUT')
		expect(afterReturn, 'a later IN makes them present again').toBe('IN')
	})

	/**
	 * Both read as outside before any movement: a registered participant has
	 * simply "not yet arrived". The oracle claimed the registered one starts
	 * present and the guest off-site — there is no such distinction, presence is
	 * derived from movements alone (plus the presence window).
	 */
	test('a participant with no movement has not yet arrived', async ({ api, project }) => {
		// Arrange
		const registeredId = await seedParticipant(api, project.id, {
			firstName: 'Resident',
			lastName: 'Member',
			birthday: '1990-01-01',
		})

		// Act
		const registered = await api.get<PresenceView>(
			`/api/v2/projects/${project.id}/participants/${registeredId}`,
		)
		const guests = await api.get<{ content: PresenceView[] }>(
			`/api/v2/projects/${project.id}/participants?type=GUEST`,
		)

		// Assert
		expect(presenceOf(registered), 'no movement means not on site').not.toBe('IN')
		for (const guest of guests.content) {
			expect(presenceOf(guest), 'a guest reads as off-site').not.toBe('IN')
		}
	})

	/**
	 * History is preserved rather than cascaded: a participant who took part in a
	 * movement is disabled, never deleted.
	 */
	test('a participant carrying movements cannot be deleted', async ({ api, project }) => {
		// Arrange
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Has',
			lastName: 'History',
			birthday: '1990-01-01',
		})
		await seedMovement(api, project.id, { type: 'IN', content: [{ participantId }] })

		// Act
		const response = await api.raw('DELETE', `/api/v2/projects/${project.id}/participants/${participantId}`)

		// Assert
		expect(response.status()).toBeGreaterThanOrEqual(400)
		expect(await response.text()).toContain('PARTICIPANT_DELETE_HAS_MOVEMENT')
		const stillThere = await api.raw('GET', `/api/v2/projects/${project.id}/participants/${participantId}`)
		expect(stillThere.ok(), 'the history is preserved').toBeTruthy()
	})

	/**
	 * A group must never be left memberless, so the guard fires on the
	 * participant side too — deleting the group is the documented way out.
	 */
	test('the last member of a group cannot be deleted or disabled', async ({ api, project }) => {
		// Arrange
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Only',
			lastName: 'Member',
			birthday: '1990-01-01',
		})
		const groupId = await seedGroup(api, project.id, { name: 'Solo group', members: [participantId] })

		// Act
		const deleted = await api.raw('DELETE', `/api/v2/projects/${project.id}/participants/${participantId}`)
		const disabled = await api.raw('POST', `/api/v2/projects/${project.id}/participants/${participantId}/disable`)

		// Assert
		expect(deleted.status()).toBeGreaterThanOrEqual(400)
		expect(await deleted.text()).toContain('PARTICIPANT_DELETE_LAST_GROUP_MEMBER')
		expect(disabled.status()).toBeGreaterThanOrEqual(400)
		expect(await disabled.text()).toContain('PARTICIPANT_DISABLE_LAST_GROUP_MEMBER')

		await api.remove(`/api/v2/projects/${project.id}/groups/${groupId}`)
		const afterGroupGone = await api.raw(
			'DELETE',
			`/api/v2/projects/${project.id}/participants/${participantId}`,
		)
		expect(afterGroupGone.ok(), 'deleting the group is the way out').toBeTruthy()
	})

	/**
	 * Disabling is soft and reversible: a re-enabled participant becomes
	 * selectable in movements again.
	 */
	test('a disabled participant is re-enabled', async ({ api, project }) => {
		// Arrange
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Back',
			lastName: 'Again',
			birthday: '1990-01-01',
		})
		await api.post(`/api/v2/projects/${project.id}/participants/${participantId}/disable`)

		// Act
		await api.post(`/api/v2/projects/${project.id}/participants/${participantId}/enable`)

		// Assert
		const movement = await api.raw('POST', `/api/v2/projects/${project.id}/movements`, {
			type: 'IN',
			dateTime: '2026-07-10T09:00:00.000Z',
			reason: null,
			activityId: null,
			content: [{ participantId, vehicleId: null, poolName: null }],
		})
		expect(movement.ok(), `a re-enabled participant is selectable again (${movement.status()})`).toBeTruthy()
	})

	/**
	 * Per the seed migrations (the authoritative source), PROJECT_PARTICIPANT
	 * holds `_C`, `_R` and `_U` on participants — the prose matrix in
	 * roles-and-permissions.md saying "C R" is stale. It holds no `_D`.
	 */
	test('a participant role may edit but cannot delete participants', async ({
																				  api,
																				  project,
																				  grantRole,
																				  apiAs,
																				  pageAs
																			  }) => {
		// Arrange
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Read',
			lastName: 'Only',
			birthday: '1990-01-01',
		})
		await grantRole(project.id, 'member', PROJECT_ROLE.PARTICIPANT)
		const memberApi = await apiAs('member')

		// Act
		const updated = await memberApi.raw('PATCH', `/api/v2/projects/${project.id}/participants/${participantId}`, {
			firstName: 'Renamed',
			lastName: 'Only',
			birthday: '1990-01-01',
		})
		const deleted = await memberApi.raw('DELETE', `/api/v2/projects/${project.id}/participants/${participantId}`)

		// Assert
		expect(updated.ok(), `a participant holds update (${updated.status()})`).toBeTruthy()
		expect(deleted.status(), 'a participant must not delete').toBeGreaterThanOrEqual(400)

		const created = await memberApi.raw('POST', `/api/v2/projects/${project.id}/participants`, {
			firstName: 'Allowed',
			lastName: 'Create',
			birthday: '1991-01-01',
		})
		expect(created.ok(), 'the role still grants create').toBeTruthy()

		const memberPage = await pageAs('member')
		await memberPage.goto(`/projects/${project.id}/participants`)
		await memberPage.getByTestId('participant-row-actions').first().click()
		await expect(memberPage.getByTestId('participant-action-delete')).toHaveCount(0)
	})

	test('a birthday is required and cannot be in the future', async ({ api, project }) => {
		// Act
		const missing = await api.raw('POST', `/api/v2/projects/${project.id}/participants`, {
			firstName: 'No',
			lastName: 'Birthday',
		})
		const future = await api.raw('POST', `/api/v2/projects/${project.id}/participants`, {
			firstName: 'Future',
			lastName: 'Born',
			birthday: '2099-01-01',
		})

		// Assert
		expect(missing.status()).toBeGreaterThanOrEqual(400)
		expect(await missing.text()).toContain('PARTICIPANT_BIRTHDAY_NULL')
		expect(future.status()).toBeGreaterThanOrEqual(400)
		expect(await future.text()).toContain('PARTICIPANT_BIRTHDAY_FUTURE')
	})
})
