import { clickUntilVisible, drawerTitle, projectNavEntry, selectOption } from './support/antd'
import { invite, PROJECT_ROLE } from './support/domain'
import { account, expect, test } from './support/fixtures'
import { purgeUserByEmail } from './support/users'

/**
 * Phase C (parity batch): project members / invitations page — the rewrite's
 * admin surface for project-profiles. The invite mutation is driven via the API
 * (driving the picker itself is covered by membership.spec.ts), then the UI is
 * asserted to render the invited member, so the round-trip is covered without a
 * brittle multi-combobox interaction here.
 *
 * The invitee is the seeded `member` account rather than whoever
 * assignable-users happens to return first, so the journey no longer skips
 * itself in an environment with no other user.
 */
test.describe('project members (parity batch)', () => {
	test('tab, list, invite round-trip and edit prefill', async ({ page, api, project }) => {
		await page.goto(`/projects/${project.id}`)
		await expect(await projectNavEntry(page, 'members')).toBeVisible()
		await page.goto(`/projects/${project.id}/members`)
		await expect(page.getByTestId('member-invite')).toBeVisible()
		await expect(page.getByText(/spike/i).first()).toBeVisible()

		await invite(api, project.id, account('member').email, PROJECT_ROLE.PARTICIPANT)

		await page.reload()
		await expect(page.getByText(account('member').displayName).first()).toBeVisible()

		const rows = page.getByTestId('member-row-actions')
		await rows.last().click()
		await page.getByTestId('member-action-edit').click()
		await expect(drawerTitle(page)).toHaveText(/Edit member|Modifier le membre/)
	})

	/**
	 * user-invitations.md §3 — inviting an address nobody holds mints a light
	 * user and its INVITED profile in one call. Driven entirely through the "+"
	 * field because that is the surface under test: the picker only ever offers
	 * accounts that already exist, so before this field an administrator had no
	 * way to reach someone who has never signed in.
	 *
	 * The address is unique per run and the account it creates is deleted
	 * afterwards, so the journey leaves the directory exactly as it found it.
	 */
	test('invites an unknown email through the + field, creating a light user', async ({ page, api, project }) => {
		// Arrange
		const features = await api.get<{ lightUser: boolean }>('/api/v2/metadata/features')
		expect(features.lightUser, 'this journey needs registry.feature.light-user.enabled').toBe(true)
		const email = `invited-${Date.now()}@example.test`
		await page.goto(`/projects/${project.id}/members`)
		await clickUntilVisible(page.getByTestId('member-invite'), page.getByTestId('member-form-email'))

		try {
			// Act
			await page.getByTestId('member-form-email').fill(email)
			await page.getByTestId('member-form-email-add').click()
			await expect(page.getByTestId(`member-form-email-${email}`)).toBeVisible()
			await selectOption(page, 'member-form-role', /participant/i)
			await page.getByTestId('member-form-submit').click()

			// Assert
			await expect(page.getByText(email).first()).toBeVisible()
		} finally {
			await purgeUserByEmail(api, email)
		}
	})

	/**
	 * A malformed address is refused in the drawer rather than round-tripping to
	 * the backend's @ValidEmails, so the administrator is told before losing the
	 * rest of the form.
	 */
	test('refuses a malformed address without submitting', async ({ page, project }) => {
		// Arrange
		await page.goto(`/projects/${project.id}/members`)
		await clickUntilVisible(page.getByTestId('member-invite'), page.getByTestId('member-form-email'))

		// Act
		await page.getByTestId('member-form-email').fill('not-an-email')
		await page.getByTestId('member-form-email-add').click()

		// Assert
		await expect(page.getByRole('alert')).toBeVisible()
		await expect(drawerTitle(page)).toBeVisible()
	})
})
