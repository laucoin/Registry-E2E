import { expect, test } from '@fixtures/test.fixture';
import { authFile } from '@support/accounts';

/** Objectif: Couvrir l'invitation dans un projet | Périmètre: inviter, voir l'invitation en attente, l'accepter | Limites: invitation d'un utilisateur existant */
test.describe('Inviting a user', () => {
	test('PRF-01 · a project administrator invites a user with a required role', async ({
		data,
		profileInvitationForm: form,
		profilesList,
	}) => {
		const project = await data.project();
		const invitee = await data.userOf('participant');

		await test.step('The role is required', async () => {
			await form.open(project.id);
			await form.chooseUser(invitee.email);
			await form.inviteRejected();
			await expect(form.role).toHaveAttribute('error', /.+/);
		});

		await test.step('The invited user is listed as invited', async () => {
			await form.chooseRole('Participant');
			await form.invite();
			await profilesList.gotoProject(project.id);
			await expect(profilesList.status(invitee.lastName)).toHaveText('Invité');
		});
	});
});

test.describe('An invitation seen by another member', () => {
	test.use({ storageState: authFile('coordinator') });

	test('PRF-01 · another member sees the invitation pending', async ({ data, profilesList }) => {
		const project = await data.project();
		await data.invite(project.id, 'coordinator', 'PROJECT_COORDINATOR');
		await data.invite(project.id, 'participant', 'PROJECT_PARTICIPANT', false);
		const invitee = await data.userOf('participant');

		await test.step('The invitation is pending, without answer buttons for them', async () => {
			await profilesList.gotoProject(project.id);
			await expect(profilesList.status(invitee.lastName)).toHaveText('Invité');
			await expect(profilesList.acceptButton(invitee.lastName)).toHaveCount(0);
		});
	});
});

test.describe('An invitation answered by the invited user', () => {
	test.use({ storageState: authFile('participant') });

	test('PRF-01 · the invited user accepts from their invitations after confirming', async ({
		data,
		profilesList,
	}) => {
		const project = await data.project();
		await data.invite(project.id, 'participant', 'PROJECT_PARTICIPANT', false);

		await test.step('Accept the invitation', async () => {
			await profilesList.gotoInvitations();
			await profilesList.accept(project.name);
		});

		await test.step('The invitation no longer waits for an answer', async () => {
			await expect(profilesList.acceptButton(project.name)).toHaveCount(0);
		});
	});
});
