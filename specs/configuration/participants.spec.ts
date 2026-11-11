import { expect, test } from '@fixtures/test.fixture';
import { uiDateIn } from '@support/dates';
import { uid } from '@support/unique';

/** Objectif: Couvrir la saisie d'un participant | Périmètre: formulaire et liste des participants | Limites: sans utilisateur lié */
test.describe('Participants', () => {
	test('PAR-01 · PAR-02 · create a participant then find every field filled in its edition form', async ({
		data,
		participantForm,
		participantsList,
	}) => {
		const project = await data.project();
		const group = `Rangers ${uid()}`;
		await data.group(project.id, [], { name: group });
		const lastName = `HOPPER-${uid().toUpperCase()}`;
		const start = { date: uiDateIn(0), time: '09:00' };
		const end = { date: uiDateIn(5), time: '18:00' };

		await test.step('Create a participant with a group and an availability', async () => {
			await participantsList.goto(project.id);
			await participantsList.openCreation();
			await participantForm.save({
				firstName: 'Grace',
				lastName,
				birthday: '09/12/2006',
				start,
				end,
				groups: [group],
			});
		});

		await test.step('The participant is listed with the group', async () => {
			await expect(participantsList.row(lastName).root).toContainText(group);
		});

		await test.step('The edition form is filled with the participant', async () => {
			await participantsList.run(lastName, 'edit');
			await expect(participantForm.firstName).toHaveValue('Grace');
			await expect(participantForm.lastName).toHaveValue(lastName);
			await expect(participantForm.birthday).toHaveValue('09/12/2006');
			await expect(participantForm.start.date).toHaveValue(start.date);
			await expect(participantForm.end.date).toHaveValue(end.date);
			await expect(participantForm.chosenGroups).toHaveText([group]);
		});

		await test.step('Save a new first name', async () => {
			await participantForm.save({ firstName: 'Ada' });
			await expect(participantsList.row(lastName).root).toContainText(`Ada ${lastName}`);
		});
	});
});
