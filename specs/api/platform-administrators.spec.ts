import { expect, test } from '@fixtures/test.fixture';
import { rejection } from '@support/api/problem';

/**
 * Objectif: Vérifier que la plateforme garde toujours un administrateur | Périmètre: rétrogradation du dernier
 * administrateur visible | Limites: s'appuie sur le seed, où `administrator` est le seul administrateur non bloqué.
 */
test.describe('Last platform administrator', { tag: '@exclusive' }, () => {
	test('USR-03 · the last platform administrator cannot be demoted', async ({ data }) => {
		const administrator = await data.userOf('administrator');

		await test.step('Demoting the last administrator is refused', async () => {
			const response = await data.api.raw('PATCH', `/users/${administrator.id}/role`, { role: 'USER' });
			expect(await rejection(response)).toMatch(/USER_UPDATE_LAST_APPLICATION_ADMINISTRATOR_ROLE$/);
		});
	});
});
