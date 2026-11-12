import { expect, test } from '@fixtures/test.fixture';
import { authFile } from '@support/accounts';
import { uid } from '@support/unique';

/** Objectif: Couvrir les comportements communs des listes | Périmètre: lots, recherche, URL, filtres, liste vide, erreur, visibilité | Limites: sur la liste des participants */
test.describe('List behaviours', () => {
	test('LST-01 · the next batch loads while scrolling, without numbered pages', async ({
		data,
		participantsList,
	}) => {
		const project = await data.project();
		await Promise.all(Array.from({ length: 25 }, () => data.participant(project.id)));

		await test.step('The second batch arrives once the end of the list is reached', async () => {
			await participantsList.goto(project.id);
			await expect(participantsList.rows).toHaveCount(20);
			await participantsList.list.loadMore.scrollIntoViewIfNeeded();
			await expect(participantsList.rows).toHaveCount(25);
			await expect(participantsList.list.loadMore).toHaveCount(0);
		});
	});

	test('LST-02 · LST-03 · the search lives in the address, survives a reload and is reset with the filters', async ({
		data,
		page,
		participantsList,
	}) => {
		const project = await data.project();
		const lastName = `SEARCHED-${uid().toUpperCase()}`;
		await data.participant(project.id, { lastName });
		await data.participant(project.id);

		await test.step('Enter searches at once and writes the address', async () => {
			await participantsList.goto(project.id);
			await participantsList.search.fill(lastName);
			await participantsList.search.press('Enter');
			await expect(participantsList.rows).toHaveCount(1);
			await expect(page).toHaveURL(new RegExp(`q=${lastName}`));
		});

		await test.step('A reload keeps the search and counts it among the active filters', async () => {
			await participantsList.reload();
			await expect(participantsList.search).toHaveValue(lastName);
			await expect(participantsList.rows).toHaveCount(1);
			await expect(participantsList.list.activeFilters).toContainText('1');
		});

		await test.step('Resetting the filters shows everyone again', async () => {
			await participantsList.goto(project.id, '?q=nobody-at-all');
			await participantsList.list.resetFilters.click();
			await expect(participantsList.search).toHaveValue('');
			await expect(participantsList.rows).toHaveCount(2);
		});
	});

	test('LST-04 · LST-05 · an empty list says so, and a loading error shows the message of the backend', async ({
		data,
		participantsList,
	}) => {
		const project = await data.project();

		await test.step('The empty list names what is missing and offers to create it', async () => {
			await participantsList.goto(project.id);
			await expect(participantsList.list.empty).toContainText(/Aucun\s+participant/);
			await expect(participantsList.createButton).toBeVisible();
		});

		await test.step('A loading error shows the detail sent by the backend', async () => {
			await participantsList.failNextLoad(500, 'Base indisponible pour maintenance');
			await participantsList.reload();
			await expect(participantsList.list.error).toContainText('Base indisponible pour maintenance');
		});
	});
});

test.describe('List behaviours for a project participant', () => {
	test.use({ storageState: authFile('participant') });

	test('LST-06 · the visibility filter is not offered to a project participant', async ({
		data,
		participantsList,
	}) => {
		const project = await data.project();
		await data.invite(project.id, 'participant', 'PROJECT_PARTICIPANT');
		await data.participant(project.id);

		await test.step('The participants are listed without visibility filter', async () => {
			await participantsList.goto(project.id);
			await expect(participantsList.rows).toHaveCount(1);
			await expect(participantsList.visibilityFilter).toHaveCount(0);
		});
	});
});
