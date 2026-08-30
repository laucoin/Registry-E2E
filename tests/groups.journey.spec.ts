import { clickUntilVisible, expectDisableThenDelete, selectOption } from './support/antd'
import { seedParticipant } from './support/domain'
import { expect, type ProjectHandle, test } from './support/fixtures'

/**
 * A
 * group must be born with ≥1 member (GROUP_MEMBERS_EMPTY), so the create form
 * carries the eligibility picker; seed a participant to pick.
 */
test.describe('group lifecycle (Nuxt rewrite)', () => {
	let project: ProjectHandle

	test.beforeEach(async ({ page, api, projects }) => {
		project = await projects.create({ name: 'groups' })
		await seedParticipant(api, project.id, { firstName: 'Alex', lastName: 'Rivera', birthday: '1990-01-01' })
		await page.goto(`/projects/${project.id}/groups`)
	})

	test('create, disable, then delete a group via test hooks', async ({ page }) => {
		await clickUntilVisible(page.getByTestId('group-create'), page.getByTestId('group-form-name'))
		await page.getByTestId('group-form-name').fill('Les Loups')

		await selectOption(page, 'group-form-members', /alex/i)
		await page.getByTestId('group-form-submit').click()

		const row = page.getByTestId('group-row').filter({ hasText: /les loups/i })
		await expect(row).toBeVisible()

		await expectDisableThenDelete(page, 'group', row, /les loups/i)
	})

	/**
	 * Removing the last member trips GROUP_LAST_MEMBERS_CANNOT_BE_REMOVED (409);
	 * the translated backend message must show in the drawer instead of failing
	 * silently.
	 */
	test('removing the last member surfaces the backend refusal', async ({ page }) => {
		await clickUntilVisible(page.getByTestId('group-create'), page.getByTestId('group-form-name'))
		await page.getByTestId('group-form-name').fill('Solo')
		await selectOption(page, 'group-form-members', /alex/i)
		await page.getByTestId('group-form-submit').click()

		const row = page.getByTestId('group-row').filter({ hasText: /solo/i })
		await expect(row).toBeVisible()
		await row.getByTestId('group-members-manage').click()

		await page.getByTestId(/group-member-.*-remove/).click()
		await expect(page.getByRole('alert').filter({ hasText: /dernier membre|last member/i })).toBeVisible()
	})
})
