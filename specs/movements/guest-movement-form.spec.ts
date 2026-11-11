import { expect, test } from '@fixtures/test.fixture';
import { uid } from '@support/unique';

/** Objectif: Couvrir le formulaire de mouvement des invités | Périmètre: entrée avec motif et invité, sortie | Limites: un invité à la fois */
test.describe('Guest movement form', () => {
	test('MVF-03 · a guest enters with a reason, then leaves and is no longer offered for an exit', async ({
		data,
		guestMovementForm: form,
		movementsList,
	}) => {
		const project = await data.project();
		const guest = { firstName: 'Ada', lastName: `BYRON-${uid().toUpperCase()}`, birthday: '10/12/1990' };
		const fullName = `${guest.firstName} ${guest.lastName}`;

		await test.step('An entry needs a reason and a guest', async () => {
			await form.open(project.id);
			await form.information.continueAs('IN');
			await form.saveRejected();
			await expect(form.reason.field).toHaveAttribute('error', /.+/);
			await expect(form.guestFirstName).toHaveAttribute('error', /.+/);
		});

		await test.step('The entry creates the guest', async () => {
			await form.fillGuest(guest);
			await form.reason.open();
			await form.reason.options.first().click();
			await form.save();
			await movementsList.goto(project.id);
			await expect(movementsList.rows.filter({ hasText: 'Entrée' })).toHaveCount(1);
		});

		await test.step('The guest leaves', async () => {
			await form.open(project.id);
			await form.information.continueAs('OUT');
			await form.leavingGuests.choose(fullName);
			await form.save();
		});

		await test.step('A guest who left is no longer offered for an exit', async () => {
			await form.open(project.id);
			await form.information.continueAs('OUT');
			await form.leavingGuests.search(guest.lastName);
			await expect(form.leavingGuests.noResult).toBeVisible();
		});
	});
});
