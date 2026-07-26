import { seedParticipant } from './support/domain'
import { expect, test } from './support/fixtures'

/**
 * Phase E (parity batch): typed list filters on the domain lists. The AntD
 * combobox drive is flaky to automate, so this proves the two halves the
 * filters bridge: the v2 endpoint narrows the result set (API), and the filter
 * controls render in the Search & Filter panel (UI). The DomainList wiring that
 * merges them (extraQuery → query, reset page) is thin, shared code.
 */
test.describe('list filters (parity batch)', () => {
	test('backend narrows the result set and the filter controls render', async ({ page, api, project }) => {
		await seedParticipant(api, project.id, { firstName: 'Omar', lastName: 'Diaz', birthday: '1990-04-04' })

		const registered = await api.get<{ totalElements: number }>(
			`/api/v2/projects/${project.id}/participants?type=REGISTERED`,
		)
		const guests = await api.get<{ totalElements: number }>(
			`/api/v2/projects/${project.id}/participants?type=GUEST`,
		)
		expect(registered.totalElements).toBe(1)
		expect(guests.totalElements).toBe(0)

		await page.goto(`/projects/${project.id}/participants`)
		await page.getByText(/rechercher, trier & filtrer|search, sort & filter/i).first().click()
		await expect(page.getByTestId('participant-filter-type')).toBeVisible()
		await expect(page.getByTestId('participant-filter-status')).toBeVisible()
		await expect(page.getByTestId('participant-filter-visible')).toBeVisible()
	})
})
