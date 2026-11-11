import { expect, test } from '@fixtures/test.fixture';
import { authFile } from '@support/accounts';

/** Objectif: Vérifier l'accès aux membres d'un projet selon le rôle | Périmètre: RP_C et RP_P | Limites: RP_A est couvert par les invitations */
test.describe('Project members seen by a coordinator', () => {
	test.use({ storageState: authFile('coordinator') });

	test('PRF-06 · a coordinator reads the members without inviting nor managing them', async ({
		data,
		profilesList,
	}) => {
		const project = await data.project();
		await data.invite(project.id, 'coordinator', 'PROJECT_COORDINATOR');
		const administrator = await data.userOf('administrator');

		await test.step('The members are listed, without invitation', async () => {
			await profilesList.gotoProject(project.id);
			await expect(profilesList.row(administrator.lastName)).toBeVisible();
			await expect(profilesList.inviteButton).toHaveCount(0);
		});

		await test.step('The actions on a member are greyed out', async () => {
			const menu = profilesList.menu(administrator.lastName);
			await menu.openMenu();
			await expect(menu.action('edit')).toHaveAttribute('disabled');
			await expect(menu.action('block')).toHaveAttribute('disabled');
			await expect(menu.action('delete')).toHaveAttribute('disabled');
		});
	});
});

test.describe('Project members seen by a participant', () => {
	test.use({ storageState: authFile('participant') });

	test('PRF-06 · a participant opening the members by their address gets the refusal of the backend', async ({
		data,
		profilesList,
	}) => {
		const project = await data.project();
		await data.invite(project.id, 'participant', 'PROJECT_PARTICIPANT');

		await test.step('The list shows the loading error', async () => {
			// La route n'a pas de garde de rôle : c'est le refus du backend qui protège la liste.
			await profilesList.gotoProject(project.id);
			await expect(profilesList.loadError).toBeVisible();
		});
	});
});
