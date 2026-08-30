import {
	OPTIONS_ALERT,
	OPTIONS_ALL,
	OPTIONS_COMMUNICATION,
	SEED_DATE_TIME,
	seedAlert,
	seedParticipant,
	setProjectOptions,
} from './support/domain'
import { expect, test } from './support/fixtures'

/**
 * Dashboards (dashboards spec) — the global home panels and the per-project
 * overview (metrics + option-gated panels + clickable domain navigation).
 */
test.describe('dashboards (Phase 3)', () => {
	test('global home shows the four dashboard panels', async ({ page }) => {
		await page.goto('/')
		await expect(page.getByTestId('dashboard-favorites')).toBeVisible()
		await expect(page.getByTestId('dashboard-open-alerts')).toBeVisible()
		await expect(page.getByTestId('dashboard-invites-received')).toBeVisible()
		await expect(page.getByTestId('dashboard-invites-sent')).toBeVisible()
	})

	test('project overview renders metrics, panels and domain navigation', async ({ page, api, projects }) => {
		const project = await projects.create({ options: OPTIONS_ALL })
		await seedParticipant(api, project.id, { firstName: 'Dana', lastName: 'Cole', birthday: '1992-02-02' })
		await page.goto(`/projects/${project.id}`)

		await expect(page.getByTestId('project-tab-dashboard')).toBeVisible()
		await expect(page.getByTestId('overview-presence')).toBeVisible()
		await expect(page.getByTestId('overview-arrivals')).toBeVisible()
		await expect(page.getByTestId('overview-departures')).toBeVisible()
		await expect(page.getByTestId('overview-ongoing')).toBeVisible()
		const nav = page.getByTestId('overview-nav-participants')
		await expect(nav).toBeVisible()
		await nav.click()
		await expect(page).toHaveURL(new RegExp(`/projects/${project.id}/participants`))
	})

	/**
	 * Turning the ALERT module off does not delete the alerts already recorded,
	 * so the rows survive in the database and the open-alert panel used to keep
	 * counting them — a badge on the global home pointing at a project whose
	 * alerts are no longer reachable. The count has to follow the option.
	 */
	test('a project counts on the open-alerts panel only while its ALERT option is on', async ({ page, api, projects }) => {
		// Arrange
		const project = await projects.create({ options: OPTIONS_ALERT })
		await seedAlert(api, project.id, { title: 'Gated alert', dateTime: SEED_DATE_TIME })

		await page.goto('/')
		const panel = page.getByTestId('dashboard-open-alerts')
		await expect(panel).toContainText(project.name)

		// Act
		await setProjectOptions(api, project.id, OPTIONS_COMMUNICATION)

		// Assert
		await page.goto('/')
		await expect(panel, 'the project leaves the panel with its module').not.toContainText(project.name)
	})
})
