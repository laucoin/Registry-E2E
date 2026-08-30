import { projectNavEntry } from './support/antd'
import { seedParticipant } from './support/domain'
import { expect, test } from './support/fixtures'

/**
 * The shell split (operations vs settings) and the list chrome that goes with
 * it. Both are UI contracts an operator depends on under time pressure: the
 * live board must not be buried under configuration, and a search must answer
 * without anyone hunting for a button.
 */
test.describe('project shell — operations and settings', () => {
	test('the tab bar carries only the operational domains', async ({ page, project }) => {
		// Arrange
		await page.goto(`/projects/${project.id}`)

		// Act + Assert
		await expect(page.getByTestId('project-tab-dashboard')).toBeVisible()
		await expect(page.getByTestId('project-tab-current')).toBeVisible()
		await expect(page.getByTestId('project-tab-movements')).toBeVisible()

		// Assert
		for (const domain of ['members', 'participants', 'groups', 'vehicles', 'activities']) {
			await expect(page.getByTestId(`project-tab-${domain}`), `${domain} must not be a tab`).toHaveCount(0)
		}
	})

	test('the settings menu opens the configuration domains', async ({ page, project }) => {
		// Arrange
		await page.goto(`/projects/${project.id}`)

		// Assert
		await expect(page.locator('.ant-tabs-nav').getByTestId('project-settings')).toBeVisible()

		// Act
		await page.getByTestId('project-settings').click()

		// Assert
		await expect(page.getByTestId('project-settings-participants')).toBeVisible()
		await expect(page.getByTestId('project-settings-groups')).toBeVisible()

		await page.getByTestId('project-settings-participants').click()
		await expect(page).toHaveURL(new RegExp(`/projects/${project.id}/participants$`))
	})

	/**
	 * A settings domain is not a tab, so the bar must fall back to the dashboard
	 * rather than showing nothing selected — an unhighlighted bar reads as "no
	 * page open".
	 */
	test('the dashboard stays highlighted while a settings domain is open', async ({ page, project }) => {
		// Act
		await page.goto(`/projects/${project.id}/participants`)

		// Assert
		await expect(page.getByTestId('project-tab-dashboard')).toBeVisible()
		await expect(await projectNavEntry(page, 'participants')).toBeVisible()
	})

	/**
	 * Below the compact breakpoint the dropdown would have nowhere to open, so
	 * the same menu becomes a bottom sheet.
	 */
	test('the settings menu becomes a sheet on a narrow viewport', async ({ page, project }) => {
		// Arrange
		await page.setViewportSize({ width: 320, height: 720 })

		// Act
		await page.goto(`/projects/${project.id}`)
		await page.getByRole('button', { name: /paramétrage|settings/i }).click()

		// Assert
		await expect(page.getByTestId('project-settings-drawer')).toBeVisible()
		await expect(page.locator('.ant-drawer-bottom')).toBeVisible()
	})
})

test.describe('lists — search, sort and highlight', () => {
	/**
	 * The search fires on its own after a pause; nothing is submitted. The
	 * seeded pair differs enough that a hit and a miss are unambiguous.
	 */
	test('typing narrows the list without pressing anything', async ({ page, api, project }) => {
		// Arrange
		await seedParticipant(api, project.id, { firstName: 'Zephyrine', lastName: 'Aubertin', birthday: '1990-01-01' })
		await seedParticipant(api, project.id, { firstName: 'Marc', lastName: 'Bouvier', birthday: '1991-01-01' })
		await page.goto(`/projects/${project.id}/participants`)
		await page.getByRole('button', { name: /rechercher|search/i }).first().click()

		// Act
		await page.getByTestId('participant-search').fill('Zephyrine')

		// Assert
		await expect(page.getByText(/AUBERTIN/i)).toBeVisible()
		await expect(page.getByText(/BOUVIER/i)).toHaveCount(0)
	})

	test('the matched term is marked in the results', async ({ page, api, project }) => {
		// Arrange
		await seedParticipant(api, project.id, { firstName: 'Zephyrine', lastName: 'Aubertin', birthday: '1990-01-01' })
		await page.goto(`/projects/${project.id}/participants`)
		await page.getByRole('button', { name: /rechercher|search/i }).first().click()

		// Act
		await page.getByTestId('participant-search').fill('Zephyrine')

		// Assert
		await expect(page.locator('mark').first()).toContainText(/zephyrine/i)
	})

	/**
	 * While a search is active the backend orders by match quality, so offering
	 * a criterion would be a lie — the control says so instead of pretending.
	 */
	test('the sort criterion yields to relevance while searching', async ({ page, api, project }) => {
		// Arrange
		await seedParticipant(api, project.id, { firstName: 'Zephyrine', lastName: 'Aubertin', birthday: '1990-01-01' })
		await page.goto(`/projects/${project.id}/participants`)
		await page.getByRole('button', { name: /rechercher|search/i }).first().click()
		await expect(page.getByTestId('participant-sort')).toBeVisible()

		// Act
		await page.getByTestId('participant-search').fill('Zephyrine')

		// Assert
		await expect(page.getByTestId('search-relevance-hint')).toBeVisible()
		await expect(page.getByTestId('participant-sort')).toHaveClass(/ant-select-disabled/)
	})

	/**
	 * The placeholder names the indexed fields; a generic "Search…" left the
	 * operator guessing whether a licence plate was searchable at all.
	 */
	test('the search placeholder names what is searchable', async ({ page, project }) => {
		// Act
		await page.goto(`/projects/${project.id}/participants`)
		await page.getByRole('button', { name: /rechercher|search/i }).first().click()

		// Assert
		const input = page.getByTestId('participant-search')
		await expect(input).toHaveAttribute('placeholder', /prénom|first name/i)
		await expect(input).toHaveAttribute('placeholder', /nom|last name/i)
	})
})

test.describe('projects list — rows and disabled state', () => {
	test('projects are listed one per line', async ({ page, projects }) => {
		// Arrange
		await projects.create({ name: 'row layout a' })
		await projects.create({ name: 'row layout b' })

		// Act
		await page.goto('/projects')
		const cards = page.getByTestId('project-row-link')
		await expect(cards.first()).toBeVisible()

		// Assert
		const first = await cards.nth(0).boundingBox()
		const second = await cards.nth(1).boundingBox()
		expect(second!.y, 'the second project sits below the first').toBeGreaterThan(first!.y)
	})

	/**
	 * A disabled project is closed, not merely tagged: its pages hold nothing an
	 * operator can use, so the shell refuses the whole subtree instead of
	 * painting empty tabs over it.
	 */
	test('a disabled project can no longer be opened', async ({ page, api, projects }) => {
		// Arrange
		const project = await projects.create({ name: 'closed project' })
		await api.post(`/api/v2/projects/${project.id}/disable`)

		// Act
		const response = await page.goto(`/projects/${project.id}`)

		// Assert
		expect(response?.status(), 'a disabled project is refused').toBe(403)

		// Assert
		await page.goto('/projects')
		await expect(page.getByTestId('project-disabled-tag').first()).toBeVisible()
	})
})
