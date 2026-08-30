import { invite, pendingInvitation, PROJECT_ROLE } from './support/domain'
import { account, expect, test } from './support/fixtures'

/**
 * critical-scenarios.md §2 "Profile status and access window" — permissions
 * require an ACCEPTED, in-window profile. INVITED, REJECTED and BLOCKED profiles
 * grant nothing (project-profiles.md), and so does an accepted profile whose
 * access window has closed.
 *
 * Every assertion is made in the lesser account's own session after a fresh
 * navigation, since the scoped authorities are resolved during SSR.
 */
test.describe('access control — profile status', () => {
	test('an invitation that has not been accepted grants nothing', async ({ api, project, pageAs }) => {
		// Arrange
		await invite(api, project.id, account('member').email, PROJECT_ROLE.COORDINATOR)

		// Act
		const memberPage = await pageAs('member')
		const response = await memberPage.goto(`/projects/${project.id}/participants`)

		// Assert
		expect(response?.status(), 'an INVITED profile must grant nothing').toBe(403)
	})

	test('a rejected profile grants nothing', async ({ api, project, pageAs, apiAs }) => {
		// Arrange
		await invite(api, project.id, account('member').email, PROJECT_ROLE.COORDINATOR)
		const memberApi = await apiAs('member')
		const profileId = await pendingInvitation(memberApi, project.id)

		// Act
		await memberApi.post(`/api/v2/users/profiles/${profileId}/reject`)
		const memberPage = await pageAs('member')
		const response = await memberPage.goto(`/projects/${project.id}/participants`)

		// Assert
		expect(response?.status(), 'a REJECTED profile must grant nothing').toBe(403)
	})

	/**
	 * Unlike the REJECTED case above, the block lands on a profile whose session is
	 * already open, so the refusal cannot be read from a navigation:
	 * `project-authority.ts` answers from the session store sealed at sign-in and
	 * never consults the backend. What the block genuinely revokes is asserted
	 * against the API, plus the project list — which is backend-driven and so does
	 * reflect the revocation.
	 */
	test('a blocked profile cannot open its project', async ({ api, project, grantRole, apiAs, pageAs }) => {
		// Arrange
		const profileId = await grantRole(project.id, 'member', PROJECT_ROLE.COORDINATOR)
		const memberApi = await apiAs('member')
		expect((await memberApi.raw('GET', `/api/v2/projects/${project.id}/participants`)).ok()).toBeTruthy()

		// Act
		await api.post(`/api/v2/projects/${project.id}/profiles/${profileId}/block`)

		// Assert
		const response = await memberApi.raw('GET', `/api/v2/projects/${project.id}/participants`)
		expect(response.status(), 'a BLOCKED profile must grant nothing').toBeGreaterThanOrEqual(400)
		const memberPage = await pageAs('member')
		await memberPage.goto('/projects')
		await expect(memberPage.locator('.project-card', { hasText: project.name })).toHaveCount(0)
	})

	/**
	 * The window is closed by moving BOTH bounds into the past, inside the
	 * project's own 2026-07-01..2026-08-31 range — a profile window outside the
	 * project range is rejected outright, so "expired" has to mean expired
	 * relative to now while still sitting inside the project.
	 */
	test('a profile outside its access window grants nothing', async ({ project, grantRole, pageAs }) => {
		// Arrange
		await grantRole(project.id, 'member', PROJECT_ROLE.COORDINATOR, {
			startAccess: { date: '2026-07-01' },
			endAccess: { date: '2026-07-02' },
		})

		// Act
		const memberPage = await pageAs('member')
		const response = await memberPage.goto(`/projects/${project.id}/participants`)

		// Assert
		expect(response?.status(), 'a profile past its access window must grant nothing').toBe(403)
	})
})
