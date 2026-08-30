import { projectNavEntry } from './support/antd'
import { PROJECT_ROLE, seedParticipant } from './support/domain'
import { account, expect, test } from './support/fixtures'

/**
 * critical-scenarios.md §2 "Role gating" — the first assertions in the suite
 * that Registry says NO to somebody. Each case arranges the project and the
 * membership as the administrator, then asserts in the lesser account's OWN
 * session; the invitee's page always makes a fresh navigation after the grant,
 * because the Nuxt session resolves a project's scoped authorities during SSR.
 *
 * The access matrix is taken from the seed migrations, which
 * roles-and-permissions.md names as the source of truth — NOT from the prose
 * table on that page, which is stale: it lists PROJECT_PARTICIPANT as "C R"
 * while V1_0_1 and its successors also grant `_U` on participants, groups,
 * movements, communications and alerts. What the role genuinely lacks is `_D`
 * anywhere, plus any access at all to members, vehicles and activities.
 * PROJECT_COORDINATOR reads members but cannot manage them.
 */
test.describe('access control — role gating', () => {
	/**
	 * The seed migrations — which roles-and-permissions.md itself names as the
	 * source of truth — grant PROJECT_PARTICIPANT `_C`, `_R` and `_U` on
	 * participants, but no `_D` anywhere. The prose access matrix on that page
	 * says "C R" only and is wrong; this asserts the data.
	 */
	test('a participant may edit but is offered no delete action', async ({ api, project, grantRole, pageAs }) => {
		// Arrange
		await seedParticipant(api, project.id, { firstName: 'Read', lastName: 'Only', birthday: '1990-01-01' })
		await grantRole(project.id, 'member', PROJECT_ROLE.PARTICIPANT)

		// Act
		const memberPage = await pageAs('member')
		await memberPage.goto(`/projects/${project.id}/participants`)
		await memberPage.getByTestId('participant-row-actions').first().click()

		// Assert
		await expect(memberPage.getByTestId('participant-action-edit')).toBeVisible()
		await expect(memberPage.getByTestId('participant-action-delete')).toHaveCount(0)
	})

	test('a participant cannot reach the member list', async ({ project, grantRole, pageAs }) => {
		// Arrange
		await grantRole(project.id, 'member', PROJECT_ROLE.PARTICIPANT)

		// Act
		const memberPage = await pageAs('member')
		const response = await memberPage.goto(`/projects/${project.id}/members`)

		// Assert
		expect(response?.status(), 'members must be closed to a participant').toBe(403)
		await memberPage.goto(`/projects/${project.id}`)
		await expect(await projectNavEntry(memberPage, 'members')).toHaveCount(0)
	})

	test('a coordinator reads the member list but cannot manage it', async ({ project, grantRole, pageAs }) => {
		// Arrange
		await grantRole(project.id, 'member', PROJECT_ROLE.COORDINATOR)

		// Act
		const memberPage = await pageAs('member')
		await memberPage.goto(`/projects/${project.id}/members`)

		// Assert
		await expect(memberPage.getByText(/spike/i).first()).toBeVisible()
		await expect(memberPage.getByTestId('member-invite')).toHaveCount(0)
		await expect(memberPage.getByTestId('member-row-actions')).toHaveCount(0)
	})

	/**
	 * The role ceiling (PROJECT_PROFILE_ASSIGNS_ROLE_HIGHER_THAN_CURRENT_USER):
	 * a coordinator sits at level 10 and cannot hand out level 0. Asserted
	 * against the API because the UI does not offer the option at all — the
	 * refusal has to hold even when the request is made directly.
	 */
	test('a coordinator cannot assign a role above their own level', async ({ project, grantRole, apiAs }) => {
		// Arrange
		await grantRole(project.id, 'member', PROJECT_ROLE.COORDINATOR)
		const memberApi = await apiAs('member')

		// Act
		const response = await memberApi.raw('POST', `/api/v2/projects/${project.id}/profiles`, {
			emails: [account('burn').email],
			role: PROJECT_ROLE.ADMINISTRATOR,
		})

		// Assert
		expect(response.status(), 'assigning a higher role must be refused').toBeGreaterThanOrEqual(400)
		expect(await response.text()).toContain('NOT_ENOUGH_PERMISSION')
	})
})
