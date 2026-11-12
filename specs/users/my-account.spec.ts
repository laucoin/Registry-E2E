import { expect, test } from '@fixtures/test.fixture';
import { authFile } from '@support/accounts';
import { at } from '@support/dates';

/** Objectif: Couvrir Mon compte et la fin d'un accès | Périmètre: export, suppression protégée, accès expiré | Limites: aucun compte n'est supprimé */
test.describe('My account', () => {
	test.use({ storageState: authFile('participant') });

	test('ACC-01 · ACC-02 · a user exports their data, and deleting the account asks for a typed phrase', async ({
		myAccount,
	}) => {
		await test.step('Export one own data', async () => {
			await myAccount.goto();
			const file = await myAccount.exportData();
			expect(file.suggestedFilename()).toBe('registry-my-data.json');
		});

		await test.step('The deletion stays disabled until the phrase is typed', async () => {
			await myAccount.openDeletion();
			await expect(myAccount.confirmDeletion).toHaveAttribute('disabled');
			await myAccount.cancelDeletion();
		});
	});
});

test.describe('Access range of a profile', () => {
	test('SEC-04 · a profile whose access range is over no longer opens the project', async ({ data }) => {
		const project = await data.project();
		await data.invite(project.id, 'coordinator', 'PROJECT_COORDINATOR', true, {
			startAccess: at(-10),
			endAccess: at(-5),
		});
		const coordinator = await data.apiAs('coordinator');

		await test.step('The accepted but expired profile is refused the project content', async () => {
			expect((await coordinator.raw('GET', `/projects/${project.id}/participants`)).status()).toBe(403);
		});
	});
});
