import { expect, test } from '@fixtures/test.fixture';
import { uid } from '@support/unique';

/** Objectif: Couvrir le parcours critique d'un séjour | Périmètre: projet, participant, groupe, première entrée, accueil et liste des E/S | Limites: sans option */
test.describe('Critical path of a stay', { tag: '@smoke' }, () => {
	test('CRIT-01 · from an empty project to the first entry of a registered participant', async ({
		data,
		groupForm,
		movementsList,
		participantForm,
		projectForm,
		projectHome,
		registeredMovementForm,
	}) => {
		const suffix = uid();
		const participant = { firstName: 'Ada', lastName: `LOVELACE-${suffix}`, birthday: '10/12/2010' };
		const fullName = `${participant.firstName} ${participant.lastName}`;
		let projectId = '';

		await test.step('Create the project through the three-step form', async () => {
			projectId = await projectForm.create(`E2E stay ${suffix}`);
			data.track(projectId);
		});

		await test.step('Register a participant', async () => {
			await participantForm.create(projectId, participant);
		});

		await test.step('Create a group with this participant', async () => {
			await groupForm.create(projectId, `Pioneers ${suffix}`, [fullName]);
		});

		await test.step('Record the first entry of the participant', async () => {
			await registeredMovementForm.record(projectId, 'IN', [fullName]);
		});

		await test.step('The project dashboard counts the participant as present', async () => {
			await projectHome.goto(projectId);
			await expect(projectHome.participantStats).toHaveAccessibleName(
				'Inscrits présents 1 Inscrits en sortie 0 Invités présents 0',
			);
		});

		await test.step('The entry is listed in the movements of the project', async () => {
			await movementsList.goto(projectId);
			await expect(movementsList.rows).toHaveCount(1);
			await expect(movementsList.rows.first()).toContainText('Entrée');
		});
	});
});
