import { PROJECT_ROLE, seedParticipant, uniqueName } from './support/domain'
import { expect, test } from './support/fixtures'

/**
 * critical-scenarios.md §2 "Tenancy" — the multi-tenant isolation spine. The
 * backend namespaces every project-scoped authority as "{projectId}_{PERMISSION}"
 * (security.md), so holding a permission is always relative to ONE project; these
 * journeys assert that a caller cannot reach sideways out of it.
 */
test.describe('access control — tenancy', () => {
	test('the project list only shows projects I hold a profile on', async ({ projects, grantRole, pageAs }) => {
		// Arrange
		const joined = await projects.create({ name: 'tenancy joined' })
		const foreign = await projects.create({ name: 'tenancy foreign' })
		await grantRole(joined.id, 'member', PROJECT_ROLE.COORDINATOR)

		// Act
		const memberPage = await pageAs('member')
		await memberPage.goto('/projects')

		// Assert
		await expect(memberPage.locator('.project-card', { hasText: joined.name })).toBeVisible()
		await expect(memberPage.locator('.project-card', { hasText: foreign.name })).toHaveCount(0)
	})

	/**
	 * The member is a full PROJECT_ADMINISTRATOR of its own project, which is
	 * exactly what makes this meaningful: the level-0 role it holds in one
	 * project must buy it nothing in another.
	 */
	test('a permission held in one project grants nothing in another', async ({ projects, apiAs, pageAs }) => {
		// Arrange
		const own = await projects.create({ name: 'tenancy own', as: 'member' })
		const foreign = await projects.create({ name: 'tenancy other' })
		const memberApi = await apiAs('member')

		// Act
		const readOwn = await memberApi.raw('GET', `/api/v2/projects/${own.id}`)
		const readForeign = await memberApi.raw('GET', `/api/v2/projects/${foreign.id}`)

		// Assert
		expect(readOwn.ok(), 'the creator administers their own project').toBeTruthy()
		expect(readForeign.status(), 'a foreign project must be refused').toBeGreaterThanOrEqual(400)
		const memberPage = await pageAs('member')
		const response = await memberPage.goto(`/projects/${foreign.id}/participants`)
		expect(response?.status()).toBe(403)
	})

	/**
	 * Both projects belong to the SAME administrator, so nothing here is a
	 * permission refusal — it is the project boundary itself being enforced.
	 */
	test('a resource of another project cannot be pulled into mine', async ({ api, projects }) => {
		// Arrange
		const target = await projects.create({ name: 'tenancy target' })
		const source = await projects.create({ name: 'tenancy source' })
		const foreignParticipant = await seedParticipant(api, source.id, {
			firstName: 'Foreign',
			lastName: 'Person',
			birthday: '1990-01-01',
		})

		// Act
		const response = await api.raw('POST', `/api/v2/projects/${target.id}/movements`, {
			type: 'IN',
			dateTime: '2026-07-10T09:00:00.000Z',
			reason: null,
			activityId: null,
			content: [{ participantId: foreignParticipant, vehicleId: null, poolName: null }],
		})

		// Assert
		expect(response.status(), 'a cross-project reference must be refused').toBeGreaterThanOrEqual(400)
		expect(await response.text()).toContain('MOVEMENT_PARTICIPANTS_NOT_FOUND_IN_MOVEMENT_PROJECT')
	})

	test('a disabled resource cannot be referenced in a new record', async ({ api, project }) => {
		// Arrange
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Hidden',
			lastName: 'Person',
			birthday: '1990-01-01',
		})
		await api.post(`/api/v2/projects/${project.id}/participants/${participantId}/disable`)

		// Act
		const response = await api.raw('POST', `/api/v2/projects/${project.id}/movements`, {
			type: 'IN',
			dateTime: '2026-07-10T09:00:00.000Z',
			reason: null,
			activityId: null,
			content: [{ participantId, vehicleId: null, poolName: null }],
		})

		// Assert
		expect(response.status(), 'a disabled participant must not be referenceable').toBeGreaterThanOrEqual(400)
		expect(await response.text()).toContain('MOVEMENT_PARTICIPANTS_NOT_VISIBLE')
	})

	/**
	 * The support read (roles-and-permissions.md): a global USER_ADMINISTRATOR
	 * reads any project without holding a profile on it — the one documented
	 * exception to the rule above.
	 */
	test('a platform administrator reads any project for support', async ({ api, projects }) => {
		// Arrange
		const memberOwned = await projects.create({ name: 'tenancy support', as: 'member' })

		// Act
		const response = await api.raw('GET', `/api/v2/projects/${memberOwned.id}`)

		// Assert
		expect(response.ok(), 'a platform administrator reads any project').toBeTruthy()
	})

	/**
	 * The authorities must apply to the very next request, with no re-login: the
	 * creator becomes PROJECT_ADMINISTRATOR as part of the create transaction.
	 */
	test('creating a project grants its scoped authorities immediately', async ({ apiAs, pageAs }) => {
		// Arrange
		const memberApi = await apiAs('member')

		// Act
		const created = await memberApi.post<{ id: string }>('/api/v2/projects', {
			name: uniqueName('tenancy immediate'),
			begin: { date: '2026-07-01' },
			end: { date: '2026-08-31' },
			options: [],
		})

		try {
			// Assert
			const participant = await memberApi.raw('POST', `/api/v2/projects/${created.id}/participants`, {
				firstName: 'Straight',
				lastName: 'Away',
				birthday: '1990-01-01',
			})
			expect(participant.ok(), 'the creator acts as administrator immediately').toBeTruthy()

			const memberPage = await pageAs('member')
			await memberPage.goto(`/projects/${created.id}/members`)
			await expect(memberPage.getByTestId('member-invite')).toBeVisible()
		} finally {
			await memberApi.discard(`/api/v2/projects/${created.id}`)
		}
	})
})
