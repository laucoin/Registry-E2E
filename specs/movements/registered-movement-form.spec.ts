import { expect, test } from '@fixtures/test.fixture';
import { uiDateIn } from '@support/dates';
import { uid } from '@support/unique';

/** Objectif: Couvrir le formulaire de mouvement des inscrits | Périmètre: stepper, date par défaut, motif d'une sortie | Limites: sans véhicule */
test.describe('Registered movement form', () => {
	test('MVF-01 · MVF-02 · record the exit of a present participant, whose reason is required and may be an activity', async ({
		data,
		movementsList,
		registeredMovementForm: form,
	}) => {
		const project = await data.project(['ACTIVITY']);
		const lastName = `CURIE-${uid().toUpperCase()}`;
		const participant = await data.participant(project.id, { firstName: 'Marie', lastName });
		await data.participantMovement(project.id, { type: 'IN', participantIds: [participant.id] });
		const activity = `Hike ${uid()}`;
		await data.activity(project.id, { name: activity });

		await test.step('The first step can be cancelled and starts now', async () => {
			await form.open(project.id);
			await expect(form.information.cancel).toBeVisible();
			await expect(form.information.dateTime.date).toHaveValue(uiDateIn(0));
		});

		await test.step('The second step goes back to the first one', async () => {
			await form.information.continueAs('OUT');
			await expect(form.previous).toBeVisible();
		});

		await test.step('An exit without reason is refused', async () => {
			await form.chooseParticipants([`Marie ${lastName}`]);
			await form.saveRejected();
			await expect(form.reason.field).toHaveAttribute('error', /.+/);
		});

		await test.step('The activities are offered among the reasons', async () => {
			await form.reason.open();
			await expect(form.reason.options.filter({ hasText: activity })).toHaveCount(1);
			await expect(form.reason.options.filter({ hasText: 'Courses' })).toHaveCount(1);
		});

		await test.step('The exit is recorded', async () => {
			await form.reason.options.filter({ hasText: activity }).click();
			await form.save();
			await movementsList.goto(project.id);
			await expect(movementsList.rows.filter({ hasText: 'Sortie' })).toHaveCount(1);
		});
	});
});
