import { expect, test } from '@fixtures/test.fixture';
import { isoDate, uiDateIn } from '@support/dates';
import { uid } from '@support/unique';

/** Objectif: Couvrir les filtres et les lignes de la liste des projets | Périmètre: texte, date, favoris, options, rejoindre, modifier | Limites: en administrateur */
test.describe('Projects list filters and rows', () => {
	test('PL-02 · the list filters on the text, the projects active at an instant and the favorites', async ({
		data,
		projectsList,
	}) => {
		const prefix = `E2E filters ${uid()}`;
		const active = await data.project([], { name: `${prefix} active` });
		await data.project([], {
			name: `${prefix} future`,
			begin: { date: isoDate(10) },
			end: { date: isoDate(20) },
		});

		await test.step('The text keeps both projects', async () => {
			await projectsList.goto(prefix);
			await expect(projectsList.rows).toHaveCount(2);
		});

		await test.step('Today keeps only the project already begun', async () => {
			await projectsList.activeAt.fill({ date: uiDateIn(0), time: '12:00' });
			await expect(projectsList.rows).toHaveCount(1);
			await expect(projectsList.row(active.name).root).toBeVisible();
		});

		await test.step('The favorites keep only the starred project', async () => {
			await projectsList.goto(prefix);
			await projectsList.star(active.name).click();
			await expect(projectsList.star(active.name)).toHaveAttribute('aria-pressed', 'true');
			await projectsList.showFavoritesOnly();
			await expect(projectsList.rows).toHaveCount(1);
			await expect(projectsList.row(active.name).root).toBeVisible();
		});
	});

	test('PL-03 · a row lists the options of a project and offers to join it', async ({ data, projectsList }) => {
		const project = await data.project(['ACTIVITY', 'VEHICLE']);

		await test.step('The options button opens the list of the options', async () => {
			await projectsList.goto(project.name);
			await projectsList.optionsButton(project.name).click();
			await expect(projectsList.optionItems).toHaveCount(2);
		});

		await test.step('A valid profile offers to join the project', async () => {
			await projectsList.goto(project.name);
			await expect(projectsList.join(project.name)).toHaveAttribute('aria-disabled', 'false');
		});
	});

	test('PL-07 · editing a project opens its form filled', async ({ data, projectForm, projectsList }) => {
		const project = await data.project();

		await test.step('Edit opens the form filled with the project', async () => {
			await projectsList.goto(project.name);
			await projectsList.row(project.name).run('edit');
			await expect(projectForm.name).toHaveValue(project.name);
		});
	});

	test('PL-04 · the platform administrator joins a project without profile through a support profile', async ({
		data,
		page,
		projectsList,
	}) => {
		const project = await data.projectAs('coordinator');

		await test.step('Confirm the support profile and reach the project', async () => {
			await projectsList.goto(project.name);
			await projectsList.showAllProjects();
			await projectsList.supportButton(project.name).click();
			await projectsList.confirmation.confirm();
			await expect(page).toHaveURL(new RegExp(`/projects/${project.id}$`));
		});
	});
});
