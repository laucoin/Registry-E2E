import { clickUntilVisible, replaceDate } from './support/antd'
import { OPTION, seedGroup, seedParticipant } from './support/domain'
import { expect, test } from './support/fixtures'

/**
 * Phase A (parity batch): edit forms across domains. The v2 PATCH is a full
 * replace, so the guarantee under test is that editing a visible field never
 * wipes the fields the form doesn't surface (round-trip).
 */
test.describe('edit forms (parity batch)', () => {
	test('participant edit preserves group membership', async ({ page, api, project }) => {
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Omar',
			lastName: 'Diaz',
			birthday: '1990-04-04',
		})
		await seedGroup(api, project.id, { name: 'Squad A', members: [participantId] })

		await page.goto(`/projects/${project.id}/participants`)
		await page.getByTestId('participant-row-actions').first().click()
		await page.getByTestId('participant-action-edit').click()
		await expect(page.getByTestId('participant-form-lastname')).toHaveValue('Diaz')
		await page.getByTestId('participant-form-lastname').fill('Cole')
		await page.getByTestId('participant-form-submit').click()
		await expect(page.getByText(/Omar COLE/)).toBeVisible()

		const after = await api.get<{ lastName: string, groups?: Array<{ name: string }> }>(
			`/api/v2/projects/${project.id}/participants/${participantId}`,
		)
		expect(after.lastName).toBe('Cole')
		expect((after.groups ?? []).map(group => group.name)).toContain('Squad A')
	})

	/**
	 * An end date before the begin date must keep Next on step 1 with the
	 * inline error; after fixing the date, going back, and changing it again,
	 * Next must still advance — this guards the antd Steps cached-icon remount
	 * crash.
	 */
	test('project edit wizard survives back-nav and date changes (B1 regression)', async ({ page, project }) => {
		await page.goto(`/projects/edit/${project.id}`)
		await expect(page.getByTestId('project-edit-name')).not.toHaveValue('')

		await replaceDate(page, 'project-edit-end-date', '2020-01-01')
		await clickUntilVisible(
			page.getByTestId('project-edit-next'),
			page.getByText(/end date must be after|date de fin doit/i),
		)
		await expect(page.getByTestId('project-edit-submit')).not.toBeVisible()

		await replaceDate(page, 'project-edit-end-date', '2030-12-31')
		await clickUntilVisible(page.getByTestId('project-edit-next'), page.getByTestId('project-edit-submit'))
		await clickUntilVisible(page.getByTestId('project-edit-back'), page.getByTestId('project-edit-next'))
		await replaceDate(page, 'project-edit-end-date', '2031-01-15')
		await clickUntilVisible(page.getByTestId('project-edit-next'), page.getByTestId('project-edit-submit'))
	})

	/**
	 * The new name keeps the "E2E " prefix: a rename that drops it hides the
	 * project from the stray-data sweep, so an interrupted run would leak it.
	 * The card is addressed by name rather than taken as the first row, because
	 * the list is ordered by name and the seeded project is not reliably first.
	 */
	test('project edit updates name and options', async ({ page, api, projects }) => {
		const project = await projects.create({ options: [OPTION.ACTIVITY] })
		const renamed = `${project.name} renamed`

		await page.goto('/projects')
		const card = page.locator('.project-card', { hasText: project.name })
		await card.getByTestId('project-row-actions').click()
		await page.getByTestId('project-action-edit').click()
		await expect(page).toHaveURL(new RegExp(`/projects/edit/${project.id}`))
		await page.getByTestId('project-edit-name').fill(renamed)
		await clickUntilVisible(page.getByTestId('project-edit-next'), page.getByTestId('project-edit-option-vehicle'))
		await page.getByTestId('project-edit-option-vehicle').click()
		await page.getByTestId('project-edit-submit').click()
		await expect(page).toHaveURL(new RegExp(`/projects/${project.id}$`))

		const after = await api.get<{ name: string, options?: Array<{ value: string }> }>(
			`/api/v2/projects/${project.id}`,
		)
		expect(after.name).toBe(renamed)
		expect((after.options ?? []).map(option => option.value))
			.toEqual(expect.arrayContaining([OPTION.ACTIVITY, OPTION.VEHICLE]))
	})
})
