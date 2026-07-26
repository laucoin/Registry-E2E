import { PROJECT_ROLE, seedMovement, seedParticipant, uniqueName } from './support/domain'
import { expect, test } from './support/fixtures'

/**
 * critical-scenarios.md §3 "Editing" / "Lifecycle" — the project window is
 * bounded in BOTH directions (projects.md):
 * @StartBeforeEnd            begin must precede end
 * PROJECT_DATE_CONFLICT_WITH_ELEMENTS   it cannot be narrowed past something it
 * already contains
 * <ENTITY>_..._OUT_OF_PROJECT_DATE_RANGE  and nothing dated may fall outside it
 * Widening is always accepted; only narrowing is constrained.
 */
test.describe('projects — window and deletion', () => {
	test('the end must not precede the begin', async ({ api }) => {
		// Act
		const response = await api.raw('POST', '/api/v2/projects', {
			name: uniqueName('inverted window'),
			begin: { date: '2026-08-31' },
			end: { date: '2026-07-01' },
			options: [],
		})

		// Assert
		expect(response.status(), 'an inverted window must be refused').toBeGreaterThanOrEqual(400)
	})

	/**
	 * The reciprocal guard, from the element's side: a movement dated outside the
	 * project's own range is refused rather than clamped.
	 */
	test('a dated element cannot be placed outside the project window', async ({ api, project }) => {
		// Arrange
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Outside',
			lastName: 'Window',
			birthday: '1990-01-01',
		})

		// Act
		const response = await api.raw('POST', `/api/v2/projects/${project.id}/movements`, {
			type: 'IN',
			dateTime: '2027-01-01T09:00:00.000Z',
			reason: null,
			activityId: null,
			content: [{ participantId, vehicleId: null, poolName: null }],
		})

		// Assert
		expect(response.status()).toBeGreaterThanOrEqual(400)
		expect(await response.text()).toContain('MOVEMENT_DATETIME_OUT_OF_PROJECT_DATE_RANGE')
	})

	/**
	 * Narrowing past a recorded movement would strand it outside its own project,
	 * so the project is what has to give — the movement is never moved.
	 */
	test('the window cannot be narrowed past an element it already contains', async ({ api, project }) => {
		// Arrange
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Anchored',
			lastName: 'Movement',
			birthday: '1990-01-01',
		})
		await seedMovement(api, project.id, {
			type: 'IN',
			dateTime: '2026-08-20T09:00:00.000Z',
			content: [{ participantId }],
		})

		// Act
		const narrowed = await api.raw('PATCH', `/api/v2/projects/${project.id}`, {
			name: project.name,
			begin: { date: '2026-07-01' },
			end: { date: '2026-08-10' },
			options: [],
		})
		const widened = await api.raw('PATCH', `/api/v2/projects/${project.id}`, {
			name: project.name,
			begin: { date: '2026-06-01' },
			end: { date: '2026-09-30' },
			options: [],
		})

		// Assert
		expect(narrowed.status(), 'narrowing past a movement must be refused').toBeGreaterThanOrEqual(400)
		expect(await narrowed.text()).toContain('PROJECT_DATE_CONFLICT_WITH_ELEMENTS')
		expect(widened.ok(), 'widening is always accepted').toBeTruthy()
	})

	/**
	 * Deletion is the PROJECT_ADMINISTRATOR's alone — a coordinator can update
	 * and even disable the project, but not destroy it (roles-and-permissions.md).
	 */
	test('only the administrator may delete a project', async ({ project, grantRole, apiAs }) => {
		// Arrange
		await grantRole(project.id, 'member', PROJECT_ROLE.COORDINATOR)
		const memberApi = await apiAs('member')

		// Act
		const response = await memberApi.raw('DELETE', `/api/v2/projects/${project.id}`)

		// Assert
		expect(response.status(), 'a coordinator must not delete the project').toBeGreaterThanOrEqual(400)
		const stillThere = await memberApi.raw('GET', `/api/v2/projects/${project.id}`)
		expect(stillThere.ok(), 'the project survives the refused delete').toBeTruthy()
	})

	/**
	 * A refused deletion must explain itself in the user's language rather than
	 * surfacing a raw code or a silent no-op.
	 *
	 * The Delete entry is offered to the coordinator: `isActionEnabled` gates on
	 * per-deployment configuration, not on the caller's authorities, so
	 * unlike Enable/Disable the item carries no `canManageAccess(item)` guard. The
	 * affordance is therefore misleading, but the refusal itself holds server-side
	 * (asserted by the sibling API test above); what this journey pins down is that
	 * the refusal reaches the user instead of dying in an unhandled rejection.
	 */
	test('a refused deletion surfaces a translated message', async ({ project, grantRole, pageAs }) => {
		// Arrange
		await grantRole(project.id, 'member', PROJECT_ROLE.COORDINATOR)
		const memberPage = await pageAs('member')

		// Act
		await memberPage.goto('/projects')
		const card = memberPage.locator('.project-card', { hasText: project.name })
		await expect(card).toBeVisible()
		await card.getByTestId('project-row-actions').click()
		await memberPage.getByTestId('project-action-delete').click()
		await expect(memberPage.getByTestId('project-delete-dialog')).toBeVisible()
		await memberPage.getByTestId('long-delete-confirm').click()

		// Assert
		const alert = memberPage.getByTestId('project-delete-dialog').getByRole('alert')
		await expect(alert).toBeVisible()
		await expect(alert).not.toContainText(/^[A-Z_]+$/)
		await expect(alert).toContainText(/[a-zà-ÿ]{4,}/)
		await memberPage.getByTestId('long-delete-cancel').click()
		await expect(card).toBeVisible()
	})
})
