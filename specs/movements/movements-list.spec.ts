import { expect, test } from '@fixtures/test.fixture';
import { isoDate, uiDateIn } from '@support/dates';
import { uid } from '@support/unique';

/** Objectif: Couvrir les actions sur une entrée ou sortie | Périmètre: modification et suppressions, en administrateur | Limites: les droits des autres rôles sont vérifiés à part */
test.describe('Movements list', () => {
	test('MVL-03 · editing a registered movement opens its form filled with the movement', async ({
		data,
		movementsList,
		registeredMovementForm: form,
	}) => {
		const project = await data.project();
		const lastName = `NOETHER-${uid().toUpperCase()}`;
		const participant = await data.participant(project.id, { firstName: 'Emmy', lastName });
		await data.participantMovement(project.id, { type: 'IN', participantIds: [participant.id] });

		await test.step('Open the edition from the list', async () => {
			await movementsList.goto(project.id);
			await movementsList.only.run('edit');
			await expect(form.information.dateTime.date).toHaveValue(uiDateIn(0));
		});

		await test.step('The participant of the movement is already chosen', async () => {
			await form.information.next();
			await expect(form.participants.chosen).toHaveText([`Emmy ${lastName}`]);
		});
	});

	test('MVL-03 · editing a guest movement opens the guest form filled with the guest', async ({
		data,
		guestMovementForm: form,
		movementsList,
	}) => {
		const project = await data.project();
		const lastName = `LAMARR-${uid().toUpperCase()}`;
		await data.guestMovement(project.id, {
			type: 'IN',
			reason: 'VISIT',
			guests: [{ firstName: 'Hedy', lastName, birthday: isoDate(-9000) }],
		});

		await test.step('Open the edition from the list and find the guest', async () => {
			await movementsList.goto(project.id);
			await movementsList.only.run('edit');
			await form.information.next();
			await expect(form.guestLastName.getByRole('textbox')).toHaveValue(lastName);
		});
	});

	test('MVL-04 · delete, restore then permanently delete a movement', async ({ data, movementsList }) => {
		const project = await data.project();
		const participant = await data.participant(project.id);
		await data.participantMovement(project.id, { type: 'IN', participantIds: [participant.id] });

		await test.step('A deleted movement stays listed, tagged, for those who can restore it', async () => {
			await movementsList.goto(project.id);
			await movementsList.runConfirmed('softDelete');
			await expect(movementsList.hiddenTag).toBeVisible();
		});

		await test.step('A restored movement loses its tag', async () => {
			await movementsList.runConfirmed('restore');
			await expect(movementsList.hiddenTag).toHaveCount(0);
		});

		await test.step('A permanently deleted movement leaves the list', async () => {
			await movementsList.runConfirmed('hardDelete');
			await expect(movementsList.rows).toHaveCount(0);
		});
	});
});
