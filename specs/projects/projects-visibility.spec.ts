import { expect, test } from '@fixtures/test.fixture';
import { authFile } from '@support/accounts';

/** Objectif: Vérifier quels projets chaque rôle global voit | Périmètre: liste des projets, filtre « Profil » | Limites: projets filtrés par leur nom */
test.describe('Projects seen by a plain user', () => {
	test.use({ storageState: authFile('coordinator') });

	test('PL-01 · a plain user only sees the projects where they have a profile', async ({ data, projectsList }) => {
		const own = await data.projectAs('coordinator');
		const other = await data.projectAs('participant');

		await test.step('Their own project is listed', async () => {
			await projectsList.goto(own.name);
			await expect(projectsList.rows.filter({ hasText: own.name })).toHaveCount(1);
		});

		await test.step('A project without their profile is not listed, and nothing widens the list', async () => {
			await projectsList.goto(other.name);
			await expect(projectsList.noResult).toBeVisible();
			await expect(projectsList.withProfile).toHaveCount(0);
		});
	});
});

test.describe('Projects seen by the platform administrator', () => {
	test('PL-01 · the administrator sees their projects by default and every project on demand', async ({
		data,
		projectsList,
	}) => {
		const other = await data.projectAs('coordinator');

		await test.step('By default only the projects with a profile are listed', async () => {
			await projectsList.goto(other.name);
			await expect(projectsList.noResult).toBeVisible();
		});

		await test.step('Showing every project lists the project without profile', async () => {
			await projectsList.showAllProjects();
			await expect(projectsList.rows.filter({ hasText: other.name })).toHaveCount(1);
		});
	});
});
