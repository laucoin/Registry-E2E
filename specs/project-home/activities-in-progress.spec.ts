import { expect, test } from '@fixtures/test.fixture';
import { uid } from '@support/unique';

/** Objectif: Couvrir le suivi des activités en cours sur l'accueil | Périmètre: ligne, participants, « Faire rentrer » | Limites: une activité */
test.describe('Activities in progress', () => {
	test('PH-08 · an activity in progress lists and brings back the participants still out', async ({
		data,
		projectHome,
		registeredMovementForm: form,
	}) => {
		const project = await data.project(['ACTIVITY']);
		const suffix = uid().toUpperCase();
		const away = await data.participant(project.id, { firstName: 'Nellie', lastName: `BLY-${suffix}` });
		const back = await data.participant(project.id, { firstName: 'Amelia', lastName: `EARHART-${suffix}` });
		const participantIds = [away.id, back.id];
		await data.participantMovement(project.id, { type: 'IN', participantIds });
		const activity = `Kayak ${uid()}`;
		const { id: activityId } = await data.activity(project.id, { name: activity });
		await data.participantMovement(project.id, { type: 'OUT', participantIds, activityId });
		await data.participantMovement(project.id, { type: 'IN', participantIds: [back.id] });

		await test.step('The counter of the activity lists the participants still out', async () => {
			await projectHome.goto(project.id);
			const participants = await projectHome.openActivityParticipants(activity);
			await expect(participants).toContainText(`BLY-${suffix}`);
			await expect(participants).not.toContainText(`EARHART-${suffix}`);
		});

		await test.step('Bringing back the activity prepares the entry of the participant still out', async () => {
			await projectHome.goto(project.id);
			await projectHome.bringBack(activity);
			await expect(form.title).toHaveJSProperty('title', 'Créer une entrée');
			await expect(form.participants.chosen).toHaveText([`Nellie BLY-${suffix}`]);
		});
	});
});
