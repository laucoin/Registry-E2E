import { expect, test } from '@fixtures/test.fixture';
import { authFile } from '@support/accounts';
import { uid } from '@support/unique';

/**
 * Objectif: Couvrir l'accueil de l'application | Périmètre: favoris, invitations, projets demandant de l'attention,
 * création | Limites: le coordinateur est le seul compte dont les favoris, invitations et alertes ne bougent pas en parallèle.
 */
test.describe('Home favorites', () => {
	test.use({ storageState: authFile('coordinator') });

	test('HOME-01 · HOME-02 · at most three favorites, which leave on their star and open their project', async ({
		data,
		home,
		page,
	}) => {
		const owner = await data.asOwner('coordinator');
		// L'accueil montre les trois premiers favoris par nom : les noms fixent lesquels.
		const prefix = `0 E2E favorite ${uid()}`;
		const [first, second, third, fourth] = [
			await owner.project([], { name: `${prefix} 1` }),
			await owner.project([], { name: `${prefix} 2` }),
			await owner.project([], { name: `${prefix} 3` }),
			await owner.project([], { name: `${prefix} 4` }),
		];
		await owner.favorite(first.id);
		await owner.favorite(second.id);
		await owner.favorite(third.id);

		await test.step('The star of a card removes the favorite', async () => {
			await home.goto();
			await home.unfavorite(first.name);
			await expect(home.favoriteCard(first.name)).toHaveCount(0);
		});

		await test.step('Four favorites show three cards', async () => {
			await owner.favorite(first.id);
			await owner.favorite(fourth.id);
			await home.goto();
			await expect(home.favoriteCards).toHaveCount(3);
		});

		await test.step('A card opens the home of its project', async () => {
			await home.openFavorite(second.name);
			await expect(page).toHaveURL(new RegExp(`/projects/${second.id}$`));
		});
	});
});

test.describe('Home invitations and attention', () => {
	test.use({ storageState: authFile('coordinator') });

	test('HOME-04 · invitations are accepted or refused after confirming', async ({ data, home }) => {
		// L'accueil montre les trois premières invitations par nom de projet : le préfixe les place avant celles du seed.
		const [accepted, refused] = [
			await data.project([], { name: `0 E2E accepted ${uid()}` }),
			await data.project([], { name: `0 E2E refused ${uid()}` }),
		];
		await data.invite(accepted.id, 'coordinator', 'PROJECT_PARTICIPANT', false);
		await data.invite(refused.id, 'coordinator', 'PROJECT_PARTICIPANT', false);

		await test.step('Each invitation shows its project and role', async () => {
			await home.goto();
			await expect(home.invitation(accepted.name)).toContainText('Participant');
		});

		await test.step('Accept one, refuse the other', async () => {
			await home.answer(accepted.name, true);
			await expect(home.invitation(accepted.name)).toHaveCount(0);
			await home.answer(refused.name, false);
			await expect(home.invitation(refused.name)).toHaveCount(0);
		});
	});

	test('HOME-06 · HOME-08 · projects with ongoing alerts come first by count, and the create button opens the form', async ({
		data,
		home,
		page,
	}) => {
		const owner = await data.asOwner('coordinator');
		const options = ['ACTIVITY', 'COMMUNICATION', 'ALERT'] as const;
		const [calm, busy] = [await owner.project([...options]), await owner.project([...options])];
		await owner.alert(calm.id, { title: `Rain ${uid()}` });
		await owner.alert(busy.id, { title: `Storm ${uid()}` });
		await owner.alert(busy.id, { title: `Flood ${uid()}` });

		await test.step('The project with the most alerts comes first', async () => {
			await home.goto();
			await expect(home.attentionNames).toHaveText([busy.name, calm.name]);
		});

		await test.step('A project needing attention opens', async () => {
			await home.openAttentionProject(busy.name);
			await expect(page).toHaveURL(new RegExp(`/projects/${busy.id}`));
		});

		await test.step('The create button opens the project form', async () => {
			await home.goto();
			await home.createButton.click();
			await expect(page).toHaveURL(/\/projects\/create$/);
		});
	});
});
