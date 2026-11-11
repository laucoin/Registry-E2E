import { expect, test } from '@fixtures/test.fixture';

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
