import { expect, test } from '@fixtures/test.fixture';
import { rejection } from '@support/api/problem';
import { isoDate, isoHoursAgo } from '@support/dates';

/** Objectif: Vérifier les règles du backend sur les projets | Périmètre: dates du projet, profil de support | Limites: sans l'interface */
test.describe('Project rules', () => {
	test('PRJ-05 · narrowing the dates of a project so that they exclude existing movements is refused', async ({
		data,
	}) => {
		const project = await data.project();
		const { id } = await data.participant(project.id);
		await data.participantMovement(project.id, {
			type: 'IN',
			participantIds: [id],
			dateTime: isoHoursAgo(24 * 10),
		});

		await test.step('The project can no longer begin after the movement', async () => {
			const narrowed = {
				name: project.name,
				begin: { date: isoDate(-5) },
				end: { date: isoDate(30) },
				options: [],
			};
			const response = await data.api.raw('PATCH', `/projects/${project.id}`, narrowed);
			expect(await rejection(response)).toMatch(/PROJECT_DATE_CONFLICT_WITH_ELEMENTS$/);
		});
	});

	test('PL-05 · a plain user cannot create a support profile', async ({ data }) => {
		const project = await data.projectAs('participant');
		const api = await data.apiAs('coordinator');

		await test.step('The backend refuses the support profile', async () => {
			expect((await api.raw('POST', `/users/profiles/${project.id}/support`)).status()).toBe(403);
		});
	});
});
