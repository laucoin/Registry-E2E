import { expect, test } from '@fixtures/test.fixture';
import { authFile } from '@support/accounts';

/**
 * Objectif: Vérifier ce que la page de configuration montre selon les options et le rôle | Périmètre: informations,
 * bouton de modification, tuiles et compteurs, zone de danger | Limites: les pages ouvertes par les tuiles ont leurs tests.
 */
test.describe('Configuration seen by the project administrator', () => {
	test('CFG-01 · CFG-02 · VEH-01 · ACT-01 · the administrator sees every tile of the enabled options and the danger zone', async ({
		configuration,
		data,
		page,
	}) => {
		const project = await data.project(['VEHICLE', 'ACTIVITY']);
		await data.participant(project.id);

		await test.step('The information can be edited and the danger zone is shown', async () => {
			await configuration.goto(project.id);
			await expect(configuration.projectName).toContainText(project.name);
			await expect(configuration.editButton).toBeVisible();
			await expect(configuration.dangerZone).toBeVisible();
		});

		await test.step('Every tile is shown with its count, and opens its page', async () => {
			await expect(configuration.tiles).toHaveCount(5);
			await expect(configuration.tileCount('participants')).toHaveText('1');
			await configuration.tile('participants').click();
			await expect(page).toHaveURL(new RegExp(`/projects/${project.id}/configuration/participants`));
		});
	});

	test('VEH-01 · ACT-01 · without their option, the vehicles and activities tiles are hidden', async ({
		configuration,
		data,
	}) => {
		const project = await data.project();

		await test.step('Only the members, participants and groups tiles are shown', async () => {
			await configuration.goto(project.id);
			await expect(configuration.tiles).toHaveCount(3);
			await expect(configuration.tile('vehicles')).toHaveCount(0);
			await expect(configuration.tile('activities')).toHaveCount(0);
		});
	});
});

test.describe('Configuration seen by a project coordinator', () => {
	test.use({ storageState: authFile('coordinator') });

	test('CFG-01 · CFG-02 · a coordinator sees the vehicles and activities, but cannot edit nor delete the project', async ({
		configuration,
		data,
	}) => {
		const project = await data.project(['VEHICLE', 'ACTIVITY']);
		await data.invite(project.id, 'coordinator', 'PROJECT_COORDINATOR');

		await test.step('The tiles are shown, not the edition nor the danger zone', async () => {
			await configuration.goto(project.id);
			await expect(configuration.tile('vehicles')).toBeVisible();
			await expect(configuration.tile('activities')).toBeVisible();
			await expect(configuration.editButton).toHaveCount(0);
			await expect(configuration.dangerZone).toHaveCount(0);
		});
	});
});

test.describe('Configuration seen by a project participant', () => {
	test.use({ storageState: authFile('participant') });

	test('VEH-01 · ACT-01 · CFG-02 · a participant sees neither the vehicles, the activities nor the danger zone', async ({
		configuration,
		data,
	}) => {
		const project = await data.project(['VEHICLE', 'ACTIVITY']);
		await data.invite(project.id, 'participant', 'PROJECT_PARTICIPANT');

		await test.step('Only the participants and groups tiles are shown', async () => {
			await configuration.goto(project.id);
			await expect(configuration.tile('participants')).toBeVisible();
			await expect(configuration.tile('vehicles')).toHaveCount(0);
			await expect(configuration.tile('activities')).toHaveCount(0);
			await expect(configuration.dangerZone).toHaveCount(0);
		});
	});
});
