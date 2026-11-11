import { expect, test } from '@fixtures/test.fixture';
import { uiDateIn } from '@support/dates';
import { defined } from '@support/defined';
import { EXPECTED_PROJECT_AUTHORITIES, Permissions } from '@support/permissions';
import { uid } from '@support/unique';

/** Objectif: Couvrir la création et la modification d'un projet | Périmètre: formulaire en étapes | Limites: l'invitation est passée */
test.describe('Project form', () => {
	test('PRJ-01 · the project exists from the options step and its creator administers it', async ({
		data,
		projectForm,
	}) => {
		const name = `E2E camp ${uid()}`;
		let projectId = '';

		await test.step('Fill the information and save every option', async () => {
			await projectForm.openCreation();
			await projectForm.fillInformation({
				name,
				begin: { date: uiDateIn(0), time: '08:00' },
				end: { date: uiDateIn(7), time: '18:00' },
			});
			await projectForm.selectAllOptions();
			await expect(projectForm.checkedOptions).toHaveCount(4);
			await projectForm.saveOptions();
		});

		await test.step('The third step invites people to the project, which already exists', async () => {
			await expect(projectForm.createdCallout).toBeVisible();
			await expect(projectForm.invitationStep).toBeVisible();
			projectId = defined(await data.projectIdNamed(name));
			data.track(projectId);
		});

		await test.step('Skipping the invitation opens the project, administered by its creator', async () => {
			expect(await projectForm.skipInvitation()).toBe(projectId);
			const permissions = await Permissions.load(data.api, projectId);
			expect(permissions.projectAuthorities).toEqual(EXPECTED_PROJECT_AUTHORITIES.PROJECT_ADMINISTRATOR);
		});
	});

	test('PRJ-02 · the edition form is the same form, filled, without the invitation', async ({
		data,
		projectForm,
		projectHome,
	}) => {
		const project = await data.project(['VEHICLE']);

		await test.step('The information is filled with the project', async () => {
			await projectForm.openEdition(project.id);
			await expect(projectForm.name).toHaveValue(project.name);
			await expect(projectForm.begin.date).toHaveValue(uiDateIn(-30));
			await expect(projectForm.end.date).toHaveValue(uiDateIn(30));
			await expect(projectForm.invitationStep).toHaveCount(0);
		});

		await test.step('The options step keeps the vehicle option on', async () => {
			await projectForm.fillInformation({ name: `${project.name} renamed` });
			await expect(projectForm.options).toHaveCount(4);
			await expect(projectForm.checkedOptions).toHaveCount(1);
		});

		await test.step('Save the new name', async () => {
			await projectForm.saveOptions();
			await projectHome.goto(project.id);
			await expect(projectHome.title).toContainText(`${project.name} renamed`);
		});
	});
});
