import { expect, test } from '@fixtures/test.fixture';
import { authFile } from '@support/accounts';

/** Objectif: Vérifier qui peut supprimer, restaurer et supprimer définitivement une entrée ou sortie | Périmètre: RP_C et RP_P | Limites: le parcours complet en RP_A est dans movements-list */
test.describe('Movement deletion rights of a coordinator', () => {
	test.use({ storageState: authFile('coordinator') });

	test('MVL-04 · a coordinator restores a deleted movement but cannot delete it permanently', async ({
		data,
		movementsList,
	}) => {
		const project = await data.project();
		await data.invite(project.id, 'coordinator', 'PROJECT_COORDINATOR');
		const participant = await data.participant(project.id);
		const movement = await data.participantMovement(project.id, { type: 'IN', participantIds: [participant.id] });
		await data.softDeleteMovement(project.id, movement.id);

		await test.step('The deleted movement is listed and can be restored, not permanently deleted', async () => {
			await movementsList.goto(project.id);
			await expect(movementsList.hiddenTag).toBeVisible();
			await movementsList.only.openMenu();
			await expect(movementsList.only.action('restore')).not.toHaveAttribute('disabled');
			await expect(movementsList.only.action('hardDelete')).toHaveAttribute('disabled');
		});
	});
});

test.describe('Movement deletion rights of a participant', () => {
	test.use({ storageState: authFile('participant') });

	test('MVL-04 · a participant deletes a movement, which then disappears for them', async ({
		data,
		movementsList,
	}) => {
		const project = await data.project();
		await data.invite(project.id, 'participant', 'PROJECT_PARTICIPANT');
		const participant = await data.participant(project.id);
		await data.participantMovement(project.id, { type: 'IN', participantIds: [participant.id] });

		await test.step('The participant can delete but not permanently delete', async () => {
			await movementsList.goto(project.id);
			await movementsList.only.openMenu();
			await expect(movementsList.only.action('hardDelete')).toHaveAttribute('disabled');
			await movementsList.only.action('softDelete').click();
			await movementsList.confirmation.confirm();
		});

		await test.step('Without the right to restore, the deleted movement is no longer listed', async () => {
			await expect(movementsList.rows).toHaveCount(0);
		});
	});
});
