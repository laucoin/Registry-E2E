import { account } from './support/actors'
import { registryApi } from './support/api'
import { invite, pendingInvitation, PROJECT_ROLE, uniqueName } from './support/domain'
import { expect, test } from './support/fixtures'
import { idpPassword, signInThroughIdp } from './support/idp'
import { findUserByEmail, findUserIdByEmail, purgeUserByEmail } from './support/users'

/**
 * critical-scenarios.md §4 — the membership lifecycle: invite (by id or by
 * email, creating a light user for an unknown address), answer, manage, leave.
 *
 * Inviting is a BATCH action with ONE role and an optional access window; when
 * only some invitees already hold a conflicting profile they are skipped and
 * reported in `notCreatedUserIds` rather than failing the whole call
 * (project-profiles.md).
 */
function lightUserEmail(): string {
	return `${uniqueName('light').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}@example.test`
}

test.describe('membership — inviting and answering', () => {
	test('accepting an invitation grants the role', async ({ api, project, apiAs, pageAs }) => {
		// Arrange
		await invite(api, project.id, account('member').email, PROJECT_ROLE.COORDINATOR)
		const memberApi = await apiAs('member')
		const profileId = await pendingInvitation(memberApi, project.id)

		// Act
		await memberApi.post(`/api/v2/users/profiles/${profileId}/accept`)

		// Assert
		const memberPage = await pageAs('member')
		await memberPage.goto(`/projects/${project.id}/participants`)
		await expect(memberPage.getByTestId('participant-create')).toBeVisible()
	})

	test('rejecting an invitation grants nothing', async ({ api, project, apiAs, pageAs }) => {
		// Arrange
		await invite(api, project.id, account('member').email, PROJECT_ROLE.COORDINATOR)
		const memberApi = await apiAs('member')
		const profileId = await pendingInvitation(memberApi, project.id)

		// Act
		await memberApi.post(`/api/v2/users/profiles/${profileId}/reject`)

		// Assert
		const memberPage = await pageAs('member')
		expect((await memberPage.goto(`/projects/${project.id}/participants`))?.status()).toBe(403)
		await memberPage.goto('/projects')
		await expect(memberPage.locator('.project-card', { hasText: project.name })).toHaveCount(0)
	})

	/**
	 * @ProfileAcceptOrReject — answering is only possible from INVITED, so a
	 * double-accept (a re-submitted form, a stale tab) must not re-open the
	 * decision.
	 */
	test('accepting is only possible from the INVITED status', async ({ api, project, apiAs }) => {
		// Arrange
		await invite(api, project.id, account('member').email, PROJECT_ROLE.PARTICIPANT)
		const memberApi = await apiAs('member')
		const profileId = await pendingInvitation(memberApi, project.id)
		await memberApi.post(`/api/v2/users/profiles/${profileId}/accept`)

		// Act
		const again = await memberApi.raw('POST', `/api/v2/users/profiles/${profileId}/accept`)

		// Assert
		expect(again.status(), 'accepting twice must be refused').toBeGreaterThanOrEqual(400)
		expect(await again.text()).toContain('NOT_FOUND_WITH_GIVEN_IDENTIFIER')
	})

	/**
	 * An unknown address becomes a "light" user: an account with an email and no
	 * identity-provider link, which the invitation flow is specified around
	 * (user-invitations.md).
	 */
	test('inviting an unknown email creates a light user', async ({ api, project }) => {
		// Arrange
		const email = lightUserEmail()
		expect(await findUserIdByEmail(api, email), 'the address holds no account yet').toBeUndefined()

		// Act
		await invite(api, project.id, email, PROJECT_ROLE.PARTICIPANT)

		// Assert
		const light = await findUserByEmail(api, email)
		expect(light.id, 'a light user was created').toBeTruthy()
		const profiles = await api.get<{ content: Array<{ status?: { value: string } | string }> }>(
			`/api/v2/projects/${project.id}/profiles?page=0&size=50`,
		)
		const statuses = profiles.content.map(profile =>
			typeof profile.status === 'string' ? profile.status : profile.status?.value)
		expect(statuses, 'the light user holds an INVITED profile').toContain('INVITED')
	})

	/**
	 * The whole call must not fail because one invitee is already a member: the
	 * duplicate is reported in notCreatedUserIds and the rest still go through.
	 */
	test('inviting someone who is already a member warns and skips them', async ({ api, project }) => {
		// Arrange
		await invite(api, project.id, account('member').email, PROJECT_ROLE.PARTICIPANT)
		const alreadyMember = await findUserByEmail(api, account('member').email)
		const freshEmail = lightUserEmail()

		// Act
		const response = await api.raw('POST', `/api/v2/projects/${project.id}/profiles`, {
			emails: [account('member').email, freshEmail],
			role: PROJECT_ROLE.PARTICIPANT,
		})

		// Assert
		expect(response.ok(), `the batch still succeeds (${response.status()})`).toBeTruthy()
		const body = await response.json()
		expect(body.notCreatedUserIds ?? [], 'the existing member is reported as skipped')
			.toContain(alreadyMember.id)
		expect(await findUserIdByEmail(api, freshEmail), 'the other invitee was still invited').toBeTruthy()
	})

	test('an invitation with no recipient is refused', async ({ api, project }) => {
		// Act
		const response = await api.raw('POST', `/api/v2/projects/${project.id}/profiles`, {
			emails: [],
			userIds: [],
			role: PROJECT_ROLE.PARTICIPANT,
		})

		// Assert
		expect(response.status()).toBeGreaterThanOrEqual(400)
		expect(await response.text()).toContain('PROJECT_PROFILE_USERS_EMPTY')
	})

	test('a malformed email is refused', async ({ api, project }) => {
		// Act
		const response = await api.raw('POST', `/api/v2/projects/${project.id}/profiles`, {
			emails: ['not-an-email'],
			role: PROJECT_ROLE.PARTICIPANT,
		})

		// Assert
		expect(response.status()).toBeGreaterThanOrEqual(400)
		expect(await response.text()).toContain('PROJECT_PROFILE_EMAIL_INVALID')
	})

	test('the access window start must precede its end', async ({ api, project }) => {
		// Act
		const response = await api.raw('POST', `/api/v2/projects/${project.id}/profiles`, {
			emails: [lightUserEmail()],
			role: PROJECT_ROLE.PARTICIPANT,
			startAccess: { date: '2026-08-20' },
			endAccess: { date: '2026-07-05' },
		})

		// Assert
		expect(response.status()).toBeGreaterThanOrEqual(400)
		expect(await response.text()).toContain('PROJECT_PROFILE_START_ACCESS_LATER_THAN_END_ACCESS')
	})

	/**
	 * The light user is created for `light`'s OWN address, so signing that
	 * identity in for the first time exercises the link path in
	 * TokenConverterService: a row with a matching email and a null oidc_id is
	 * linked rather than duplicated, and the pending invitation is waiting.
	 * `light` is a dedicated disposable identity — sharing `fresh` with
	 * auth-provisioning made this journey order-dependent. Purged afterwards.
	 */
	test('a light user is linked to its identity on first sign-in', async ({ browser, baseURL, api, project }) => {
		// Arrange
		await invite(api, project.id, account('light').email, PROJECT_ROLE.COORDINATOR)
		const light = await findUserByEmail(api, account('light').email)
		const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } })
		const page = await context.newPage()

		try {
			// Act
			await signInThroughIdp(page, account('light').username, idpPassword())
			await page.waitForURL(url => url.href.startsWith(baseURL!))

			// Assert
			const linkedApi = registryApi(page)
			const me = await linkedApi.get<{ id: string, role?: { value: string } | string }>(
				'/api/v1/authentication/user/current',
			)
			expect(me.id, 'the light account was linked, not duplicated').toBe(light.id)

			const invitations = await linkedApi.get<{ content: Array<{ project?: { id: string } }> }>(
				'/api/v2/users/profiles?status=INVITED&size=200',
			)
			expect(invitations.content.some(profile => profile.project?.id === project.id),
				'the invitation is waiting on the project').toBe(true)
		} finally {
			await context.close()
			await purgeUserByEmail(api, account('light').email)
		}
	})

	test('inviting a known email reuses the existing account', async ({ api, projects }) => {
		// Arrange
		const first = await projects.create({ name: 'membership reuse a' })
		const second = await projects.create({ name: 'membership reuse b' })
		const email = lightUserEmail()
		await invite(api, first.id, email, PROJECT_ROLE.PARTICIPANT)
		const created = await findUserByEmail(api, email)

		// Act
		await invite(api, second.id, email, PROJECT_ROLE.PARTICIPANT)

		// Assert
		const reused = await findUserByEmail(api, email)
		expect(reused.id, 'no duplicate account is created').toBe(created.id)
	})
})

