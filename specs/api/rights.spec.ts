import { expect, test } from '@fixtures/test.fixture';
import { rejection } from '@support/api/problem';

/**
 * Objectif: Vérifier que le backend refuse les opérations sensibles aux rôles qui n'y ont pas droit | Périmètre:
 * historique, activités, véhicules, restauration, suppression définitive, profils | Limites: la matrice complète est SEC-01.
 */
test.describe('Rights enforced by the backend', () => {
	test('SEC-02 · a project participant cannot read histories, activities or vehicles, restore, or delete permanently', async ({
		data,
	}) => {
		const project = await data.project(['VEHICLE', 'ACTIVITY']);
		await data.invite(project.id, 'participant', 'PROJECT_PARTICIPANT');
		const participant = await data.participant(project.id);
		const api = await data.apiAs('participant');
		const base = `/projects/${project.id}`;

		await test.step('Histories, activities and vehicles are forbidden', async () => {
			expect((await api.raw('GET', `${base}/participants/${participant.id}/movements`)).status()).toBe(403);
			expect((await api.raw('GET', `${base}/activities`)).status()).toBe(403);
			expect((await api.raw('GET', `${base}/vehicles`)).status()).toBe(403);
		});

		await test.step('Restoring and deleting permanently are forbidden', async () => {
			expect((await api.raw('POST', `${base}/participants/${participant.id}/enable`)).status()).toBe(403);
			expect((await api.raw('DELETE', `${base}/participants/${participant.id}`)).status()).toBe(403);
		});
	});

	test('SEC-02 · a project coordinator cannot delete permanently nor invite', async ({ data }) => {
		const project = await data.project();
		await data.invite(project.id, 'coordinator', 'PROJECT_COORDINATOR');
		const participant = await data.participant(project.id);
		const api = await data.apiAs('coordinator');
		const { email } = await data.userOf('participant');

		await test.step('Deleting permanently is forbidden', async () => {
			expect((await api.raw('DELETE', `/projects/${project.id}/participants/${participant.id}`)).status()).toBe(
				403,
			);
		});

		await test.step('Inviting a user is forbidden', async () => {
			const invitation = { emails: [email], role: 'PROJECT_PARTICIPANT' };
			expect((await api.raw('POST', `/projects/${project.id}/profiles`, invitation)).status()).toBe(403);
		});
	});

	test('SEC-05 · a project participant cannot change the user linked to a participant, only remove its own link', async ({
		data,
	}) => {
		const project = await data.project();
		await data.invite(project.id, 'participant', 'PROJECT_PARTICIPANT');
		const me = await data.userOf('participant');
		const other = await data.participant(project.id);
		const mine = await data.participant(project.id, { userId: me.id });
		const api = await data.apiAs('participant');
		const base = `/projects/${project.id}/participants`;
		const identity = { firstName: 'Ada', lastName: 'LOVELACE', birthday: '2000-01-01' };

		await test.step('Linking itself to another participant is forbidden', async () => {
			const response = await api.raw('PATCH', `${base}/${other.id}`, { ...identity, userId: me.id });
			expect(await rejection(response)).toBe('403 PARTICIPANT_USER_LINK_FORBIDDEN');
		});

		await test.step('Removing its own link is allowed', async () => {
			expect((await api.raw('PATCH', `${base}/${mine.id}`, identity)).status()).toBe(200);
			expect(await data.participantOf(project.id, mine.id)).not.toHaveProperty('user.id');
		});
	});

	test('SEC-03 · a change without a valid CSRF token is rejected', async ({ data }) => {
		const project = await data.project();
		const path = `/projects/${project.id}/participants`;
		const participant = { firstName: 'Ada', lastName: 'LOVELACE', birthday: '2000-01-01' };

		await test.step('Without a token', async () => {
			expect((await data.api.withoutCsrf('POST', path, participant)).status()).toBe(403);
		});

		await test.step('With an invalid token', async () => {
			const response = await data.api.raw('POST', path, participant, { 'X-XSRF-TOKEN': 'invalid' });
			expect(response.status()).toBe(403);
		});
	});
});
