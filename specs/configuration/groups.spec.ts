import { expect, test } from '@fixtures/test.fixture';
import { uid } from '@support/unique';

/** Objectif: Couvrir la saisie d'un groupe | Périmètre: formulaire en deux étapes et liste des groupes | Limites: sans disponibilité */
test.describe('Groups', () => {
	test('GRP-01 · create a group without members, another with a member, then edit one', async ({
		data,
		groupForm,
		groupsList,
	}) => {
		const project = await data.project();
		const lastName = `TURING-${uid().toUpperCase()}`;
		await data.participant(project.id, { firstName: 'Alan', lastName });
		const empty = `Scouts ${uid()}`;
		const filled = `Guides ${uid()}`;

		await test.step('Create a group and skip its members', async () => {
			await groupsList.goto(project.id);
			await groupsList.openCreation();
			await groupForm.createOpened(empty, []);
			await expect(groupsList.row(empty).root).toContainText('Aucun membre');
		});

		await test.step('Create a group with a member', async () => {
			await groupsList.openCreation();
			await groupForm.createOpened(filled, [`Alan ${lastName}`]);
			await expect(groupsList.row(filled).root).toContainText('Un membre');
		});

		await test.step('The edition form is filled with the group and saves a new name', async () => {
			await groupsList.run(empty, 'edit');
			await expect(groupForm.name).toHaveValue(empty);
			await groupForm.save(`${empty} renamed`);
			await expect(groupsList.row(`${empty} renamed`).root).toBeVisible();
		});
	});
});
