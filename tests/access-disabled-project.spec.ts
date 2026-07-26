import { PROJECT_ROLE, seedParticipant } from './support/domain'
import { expect, test } from './support/fixtures'

/**
 * critical-scenarios.md §2 "Disabled projects" — disabling is a soft, reversible
 * freeze (projects.md). Visibility gating (security.md): while a project is not
 * visible, non-administrators get NO project authorities at all, and even its
 * administrator keeps only REGISTRY_PROJECT_R/U/D — option authorities are
 * granted only while the project is visible.
 */
test.describe('access control — disabled projects', () => {
	test('disabling a project freezes it for non-administrators', async ({ api, project, grantRole, pageAs }) => {
		// Arrange
		await grantRole(project.id, 'member', PROJECT_ROLE.COORDINATOR)
		const memberPage = await pageAs('member')
		await memberPage.goto(`/projects/${project.id}/participants`)
		await expect(memberPage.getByTestId('participant-create')).toBeVisible()

		// Act
		await api.post(`/api/v2/projects/${project.id}/disable`)

		// Assert
		const response = await memberPage.goto(`/projects/${project.id}/participants`)
		expect(response?.status(), 'a coordinator loses every authority on a disabled project').toBe(403)
	})

	test('re-enabling a project restores the coordinator', async ({ api, project, grantRole, pageAs }) => {
		// Arrange
		await grantRole(project.id, 'member', PROJECT_ROLE.COORDINATOR)
		await api.post(`/api/v2/projects/${project.id}/disable`)
		const memberPage = await pageAs('member')
		expect((await memberPage.goto(`/projects/${project.id}/participants`))?.status()).toBe(403)

		// Act
		await api.post(`/api/v2/projects/${project.id}/enable`)

		// Assert
		await memberPage.goto(`/projects/${project.id}/participants`)
		await expect(memberPage.getByTestId('participant-create')).toBeVisible()
	})

	/**
	 * The administrator keeps exactly three actions — read, re-enable, delete —
	 * so a write into a domain of a disabled project must still be refused even
	 * for the person who can turn it back on.
	 */
	test('a disabled project leaves its administrator three actions', async ({ api, project }) => {
		// Arrange
		await seedParticipant(api, project.id, { firstName: 'Frozen', lastName: 'Row', birthday: '1990-01-01' })
		await api.post(`/api/v2/projects/${project.id}/disable`)

		// Act
		const read = await api.raw('GET', `/api/v2/projects/${project.id}`)
		const write = await api.raw('POST', `/api/v2/projects/${project.id}/participants`, {
			firstName: 'Should',
			lastName: 'Fail',
			birthday: '1990-01-01',
		})

		// Assert
		expect(read.ok(), 'the administrator still reads a disabled project').toBeTruthy()
		expect(write.status(), 'writing into a disabled project must be refused').toBeGreaterThanOrEqual(400)

		const enabled = await api.raw('POST', `/api/v2/projects/${project.id}/enable`)
		expect(enabled.ok(), 'the administrator can re-enable it').toBeTruthy()
	})
})
