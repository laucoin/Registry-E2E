import { expect, test } from '@fixtures/test.fixture';
import { rejection } from '@support/api/problem';
import { at, isoHoursAgo } from '@support/dates';

/**
 * Objectif: Vérifier les règles du backend sur les mouvements | Périmètre: dates acceptées, conducteur, disponibilités,
 * mouvement de fin de séjour | Limites: participants inscrits seulement.
 */
test.describe('Movement rules', () => {
	const inMinutes = (minutes: number): string => new Date(Date.now() + minutes * 60_000).toISOString();

	test('MVF-06 · a movement in the future, out of the project dates or driven by a minor is refused', async ({
		data,
	}) => {
		const project = await data.project(['VEHICLE']);
		const { id } = await data.participant(project.id);
		const minor = await data.participant(project.id, { birthday: '2015-01-01' });
		const vehicle = await data.vehicle(project.id);

		await test.step('One minute ahead is tolerated, five minutes ahead is refused', async () => {
			await data.participantMovement(project.id, { type: 'IN', participantIds: [id], dateTime: inMinutes(1) });
			const late = await data.tryParticipantMovement(project.id, {
				type: 'IN',
				participantIds: [minor.id],
				dateTime: inMinutes(5),
			});
			expect(await rejection(late)).toMatch(/MOVEMENT_DATETIME_IN_FUTURE$/);
		});

		await test.step('A movement before the project is refused', async () => {
			const early = await data.tryParticipantMovement(project.id, {
				type: 'IN',
				participantIds: [minor.id],
				dateTime: isoHoursAgo(24 * 40),
			});
			expect(await rejection(early)).toMatch(/MOVEMENT_DATETIME_OUT_OF_PROJECT_DATE_RANGE$/);
		});

		await test.step('A minor cannot be responsible for a vehicle', async () => {
			const driven = await data.tryParticipantMovement(project.id, {
				type: 'IN',
				participantIds: [minor.id],
				vehicleId: vehicle.id,
			});
			expect(await rejection(driven)).toMatch(/MOVEMENT_DRIVERS_NOT_MAJOR$/);
		});
	});
});

test.describe('Availability of the participants', () => {
	test('MVF-09 · the dates of the participant prevail, then those of a group, otherwise always available', async ({
		data,
	}) => {
		const project = await data.project();
		const now = new Date().toISOString();
		const own = await data.participant(project.id, { startAvailability: at(-1), endAvailability: at(1) });
		const grouped = await data.participant(project.id);
		const free = await data.participant(project.id);
		await data.group(project.id, [own.id, grouped.id], { startAvailability: at(2), endAvailability: at(4) });

		await test.step('Only the group dates make the grouped participant unavailable now', async () => {
			const available = await data.availableParticipantIds(project.id, now);
			expect([available.includes(own.id), available.includes(grouped.id), available.includes(free.id)]).toEqual([
				true,
				false,
				true,
			]);
		});
	});
});

test.describe('Movements ending a stay', () => {
	test('MVL-05 · a movement ending the stay is neither updated nor deleted, and a movement keeps its type', async ({
		data,
	}) => {
		const project = await data.project();
		const { id } = await data.participant(project.id);
		const entry = { type: 'IN', dateTime: isoHoursAgo(3), content: [{ participantId: id }] };
		const exit = {
			type: 'OUT',
			reason: 'DEFINITIVE_DEPARTURE',
			dateTime: isoHoursAgo(1),
			content: [{ participantId: id }],
		};
		const base = `/projects/${project.id}/movements`;
		const { id: entryId } = await data.api.send<{ id: string }>('POST', base, entry);
		const { id: exitId } = await data.api.send<{ id: string }>('POST', base, exit);

		await test.step('The definitive exit can be neither updated nor deleted', async () => {
			expect(await rejection(await data.api.raw('PATCH', `${base}/${exitId}`, exit))).toMatch(
				/MOVEMENT_CANNOT_BE_UPDATED$/,
			);
			expect(await rejection(await data.api.raw('DELETE', `${base}/${exitId}`))).toMatch(
				/MOVEMENT_CANNOT_BE_DELETED$/,
			);
		});

		await test.step('An entry cannot become an exit', async () => {
			const changed = { ...entry, type: 'OUT', reason: 'SHOPPING' };
			expect(await rejection(await data.api.raw('PATCH', `${base}/${entryId}`, changed))).toMatch(
				/MOVEMENT_UPDATE_CHANGE_TYPE$/,
			);
		});
	});
});
