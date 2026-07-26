import { PROJECT_ROLE, USER_ROLE } from './support/domain'
import { account, expect, test } from './support/fixtures'
import { directory, roleOf } from './support/users'

/**
 * critical-scenarios.md §2 "Last-administrator safety" — the system refuses to
 * remove, demote or block the LAST level-0 administrator, of a project or of the
 * platform (roles-and-permissions.md). These are the guards that keep an account
 * from locking everyone out, so they are asserted against the API: the refusal
 * has to hold for a direct request, not only where the UI hides a button.
 */
test.describe('access control — last-administrator safety', () => {
	/**
	 * The creator is the project's only PROJECT_ADMINISTRATOR, so its own profile
	 * is the last one — each of the three verbs must refuse with its own code.
	 */
	test('the last project administrator cannot be removed, demoted or blocked', async ({ api, project }) => {
		// Arrange
		const profiles = await api.get<{ content: Array<{ id: string, role?: { value: string } }> }>(
			`/api/v2/projects/${project.id}/profiles?page=0&size=50`,
		)
		const own = profiles.content.find(profile => profile.role?.value === PROJECT_ROLE.ADMINISTRATOR)
		expect(own, 'the creator holds the administrator profile').toBeTruthy()

		// Act
		const demoted = await api.raw('PATCH', `/api/v2/projects/${project.id}/profiles/${own!.id}`, {
			role: PROJECT_ROLE.COORDINATOR,
		})
		const blocked = await api.raw('POST', `/api/v2/projects/${project.id}/profiles/${own!.id}/block`)
		const removed = await api.raw('DELETE', `/api/v2/projects/${project.id}/profiles/${own!.id}`)

		// Assert
		expect(demoted.status(), 'demoting the last administrator must be refused').toBeGreaterThanOrEqual(400)
		expect(await demoted.text()).toContain('PROJECT_PROFILE_UPDATE_LAST_PROJECT_ADMINISTRATOR')
		expect(blocked.status(), 'blocking the last administrator must be refused').toBeGreaterThanOrEqual(400)
		expect(await blocked.text()).toContain('PROJECT_PROFILE_BLOCK_LAST_PROJECT_ADMINISTRATOR')
		expect(removed.status(), 'removing the last administrator must be refused').toBeGreaterThanOrEqual(400)
		expect(await removed.text()).toContain('PROJECT_PROFILE_DELETE_LAST_PROJECT_ADMINISTRATOR')
	})

	/**
	 * The platform plane. This journey is only meaningful when the caller really
	 * IS the last level-0 account, and it is destructive if it is not: with a
	 * second administrator present the guard correctly stays silent, the demote
	 * goes through, and the suite loses the very account every later journey
	 * signs in as. So the precondition is verified first and the role is restored
	 * unconditionally — a environment seeded with extra administrators (the
	 * backend's own dev dataset seeds three) skips rather than self-harms.
	 *
	 * The two verbs are refused by two different guards. Demotion reaches the
	 * last-administrator guard, but the directory delete never does: it rejects a
	 * caller aiming at their own row first, and that precedence is deliberate.
	 * The last-administrator delete guard lives on the self-service endpoint
	 * (DELETE /users/me), which is the only path that can reach it.
	 */
	test('the last platform administrator cannot be demoted or deleted', async ({ api }) => {
		// Arrange
		const administrators = (await directory(api)).filter(user => roleOf(user) === USER_ROLE.ADMINISTRATOR)
		const self = administrators.find(user => user.email === account('admin').email)
		expect(self, 'the caller holds the administrator role').toBeTruthy()
		test.skip(
			administrators.length > 1,
			`${administrators.length} platform administrators exist — the last-administrator guard cannot fire`,
		)

		try {
			// Act
			const demoted = await api.raw('PATCH', `/api/v2/users/${self!.id}`, { role: USER_ROLE.USER })
			const deleted = await api.raw('DELETE', `/api/v2/users/${self!.id}`)

			// Assert
			expect(demoted.status(), 'demoting the last platform administrator must be refused')
				.toBeGreaterThanOrEqual(400)
			expect(await demoted.text()).toContain('USER_UPDATE_LAST_APPLICATION_ADMINISTRATOR_ROLE')
			expect(deleted.status(), 'deleting your own row from the directory must be refused')
				.toBeGreaterThanOrEqual(400)
			expect(await deleted.text()).toContain('USER_DELETE_CURRENT_USER')
		} finally {
			await api.raw('PATCH', `/api/v2/users/${self!.id}`, { role: USER_ROLE.ADMINISTRATOR })
		}
	})
})
