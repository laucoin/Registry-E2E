import { expect, test } from '@fixtures/test.fixture';
import { authFile } from '@support/accounts';

/** Objectif: Vérifier qu'un utilisateur simple n'accède pas aux utilisateurs | Périmètre: menu, URL, API | Limites: R_A est couvert par les tests de la liste */
test.describe('Users seen by a plain user', () => {
	test.use({ storageState: authFile('coordinator') });

	test('USR-01 · a plain user reaches the users neither by the menu, the address nor the API', async ({
		data,
		page,
		session,
	}) => {
		await test.step('The menu has no users link', async () => {
			await session.visit('/');
			await expect(session.navLink('Projets')).toBeVisible();
			await expect(session.navLink('Utilisateurs')).toHaveCount(0);
		});

		await test.step('The users address leads elsewhere', async () => {
			await session.visit('/users');
			await expect(page).not.toHaveURL(/\/users/);
		});

		await test.step('The API refuses the users', async () => {
			expect((await (await data.apiAs('coordinator')).raw('GET', '/users')).status()).toBe(403);
		});
	});
});
