import { projectNavEntry } from './support/antd'
import { OPTION, OPTIONS_ALERT, OPTIONS_COMMUNICATION } from './support/domain'
import { expect, test } from './support/fixtures'

/**
 * critical-scenarios.md §2 "Option gating" — a module that is off is invisible
 * and its API is closed, REGARDLESS of role. Each case is asserted twice, the
 * way the oracle words it: the direct URL is refused, and the tab is not
 * offered — an affordance that is merely hidden while the route still answers
 * would be a real leak.
 *
 * The project owner here is the administrator, which is the point: this is not
 * a permission refusal that a bigger role could lift.
 */
test.describe('access control — option gating', () => {
	/**
	 * `entity` is spelled out rather than derived from `domain`: the test-id
	 * prefix is the singular ("activity-create" under /activities), which no
	 * naive de-pluralisation gets right.
	 */
	const GATED = [
		{ domain: 'vehicles', entity: 'vehicle', option: OPTION.VEHICLE, enabled: [OPTION.VEHICLE] },
		{ domain: 'activities', entity: 'activity', option: OPTION.ACTIVITY, enabled: [OPTION.ACTIVITY] },
		{ domain: 'alerts', entity: 'alert', option: OPTION.ALERT, enabled: OPTIONS_ALERT },
	] as const

	for (const { domain, entity, option, enabled } of GATED) {
		test(`with the ${option} option off the ${domain} domain is closed`, async ({ page, projects }) => {
			// Arrange
			const project = await projects.create({ options: [] })

			// Act
			const response = await page.goto(`/projects/${project.id}/${domain}`)

			// Assert
			expect(response?.status(), `${domain} must be refused without ${option}`).toBe(403)
			await page.goto(`/projects/${project.id}`)
			await expect(await projectNavEntry(page, domain)).toHaveCount(0)
		})

		test(`with the ${option} option on the ${domain} domain is open`, async ({ page, projects }) => {
			// Arrange
			const project = await projects.create({ options: [...enabled] })

			// Act
			const response = await page.goto(`/projects/${project.id}/${domain}`)

			// Assert
			expect(response?.status(), `${domain} must be reachable with ${option}`).toBeLessThan(400)
			await expect(page.getByTestId(`${entity}-create`)).toBeVisible()
		})
	}

	/**
	 * Communications have no domain page of their own (QA U4) — the thread drawer
	 * on the parent record is the only surface — so the gate shows up as the
	 * absent thread affordance on the row rather than as a refused route.
	 */
	test('with the COMMUNICATION option off no thread can be opened', async ({ page, projects }) => {
		// Arrange
		const withoutOption = await projects.create({ options: [OPTION.ACTIVITY] })
		const withOption = await projects.create({ options: OPTIONS_COMMUNICATION })

		// Act
		await page.goto(`/projects/${withoutOption.id}/movements`)

		// Assert
		await expect(page.getByTestId('movement-communications')).toHaveCount(0)
		const response = await page.goto(`/projects/${withoutOption.id}/communications`)
		expect(response?.status()).toBe(404)

		await page.goto(`/projects/${withOption.id}/movements`)
		await expect(page.getByTestId('movement-create')).toBeVisible()
	})
})
