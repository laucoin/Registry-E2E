import { expect, test } from '@fixtures/test.fixture';

/**
 * Objectif: Couvrir la liste des utilisateurs de la plateforme | Périmètre: lignes, rôle, export, protections de la
 * suppression | Limites: aucun compte n'est supprimé ni rétrogradé (les comptes de départ sont partagés).
 */
test.describe('Users', () => {
	test('USR-02 · a row shows the name and the role of a user', async ({ data, usersList }) => {
		const coordinator = await data.userOf('coordinator');

		await test.step('The row of a user shows their name and role', async () => {
			await usersList.goto(coordinator.email);
			await expect(usersList.row(coordinator.email).root).toContainText(coordinator.lastName.toUpperCase());
			await expect(usersList.role(coordinator.email)).toHaveText('Utilisateur');
		});
	});

	test('USR-03 · the role dialog is filled with the role of the user', async ({ data, usersList }) => {
		const coordinator = await data.userOf('coordinator');

		await test.step('Open then close the role dialog', async () => {
			await usersList.goto(coordinator.email);
			await usersList.row(coordinator.email).run('update-role');
			await expect(usersList.roleSelect).toHaveJSProperty('value', 'USER');
			await usersList.closeRoleDialog();
		});
	});

	test('USR-05 · exporting the data of a user reminds to delete the file and downloads it', async ({
		data,
		usersList,
	}) => {
		const coordinator = await data.userOf('coordinator');

		await test.step('The confirmation reminds the deletion, then the file is downloaded', async () => {
			await usersList.goto(coordinator.email);
			await usersList.row(coordinator.email).run('export');
			await expect(usersList.confirmation.message).toContainText('supprimé dès qu’il a été transmis');
			await usersList.confirmation.cancel();
			const file = await usersList.export(coordinator.email);
			expect(file.suggestedFilename()).toBe(`registry-user-${coordinator.id}.json`);
		});
	});

	test('USR-06 · no action on one own row, and deleting a user asks for a typed phrase', async ({
		data,
		usersList,
	}) => {
		const [administrator, coordinator] = [await data.userOf('administrator'), await data.userOf('coordinator')];

		await test.step('One own row has no actions', async () => {
			await usersList.goto(administrator.email);
			await expect(usersList.row(administrator.email).root).toBeVisible();
			await expect(usersList.menuButton(administrator.email)).toHaveCount(0);
		});

		await test.step('The deletion stays disabled until the phrase is typed', async () => {
			await usersList.goto(coordinator.email);
			await usersList.row(coordinator.email).run('delete');
			await expect(usersList.confirmation.confirmButton).toHaveAttribute('disabled');
			await usersList.confirmation.cancel();
		});
	});
});

test.describe('Blocking users', { tag: '@exclusive' }, () => {
	test('USR-04 · USR-06 · a blocked user loses access until unblocked, and the last administrator of a project cannot be blocked', async ({
		data,
		usersList,
	}) => {
		const participant = await data.userOf('participant');
		const coordinator = await data.userOf('coordinator');
		await data.projectAs('coordinator');
		data.onCleanup(() => data.api.raw('POST', `/users/${participant.id}/unblock`));
		const access = async (): Promise<number> =>
			(await (await data.apiAs('participant')).raw('GET', '/authentication/user/current')).status();

		await test.step('Block a user, who is tagged and loses access', async () => {
			// L'email du compte participant dépasse la longueur de recherche autorisée : il est cherché par son nom.
			await usersList.goto(participant.lastName);
			await usersList.runConfirmed(participant.email, 'block');
			await expect(usersList.hiddenTag(participant.email)).toBeVisible();
			await expect.poll(access).not.toBe(200);
		});

		await test.step('Unblock the user, who gets access back', async () => {
			await usersList.runConfirmed(participant.email, 'unblock');
			await expect(usersList.hiddenTag(participant.email)).toHaveCount(0);
			await expect.poll(access).toBe(200);
		});

		await test.step('The last administrator of a project cannot be blocked', async () => {
			await usersList.goto(coordinator.email);
			await usersList.runConfirmed(coordinator.email, 'block');
			await expect(usersList.toasts.error).toBeVisible();
			await expect(usersList.hiddenTag(coordinator.email)).toHaveCount(0);
		});
	});
});
