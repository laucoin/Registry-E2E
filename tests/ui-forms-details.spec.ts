import { clickUntilVisible } from './support/antd'
import { seedActivity, seedMovement, seedParticipant, seedVehicle, uniqueName } from './support/domain'
import { expect, test } from './support/fixtures'

/**
 * Form feedback and the detail surfaces reached from the project home. Both are
 * about the moment BEFORE a user commits to something: knowing a field is
 * wrong while typing it, knowing a deletion will take minutes before starting
 * it, and reading who is actually on site without leaving the dashboard.
 */
test.describe('forms — live feedback', () => {
	/**
	 * The error must not wait for the Next button: once the field has been met,
	 * it tracks every keystroke — and clears itself the moment it is fixed.
	 */
	test('the project name validates while typing, not on submit', async ({ page }) => {
		// Arrange
		await page.goto('/projects/create')
		const name = page.getByTestId('project-create-name')

		// Act
		await name.click()
		await name.blur()

		// Assert
		await expect(page.getByText(/nom est obligatoire|name is required/i)).toBeVisible()

		// Act
		await name.fill('Camp')

		// Assert
		await expect(page.getByText(/nom est obligatoire|name is required/i)).toHaveCount(0)
	})

	/**
	 * The ceiling is the column width, so the field simply stops accepting
	 * characters rather than letting the API refuse the save.
	 */
	test('the project name cannot exceed the stored length', async ({ page }) => {
		// Arrange
		await page.goto('/projects/create')
		const name = page.getByTestId('project-create-name')

		// Act
		await name.fill('x'.repeat(200))

		// Assert
		expect((await name.inputValue()).length).toBe(150)
	})

	test('the select-all switch says what pressing it will do', async ({ page }) => {
		// Arrange
		await page.goto('/projects/create')
		await page.getByTestId('project-create-name').fill(uniqueName('toggle'))
		await clickUntilVisible(
			page.getByTestId('project-create-next'),
			page.getByTestId('project-create-options-all'),
		)

		// Act + Assert
		await expect(page.getByText(/tout sélectionner|select all/i)).toBeVisible()
		await page.getByTestId('project-create-options-all').click()
		await expect(page.getByText(/tout désélectionner|deselect all/i)).toBeVisible()
	})

	/**
	 * The time field commits on selection like the date beside it — there is no
	 * confirmation step to find.
	 */
	test('the time field has no OK button to press', async ({ page }) => {
		// Arrange
		await page.goto('/projects/create')

		// Act
		await page.getByTestId('project-create-begin-time-hour').click()

		// Assert
		await expect(page.locator('.ant-picker-ok')).toHaveCount(0)
	})

	/**
	 * A freshly created project opens on its own home: the operator is there to
	 * use it, not to find it again in the list.
	 */
	test('creating a project lands on that project', async ({ page }) => {
		// Arrange
		const name = uniqueName('landing')
		await page.goto('/projects/create')

		// Act
		await page.getByTestId('project-create-name').fill(name)
		await clickUntilVisible(
			page.getByTestId('project-create-next'),
			page.getByTestId('project-create-submit'),
		)
		await page.getByTestId('project-create-submit').click()

		// Assert
		await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}$/)
		await expect(page.getByTestId('project-tab-dashboard')).toBeVisible()
	})
})

test.describe('deletion — a long operation says so', () => {
	/**
	 * A cascading delete answers once, at the end. The dialog warns about the
	 * duration up front and names the work while it runs, so a minute of silence
	 * is expected rather than alarming.
	 */
	test('the project delete dialog warns about the duration', async ({ page, projects }) => {
		// Arrange
		const project = await projects.create({ name: 'delete dialog' })
		await page.goto('/projects')
		const card = page.locator('.project-card', { hasText: project.name })

		// Act
		await card.getByTestId('project-row-actions').click()
		await page.getByTestId('project-action-delete').click()

		// Assert
		const dialog = page.getByTestId('project-delete-dialog')
		await expect(dialog).toBeVisible()
		await expect(dialog).toContainText(/quelques minutes|a few minutes/i)
	})
})

test.describe('project home — detail surfaces', () => {
	/**
	 * "View all" answers the question the counter raises — who is here, and in
	 * what state — over the dashboard rather than by navigating away.
	 */
	test('view all opens the detailed participant list with statuses', async ({ page, api, project }) => {
		// Arrange
		await seedParticipant(api, project.id, { firstName: 'Detail', lastName: 'Person', birthday: '1990-01-01' })

		// Act
		await page.goto(`/projects/${project.id}`)
		await page.getByTestId('overview-presence-view-all').click()

		// Assert
		const drawer = page.getByTestId('presence-drawer-participants')
		await expect(drawer).toBeVisible()
		await expect(drawer.getByTestId('presence-drawer-participants-search')).toBeVisible()
		await expect(drawer.getByText(/PERSON/i)).toBeVisible()
	})

	test('the detailed list can be searched in place', async ({ page, api, project }) => {
		// Arrange
		await seedParticipant(api, project.id, { firstName: 'Zephyrine', lastName: 'Aubertin', birthday: '1990-01-01' })
		await seedParticipant(api, project.id, { firstName: 'Marc', lastName: 'Bouvier', birthday: '1991-01-01' })
		await page.goto(`/projects/${project.id}`)
		await page.getByTestId('overview-presence-view-all').click()

		// Act
		await page.getByTestId('presence-drawer-participants-search').fill('Aubertin')

		// Assert
		await expect(page.getByText(/AUBERTIN/i)).toBeVisible()
		await expect(page.getByText(/BOUVIER/i)).toHaveCount(0)
	})

	test('vehicles get the same view-all affordance', async ({ page, api, projects }) => {
		// Arrange
		const project = await projects.create({ options: ['VEHICLE'] })
		await seedVehicle(api, project.id, { licensePlate: 'AB-123-CD', brand: 'Renault', model: 'Trafic' })

		// Act
		await page.goto(`/projects/${project.id}`)
		await page.getByTestId('overview-vehicles-view-all').click()

		// Assert
		const drawer = page.getByTestId('presence-drawer-vehicles')
		await expect(drawer).toBeVisible()
		await expect(drawer.getByText(/AB-123-CD/i)).toBeVisible()
	})

	/**
	 * The row menu already opens the history; what matters here is the ORDER —
	 * direction first, reason last — because the direction is what the eye scans
	 * down the column.
	 */
	test('the movement history reads direction first and truncates a long reason', async ({ page, api, projects }) => {
		// Arrange
		const project = await projects.create({ options: ['ACTIVITY'] })
		const longReason = 'Randonnée nocturne en montagne avec bivouac'
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'History',
			lastName: 'Reader',
			birthday: '1990-01-01',
		})
		const activityId = await seedActivity(api, project.id, { name: longReason })
		await seedMovement(api, project.id, { type: 'OUT', activityId, content: [{ participantId }] })

		// Act
		await page.goto(`/projects/${project.id}/participants`)
		await page.getByTestId('participant-history').first().click()

		// Assert
		const row = page.getByTestId('movement-history-list').locator('.history__row').first()
		await expect(row).toBeVisible()
		await expect(row.locator('.history__reason')).toContainText('…')
		expect((await row.locator('.history__reason').innerText()).length)
			.toBeLessThan(longReason.length)

		// Assert
		const tagBox = await row.locator('.history__type').boundingBox()
		const reasonBox = await row.locator('.history__reason').boundingBox()
		expect(tagBox!.x, 'the direction is read before the reason').toBeLessThan(reasonBox!.x)
	})
})
