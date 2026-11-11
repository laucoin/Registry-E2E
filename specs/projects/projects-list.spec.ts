import { expect, test } from '@fixtures/test.fixture';

/** Objectif: Couvrir la suppression d'un projet depuis la liste | Périmètre: supprimer, restaurer, supprimer définitivement | Limites: compte administrateur du projet */
test.describe('Projects list', () => {
	test('PL-06 · delete, restore then permanently delete a project, each confirmed', async ({
		data,
		projectsList,
	}) => {
		const project = await data.project();

		await test.step('A deleted project is greyed out, tagged, and explains why it cannot be joined', async () => {
			await projectsList.goto(project.name);
			await projectsList.runConfirmed(project.name, 'softDelete');
			await expect(projectsList.hiddenTag(project.name)).toBeVisible();
			await expect(projectsList.join(project.name)).toHaveAttribute('aria-disabled', 'true');
			await projectsList.join(project.name).click();
			await expect(projectsList.hiddenNotice).toContainText(project.name);
		});

		await test.step('A restored project can be joined again', async () => {
			await projectsList.goto(project.name);
			await projectsList.runConfirmed(project.name, 'restore');
			await expect(projectsList.hiddenTag(project.name)).toHaveCount(0);
			await expect(projectsList.join(project.name)).toHaveAttribute('aria-disabled', 'false');
		});

		await test.step('A permanent deletion asks for the phrase, then removes the project', async () => {
			await projectsList.runConfirmed(project.name, 'hardDelete', 'supprimer le projet');
			await expect(projectsList.rows.filter({ hasText: project.name })).toHaveCount(0);
			expect(await data.projectIdNamed(project.name)).toBeUndefined();
		});
	});
});
