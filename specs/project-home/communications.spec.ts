import { expect, test } from '@fixtures/test.fixture';
import { isoHoursAgo } from '@support/dates';
import { uid } from '@support/unique';

/**
 * Objectif: Couvrir les communications d'un mouvement en cours | Périmètre: envoi, ordre, auteur, alerte liée |
 * Limites: le chargement progressif des anciens messages n'est pas couvert.
 */
test.describe('Movement communications', () => {
	const OPTIONS = ['ACTIVITY', 'COMMUNICATION', 'ALERT'] as const;

	test('DRW-01 · DRW-02 · DRW-03 · messages are sent by button or shortcut, newest last, signed by the activity', async ({
		data,
		projectHome,
	}) => {
		const project = await data.project([...OPTIONS]);
		const { id } = await data.participant(project.id);
		const activity = `Canyon ${uid()}`;
		const { id: activityId } = await data.activity(project.id, { name: activity });
		await data.participantMovement(project.id, { type: 'IN', participantIds: [id], dateTime: isoHoursAgo(2) });
		await data.participantMovement(project.id, { type: 'OUT', participantIds: [id], activityId });

		await test.step('Send a message with the button, then another with the shortcut', async () => {
			await projectHome.gotoMonitoring(project.id);
			const drawer = await projectHome.openCommunications(projectHome.activityRows);
			await drawer.send('First news');
			await expect(drawer.messages).toHaveText(['First news']);
			await drawer.sendWithShortcut('Second news');
			await expect(drawer.messages).toHaveText(['First news', 'Second news']);
			await expect(drawer.authors.first()).toContainText(activity);
		});
	});

	test('DRW-03 · DRW-04 · on another movement the current user signs, and a message linked to an alert shows in both', async ({
		alertsList,
		data,
		projectHome,
	}) => {
		const project = await data.project([...OPTIONS]);
		const { id } = await data.participant(project.id);
		await data.participantMovement(project.id, { type: 'IN', participantIds: [id], dateTime: isoHoursAgo(2) });
		const movement = await data.participantMovement(project.id, {
			type: 'OUT',
			participantIds: [id],
			reason: 'SHOPPING',
		});
		const title = `Lost bag ${uid()}`;
		const alert = await data.alert(project.id, { title });
		await data.communication(project.id, alert.id, { movementId: movement.id, message: 'Bag left at the shop' });

		await test.step('The message linked to the alert shows the alert on the movement', async () => {
			await projectHome.gotoMonitoring(project.id);
			await projectHome.openOtherMovementsTab();
			const drawer = await projectHome.openCommunications(projectHome.otherMovementRows);
			await expect(drawer.messages).toContainText(['Bag left at the shop']);
			await expect(drawer.alertTitles.first()).toContainText(title);
			await expect(drawer.authors).toHaveCount(0);
		});

		await test.step('The same message shows in the alert', async () => {
			await alertsList.goto(project.id);
			const drawer = await alertsList.openCommunications(title);
			await expect(drawer.messages).toContainText(['Bag left at the shop']);
		});
	});
});
