import { drawerTitle, sendThreadMessage } from './support/antd'
import {
	movementReason,
	OPTIONS_COMMUNICATION,
	seedCommunication,
	seedMovement,
	seedParticipant,
} from './support/domain'
import { expect, test } from './support/fixtures'

/**
 * Phase F.2 (parity batch): the per-movement communication thread.
 * Communications attach only to OUT movements (backend rule), so the button is
 * gated to OUT rows; this seeds one message, opens the thread, and composes a
 * second through the UI.
 */
test.describe('movement communications thread (parity batch)', () => {
	test('reads the thread and composes a message', async ({ page, api, projects }) => {
		const project = await projects.create({ options: OPTIONS_COMMUNICATION })
		const participantId = await seedParticipant(api, project.id, {
			firstName: 'Omar',
			lastName: 'Diaz',
			birthday: '1990-04-04',
		})
		const reason = await movementReason(api, project.id)
		const movementId = await seedMovement(api, project.id, {
			type: 'OUT',
			reason: reason.value,
			content: [{ participantId }],
		})
		await seedCommunication(api, project.id, {
			movementId,
			dateTime: '2026-07-10T10:00:00.000Z',
			message: 'Hello thread',
		})

		await page.goto(`/projects/${project.id}/movements`)
		await page.getByTestId('movement-communications').first().click()
		await expect(drawerTitle(page)).toHaveText(/Movement discussion|Discussion du mouvement/)
		await expect(page.getByText('Hello thread')).toBeVisible()

		await sendThreadMessage(page, 'Second message')
		await expect(page.getByText('Second message')).toBeVisible()
	})
})
