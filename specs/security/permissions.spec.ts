import { expect, test } from '@fixtures/test.fixture';
import { EXPECTED_GLOBAL_AUTHORITIES, EXPECTED_PROJECT_AUTHORITIES, Permissions } from '@support/permissions';

/**
 * Objectif: Figer la matrice rôle → permissions que le backend applique | Périmètre: les trois rôles de projet et les
 * deux rôles globaux | Limites: le comportement de l'interface pour chaque droit est couvert par les tests de chaque écran.
 */
test.describe('Permissions granted by the backend', () => {
	test('SEC-01 · each project role receives exactly the expected permissions', async ({ data }) => {
		const project = await data.project(['VEHICLE', 'ACTIVITY', 'COMMUNICATION', 'ALERT']);
		await data.invite(project.id, 'coordinator', 'PROJECT_COORDINATOR');
		await data.invite(project.id, 'participant', 'PROJECT_PARTICIPANT');

		await test.step('The project administrator', async () => {
			const permissions = await Permissions.load(data.api, project.id);
			expect(permissions.projectAuthorities).toEqual(EXPECTED_PROJECT_AUTHORITIES.PROJECT_ADMINISTRATOR);
		});

		await test.step('The project coordinator', async () => {
			const permissions = await Permissions.load(await data.apiAs('coordinator'), project.id);
			expect(permissions.projectAuthorities).toEqual(EXPECTED_PROJECT_AUTHORITIES.PROJECT_COORDINATOR);
		});

		await test.step('The project participant', async () => {
			const permissions = await Permissions.load(await data.apiAs('participant'), project.id);
			expect(permissions.projectAuthorities).toEqual(EXPECTED_PROJECT_AUTHORITIES.PROJECT_PARTICIPANT);
		});
	});

	test('SEC-01 · each platform role receives exactly the expected permissions', async ({ data }) => {
		const project = await data.project();

		await test.step('The platform administrator', async () => {
			const permissions = await Permissions.load(data.api, project.id);
			expect(permissions.globalAuthorities).toEqual(EXPECTED_GLOBAL_AUTHORITIES.USER_ADMINISTRATOR);
		});

		await test.step('A plain user', async () => {
			const permissions = await Permissions.load(await data.apiAs('coordinator'), project.id);
			expect(permissions.globalAuthorities).toEqual(EXPECTED_GLOBAL_AUTHORITIES.USER);
		});
	});
});
