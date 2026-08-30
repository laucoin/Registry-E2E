import { PROJECT_ROLE, seedGroup, seedParticipant } from './support/domain'
import { expect, test } from './support/fixtures'

/**
 * critical-scenarios.md §6 — a group must never exist without a member
 * (GROUP_MEMBERS_EMPTY on create, GROUP_LAST_MEMBERS_CANNOT_BE_REMOVED on
 * removal), and membership is a coordinator-and-above concern: a
 * PROJECT_PARTICIPANT may create and read groups but not restructure existing
 * ones (roles-and-permissions.md).
 */
test.describe('groups — membership rules', () => {
	test('a group cannot be created without a member', async ({ api, project }) => {
		// Act
		const response = await api.raw('POST', `/api/v2/projects/${project.id}/groups`, {
			name: 'Memberless',
			members: [],
		})

		// Assert
		expect(response.status()).toBeGreaterThanOrEqual(400)
		expect(await response.text()).toContain('GROUP_MEMBERS_EMPTY')
	})

	/**
	 * v2 PATCH is a full replace, so the members list is resubmitted whole — the
	 * add and the removal happen in the same call.
	 */
	test('an administrator adds and removes group members', async ({ api, project }) => {
		// Arrange
		const ana = await seedParticipant(api, project.id, {
			firstName: 'Ana',
			lastName: 'One',
			birthday: '1990-01-01'
		})
		const ben = await seedParticipant(api, project.id, {
			firstName: 'Ben',
			lastName: 'Two',
			birthday: '1991-01-01'
		})
		const cora = await seedParticipant(api, project.id, {
			firstName: 'Cora',
			lastName: 'Three',
			birthday: '1992-01-01'
		})
		const groupId = await seedGroup(api, project.id, { name: 'Shifting', members: [ana, ben] })

		// Act
		await api.patch(`/api/v2/projects/${project.id}/groups/${groupId}`, {
			name: 'Shifting',
			members: [ana, cora],
		})

		// Assert
		const group = await api.get<{ members?: Array<{ id: string, firstName?: string }> }>(
			`/api/v2/projects/${project.id}/groups/${groupId}`,
		)
		const memberIds = (group.members ?? []).map(member => member.id)
		expect(memberIds).toContain(ana)
		expect(memberIds).toContain(cora)
		expect(memberIds, 'Ben was removed').not.toContain(ben)
	})

	test('a participant may change a group’s membership but cannot delete', async ({
																					   api,
																					   project,
																					   grantRole,
																					   apiAs
																				   }) => {
		// Arrange
		const ana = await seedParticipant(api, project.id, {
			firstName: 'Ana',
			lastName: 'One',
			birthday: '1990-01-01'
		})
		const ben = await seedParticipant(api, project.id, {
			firstName: 'Ben',
			lastName: 'Two',
			birthday: '1991-01-01'
		})
		const groupId = await seedGroup(api, project.id, { name: 'Locked', members: [ana] })
		await grantRole(project.id, 'member', PROJECT_ROLE.PARTICIPANT)
		const memberApi = await apiAs('member')

		// Act
		const restructured = await memberApi.raw('PATCH', `/api/v2/projects/${project.id}/groups/${groupId}`, {
			name: 'Locked',
			members: [ana, ben],
		})

		// Assert
		expect(restructured.ok(), `a participant holds group update (${restructured.status()})`).toBeTruthy()
		const removed = await memberApi.raw('DELETE', `/api/v2/projects/${project.id}/groups/${groupId}`)
		expect(removed.status(), 'a participant must not delete a group').toBeGreaterThanOrEqual(400)

		const created = await memberApi.raw('POST', `/api/v2/projects/${project.id}/groups`, {
			name: 'Participant made',
			members: [ben],
		})
		expect(created.ok(), 'the role still grants group creation').toBeTruthy()
		const read = await memberApi.raw('GET', `/api/v2/projects/${project.id}/groups?page=0&size=20`)
		expect(read.ok(), 'the role still grants group reads').toBeTruthy()
	})
})
