import type { APIResponse } from '@playwright/test'
import type { RegistryApi } from './support/api'
import { OPTION, OPTIONS_ALERT, OPTIONS_COMMUNICATION, uniqueName } from './support/domain'
import { expect, test } from './support/fixtures'

/**
 * critical-scenarios.md §3 "Options and their dependencies" — the option graph
 * (@ProjectOptionDependencies, projects.md):
 * VEHICLE, ACTIVITY  stand alone
 * COMMUNICATION      requires ACTIVITY
 * ALERT              requires ACTIVITY and COMMUNICATION
 * A violation is refused with PROJECT_OPTIONS_MISSING listing what is absent.
 *
 * Asserted against the API because the wizard's checkbox logic prevents most of
 * these combinations by construction, and the guarantee under test is that the
 * backend refuses them regardless.
 */
test.describe('projects — option dependencies', () => {
	function create(api: RegistryApi, options: string[]): Promise<APIResponse> {
		return api.raw('POST', '/api/v2/projects', {
			name: uniqueName('option graph'),
			begin: { date: '2026-07-01' },
			end: { date: '2026-08-31' },
			options,
		})
	}

	for (const option of [OPTION.VEHICLE, OPTION.ACTIVITY]) {
		test(`${option} can be enabled on its own`, async ({ api, projects }) => {
			// Act
			const project = await projects.create({ options: [option] })

			// Assert
			const stored = await api.get<{ options?: Array<{ value: string }> }>(`/api/v2/projects/${project.id}`)
			expect((stored.options ?? []).map(entry => entry.value)).toContain(option)
		})
	}

	test('COMMUNICATION without ACTIVITY is rejected', async ({ api }) => {
		// Act
		const response = await create(api, [OPTION.COMMUNICATION])

		// Assert
		expect(response.status()).toBeGreaterThanOrEqual(400)
		expect(await response.text()).toContain('PROJECT_OPTIONS_MISSING')
	})

	test('ALERT without its two dependencies is rejected', async ({ api }) => {
		// Act
		const alone = await create(api, [OPTION.ALERT])
		const halfway = await create(api, [OPTION.ACTIVITY, OPTION.ALERT])

		// Assert
		expect(alone.status()).toBeGreaterThanOrEqual(400)
		expect(await alone.text()).toContain('PROJECT_OPTIONS_MISSING')
		expect(halfway.status(), 'ALERT still needs COMMUNICATION').toBeGreaterThanOrEqual(400)
		expect(await halfway.text()).toContain('PROJECT_OPTIONS_MISSING')
	})

	test('COMMUNICATION with ACTIVITY is accepted', async ({ api, projects }) => {
		// Act
		const project = await projects.create({ options: OPTIONS_COMMUNICATION })

		// Assert
		const stored = await api.get<{ options?: Array<{ value: string }> }>(`/api/v2/projects/${project.id}`)
		expect((stored.options ?? []).map(entry => entry.value))
			.toEqual(expect.arrayContaining([...OPTIONS_COMMUNICATION]))
	})

	/**
	 * v2 PATCH is a full replace, so disabling an option means resubmitting the
	 * set without it.
	 */
	test('an enabled option can be disabled', async ({ api, projects }) => {
		// Arrange
		const project = await projects.create({ options: [OPTION.VEHICLE, OPTION.ACTIVITY] })

		// Act
		await api.patch(`/api/v2/projects/${project.id}`, {
			name: project.name,
			begin: { date: '2026-07-01' },
			end: { date: '2026-08-31' },
			options: [OPTION.ACTIVITY],
		})

		// Assert
		const stored = await api.get<{ options?: Array<{ value: string }> }>(`/api/v2/projects/${project.id}`)
		expect((stored.options ?? []).map(entry => entry.value)).not.toContain(OPTION.VEHICLE)
	})

	/**
	 * The dependency graph holds on edit too: removing ACTIVITY from a project
	 * whose ALERT and COMMUNICATION options depend on it must be refused rather
	 * than silently orphaning them.
	 */
	test('disabling an option that another enabled option depends on is rejected', async ({ api, projects }) => {
		// Arrange
		const project = await projects.create({ options: OPTIONS_ALERT })

		// Act
		const response = await api.raw('PATCH', `/api/v2/projects/${project.id}`, {
			name: project.name,
			begin: { date: '2026-07-01' },
			end: { date: '2026-08-31' },
			options: [OPTION.COMMUNICATION, OPTION.ALERT],
		})

		// Assert
		expect(response.status(), 'removing a depended-on option must be refused').toBeGreaterThanOrEqual(400)
		expect(await response.text()).toContain('PROJECT_OPTIONS_MISSING')
	})
})
