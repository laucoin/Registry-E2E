import { expect, test } from '@fixtures/test.fixture';
import { rejection } from '@support/api/problem';
import { isoHoursAgo } from '@support/dates';

/** Objectif: Vérifier des règles de cycle de vie côté backend | Périmètre: alerte résolue, cible d'une communication, profil de support | Limites: sans l'interface */
test.describe('Lifecycle rules', () => {
	test('ALR-06 · a resolved alert can no longer change, and a communication only targets an exit', async ({
		data,
	}) => {
		const project = await data.project(['ACTIVITY', 'COMMUNICATION', 'ALERT']);
		const alert = await data.alert(project.id);
		const { id } = await data.participant(project.id);
		const entry = await data.participantMovement(project.id, {
			type: 'IN',
			participantIds: [id],
			dateTime: isoHoursAgo(1),
		});
		const base = `/projects/${project.id}`;

		await test.step('A resolved alert cannot be edited', async () => {
			await data.api.send('PATCH', `${base}/alerts/${alert.id}/status/RESOLVED`);
			const edited = { title: 'Edited', dateTime: new Date().toISOString(), message: 'E2E' };
			const response = await data.api.raw('PATCH', `${base}/alerts/${alert.id}`, edited);
			expect(response.status()).toBeGreaterThanOrEqual(400);
		});

		await test.step('A communication cannot target an entry', async () => {
			const communication = { dateTime: new Date().toISOString(), message: 'E2E', movementId: entry.id };
			const response = await data.api.raw('POST', `${base}/communications`, communication);
			expect(await rejection(response)).toMatch(/COMMUNICATION_MOVEMENT_TYPE_NOT_OUT$/);
		});
	});

	test('PRF-07 · a support profile expires one hour after its creation', async ({ data }) => {
		const project = await data.projectAs('coordinator');

		await test.step('The support profile ends in about an hour', async () => {
			await data.api.send('POST', `/users/profiles/${project.id}/support`);
			const minutesLeft = ((await data.accessEndOf(project.id, 'administrator')) - Date.now()) / 60_000;
			expect(minutesLeft).toBeGreaterThan(55);
			expect(minutesLeft).toBeLessThanOrEqual(60);
		});
	});
});