test.describe('membership — managing members', () => {
	test('an administrator changes a member’s role and access window', async ({ api, project, grantRole }) => {
		// Arrange
		const profileId = await grantRole(project.id, 'member', PROJECT_ROLE.PARTICIPANT)

		// Act
		await api.patch(`/api/v2/projects/${project.id}/profiles/${profileId}`, {
			role: PROJECT_ROLE.COORDINATOR,
			startAccess: { date: '2026-07-01' },
			endAccess: { date: '2026-08-31' },
		})

		// Assert
		const profile = await api.get<{ role?: { value: string } | string }>(
			`/api/v2/projects/${project.id}/profiles/${profileId}`,
		)
		const role = typeof profile.role === 'string' ? profile.role : profile.role?.value
		expect(role, 'the new role is saved').toBe(PROJECT_ROLE.COORDINATOR)
	})

	/**
	 * Members are the PROJECT_ADMINISTRATOR's alone: a coordinator reads the list
	 * but every mutation on it is refused.
	 */
	test('a non-administrator cannot edit a member', async ({ api, project, grantRole, apiAs }) => {
		// Arrange
		const memberProfile = await grantRole(project.id, 'member', PROJECT_ROLE.COORDINATOR)
		const memberApi = await apiAs('member')

		// Act
		const response = await memberApi.raw('PATCH', `/api/v2/projects/${project.id}/profiles/${memberProfile}`, {
			role: PROJECT_ROLE.PARTICIPANT,
		})

		// Assert
		expect(response.status(), 'a coordinator must not edit a member').toBeGreaterThanOrEqual(400)
	})

	/**
	 * Blocking keeps the profile but suspends everything it grants, and
	 * unblocking must put it back exactly as it was.
	 *
	 * Asserted through the API, not a navigation. `project-authority.ts` decides a
	 * page from the session store alone — a deliberate UX fast-path whose own
	 * comment notes "the backend re-checks regardless" — and that store was sealed
	 * at sign-in. Since `grantRole` already opens the member context (contexts are
	 * cached per account), no navigation made after the block can see a session
	 * built after it. The enforcement lives in the backend, which rebuilds
	 * authorities from the database on every token conversion and drops any profile
	 * that is not ACCEPTED; that is the layer worth pinning down.
	 */
	test('an administrator blocks and then unblocks a member', async ({ api, project, grantRole, apiAs }) => {
		// Arrange
		const profileId = await grantRole(project.id, 'member', PROJECT_ROLE.COORDINATOR)
		const memberApi = await apiAs('member')

		// Act
		await api.post(`/api/v2/projects/${project.id}/profiles/${profileId}/block`)

		// Assert
		const blocked = await memberApi.raw('GET', `/api/v2/projects/${project.id}/participants`)
		expect(blocked.status(), 'a blocked profile must grant nothing').toBeGreaterThanOrEqual(400)

		await api.post(`/api/v2/projects/${project.id}/profiles/${profileId}/unblock`)
		const restored = await memberApi.raw('GET', `/api/v2/projects/${project.id}/participants`)
		expect(restored.ok(), 'unblocking restores what the profile granted').toBeTruthy()
	})

	test('an administrator removes a member', async ({ api, project, grantRole, pageAs }) => {
		// Arrange
		const profileId = await grantRole(project.id, 'member', PROJECT_ROLE.COORDINATOR)

		// Act
		await api.remove(`/api/v2/projects/${project.id}/profiles/${profileId}`)

		// Assert
		const memberPage = await pageAs('member')
		expect((await memberPage.goto(`/projects/${project.id}/participants`))?.status()).toBe(403)
		await memberPage.goto('/projects')
		await expect(memberPage.locator('.project-card', { hasText: project.name })).toHaveCount(0)
	})

	/**
	 * A SECOND administrator is granted first so these assert the self-guard and
	 * not the last-administrator guard: with only one admin the request would be
	 * refused for the wrong reason, and the test would pass while proving nothing.
	 */
	test('I cannot block or remove my own profile', async ({ api, project, grantRole }) => {
		// Arrange
		await grantRole(project.id, 'member', PROJECT_ROLE.ADMINISTRATOR)
		const profiles = await api.get<{ content: Array<{ id: string, user?: { email?: string } }> }>(
			`/api/v2/projects/${project.id}/profiles?page=0&size=50`,
		)
		const own = profiles.content.find(profile => profile.user?.email === account('admin').email)
		expect(own, 'the caller holds a profile on their own project').toBeTruthy()

		// Act
		const blocked = await api.raw('POST', `/api/v2/projects/${project.id}/profiles/${own!.id}/block`)
		const removed = await api.raw('DELETE', `/api/v2/projects/${project.id}/profiles/${own!.id}`)

		// Assert
		expect(blocked.status(), 'blocking your own profile must be refused').toBeGreaterThanOrEqual(400)
		expect(removed.status(), 'removing your own profile must be refused').toBeGreaterThanOrEqual(400)
	})

	/**
	 * The self-service half of the same guard: leaving is allowed, but only for
	 * someone who is not the project's last administrator.
	 */
	test('a user leaves a project on their own', async ({ project, grantRole, apiAs, pageAs }) => {
		// Arrange
		const profileId = await grantRole(project.id, 'member', PROJECT_ROLE.COORDINATOR)
		const memberApi = await apiAs('member')

		// Act
		await memberApi.remove(`/api/v2/users/profiles/${profileId}`)

		// Assert
		const memberPage = await pageAs('member')
		await memberPage.goto('/projects')
		await expect(memberPage.locator('.project-card', { hasText: project.name })).toHaveCount(0)
	})
})
