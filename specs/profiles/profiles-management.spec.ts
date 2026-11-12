import { expect, test } from '@fixtures/test.fixture';
import { authFile } from '@support/accounts';
import { rejection } from '@support/api/problem';

/**
 * Objectif: Couvrir la gestion des membres d'un projet | Périmètre: refus d'une invitation, modification, blocage,
 * suppression | Limites: les comptes de départ ne sont modifiés que dans des projets créés pour le test.
 */
test.describe('Project members managed by the administrator', () => {
	test('PRF-03 · the edition only changes the role and the access range, and the last administrator stays one', async ({
		data,
		profilesList,
	}) => {
		const project = await data.project();
		await data.invite(project.id, 'coordinator', 'PROJECT_COORDINATOR');
		const coordinator = await data.userOf('coordinator');
		const ownProfileId = await data.profileIdOf(project.id, 'administrator');

		await test.step('The edition dialog holds the role and the access range only', async () => {
			await profilesList.gotoProject(project.id);
			await profilesList.menu(coordinator.lastName).run('edit');
			await expect(
				profilesList.editDialog.getByTestId('project-profile-edition-form-role-select'),
			).toHaveJSProperty('value', 'PROJECT_COORDINATOR');
			await expect(
				profilesList.editDialog.getByTestId('project-profile-edition-form-begin-date-time-picker'),
			).toBeVisible();
			await expect(
				profilesList.editDialog.getByTestId('project-profile-edition-form-end-date-time-picker'),
			).toBeVisible();
		});

		await test.step('The last project administrator cannot be demoted', async () => {
			const demoted = await data.api.raw('PATCH', `/projects/${project.id}/profiles/${ownProfileId}`, {
				role: 'PROJECT_PARTICIPANT',
			});
			expect(await rejection(demoted)).toMatch(/PROJECT_PROFILE_UPDATE_LAST_PROJECT_ADMINISTRATOR$/);
		});
	});

	test('PRF-04 · a blocked member loses access at once and gets it back once unblocked', async ({
		data,
		profilesList,
	}) => {
		const project = await data.project();
		await data.invite(project.id, 'coordinator', 'PROJECT_COORDINATOR');
		const coordinator = await data.userOf('coordinator');
		const access = async (): Promise<number> =>
			(await (await data.apiAs('coordinator')).raw('GET', `/projects/${project.id}/participants`)).status();

		await test.step('Block the member', async () => {
			await profilesList.gotoProject(project.id);
			await profilesList.runConfirmed(coordinator.lastName, 'block');
			await expect(profilesList.blockedTag(coordinator.lastName)).toBeVisible();
			await expect.poll(access).toBe(403);
		});

		await test.step('Unblock the member', async () => {
			await profilesList.runConfirmed(coordinator.lastName, 'unblock');
			await expect(profilesList.blockedTag(coordinator.lastName)).toHaveCount(0);
			await expect.poll(access).toBe(200);
		});
	});

	test('PRF-05 · a member is deleted after confirming, and deleting one own profile asks for a phrase', async ({
		data,
		profilesList,
	}) => {
		const project = await data.project();
		await data.invite(project.id, 'coordinator', 'PROJECT_COORDINATOR');
		const [administrator, coordinator] = [await data.userOf('administrator'), await data.userOf('coordinator')];

		await test.step('Delete another member', async () => {
			await profilesList.gotoProject(project.id);
			await profilesList.runConfirmed(coordinator.lastName, 'delete');
			await expect(profilesList.row(coordinator.lastName)).toHaveCount(0);
		});

		await test.step('Deleting one own profile stays disabled until the phrase is typed', async () => {
			await profilesList.menu(administrator.lastName).run('delete');
			await expect(profilesList.confirmation.confirmButton).toHaveAttribute('disabled');
			await profilesList.confirmation.cancel();
		});
	});
});

test.describe('Project members seen by a coordinator', () => {
	test.use({ storageState: authFile('coordinator') });

	test('PRF-04 · a coordinator does not see the blocked members', async ({ data, profilesList }) => {
		const project = await data.project();
		await data.invite(project.id, 'coordinator', 'PROJECT_COORDINATOR');
		await data.invite(project.id, 'participant', 'PROJECT_PARTICIPANT');
		await data.api.send(
			'POST',
			`/projects/${project.id}/profiles/${await data.profileIdOf(project.id, 'participant')}/block`,
		);
		const [administrator, participant] = [await data.userOf('administrator'), await data.userOf('participant')];

		await test.step('The blocked participant is not listed', async () => {
			await profilesList.gotoProject(project.id);
			await expect(profilesList.row(administrator.lastName)).toBeVisible();
			await expect(profilesList.row(participant.lastName)).toHaveCount(0);
		});
	});
});

test.describe('An invitation refused by the invited user', () => {
	test.use({ storageState: authFile('participant') });

	test('PRF-02 · an invitation gives no access before it is accepted, and can be refused', async ({
		data,
		profilesList,
	}) => {
		const project = await data.project();
		await data.invite(project.id, 'participant', 'PROJECT_PARTICIPANT', false);
		const access = async (): Promise<number> =>
			(await (await data.apiAs('participant')).raw('GET', `/projects/${project.id}/participants`)).status();

		await test.step('The pending invitation gives no access', async () => {
			expect(await access()).toBe(403);
		});

		await test.step('Refuse the invitation', async () => {
			await profilesList.gotoInvitations();
			await profilesList.reject(project.name);
			await expect(profilesList.acceptButton(project.name)).toHaveCount(0);
			expect(await access()).toBe(403);
		});
	});
});
