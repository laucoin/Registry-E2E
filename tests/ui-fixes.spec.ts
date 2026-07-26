import { drawerTitle } from './support/antd'
import { seedMovement, seedParticipant } from './support/domain'
import { expect, test } from './support/fixtures'

/**
 * UI-fix regression guards (Nuxt rewrite): list-item avatar vertical centering
 * and the movement "Details" drawer (participant/vehicle list fetched on demand).
 */
test.describe('ui fixes', () => {
	test('list-item avatars are vertically centered', async ({ page, api, project }) => {
		await seedParticipant(api, project.id, { firstName: 'Nina', lastName: 'Wells', birthday: '1991-03-03' })
		await page.goto(`/projects/${project.id}/participants`)
		const meta = page.locator('.ant-list-item-meta').first()
		await expect(meta).toBeVisible()
		const alignItems = await meta.evaluate(el => getComputedStyle(el).alignItems)
		expect(alignItems).toBe('center')
	})

	/**
	 * The drawer content teleports to <body>, and the participant name only
	 * appears there — the list row shows date/type/reason, not names.
	 */
	test('a movement exposes its participant list behind Details', async ({ page, api, project }) => {
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Omar',
			lastName: 'Diaz',
			birthday: '1990-04-04',
		})
		await seedMovement(api, project.id, { type: 'IN', content: [{ participantId }] })

		await page.goto(`/projects/${project.id}/movements`)
		await page.getByTestId('movement-details').first().click()
		await expect(drawerTitle(page)).toHaveText(/Movement details|Détails du mouvement/)
		await expect(page.getByText(/Omar/i)).toBeVisible()
	})
})
