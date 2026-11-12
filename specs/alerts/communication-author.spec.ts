import { expect, test } from '@fixtures/test.fixture';
import { uid } from '@support/unique';

/** Objectif: Couvrir l'affichage d'une communication dont l'auteur a été supprimé | Périmètre: communications d'une alerte | Limites: suppression du compte simulée */
test.describe('Communication author', () => {
	test('DRW-05 · a communication whose author was deleted is signed by a deleted user', async ({
		alertsList,
		data,
	}) => {
		const project = await data.project(['ACTIVITY', 'COMMUNICATION', 'ALERT']);
		const title = `Orphan ${uid()}`;
		await data.alert(project.id, { title });

		await test.step('The author is shown as deleted', async () => {
			await alertsList.withoutCommunicationAuthors();
			await alertsList.goto(project.id);
			const drawer = await alertsList.openCommunications(title);
			await expect(drawer.authors.first()).toHaveText('Utilisateur supprimé');
		});
	});
});
