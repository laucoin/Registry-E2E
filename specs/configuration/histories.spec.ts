import { expect, test } from '@fixtures/test.fixture';
import { isoHoursAgo } from '@support/dates';
import { licensePlate, uid } from '@support/unique';

/** Objectif: Couvrir l'historique d'un véhicule et d'une activité | Périmètre: mouvements, frise, statistiques | Limites: valeurs des statistiques non recalculées */
test.describe('Histories', () => {
	test('VEH-04 · the history of a vehicle lists its own movements with its timeline and usage', async ({
		data,
		page,
		participantDetails: details,
		vehiclesList: list,
	}) => {
		const project = await data.project(['VEHICLE']);
		const plate = licensePlate();
		const vehicle = await data.vehicle(project.id, { licensePlate: plate });
		const [driver, other] = [await data.participant(project.id), await data.participant(project.id)];
		await data.participantMovement(project.id, { type: 'IN', participantIds: [driver.id], vehicleId: vehicle.id });
		await data.participantMovement(project.id, { type: 'IN', participantIds: [other.id] });

		await test.step('Open the history from the row', async () => {
			await list.goto(project.id);
			await list.primaryAction(plate).click();
			await expect(page).toHaveURL(new RegExp(`/vehicles/${vehicle.id}/movements`));
		});

		await test.step('Only the movement of the vehicle is listed, with the timeline and the usage', async () => {
			await expect(details.movementRows).toHaveCount(1);
			await expect(details.vehicleTimeline).toBeVisible();
			await expect(details.statistic('vehicle-statistics-usage-stat')).toContainText('%');
		});
	});

	test('ACT-04 · the history of an activity shows its participation and the hours spent out', async ({
		activitiesList: list,
		data,
		participantDetails: details,
	}) => {
		const project = await data.project(['ACTIVITY']);
		const name = `Orienteering ${uid()}`;
		const { id: activityId } = await data.activity(project.id, { name });
		const { id } = await data.participant(project.id);
		await data.participantMovement(project.id, { type: 'IN', participantIds: [id], dateTime: isoHoursAgo(5) });
		await data.participantMovement(project.id, {
			type: 'OUT',
			participantIds: [id],
			activityId,
			dateTime: isoHoursAgo(3),
		});
		await data.participantMovement(project.id, { type: 'IN', participantIds: [id], dateTime: isoHoursAgo(1) });

		await test.step('The statistics show the share of participants and the hours out', async () => {
			await list.goto(project.id);
			await list.primaryAction(name).click();
			await expect(details.statistic('activity-statistics-participation-stat')).toContainText('%');
			await expect(details.statistic('activity-statistics-movement-stat')).toBeVisible();
			await expect(details.statistic('activity-statistics-man-stat')).toBeVisible();
		});
	});
});
