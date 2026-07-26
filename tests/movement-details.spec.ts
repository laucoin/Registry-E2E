import { drawerTitle } from './support/antd'
import { OPTION, seedMovement, seedParticipant, seedVehicle } from './support/domain'
import { expect, test } from './support/fixtures'

/**
 * Phase F.1 (parity batch): the movement details drawer groups its content into
 * All / Adults / Minors + one tab per vehicle pool, and marks drivers.
 */
test.describe('movement details (parity batch)', () => {
	test('content is grouped into tabs with a driver marker', async ({ page, api, projects }) => {
		const project = await projects.create({ options: [OPTION.VEHICLE] })
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Omar',
			lastName: 'Diaz',
			birthday: '1990-04-04',
		})
		const vehicleId = await seedVehicle(api, project.id, { licensePlate: 'AA-1', brand: 'R', model: 'K' })
		await seedMovement(api, project.id, {
			type: 'IN',
			content: [{ participantId, vehicleId, poolName: 'Pool A' }],
		})

		await page.goto(`/projects/${project.id}/movements`)
		await page.getByTestId('movement-details').first().click()
		await expect(drawerTitle(page)).toHaveText(/Movement details|Détails du mouvement/)
		await expect(page.getByTestId('movement-detail-tab-all')).toBeVisible()
		await expect(page.getByTestId('movement-detail-tab-adults')).toBeVisible()
		await expect(page.getByTestId('movement-detail-tab-pool:Pool A')).toBeVisible()
		await expect(page.getByText('🚗')).toBeVisible()
	})
})
