import { expect, test } from '@fixtures/test.fixture';
import { rejection } from '@support/api/problem';
import { epochOf, isoHoursAgo } from '@support/dates';

/**
 * Objectif: Vérifier les dates effectives d'arrivée et de départ calculées par le backend | Périmètre: entrées, sorties
 * définitives ou non, antidatées | Limites: un participant inscrit à la fois.
 */
test.describe('Effective dates of a participant', () => {
	// Chaque date est figée une fois : elle sert à la fois au mouvement et à l'attente.
	const [h1, h2, h3, h4, h5, h6, h8, h9, h10] = [1, 2, 3, 4, 5, 6, 8, 9, 10].map(isoHoursAgo);

	test('MVF-07 · the first entry sets the arrival, an earlier entry moves it, a definitive exit sets the departure', async ({
		data,
	}) => {
		const project = await data.project();
		const { id } = await data.participant(project.id);
		const entry = { type: 'IN' as const, participantIds: [id] };

		await test.step('The first entry sets the arrival', async () => {
			await data.participantMovement(project.id, { ...entry, dateTime: h5 });
			expect(epochOf((await data.participantOf(project.id, id)).effectiveArrival)).toBe(epochOf(h5));
		});

		await test.step('An earlier entry moves the arrival', async () => {
			await data.participantMovement(project.id, { ...entry, dateTime: h10 });
			expect(epochOf((await data.participantOf(project.id, id)).effectiveArrival)).toBe(epochOf(h10));
		});

		await test.step('A definitive exit sets the departure', async () => {
			await data.participantMovement(project.id, {
				type: 'OUT',
				participantIds: [id],
				reason: 'DEFINITIVE_DEPARTURE',
				dateTime: h1,
			});
			expect(epochOf((await data.participantOf(project.id, id)).effectiveDeparture)).toBe(epochOf(h1));
		});
	});

	test('MVF-07 · a definitive exit dated before later movements is refused', async ({ data }) => {
		const project = await data.project();
		const { id } = await data.participant(project.id);
		await data.participantMovement(project.id, { type: 'IN', participantIds: [id], dateTime: h5 });
		await data.participantMovement(project.id, {
			type: 'OUT',
			participantIds: [id],
			reason: 'SHOPPING',
			dateTime: h3,
		});

		await test.step('The definitive exit before the shopping is refused', async () => {
			const response = await data.tryParticipantMovement(project.id, {
				type: 'OUT',
				participantIds: [id],
				reason: 'DEFINITIVE_DEPARTURE',
				dateTime: h4,
			});
			expect(await rejection(response)).toBe('422 MOVEMENT_DEFINITIVE_DEPARTURE_BEFORE_LATER_MOVEMENTS');
		});
	});

	test('MVF-08 · after the departure, a later movement clears it, a definitive exit moves it, an earlier one keeps it', async ({
		data,
	}) => {
		const project = await data.project();
		const { id } = await data.participant(project.id);
		const departure = { type: 'OUT' as const, participantIds: [id], reason: 'DEFINITIVE_DEPARTURE' as const };
		await data.participantMovement(project.id, { type: 'IN', participantIds: [id], dateTime: h8 });
		await data.participantMovement(project.id, { ...departure, dateTime: h6 });

		await test.step('An entry after the departure clears it', async () => {
			await data.participantMovement(project.id, { type: 'IN', participantIds: [id], dateTime: h4 });
			expect(epochOf((await data.participantOf(project.id, id)).effectiveDeparture)).toBeNull();
		});

		await test.step('A new definitive exit sets the departure again', async () => {
			await data.participantMovement(project.id, { ...departure, dateTime: h2 });
			expect(epochOf((await data.participantOf(project.id, id)).effectiveDeparture)).toBe(epochOf(h2));
		});

		await test.step('An earlier entry does not change the departure', async () => {
			await data.participantMovement(project.id, { type: 'IN', participantIds: [id], dateTime: h9 });
			expect(epochOf((await data.participantOf(project.id, id)).effectiveDeparture)).toBe(epochOf(h2));
		});
	});
});
