import { expect, test } from '@fixtures/test.fixture';
import { licensePlate, uid } from '@support/unique';

/**
 * Objectif: Couvrir la suppression des éléments de la configuration | Périmètre: supprimer, restaurer, supprimer
 * définitivement, refus quand l'élément a des mouvements | Limites: en administrateur du projet.
 */
test.describe('Deleting participants and groups', () => {
	test('PAR-06 · a participant is deleted, restored then permanently deleted, unless they have movements', async ({
		data,
		participantsList: list,
	}) => {
		const project = await data.project();
		const free = `FREE-${uid().toUpperCase()}`;
		const moved = `MOVED-${uid().toUpperCase()}`;
		await data.participant(project.id, { lastName: free });
		const { id } = await data.participant(project.id, { lastName: moved });
		await data.participantMovement(project.id, { type: 'IN', participantIds: [id] });

		await test.step('Delete then restore', async () => {
			await list.goto(project.id);
			await list.runConfirmed(free, 'softDelete');
			await expect(list.hiddenTag(free)).toBeVisible();
			await list.runConfirmed(free, 'restore');
			await expect(list.hiddenTag(free)).toHaveCount(0);
		});

		await test.step('A participant with movements cannot be permanently deleted', async () => {
			await list.runConfirmed(moved, 'hardDelete');
			await expect(list.toasts.error).toBeVisible();
			await expect(list.row(moved).root).toBeVisible();
		});

		await test.step('A participant without movements is permanently deleted', async () => {
			await list.runConfirmed(free, 'hardDelete');
			await expect(list.row(free).root).toHaveCount(0);
		});
	});

	test('GRP-07 · a group is deleted, restored then permanently deleted', async ({ data, groupsList: list }) => {
		const project = await data.project();
		const name = `Wolves ${uid()}`;
		await data.group(project.id, [], { name });

		await test.step('Delete, restore, then delete permanently', async () => {
			await list.goto(project.id);
			await list.runConfirmed(name, 'softDelete');
			await expect(list.hiddenTag(name)).toBeVisible();
			await list.runConfirmed(name, 'restore');
			await expect(list.hiddenTag(name)).toHaveCount(0);
			await list.runConfirmed(name, 'hardDelete');
			await expect(list.row(name).root).toHaveCount(0);
		});
	});
});

test.describe('Deleting vehicles and activities', () => {
	test('VEH-03 · a vehicle is deleted, restored then permanently deleted, unless it has movements', async ({
		data,
		vehiclesList: list,
	}) => {
		const project = await data.project(['VEHICLE']);
		const [free, used] = [licensePlate(), licensePlate()];
		await data.vehicle(project.id, { licensePlate: free });
		const vehicle = await data.vehicle(project.id, { licensePlate: used });
		const { id } = await data.participant(project.id);
		await data.participantMovement(project.id, { type: 'IN', participantIds: [id], vehicleId: vehicle.id });

		await test.step('Delete then restore', async () => {
			await list.goto(project.id);
			await list.runConfirmed(free, 'softDelete');
			await expect(list.hiddenTag(free)).toBeVisible();
			await list.runConfirmed(free, 'restore');
			await expect(list.hiddenTag(free)).toHaveCount(0);
		});

		await test.step('A vehicle with movements cannot be permanently deleted, another one can', async () => {
			await list.runConfirmed(used, 'hardDelete');
			await expect(list.toasts.error).toBeVisible();
			await list.runConfirmed(free, 'hardDelete');
			await expect(list.row(free).root).toHaveCount(0);
		});
	});

	test('ACT-03 · an activity is deleted, restored then permanently deleted, unless it has movements', async ({
		data,
		activitiesList: list,
	}) => {
		const project = await data.project(['ACTIVITY']);
		const [free, used] = [`Climbing ${uid()}`, `Rafting ${uid()}`];
		await data.activity(project.id, { name: free });
		const activity = await data.activity(project.id, { name: used });
		const { id } = await data.participant(project.id);
		await data.participantMovement(project.id, { type: 'IN', participantIds: [id] });
		await data.participantMovement(project.id, { type: 'OUT', participantIds: [id], activityId: activity.id });

		await test.step('Delete then restore', async () => {
			await list.goto(project.id);
			await list.runConfirmed(free, 'softDelete');
			await expect(list.hiddenTag(free)).toBeVisible();
			await list.runConfirmed(free, 'restore');
			await expect(list.hiddenTag(free)).toHaveCount(0);
		});

		await test.step('An activity with movements cannot be permanently deleted, another one can', async () => {
			await list.runConfirmed(used, 'hardDelete');
			await expect(list.toasts.error).toBeVisible();
			await list.runConfirmed(free, 'hardDelete');
			await expect(list.row(free).root).toHaveCount(0);
		});
	});
});
