import { expect, test } from '@fixtures/test.fixture';
import { uid } from '@support/unique';

/** Objectif: Couvrir le cycle de vie d'une activité | Périmètre: formulaire et liste des activités | Limites: sans durée ni disponibilité */
test.describe('Activities', () => {
	test('ACT-02 · create then edit an activity whose participant range is checked', async ({
		activitiesList,
		activityForm,
		data,
	}) => {
		const project = await data.project(['ACTIVITY']);
		const name = `Canoe ${uid()}`;

		await test.step('A minimum above the maximum is refused', async () => {
			await activitiesList.goto(project.id);
			await activitiesList.openCreation();
			await activityForm.fill({ name, minParticipants: '8', maxParticipants: '4' });
			await activityForm.submitRejected();
			await expect(activityForm.participantsRange).toHaveAttribute('error', /inférieur ou égal au maximum/);
		});

		await test.step('One bound alone is refused', async () => {
			await activityForm.fill({ maxParticipants: '' });
			await expect(activityForm.participantsRange).toHaveAttribute('error', /que le minimum ou le maximum/);
		});

		await test.step('A valid range is saved and shown on the row', async () => {
			await activityForm.save({ minParticipants: '4', maxParticipants: '8' });
			await expect(activitiesList.row(name).root).toContainText('4-8');
		});

		await test.step('The edition form is filled with the activity', async () => {
			await activitiesList.run(name, 'edit');
			await expect(activityForm.name).toHaveValue(name);
			await expect(activityForm.minParticipants).toHaveValue('4');
			await expect(activityForm.maxParticipants).toHaveValue('8');
		});

		await test.step('Save a new name', async () => {
			await activityForm.save({ name: `${name} river` });
			await expect(activitiesList.row(`${name} river`).root).toContainText('4-8');
		});
	});
});
