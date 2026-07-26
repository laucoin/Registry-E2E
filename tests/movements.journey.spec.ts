import { clickUntilVisible, drawerTitle, selectItem, selectOption } from './support/antd'
import { OPTION, seedActivity, seedGroup, seedParticipant } from './support/domain'
import { expect, test } from './support/fixtures'

/**
 * A journey over the COMPLEX core domain: the movement
 * create drawer's dependent fields + the eligibility picker. Proves the testid
 * pattern (participants.journey) scales past the simple CRUD forms.
 */
test.describe('movement create (Nuxt rewrite)', () => {
	/**
	 * The timestamp defaults to "now" (QA U3), so the common as-it-happens flow
	 * needs no date entry. The eligibility picker is an AntD Select: pick the
	 * visible dropdown item (not the hidden a11y option mirror), then dismiss
	 * the dropdown (it overlays the footer) by clicking the drawer title. The
	 * row's type tag is a backend-localised label, so the assertion matches
	 * both fr "Entrée" and en "Entrance".
	 */
	test('record a registered entry via test hooks', async ({ page, api, project }) => {
		await seedParticipant(api, project.id, { firstName: 'Alex', lastName: 'Rivera', birthday: '1990-01-01' })
		await page.goto(`/projects/${project.id}/movements`)
		await clickUntilVisible(page.getByTestId('movement-create'), page.getByTestId('movement-form-participants'))

		await expect(page.getByTestId('movement-form-datetime').locator('input')).not.toHaveValue('')

		await selectOption(page, 'movement-form-participants', /alex/i)
		await expect(page.getByTestId('movement-form-participants')).toContainText(/alex/i)

		await page.getByTestId('movement-form-submit').click()

		await expect(page.getByTestId('movement-row')).toHaveCount(1)
		await expect(page.getByTestId('movement-row').first()).toContainText(/entr/i)
	})

	/**
	 * The type stays IN while the motive select must still offer the activity:
	 * the backend merges activities into the motives regardless of direction,
	 * and the picked activity surfaces through the row's reason label.
	 */
	test('an entry (IN) can carry an activity (QA B4 contract lock)', async ({ page, api, projects }) => {
		const project = await projects.create({ options: [OPTION.ACTIVITY] })
		await seedParticipant(api, project.id, { firstName: 'Alex', lastName: 'Rivera', birthday: '1990-01-01' })
		await seedActivity(api, project.id, { name: 'Rando' })

		await page.goto(`/projects/${project.id}/movements`)
		await clickUntilVisible(page.getByTestId('movement-create'), page.getByTestId('movement-form-participants'))

		await page.getByTestId('movement-form-motive').click()
		await selectItem(page, /rando/i).click()

		await selectOption(page, 'movement-form-participants', /alex/i)
		await page.getByTestId('movement-form-submit').click()

		await expect(page.getByTestId('movement-row')).toHaveCount(1)
		await expect(page.getByTestId('movement-row').first()).toContainText(/rando/i)
	})

	/**
	 * Bulk-adding a group joins both members to the selection and clusters
	 * their content rows under the group-name header; the stored movement
	 * content then carries the group name as each member's poolName.
	 */
	test('adding a group pools its members under the group name (QA B3)', async ({ page, api, project }) => {
		const alex = await seedParticipant(api, project.id, {
			firstName: 'Alex',
			lastName: 'Rivera',
			birthday: '1990-01-01',
		})
		const billie = await seedParticipant(api, project.id, {
			firstName: 'Billie',
			lastName: 'Moss',
			birthday: '1991-02-02',
		})
		await seedGroup(api, project.id, { name: 'Les Loups', members: [alex, billie] })

		await page.goto(`/projects/${project.id}/movements`)
		await clickUntilVisible(page.getByTestId('movement-create'), page.getByTestId('movement-form-participants'))

		await page.getByTestId('movement-form-group').click()
		await selectItem(page, /les loups/i).click()
		await expect(page.getByTestId('movement-content-pool-Les Loups')).toBeVisible()
		await drawerTitle(page).click()

		await page.getByTestId('movement-form-submit').click()
		await expect(page.getByTestId('movement-row')).toHaveCount(1)

		const list = await api.get<{ content: Array<{ id: string }> }>(
			`/api/v2/projects/${project.id}/movements?page=0&size=10`,
		)
		const detail = await api.get<{ content?: Array<{ poolName?: string | null }> }>(
			`/api/v2/projects/${project.id}/movements/${list.content[0]!.id}`,
		)
		expect((detail.content ?? []).map(entry => entry.poolName)).toEqual(['Les Loups', 'Les Loups'])
	})
})
